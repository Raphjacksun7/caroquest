
"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, PlayerId } from '@/lib/types'; // Ensure PlayerId is exported
import { create } from 'zustand';
import LZString from 'lz-string';
import { deserializeGameState } from '@/lib/serialization'; 
import { applyDeltaUpdatesToGameState } from '@/lib/clientUtils'; 
import { updateBlockingStatus, updateDeadZones, checkWinCondition, createInitialGameState } from '@/lib/gameLogic'; // Added createInitialGameState


export interface PlayerInfo {
  id: string; // socket id
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
  isConnecting: boolean; // New state for connection attempt
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
  setIsConnecting: (connecting: boolean) => void; // New setter
  setIsWaitingForOpponent: (waiting: boolean) => void;
  clearStore: () => void; 
  resetForNewGame: () => void; // For re-joining or creating new game
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
      // Ensure derived state is calculated, especially after full state sync
      const { blockedPawns, blockingPawns } = updateBlockingStatus(gameState.board);
      const { deadZones, deadZoneCreatorPawns } = updateDeadZones(gameState.board, gameState.playerColors);
      const winCheck = checkWinCondition(gameState); // Pass full gameState

      set({ 
        gameState: {
          ...gameState,
          blockedPawnsInfo: blockedPawns,
          blockingPawnsInfo: blockingPawns,
          deadZoneSquares: deadZones,
          deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
          winner: winCheck.winner,
          winningLine: winCheck.winningLine,
        }
      });
    } else {
      set({ gameState: null });
    }
  },
  setError: (error) => set({ error, isWaitingForOpponent: false, isConnecting: false }), 
  applyDeltaUpdates: (updates, seqId) => { 
    const currentState = get().gameState;
    if (!currentState) return;
    
    const newState = applyDeltaUpdatesToGameState(currentState, updates); // No seqId needed here
    
    // Recalculate derived state after delta updates
    const { blockedPawns, blockingPawns } = updateBlockingStatus(newState.board);
    const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newState.board, newState.playerColors);
    const winCheck = checkWinCondition(newState);

    set({ gameState: {
        ...newState,
        blockedPawnsInfo: blockedPawns,
        blockingPawnsInfo: blockingPawns,
        deadZoneSquares: deadZones,
        deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
        winner: winCheck.winner,
        winningLine: winCheck.winningLine,
      } 
    });
  },
  setPlayers: (players) => set({ players }),
  setGameId: (gameId) => set({ gameId }),
  setLocalPlayerId: (playerId) => set({ localPlayerId: playerId }),
  setOpponentName: (name) => set({ opponentName: name }),
  setIsConnected: (connected) => set({ isConnected: connected, isConnecting: false }), // Stop connecting when connected/disconnected
  setIsConnecting: (connecting) => set({ isConnecting: connecting }),
  setIsWaitingForOpponent: (waiting) => set({ isWaitingForOpponent: waiting }),
  clearStore: () => set({
    gameState: null, localPlayerId: null, opponentName: null, gameId: null, error: null,
    isConnected: get().isConnected, // Preserve connection status if socket is still there
    isConnecting: false, isWaitingForOpponent: false, pingLatency: 0, players: [],
  }),
  resetForNewGame: () => set({ // Used before creating/joining a new game
    gameState: null, localPlayerId: null, opponentName: null, gameId: null, error: null,
    isWaitingForOpponent: false, pingLatency: 0, players: [],
    // isConnected and isConnecting are managed by connection logic
  }),
}));


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
        console.log("Socket already connected.");
        store.setIsConnected(true); // Ensure state is correct
        return Promise.resolve(socketRef.current);
    }
    if (store.isConnecting) {
        console.log("Socket connection attempt already in progress.");
        return Promise.reject(new Error("Connection attempt in progress."));
    }

    store.setIsConnecting(true);
    store.setError(null); // Clear previous errors

    const socketUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000');
    
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      upgrade: false, 
      pingInterval: 25000,
      pingTimeout: 5000,
      reconnectionAttempts: 3, // More conservative reconnection
    });
    socketRef.current = newSocket;

    return new Promise<Socket>((resolve, reject) => {
        newSocket.on('connect', () => {
            console.log('Connected to game server with ID:', newSocket.id);
            store.setIsConnected(true);
            syncTime();
            resolve(newSocket);
        });
        
        newSocket.on('disconnect', (reason) => {
            console.log('Disconnected from game server:', reason);
            store.setIsConnected(false);
            if (reason !== 'io client disconnect' && reason !== 'io server disconnect') { // Don't show error if user intentionally disconnected or server initiated
                store.setError(`Disconnected: ${reason}. Please try again.`);
            }
            // reject(new Error(`Disconnected: ${reason}`)); // Not rejecting here to allow reconnection attempts
        });
        
        newSocket.on('connect_error', (err) => {
            console.error('Connection error:', err.message, err.name);
            store.setError(`Connection failed: ${err.message}. Server might be unavailable.`);
            store.setIsConnected(false); // Also set isConnecting to false
            store.setIsConnecting(false);
            reject(err);
        });
    });
  }, [store, syncTime]);
  
  // Initialize listeners when socket is available
  useEffect(() => {
    const currentSocket = socketRef.current;
    if (!currentSocket) return;
    
    // Remove existing listeners before adding new ones to prevent duplicates
    currentSocket.off('pong_time');
    currentSocket.off('game_created');
    currentSocket.off('game_joined');
    currentSocket.off('opponent_joined');
    currentSocket.off('game_start');
    currentSocket.off('game_updated');
    currentSocket.off('game_delta');
    currentSocket.off('opponent_disconnected');
    currentSocket.off('game_error');

    currentSocket.on('pong_time', (serverTime: number) => {
      if (lastPingSent.current) {
        const now = Date.now();
        const roundTripTime = now - lastPingSent.current;
        useGameStore.setState({ pingLatency: roundTripTime });
        serverTimeOffset.current = serverTime - (now - roundTripTime / 2);
        setTimeout(syncTime, 30000);
      }
    });
    
    const handleGameCreated = ({ gameId, playerId, gameState, players, timestamp }: { gameId: string; playerId: PlayerId; gameState: Uint8Array; players: PlayerInfo[], timestamp: number }) => {
      try {
        const decodedState = deserializeGameState(gameState); // gameState is already Uint8Array
        store.setGameId(gameId);
        store.setLocalPlayerId(playerId);
        store.setGameState(decodedState);
        store.setPlayers(players);
        store.setIsWaitingForOpponent(players.length < 2);
        store.setError(null);
      } catch (error: any) {
        console.error('Error processing game_created:', error);
        store.setError(`Failed to process game data (created): ${error.message}`);
      }
    };

    const handleGameJoined = ({ gameId, playerId, gameState, players, opponentName, timestamp }: { gameId: string; playerId: PlayerId; gameState: Uint8Array; players: PlayerInfo[], opponentName: string | null, timestamp: number }) => {
       try {
        const decodedState = deserializeGameState(gameState);
        store.setGameId(gameId);
        store.setLocalPlayerId(playerId);
        store.setGameState(decodedState);
        store.setPlayers(players);
        store.setOpponentName(opponentName);
        store.setIsWaitingForOpponent(players.length < 2 && !opponentName);
        store.setError(null);
      } catch (error: any) {
        console.error('Error processing game_joined:', error);
        store.setError(`Failed to process game data (joined): ${error.message}`);
      }
    };

    const handleOpponentJoined = ({ opponentName, players, timestamp }: { opponentName: string; players: PlayerInfo[], timestamp: number}) => {
        store.setOpponentName(opponentName);
        store.setPlayers(players);
        store.setIsWaitingForOpponent(false);
        store.setError(null);
    };
    
    const handleGameStart = ({ gameState, players, timestamp }: { gameState: Uint8Array; players: PlayerInfo[], timestamp: number }) => {
        try {
            const decodedState = deserializeGameState(gameState);
            store.setGameState(decodedState);
            store.setPlayers(players);
            store.setIsWaitingForOpponent(false);
            store.setError(null);
        } catch (error: any) {
            console.error('Error processing game_start:', error);
            store.setError(`Failed to start game: ${error.message}`);
        }
    };
    
    const handleGameUpdated = ({ gameState, timestamp, fullUpdate }: { gameState: Uint8Array; timestamp: number; fullUpdate?: boolean}) => {
        try {
            const decodedState = deserializeGameState(gameState);
            store.setGameState(decodedState);
            store.setError(null);
        } catch (error: any) {
            console.error('Error processing game_updated:', error);
            store.setError(`Failed to update game: ${error.message}`);
        }
    };

    const handleGameDelta = ({ updates, seqId, timestamp }: { updates: any[]; seqId: number; timestamp: number }) => {
        try {
            store.applyDeltaUpdates(updates, seqId);
            store.setError(null);
        } catch (error: any) {
            console.error('Error processing game_delta:', error);
            store.setError(`Failed to apply update: ${error.message}`);
            if (socketRef.current && store.gameId) {
              socketRef.current.emit('request_full_state', { gameId: store.gameId });
            }
        }
    };
    
    const handleOpponentDisconnected = ({ playerName, playerId, remainingPlayers, timestamp }: { playerName: string; playerId: PlayerId; remainingPlayers: PlayerInfo[], timestamp: number }) => {
        store.setError(`${playerName} has disconnected. Waiting for them to rejoin or for a new opponent.`);
        store.setPlayers(remainingPlayers);
        store.setOpponentName(null); 
        store.setIsWaitingForOpponent(true); 
    };

    const handleGameError = ({ message }: { message: string}) => {
        console.error("Received game_error from server:", message);
        store.setError(message);
    };

    currentSocket.on('game_created', handleGameCreated);
    currentSocket.on('game_joined', handleGameJoined);
    currentSocket.on('opponent_joined', handleOpponentJoined);
    currentSocket.on('game_start', handleGameStart);
    currentSocket.on('game_updated', handleGameUpdated);
    currentSocket.on('game_delta', handleGameDelta);
    currentSocket.on('opponent_disconnected', handleOpponentDisconnected);
    currentSocket.on('game_error', handleGameError);
    
    return () => {
      // Cleanup listeners on socket change or unmount
      currentSocket.off('game_created', handleGameCreated);
      currentSocket.off('game_joined', handleGameJoined);
      currentSocket.off('opponent_joined', handleOpponentJoined);
      currentSocket.off('game_start', handleGameStart);
      currentSocket.off('game_updated', handleGameUpdated);
      currentSocket.off('game_delta', handleGameDelta);
      currentSocket.off('opponent_disconnected', handleOpponentDisconnected);
      currentSocket.off('game_error', handleGameError);
    };
  }, [socketRef.current, store, syncTime]); // Depend on the actual socket instance
  
  const getAdjustedTime = useCallback(() => {
    return Date.now() + serverTimeOffset.current;
  }, []);
  
  const createGame = useCallback(async (playerName: string, options = {}) => {
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
      socketRef.current = null;
      store.setIsConnected(false);
      store.clearStore(); // Clear game related data but keep connection status if socket is being reused
    }
  }, [store]);
  
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
    disconnect, // Expose disconnect
    connect: connectSocket, // Expose manual connect if needed
  };
}

export { useGameStore };
