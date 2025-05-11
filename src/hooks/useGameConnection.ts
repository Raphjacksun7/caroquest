"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, PlayerId, StoredPlayer, GameOptions } from '@/lib/types'; 
import { create } from 'zustand';
import { deserializeGameState } from '@/lib/serialization'; 
import { applyDeltaUpdatesToGameState } from '@/lib/clientUtils'; 
import { assignPlayerColors, PAWNS_PER_PLAYER, createInitialGameState as createClientInitialGameState } from '@/lib/gameLogic';
import LZString from 'lz-string';

export interface GameStoreState {
  gameState: GameState | null;
  localPlayerId: PlayerId | null; 
  opponentName: string | null;
  gameId: string | null;
  error: string | null;
  isConnected: boolean;
  isConnecting: boolean; 
  isWaitingForOpponent: boolean;
  pingLatency: number;
  players: StoredPlayer[]; 
  setGameState: (state: GameState | null) => void;
  setError: (error: string | null) => void;
  applyDeltaUpdates: (updates: any[], seqId?: number) => void; 
  setPlayers: (players: StoredPlayer[]) => void;
  setGameId: (gameId: string | null) => void;
  setLocalPlayerId: (playerId: PlayerId | null) => void;
  setOpponentName: (name: string | null) => void;
  setIsConnected: (connected: boolean) => void;
  setIsConnecting: (connecting: boolean) => void; 
  setIsWaitingForOpponent: (waiting: boolean) => void;
  setPingLatency: (latency: number) => void;
  clearStore: () => void; 
  resetForNewGame: () => void; 
}


const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: null,
  localPlayerId: null,
  opponentName: null,
  gameId: null,
  error: null,
  isConnected: false,
  isConnecting: false,
  isWaitingForOpponent: false,
  pingLatency: 0,
  players: [],
  setGameState: (gameState) => {
    if (gameState) {
      const hydratedState: GameState = {
        ...gameState,
        playerColors: gameState.playerColors || assignPlayerColors(),
        blockedPawnsInfo: new Set(Array.from(gameState.blockedPawnsInfo || [])),
        blockingPawnsInfo: new Set(Array.from(gameState.blockingPawnsInfo || [])),
        deadZoneSquares: new Map((Array.isArray(gameState.deadZoneSquares) ? gameState.deadZoneSquares : Object.entries(gameState.deadZoneSquares || {})).map(([k,v]:[string | number, PlayerId]) => [Number(k),v])),
        deadZoneCreatorPawnsInfo: new Set(Array.from(gameState.deadZoneCreatorPawnsInfo || [])),
        pawnsToPlace: gameState.pawnsToPlace || {1: PAWNS_PER_PLAYER, 2: PAWNS_PER_PLAYER},
        placedPawns: gameState.placedPawns || {1:0, 2:0}
      };
      set({ gameState: hydratedState });
    } else {
      set({ gameState: null });
    }
  },
  setError: (error) => set({ error, isWaitingForOpponent: false, isConnecting: false }), 
  applyDeltaUpdates: (updates, seqId) => { 
    const currentState = get().gameState;
    if (!currentState) return;
    
    const newState = applyDeltaUpdatesToGameState(currentState, updates); 
    
    set({ gameState: {
        ...newState, 
      } 
    });
  },
  setPlayers: (players) => set({ players }),
  setGameId: (gameId) => set({ gameId }),
  setLocalPlayerId: (playerId) => set({ localPlayerId: playerId }),
  setOpponentName: (name) => set({ opponentName: name }),
  setIsConnected: (connected) => set( (state) => ({ isConnected: connected, isConnecting: state.isConnecting && connected ? false : state.isConnecting }) ),
  setIsConnecting: (connecting) => set({ isConnecting: connecting }),
  setIsWaitingForOpponent: (waiting) => set({ isWaitingForOpponent: waiting }),
  setPingLatency: (latency) => set({ pingLatency: latency }),
  clearStore: () => set({
    gameState: null, localPlayerId: null, opponentName: null, gameId: null, error: null,
    isConnecting: false, isWaitingForOpponent: false, pingLatency: 0, players: [],
  }),
  resetForNewGame: () => set({ 
    gameState: createClientInitialGameState(), 
    localPlayerId: null, opponentName: null, gameId: null, error: null,
    isWaitingForOpponent: false, pingLatency: 0, players: [],
  }),
}));

// Helper function to convert string of char codes back to Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    arr[i] = str.charCodeAt(i);
  }
  return arr;
}


