
"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, PlayerId, StoredPlayer, GameOptions } from '@/lib/types';
import { createStore } from 'zustand/vanilla'; // Changed from 'zustand' to 'zustand/vanilla'
import { useStore } from 'zustand'; // For using the vanilla store in React components
import { deserializeGameState } from '@/lib/serialization';
import { applyDeltaUpdatesToGameState } from '@/lib/clientUtils';
import { createInitialGameState, PAWNS_PER_PLAYER, assignPlayerColors, BOARD_SIZE } from '@/lib/gameLogic';
import LZString from 'lz-string';

export type { StoredPlayer }; 

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
}

export interface GameStoreActions {
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
  resetForNewGame: (options?: GameOptions) => void;
}

export type FullGameStore = GameStoreState & GameStoreActions;

const initialGameState: GameState = createInitialGameState({ pawnsPerPlayer: PAWNS_PER_PLAYER});

const initialStoreState: GameStoreState = {
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
};

export const gameStore = createStore<FullGameStore>()((set, get) => ({
  ...initialStoreState,
  setGameState: (gameState) => {
    if (gameState) {
      const currentOptions = gameState.options || { pawnsPerPlayer: PAWNS_PER_PLAYER };
      const pawnsPerPlayer = currentOptions.pawnsPerPlayer || PAWNS_PER_PLAYER;
      
      const hydratedState: GameState = {
        ...gameState,
        board: gameState.board && gameState.board.length === BOARD_SIZE * BOARD_SIZE 
               ? gameState.board 
               : createInitialGameState(currentOptions).board,
        playerColors: gameState.playerColors || assignPlayerColors(),
        blockedPawnsInfo: new Set(Array.from(gameState.blockedPawnsInfo || [])),
        blockingPawnsInfo: new Set(Array.from(gameState.blockingPawnsInfo || [])),
        deadZoneSquares: new Map((Array.isArray(gameState.deadZoneSquares) ? gameState.deadZoneSquares : Object.entries(gameState.deadZoneSquares || {})).map(([k,v]:[string | number, PlayerId]) => [Number(k),v])),
        deadZoneCreatorPawnsInfo: new Set(Array.from(gameState.deadZoneCreatorPawnsInfo || [])),
        pawnsToPlace: gameState.pawnsToPlace || {1: pawnsPerPlayer, 2: pawnsPerPlayer},
        placedPawns: gameState.placedPawns || {1:0, 2:0},
        highlightedValidMoves: gameState.highlightedValidMoves || [],
        options: currentOptions,
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
    const newState = applyDeltaUpdatesToGameState(currentState, updates, seqId);
    set({ gameState: { ...newState } }); 
  },
  setPlayers: (players) => set({ players }),
  setGameId: (gameId) => set({ gameId }),
  setLocalPlayerId: (playerId) => set({ localPlayerId: playerId }),
  setOpponentName: (name) => set({ opponentName: name }),
  setIsConnected: (connected) => set( (state) => ({ isConnected: connected, isConnecting: state.isConnecting && connected ? false : state.isConnecting }) ),
  setIsConnecting: (connecting) => set({ isConnecting: connecting }),
  setIsWaitingForOpponent: (waiting) => set({ isWaitingForOpponent: waiting }),
  setPingLatency: (latency) => set({ pingLatency: latency }),
  clearStore: () => set({ ...initialStoreState }),
  resetForNewGame: (options) => set(() => {
    return {
      ...initialStoreState, // Reset all state parts
      gameState: createInitialGameState(options), 
    }
  }),
}));

// Custom hook to use the vanilla store
export function useGameStore<T>(selector: (state: FullGameStore) => T): T {
    return useStore(gameStore, selector);
}


export function useGameConnection() {
  const socketRef = useRef<Socket | null>(null);
  const lastPingSent = useRef<number | null>(null);
  const serverTimeOffset = useRef<number>(0);

  const {
    setGameState, setError, applyDeltaUpdates: storeApplyDeltaUpdates, setPlayers,
    setGameId, setLocalPlayerId, setOpponentName, setIsConnected,
    setIsConnecting, setIsWaitingForOpponent, setPingLatency,
    clearStore, resetForNewGame
  } = gameStore.getState(); // Get actions directly from vanilla store

  // Use useGameStore hook for reactive state access
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const opponentName = useGameStore(state => state.opponentName);
  const gameId = useGameStore(state => state.gameId);
  const error = useGameStore(state => state.error);
  const isConnected = useGameStore(state => state.isConnected);
  const isConnecting = useGameStore(state => state.isConnecting);
  const isWaitingForOpponent = useGameStore(state => state.isWaitingForOpponent);
  const pingLatency = useGameStore(state => state.pingLatency);
  const players = useGameStore(state => state.players);

  const socketUrl = useMemo(() => process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : ''), []);


  const syncTime = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      lastPingSent.current = Date.now();
      socketRef.current.emit('ping_time');
    }
  }, []);

  const connectSocketIO = useCallback((): Promise<Socket> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        console.warn("CLIENT: Socket.IO connection attempt outside browser environment.");
        reject(new Error("Socket.IO can only be used in a browser environment."));
        return;
      }

      if (socketRef.current && socketRef.current.connected) {
        console.log("CLIENT: Socket.IO: Already connected.");
        resolve(socketRef.current);
        return;
      }
      if (gameStore.getState().isConnecting) { 
        console.log("CLIENT: Socket.IO: Connection attempt already in progress (store).");
        const checkConnectionInterval = setInterval(() => {
          if (socketRef.current?.connected) {
            clearInterval(checkConnectionInterval);
            resolve(socketRef.current);
          } else if (!gameStore.getState().isConnecting) { 
            clearInterval(checkConnectionInterval);
            reject(new Error(gameStore.getState().error || "Previous connection attempt failed."));
          }
        }, 100);
        return;
      }
      
      console.log('CLIENT: Socket.IO: Attempting to connect to:', socketUrl);

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.removeAllListeners();
      }
      
      const newSocket = io(socketUrl, {
        // transports: ['websocket'], // Allow Socket.IO to negotiate transport
        reconnectionAttempts: 3, 
        reconnectionDelay: 2000, 
        reconnectionDelayMax: 10000, 
        timeout: 15000, 
        path: "/api/socketio/", 
        autoConnect: false, 
      });
      socketRef.current = newSocket;

      setIsConnecting(true);
      setError(null);

      const connectionTimeoutId = setTimeout(() => {
        if (newSocket && !newSocket.connected) { 
          console.error('CLIENT: Socket.IO: Explicit connection timeout after 15s.');
          const timeoutError = 'Socket.IO: Connection timeout. Server may be unavailable or a network issue is preventing connection.';
          setError(timeoutError);
          setIsConnected(false);
          setIsConnecting(false);
          newSocket.disconnect();
          reject(new Error(timeoutError));
        }
      }, 15000); 


      newSocket.on('connect', () => {
        clearTimeout(connectionTimeoutId);
        console.log('CLIENT: Socket.IO: Connected with ID:', newSocket.id);
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        syncTime();
        resolve(newSocket);
      });

      newSocket.on('connect_error', (err) => {
        clearTimeout(connectionTimeoutId);
        console.error('CLIENT: Socket.IO: Connection error:', err.message, err.name, err.cause);
        let detailedError = `Socket.IO: Connection error: "${err.message}".`;
        if (err.message === 'xhr poll error' || err.message === 'websocket error') {
          detailedError += ' This often indicates the server is unreachable or there is a CORS issue.';
        }
        setError(detailedError);
        setIsConnected(false);
        setIsConnecting(false);
        reject(new Error(detailedError));
      });

      newSocket.on('disconnect', (reason) => {
        clearTimeout(connectionTimeoutId);
        console.log('CLIENT: Socket.IO: Disconnected:', reason);
        setIsConnected(false);
        setIsConnecting(false);
        if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
          setError(`Disconnected: ${reason}.`);
        } else {
          setError(null); 
        }
      });
      
      newSocket.connect(); 
    });
  }, [setIsConnecting, setError, setIsConnected, syncTime, socketUrl]);
  
  useEffect(() => {
    const currentSocket = socketRef.current;
    if (!currentSocket) return;

    const handlePongTime = (serverTime: number) => {
      if (lastPingSent.current) {
        const now = Date.now();
        const roundTripTime = now - lastPingSent.current;
        setPingLatency(roundTripTime);
        serverTimeOffset.current = serverTime - (now - roundTripTime / 2);
        setTimeout(syncTime, 30000); 
      }
    };
    
    const handleSerializedState = (compressedData: ArrayBuffer | Uint8Array, origin: string): GameState | null => {
      try {
        const uint8Array = compressedData instanceof Uint8Array ? compressedData : new Uint8Array(compressedData);
        const decompressedBinaryString = LZString.decompressFromUint8Array(uint8Array);

        if (decompressedBinaryString === null) {
            throw new Error(`LZString decompression (from ${origin}) returned null.`);
        }
        
        // Convert the decompressed string back to Uint8Array
        const decompressedUint8Array = new TextEncoder().encode(decompressedBinaryString);
        const deserialized = deserializeGameState(decompressedUint8Array);         
        if (typeof deserialized !== 'object' || deserialized === null) {
            throw new Error(`Deserialized game state (from ${origin}) is not a valid object.`);
        }
        return deserialized as GameState; 
      } catch (error: any) {
        console.error(`CLIENT: Error processing serialized game state from ${origin}:`, error);
        setError(`Failed to process game data from ${origin}: ${error.message}. Requesting full state.`);
        if (socketRef.current && gameId) {
          socketRef.current.emit('request_full_state', { gameId });
        }
        return null;
      }
    };
    
    const handleGameCreated = ({ gameId: newGameId, playerId: newPlayerId, gameState: compressedArr, players: newPlayers, options }: { gameId: string; playerId: PlayerId; gameState: Uint8Array; players: StoredPlayer[], options: GameOptions}) => {
      const decodedState = handleSerializedState(compressedArr, 'game_created');
      if (decodedState) {
        setGameId(newGameId);
        setLocalPlayerId(newPlayerId);
        setGameState({...decodedState, options });
        setPlayers(newPlayers);
        setIsWaitingForOpponent(newPlayers.filter(p=>p.isConnected).length < 2);
        setError(null);
      }
    };

    const handleGameJoined = ({ gameId: joinedGameId, playerId: joinedPlayerId, gameState: compressedArr, players: joinedPlayers, opponentName: joinedOpponentName, options }: { gameId: string; playerId: PlayerId; gameState: Uint8Array; players: StoredPlayer[], opponentName: string | null, options: GameOptions }) => {
       const decodedState = handleSerializedState(compressedArr, 'game_joined');
       if (decodedState) {
        setGameId(joinedGameId);
        setLocalPlayerId(joinedPlayerId);
        setGameState({...decodedState, options });
        setPlayers(joinedPlayers);
        setOpponentName(joinedOpponentName);
        setIsWaitingForOpponent(joinedPlayers.filter(p=>p.isConnected).length < 2 && !joinedOpponentName);
        setError(null);
      }
    };

    const handleOpponentJoined = ({ opponentName: newOpponentName, players: updatedPlayers }: { opponentName: string; players: StoredPlayer[]}) => {
        setOpponentName(newOpponentName);
        setPlayers(updatedPlayers);
        setIsWaitingForOpponent(false);
        setError(null);
    };
    
    const handleGameStart = ({ gameState: compressedArr, players: gameStartPlayers, options }: { gameState: Uint8Array; players: StoredPlayer[], options: GameOptions }) => {
        const decodedState = handleSerializedState(compressedArr, 'game_start');
        if (decodedState) {
            setGameState({...decodedState, options });
            setPlayers(gameStartPlayers);
            setIsWaitingForOpponent(false);
            setError(null);
        }
    };
    
    const handleGameUpdated = ({ gameState: compressedArr, options }: { gameState: Uint8Array; options?: GameOptions}) => {
        const decodedState = handleSerializedState(compressedArr, 'game_updated (full)');
        if (decodedState) {
            setGameState({...decodedState, options });
            setError(null);
        }
    };

    const handleGameDelta = ({ updates, seqId }: { updates: any[]; seqId: number; }) => {
        try {
            storeApplyDeltaUpdates(updates, seqId);
            setError(null);
        } catch (error: any) {
            console.error('CLIENT: Error processing game_delta:', error);
            setError(`Failed to apply update: ${error.message}. Requesting full state.`);
            const currentLobbyId = gameStore.getState().gameId;
            if (socketRef.current && currentLobbyId) {
              socketRef.current.emit('request_full_state', { gameId: currentLobbyId });
            }
        }
    };
    
    const handleOpponentDisconnected = ({ playerName: disconnectedPlayerName, playerId: disconnectedPlayerId, remainingPlayers }: { playerName: string; playerId: PlayerId; remainingPlayers: StoredPlayer[] }) => {
        setError(`${disconnectedPlayerName} has disconnected. Waiting for them to rejoin or for a new opponent.`);
        setPlayers(remainingPlayers);
        const currentLocalPlayerId = gameStore.getState().localPlayerId;
        if(currentLocalPlayerId !== disconnectedPlayerId) { 
            setOpponentName(null); 
        }
        setIsWaitingForOpponent(true); 
    };

    const handleGameError = ({ message }: { message: string}) => {
        console.warn("CLIENT: Received game_error from server:", message);
        setError(message);
    };
    
    const handleMatchmakingJoined = ({ message, position }: { message: string, position?: number }) => {
      console.log("CLIENT: Matchmaking: Joined queue.", message, position ? `Position: ${position}` : '');
      setError(null);
    };
    const handleMatchmakingLeft = ({ message }: { message: string}) => {
      console.log("CLIENT: Matchmaking: Left queue.", message);
    };
    const handleMatchFound = ({ gameId: newGameId, opponentName: newOpponentName, assignedPlayerId, options }: { gameId: string, opponentName: string, assignedPlayerId: PlayerId, options: GameOptions }) => {
      console.log(`CLIENT: Matchmaking: Match found! Game ID: ${newGameId}, Opponent: ${newOpponentName}, Your PlayerID: ${assignedPlayerId}`);
      setGameId(newGameId);
      setLocalPlayerId(assignedPlayerId);
      setOpponentName(newOpponentName);
      const initialMatchState = createInitialGameState(options); 
      setGameState({...initialMatchState, options});
      setIsWaitingForOpponent(false); 
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
  }, [gameId, localPlayerId, setGameId, setGameState, setLocalPlayerId, setOpponentName, setPlayers, setError, setIsWaitingForOpponent, storeApplyDeltaUpdates, syncTime, setPingLatency ]); 


  const getAdjustedTime = useCallback(() => Date.now() + serverTimeOffset.current, []);
  
  const createGame = useCallback(async (playerName: string, options: GameOptions = { pawnsPerPlayer: PAWNS_PER_PLAYER }) => {
    let currentSocket = socketRef.current;
    if (!currentSocket || !currentSocket.connected) {
       try {
        currentSocket = await connectSocketIO();
      } catch (connectionError: any) {
        setError(`Failed to connect to server for creating game: ${connectionError.message}`);
        return;
      }
    }
     if (!currentSocket || !currentSocket.connected) { 
      setError("Still not connected. Cannot create game.");
      return;
    }
    resetForNewGame(options);
    currentSocket.emit('create_game', { playerName, options, clientTimestamp: getAdjustedTime() });
  }, [connectSocketIO, getAdjustedTime, setError, resetForNewGame]);

  const joinGame = useCallback(async (gameIdToJoin: string, playerName: string, options?: GameOptions) => {
    let currentSocket = socketRef.current;
    if (!currentSocket || !currentSocket.connected) {
      try {
        currentSocket = await connectSocketIO();
      } catch (connectionError: any) {
        setError(`Failed to connect to server for joining game: ${connectionError.message}`);
        return;
      }
    }
    if (!currentSocket || !currentSocket.connected) { 
      setError("Still not connected. Cannot join game.");
      return;
    }
    resetForNewGame(options);
    setGameId(gameIdToJoin); 
    currentSocket.emit('join_game', { gameId: gameIdToJoin, playerName, options, clientTimestamp: getAdjustedTime() });
  }, [connectSocketIO, getAdjustedTime, setError, resetForNewGame, setGameId]);


  const placePawnAction = useCallback((squareIndex: number) => {
    const currentSocket = socketRef.current;
    const currentLobbyId = gameStore.getState().gameId;
    if (!currentSocket || !currentLobbyId || !currentSocket.connected) {
        setError("Not connected or no game ID."); return;
    }
    currentSocket.emit('place_pawn', { gameId: currentLobbyId, squareIndex, clientTimestamp: getAdjustedTime() });
  }, [getAdjustedTime, setError]);

  const movePawnAction = useCallback((fromIndex: number, toIndex: number) => {
    const currentSocket = socketRef.current;
    const currentLobbyId = gameStore.getState().gameId;
    if (!currentSocket || !currentLobbyId || !currentSocket.connected) {
        setError("Not connected or no game ID."); return;
    }
    currentSocket.emit('move_pawn', { gameId: currentLobbyId, fromIndex, toIndex, clientTimestamp: getAdjustedTime() });
  }, [getAdjustedTime, setError]);

  const clearError = useCallback(() => setError(null), [setError]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log("CLIENT: Manually disconnecting socket.");
      socketRef.current.disconnect();
      clearStore(); 
    }
  }, [clearStore]);

  const joinMatchmakingQueue = useCallback(async (playerName: string, rating?: number) => {
    let currentSocket = socketRef.current;
    if (!playerName || playerName.trim() === "") {
        setError("Player name is required to join matchmaking.");
        return;
    }
    if (!currentSocket || !currentSocket.connected) {
       try {
        currentSocket = await connectSocketIO();
      } catch (connectionError: any) {
        setError(`Failed to connect to server for matchmaking: ${connectionError.message}`);
        return;
      }
    }
    if (!currentSocket || !currentSocket.connected) { 
      setError("Still not connected. Cannot join matchmaking.");
      return;
    }
    currentSocket.emit('join_matchmaking', { playerName, rating, clientTimestamp: getAdjustedTime() });
  }, [connectSocketIO, getAdjustedTime, setError]);


  const leaveMatchmakingQueue = useCallback(async () => {
    const currentSocket = socketRef.current;
    if (!currentSocket || !currentSocket.connected) {
      setError("Not connected. Cannot leave matchmaking queue.");
      return;
    }
    currentSocket.emit('leave_matchmaking', { clientTimestamp: getAdjustedTime() });
  }, [getAdjustedTime, setError]);

  return {
    gameState, localPlayerId, opponentName, gameId, error,
    isConnected, isConnecting, isWaitingForOpponent, pingLatency, players,
    createGame, joinGame, placePawnAction, movePawnAction,
    clearError, disconnect, connectSocketIO, 
    joinMatchmakingQueue, leaveMatchmakingQueue,
  };
}
