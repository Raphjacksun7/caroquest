
"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, PlayerId } from '@/lib/types'; 
import { create } from 'zustand';
import LZString from 'lz-string';
import { deserializeGameState } from '@/lib/serialization'; 
import { applyDeltaUpdatesToGameState } from '@/lib/clientUtils'; 
import { assignPlayerColors, PAWNS_PER_PLAYER } from '@/lib/gameLogic';

export interface PlayerInfo {
  id: string; 
  name: string;
  playerId: PlayerId;
}

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
  players: PlayerInfo[]; 
  setGameState: (state: GameState | null) => void;
  setError: (error: string | null) => void;
  applyDeltaUpdates: (updates: any[], seqId?: number) => void; 
  setPlayers: (players: PlayerInfo[]) => void;
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
        deadZoneSquares: new Map((Array.isArray(gameState.deadZoneSquares) ? gameState.deadZoneSquares : Object.entries(gameState.deadZoneSquares || {})).map(([k,v]:[string, PlayerId]) => [parseInt(k),v])),
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
  setIsConnected: (connected) => set({ isConnected: connected, isConnecting: false }), 
  setIsConnecting: (connecting) => set({ isConnecting: connecting }),
  setIsWaitingForOpponent: (waiting) => set({ isWaitingForOpponent: waiting }),
  setPingLatency: (latency) => set({ pingLatency: latency }),
  clearStore: () => set({
    gameState: null, localPlayerId: null, opponentName: null, gameId: null, error: null,
    isConnected: get().isConnected, 
    isConnecting: false, isWaitingForOpponent: false, pingLatency: 0, players: [],
  }),
  resetForNewGame: () => set({ 
    gameState: null, localPlayerId: null, opponentName: null, gameId: null, error: null,
    isWaitingForOpponent: false, pingLatency: 0, players: [],
  }),
}));

export interface GameOptions { // Ensure GameOptions is defined if used by createGame
    isPublic?: boolean;
    gameIdToCreate?: string;
    pawnsPerPlayer?: number;
    isMatchmaking?: boolean;
    isRanked?: boolean;
}