export function useGameConnection() {
  const socketRef = useRef<Socket | null>(null);
  const lastPingSent = useRef<number | null>(null);
  const serverTimeOffset = useRef<number>(0);

  const {
    gameState, localPlayerId, opponentName, gameId, error,
    isConnected, isConnecting, isWaitingForOpponent, pingLatency, players,
    setGameState, setError, applyDeltaUpdates: storeApplyDeltaUpdates, setPlayers,
    setGameId, setLocalPlayerId, setOpponentName, setIsConnected,
    setIsConnecting, setIsWaitingForOpponent, setPingLatency,
    clearStore, resetForNewGame
  } = useGameStore();

  const syncTime = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) return;
    lastPingSent.current = Date.now();
    socketRef.current.emit('ping_time');
  }, []); 

  const connectSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      setIsConnected(true);
      return Promise.resolve(socketRef.current);
    }
    if (isConnecting) {
      return Promise.reject(new Error("Connection attempt in progress."));
    }

    setIsConnecting(true);
    setError(null);

    const socketUrl = typeof window !== 'undefined' ? 
                      (process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin) : 
                      (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000');
    
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      upgrade: false, 
      pingInterval: 25000,
      pingTimeout: 5000,
      reconnectionAttempts: 3, 
    });
    socketRef.current = newSocket;

    return new Promise<Socket>((resolve, reject) => {
        newSocket.on('connect', () => {
            console.log('Socket.IO: Connected to game server with ID:', newSocket.id);
            setIsConnected(true);
            setIsConnecting(false);
            syncTime();
            resolve(newSocket);
        });
        
        newSocket.on('disconnect', (reason) => {
            console.log('Socket.IO: Disconnected from game server:', reason);
            setIsConnected(false);
            setIsConnecting(false);
            if (reason !== 'io client disconnect' && reason !== 'io server disconnect') { 
                setError(`Disconnected: ${reason}. Please check your connection or try again.`);
            }
        });
        
        newSocket.on('connect_error', (err) => {
            console.error('Socket.IO: Connection error:', err.message, err.name);
            const errorMessage = err.message.includes('xhr poll error') || err.message.includes('websocket error') 
                ? 'Failed to connect to the game server. The server might be unavailable or a network issue occurred.'
                : `Connection failed: ${err.message}. Please try again.`;
            setError(errorMessage);
            setIsConnected(false); 
            setIsConnecting(false);
            reject(err);
        });
    });
  }, [isConnecting, setIsConnected, setIsConnecting, setError, syncTime]); 

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        console.log("Socket.IO: Disconnecting socket from useGameConnection cleanup.");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); 

  useEffect(() => {
    const currentSocket = socketRef.current;
    if (!currentSocket || !isConnected) return;

    const handlePongTime = (serverTime: number) => {
      if (lastPingSent.current) {
        const now = Date.now();
        const roundTripTime = now - lastPingSent.current;
        setPingLatency(roundTripTime);
        serverTimeOffset.current = serverTime - (now - roundTripTime / 2);
        setTimeout(syncTime, 30000);
      }
    };
    
    const handleSerializedState = (compressedStateAsArray: number[], origin: string): GameState | null => {
      try {
        if (!Array.isArray(compressedStateAsArray)) {
            throw new Error("Received game state is not an array as expected.");
        }
        const compressedUint8Array = new Uint8Array(compressedStateAsArray);
        const decompressedBinaryString = LZString.decompressFromUint8Array(compressedUint8Array);
        if (decompressedBinaryString === null) {
            throw new Error("LZString decompression returned null.");
        }
        const originalBinaryUint8Array = stringToUint8Array(decompressedBinaryString);
        const deserialized = deserializeGameState(originalBinaryUint8Array); 
        
        if (typeof deserialized !== 'object' || deserialized === null) {
            throw new Error("Deserialized game state is not a valid object.");
        }
        return deserialized;
      } catch (error: any) {
        console.error(`Error processing serialized game state from ${origin}:`, error);
        setError(`Failed to process game data from ${origin}: ${error.message}`);
        return null;
      }
    };
    
    const handleGameCreated = ({ gameId: newGameId, playerId: newPlayerId, gameState: compressedArr, players: newPlayers, timestamp }: { gameId: string; playerId: PlayerId; gameState: number[]; players: StoredPlayer[], timestamp: number }) => {
      const decodedState = handleSerializedState(compressedArr, 'game_created');
      if (decodedState) {
        setGameId(newGameId);
        setLocalPlayerId(newPlayerId);
        setGameState(decodedState);
        setPlayers(newPlayers);
        setIsWaitingForOpponent(newPlayers.filter(p=>p.isConnected).length < 2);
        setError(null);
      }
    };

    const handleGameJoined = ({ gameId: joinedGameId, playerId: joinedPlayerId, gameState: compressedArr, players: joinedPlayers, opponentName: joinedOpponentName, timestamp }: { gameId: string; playerId: PlayerId; gameState: number[]; players: StoredPlayer[], opponentName: string | null, timestamp: number }) => {
       const decodedState = handleSerializedState(compressedArr, 'game_joined');
       if (decodedState) {
        setGameId(joinedGameId);
        setLocalPlayerId(joinedPlayerId);
        setGameState(decodedState);
        setPlayers(joinedPlayers);
        setOpponentName(joinedOpponentName);
        setIsWaitingForOpponent(joinedPlayers.filter(p=>p.isConnected).length < 2 && !joinedOpponentName);
        setError(null);
      }
    };

    const handleOpponentJoined = ({ opponentName: newOpponentName, players: updatedPlayers, timestamp }: { opponentName: string; players: StoredPlayer[], timestamp: number}) => {
        setOpponentName(newOpponentName);
        setPlayers(updatedPlayers);
        setIsWaitingForOpponent(false);
        setError(null);
    };
    
    const handleGameStart = ({ gameState: compressedArr, players: gameStartPlayers, timestamp }: { gameState: number[]; players: StoredPlayer[], timestamp: number }) => {
        const decodedState = handleSerializedState(compressedArr, 'game_start');
        if (decodedState) {
            setGameState(decodedState);
            setPlayers(gameStartPlayers);
            setIsWaitingForOpponent(false);
            setError(null);
        }
    };
    
    const handleGameUpdated = ({ gameState: compressedArr, timestamp, fullUpdate }: { gameState: number[]; timestamp: number; fullUpdate?: boolean}) => {
        const decodedState = handleSerializedState(compressedArr, 'game_updated (full)');
        if (decodedState) {
            setGameState(decodedState);
            setError(null);
        }
    };

    const handleGameDelta = ({ updates, seqId, timestamp }: { updates: any[]; seqId: number; timestamp: number }) => {
        try {
            storeApplyDeltaUpdates(updates, seqId);
            setError(null);
        } catch (error: any) {
            console.error('Error processing game_delta:', error);
            setError(`Failed to apply update: ${error.message}. Requesting full state.`);
            if (socketRef.current && gameId) { 
              socketRef.current.emit('request_full_state', { gameId });
            }
        }
    };
    
    const handleOpponentDisconnected = ({ playerName, playerId: disconnectedPlayerId, remainingPlayers, timestamp }: { playerName: string; playerId: PlayerId; remainingPlayers: StoredPlayer[], timestamp: number }) => {
        setError(`${playerName} has disconnected. Waiting for them to rejoin or for a new opponent.`);
        setPlayers(remainingPlayers);
        if(localPlayerId !== disconnectedPlayerId) { 
            setOpponentName(null); 
        }
        setIsWaitingForOpponent(true); 
    };

    const handleGameError = ({ message }: { message: string}) => {
        console.warn("Received game_error from server:", message);
        setError(message);
    };

    const handleMatchmakingJoined = ({ message, position }: { message: string, position?: number }) => {
      console.log("Matchmaking: Joined queue.", message, position ? `Position: ${position}` : '');
      setError(null); 
    };
    const handleMatchmakingLeft = ({ message }: { message: string}) => {
      console.log("Matchmaking: Left queue.", message);
    };
    const handleMatchFound = ({ gameId: newGameId, opponentName: newOpponentName, assignedPlayerId }: { gameId: string, opponentName: string, assignedPlayerId: PlayerId }) => {
      console.log(`Matchmaking: Match found! Game ID: ${newGameId}, Opponent: ${newOpponentName}, Your PlayerID: ${assignedPlayerId}`);
      setGameId(newGameId);
      setLocalPlayerId(assignedPlayerId);
      setOpponentName(newOpponentName);
      setIsWaitingForOpponent(false); 
      if (typeof window !== 'undefined') {
         window.location.href = `/game/${newGameId}`; 
      }
    };

    currentSocket.on('pong_time', handlePongTime);
    currentSocket.on('game_created', handleGameCreated);
    currentSocket.on('game_joined', handleGameJoined);
    currentSocket.on('opponent_joined', handleOpponentJoined);
    currentSocket.on('game_start', handleGameStart);
    currentSocket.on('game_updated', handleGameUpdated);
    currentSocket.on('game_delta', handleGameDelta);
    currentSocket.on('opponent_disconnected', handleOpponentDisconnected);
    currentSocket.on('game_error', handleGameError);
    currentSocket.on('matchmaking_joined', handleMatchmakingJoined);
    currentSocket.on('matchmaking_left', handleMatchmakingLeft);
    currentSocket.on('match_found', handleMatchFound);

    return () => {
      currentSocket.off('pong_time', handlePongTime);
      currentSocket.off('game_created', handleGameCreated);
      currentSocket.off('game_joined', handleGameJoined);
      currentSocket.off('opponent_joined', handleOpponentJoined);
      currentSocket.off('game_start', handleGameStart);
      currentSocket.off('game_updated', handleGameUpdated);
      currentSocket.off('game_delta', handleGameDelta);
      currentSocket.off('opponent_disconnected', handleOpponentDisconnected);
      currentSocket.off('game_error', handleGameError);
      currentSocket.off('matchmaking_joined', handleMatchmakingJoined);
      currentSocket.off('matchmaking_left', handleMatchmakingLeft);
      currentSocket.off('match_found', handleMatchFound);
    };
  }, [
      isConnected, 
      syncTime, 
      setPingLatency, setError, setGameState, setPlayers, setGameId, 
      setLocalPlayerId, setOpponentName, setIsWaitingForOpponent, storeApplyDeltaUpdates,
      gameId, localPlayerId 
    ]
  ); 
  
  const getAdjustedTime = useCallback(() => {
    return Date.now() + serverTimeOffset.current;
  }, []);
  
  const createGame = useCallback(async (playerName: string, options: GameOptions = {}) => {
    resetForNewGame();
    try {
      const currentSocket = await connectSocket(); 
      currentSocket.emit('create_game', { playerName, options, clientTimestamp: getAdjustedTime() });
    } catch (err: any) {
      setError(`Failed to create game: ${err.message || 'Connection error'}`);
    }
  }, [connectSocket, getAdjustedTime, resetForNewGame, setError]);
  
  const joinGame = useCallback(async (gameIdToJoin: string, playerName: string) => {
    resetForNewGame();
    try {
      const currentSocket = await connectSocket();
      setGameId(gameIdToJoin); 
      currentSocket.emit('join_game', { gameId: gameIdToJoin, playerName, clientTimestamp: getAdjustedTime() });
    } catch (err: any) {
      setError(`Failed to join game: ${err.message || 'Connection error'}`);
    }
  }, [connectSocket, getAdjustedTime, resetForNewGame, setGameId, setError]);
  
  const placePawnAction = useCallback((squareIndex: number) => { 
    if (!socketRef.current || !gameId || !socketRef.current.connected) { 
        setError("Not connected to server or no game ID."); return; 
    }
    socketRef.current.emit('place_pawn', { gameId, squareIndex, clientTimestamp: getAdjustedTime() });
  }, [gameId, getAdjustedTime, setError]);
  
  const movePawnAction = useCallback((fromIndex: number, toIndex: number) => { 
    if (!socketRef.current || !gameId || !socketRef.current.connected) { 
        setError("Not connected to server or no game ID."); return; 
    }
    socketRef.current.emit('move_pawn', { gameId, fromIndex, toIndex, clientTimestamp: getAdjustedTime() });
  }, [gameId, getAdjustedTime, setError]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      setIsConnected(false); 
      setIsConnecting(false); 
    }
  }, [setIsConnected, setIsConnecting]); 

  const joinMatchmakingQueue = useCallback(async (playerName: string, rating?: number) => {
    if (!playerName || playerName.trim() === "") {
        setError("Player name is required to join matchmaking.");
        return;
    }
    try {
        const currentSocket = await connectSocket();
        currentSocket.emit('join_matchmaking', { playerName, rating, clientTimestamp: getAdjustedTime() });
    } catch (err: any) {
        setError(`Failed to join matchmaking: ${err.message || 'Connection error'}`);
    }
  }, [connectSocket, getAdjustedTime, setError]);

  const leaveMatchmakingQueue = useCallback(async () => {
    try {
        const currentSocket = await connectSocket(); 
        currentSocket.emit('leave_matchmaking', { clientTimestamp: getAdjustedTime() });
    } catch (err: any) {
        setError(`Failed to leave matchmaking: ${err.message || 'Connection error'}`);
    }
  }, [connectSocket, getAdjustedTime, setError]);
  
  return {
    gameState, localPlayerId, opponentName, gameId, error,
    isConnected, isConnecting, isWaitingForOpponent, pingLatency, players,
    createGame, joinGame, placePawnAction, movePawnAction,
    clearError, disconnect, connect: connectSocket,
    joinMatchmakingQueue, leaveMatchmakingQueue,
  };
}

export { useGameStore };