export function useGameConnection() {
  const socketRef = useRef<Socket | null>(null);
  const store = useGameStore();
  const lastPingSent = useRef<number | null>(null);
  const serverTimeOffset = useRef<number>(0);
  
  const syncTime = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) return;
    lastPingSent.current = Date.now();
    socketRef.current.emit('ping_time');
  }, []);

  const connectSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
        store.setIsConnected(true); 
        return Promise.resolve(socketRef.current);
    }
    if (store.isConnecting) {
        return Promise.reject(new Error("Connection attempt in progress."));
    }

    store.setIsConnecting(true);
    store.setError(null); 

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
            store.setIsConnected(true);
            syncTime();
            resolve(newSocket);
        });
        
        newSocket.on('disconnect', (reason) => {
            console.log('Socket.IO: Disconnected from game server:', reason);
            store.setIsConnected(false);
            if (reason !== 'io client disconnect' && reason !== 'io server disconnect') { 
                store.setError(`Disconnected: ${reason}. Please check your connection or try again.`);
            }
        });
        
        newSocket.on('connect_error', (err) => {
            console.error('Socket.IO: Connection error:', err.message, err.name);
            const errorMessage = err.message.includes('xhr poll error') || err.message.includes('websocket error') 
                ? 'Failed to connect to the game server. The server might be unavailable or a network issue occurred.'
                : `Connection failed: ${err.message}. Please try again.`;
            store.setError(errorMessage);
            store.setIsConnected(false); 
            store.setIsConnecting(false);
            reject(err);
        });
    });
  }, [store, syncTime]);
  
  useEffect(() => {
    connectSocket().catch(err => {
        console.warn("Socket.IO: Initial connection attempt failed in useEffect.", err.message);
    });

    const currentSocket = socketRef.current;
    if (!currentSocket) return; 
    
    currentSocket.off('pong_time');
    currentSocket.off('game_created');
    currentSocket.off('game_joined');
    currentSocket.off('opponent_joined');
    currentSocket.off('game_start');
    currentSocket.off('game_updated');
    currentSocket.off('game_delta');
    currentSocket.off('opponent_disconnected');
    currentSocket.off('game_error');
    currentSocket.off('matchmaking_joined');
    currentSocket.off('matchmaking_left');
    currentSocket.off('match_found');


    currentSocket.on('pong_time', (serverTime: number) => {
      if (lastPingSent.current) {
        const now = Date.now();
        const roundTripTime = now - lastPingSent.current;
        store.setPingLatency(roundTripTime);
        serverTimeOffset.current = serverTime - (now - roundTripTime / 2);
        setTimeout(syncTime, 30000);
      }
    });
    
    const handleCompressedState = (compressedStateAsArray: number[], origin: string): GameState | null => {
      try {
        if (!Array.isArray(compressedStateAsArray)) {
            throw new Error("Received game state is not an array as expected.");
        }
        const uint8ArrayState = new Uint8Array(compressedStateAsArray);
        const binaryState = LZString.decompressFromUint8Array(uint8ArrayState);
        if (!binaryState) throw new Error("Failed to decompress game state.");
        const deserialized = deserializeGameState(binaryState); // This must return a GameState
        if (typeof deserialized !== 'object' || deserialized === null) {
            throw new Error("Deserialized game state is not a valid object.");
        }
        return deserialized;
      } catch (error: any) {
        console.error(`Error processing compressed game state from ${origin}:`, error);
        store.setError(`Failed to process game data from ${origin}: ${error.message}`);
        return null;
      }
    };
    
    currentSocket.on('game_created', ({ gameId, playerId, gameState: compressedGameStateArr, players, timestamp }: { gameId: string; playerId: PlayerId; gameState: number[]; players: PlayerInfo[], timestamp: number }) => {
      const decodedState = handleCompressedState(compressedGameStateArr, 'game_created');
      if (decodedState) {
        store.setGameId(gameId);
        store.setLocalPlayerId(playerId);
        store.setGameState(decodedState);
        store.setPlayers(players);
        store.setIsWaitingForOpponent(players.length < 2);
        store.setError(null);
      }
    });

    currentSocket.on('game_joined', ({ gameId, playerId, gameState: compressedGameStateArr, players, opponentName, timestamp }: { gameId: string; playerId: PlayerId; gameState: number[]; players: PlayerInfo[], opponentName: string | null, timestamp: number }) => {
       const decodedState = handleCompressedState(compressedGameStateArr, 'game_joined');
       if (decodedState) {
        store.setGameId(gameId);
        store.setLocalPlayerId(playerId);
        store.setGameState(decodedState);
        store.setPlayers(players);
        store.setOpponentName(opponentName);
        store.setIsWaitingForOpponent(players.length < 2 && !opponentName);
        store.setError(null);
      }
    });

    currentSocket.on('opponent_joined', ({ opponentName, players, timestamp }: { opponentName: string; players: PlayerInfo[], timestamp: number}) => {
        store.setOpponentName(opponentName);
        store.setPlayers(players);
        store.setIsWaitingForOpponent(false);
        store.setError(null);
    });
    
    currentSocket.on('game_start', ({ gameState: compressedGameStateArr, players, timestamp }: { gameState: number[]; players: PlayerInfo[], timestamp: number }) => {
        const decodedState = handleCompressedState(compressedGameStateArr, 'game_start');
        if (decodedState) {
            store.setGameState(decodedState);
            store.setPlayers(players);
            store.setIsWaitingForOpponent(false);
            store.setError(null);
        }
    });
    
    currentSocket.on('game_updated', ({ gameState: compressedGameStateArr, timestamp, fullUpdate }: { gameState: number[]; timestamp: number; fullUpdate?: boolean}) => {
        const decodedState = handleCompressedState(compressedGameStateArr, 'game_updated (full)');
        if (decodedState) {
            store.setGameState(decodedState);
            store.setError(null);
        }
    });

    currentSocket.on('game_delta', ({ updates, seqId, timestamp }: { updates: any[]; seqId: number; timestamp: number }) => {
        try {
            store.applyDeltaUpdates(updates, seqId);
            store.setError(null);
        } catch (error: any) {
            console.error('Error processing game_delta:', error);
            store.setError(`Failed to apply update: ${error.message}. Requesting full state.`);
            if (socketRef.current && store.gameId) {
              socketRef.current.emit('request_full_state', { gameId: store.gameId });
            }
        }
    });
    
    currentSocket.on('opponent_disconnected', ({ playerName, playerId: disconnectedPlayerId, remainingPlayers, timestamp }: { playerName: string; playerId: PlayerId; remainingPlayers: PlayerInfo[], timestamp: number }) => {
        store.setError(`${playerName} has disconnected. Waiting for them to rejoin or for a new opponent.`);
        store.setPlayers(remainingPlayers);
        if(store.localPlayerId !== disconnectedPlayerId) { 
            store.setOpponentName(null); 
        }
        store.setIsWaitingForOpponent(true); 
    });

    currentSocket.on('game_error', ({ message }: { message: string}) => {
        console.warn("Received game_error from server:", message);
        store.setError(message);
    });

    currentSocket.on('matchmaking_joined', ({ message, position }: { message: string, position?: number }) => {
      console.log("Matchmaking: Joined queue.", message, position ? `Position: ${position}` : '');
      store.setError(null); 
    });
    currentSocket.on('matchmaking_left', ({ message }: { message: string}) => {
      console.log("Matchmaking: Left queue.", message);
    });
    currentSocket.on('match_found', ({ gameId: newGameId, opponentName, assignedPlayerId }: { gameId: string, opponentName: string, assignedPlayerId: PlayerId }) => {
      console.log(`Matchmaking: Match found! Game ID: ${newGameId}, Opponent: ${opponentName}, Your PlayerID: ${assignedPlayerId}`);
      store.setGameId(newGameId);
      store.setLocalPlayerId(assignedPlayerId);
      store.setOpponentName(opponentName);
      store.setIsWaitingForOpponent(false); 
      if (typeof window !== 'undefined') {
         window.location.href = `/game/${newGameId}`; 
      }
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        store.setIsConnected(false);
        store.clearStore(); 
      }
    };
  }, [connectSocket, store, syncTime]); 
  
  const getAdjustedTime = useCallback(() => {
    return Date.now() + serverTimeOffset.current;
  }, []);
  
  const createGame = useCallback(async (playerName: string, options: GameOptions = {}) => {
    store.resetForNewGame();
    try {
      const currentSocket = await connectSocket(); 
      currentSocket.emit('create_game', { playerName, options, clientTimestamp: getAdjustedTime() });
    } catch (err: any) {
      store.setError(`Failed to create game: ${err.message || 'Connection error'}`);
    }
  }, [connectSocket, getAdjustedTime, store]);
  
  const joinGame = useCallback(async (gameIdToJoin: string, playerName: string) => {
    store.resetForNewGame();
    try {
      const currentSocket = await connectSocket();
      store.setGameId(gameIdToJoin); 
      currentSocket.emit('join_game', { gameId: gameIdToJoin, playerName, clientTimestamp: getAdjustedTime() });
    } catch (err: any) {
      store.setError(`Failed to join game: ${err.message || 'Connection error'}`);
    }
  }, [connectSocket, getAdjustedTime, store]);
  
  const placePawnAction = useCallback((squareIndex: number) => { 
    if (!socketRef.current || !store.gameId || !socketRef.current.connected) { 
        store.setError("Not connected to server or no game ID."); return; 
    }
    socketRef.current.emit('place_pawn', { gameId: store.gameId, squareIndex, clientTimestamp: getAdjustedTime() });
  }, [store.gameId, getAdjustedTime, store]);
  
  const movePawnAction = useCallback((fromIndex: number, toIndex: number) => { 
    if (!socketRef.current || !store.gameId || !socketRef.current.connected) { 
        store.setError("Not connected to server or no game ID."); return; 
    }
    socketRef.current.emit('move_pawn', { gameId: store.gameId, fromIndex, toIndex, clientTimestamp: getAdjustedTime() });
  }, [store.gameId, getAdjustedTime, store]);

  const clearError = useCallback(() => {
    store.setError(null);
  }, [store]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      store.setIsConnected(false);
      store.clearStore(); 
    }
  }, [store]);

  const joinMatchmakingQueue = useCallback(async (playerName: string, rating?: number) => {
    if (!playerName || playerName.trim() === "") {
        store.setError("Player name is required to join matchmaking.");
        return;
    }
    try {
        const currentSocket = await connectSocket();
        currentSocket.emit('join_matchmaking', { playerName, rating, clientTimestamp: getAdjustedTime() });
    } catch (err: any) {
        store.setError(`Failed to join matchmaking: ${err.message || 'Connection error'}`);
    }
  }, [connectSocket, getAdjustedTime, store]);

  const leaveMatchmakingQueue = useCallback(async () => {
    try {
        const currentSocket = await connectSocket(); 
        currentSocket.emit('leave_matchmaking', { clientTimestamp: getAdjustedTime() });
    } catch (err: any) {
        store.setError(`Failed to leave matchmaking: ${err.message || 'Connection error'}`);
    }
  }, [connectSocket, getAdjustedTime, store]);
  
  return {
    gameState: store.gameState,
    localPlayerId: store.localPlayerId,
    opponentName: store.opponentName,
    gameId: store.gameId,
    error: store.error,
    isConnected: store.isConnected,
    isConnecting: store.isConnecting,
    isWaitingForOpponent: store.isWaitingForOpponent,
    pingLatency: store.pingLatency,
    players: store.players,
    createGame,
    joinGame,
    placePawnAction,
    movePawnAction,
    clearError,
    disconnect, 
    connect: connectSocket,
    joinMatchmakingQueue,
    leaveMatchmakingQueue,
  };
}

export { useGameStore };
