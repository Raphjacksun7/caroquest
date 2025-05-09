
"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, PlayerId } from '@/lib/types';
import { create } from 'zustand';
import LZString from 'lz-string';
import { deserializeGameState } from '@/lib/serialization'; 
import { applyDeltaUpdatesToGameState } from '@/lib/clientUtils'; 
import { updateBlockingStatus, updateDeadZones, checkWinCondition } from '@/lib/gameLogic';


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
  setIsWaitingForOpponent: (waiting: boolean) => void;
  clearStore: () => void; // Added to reset store
}


const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: null,
  localPlayerId: null,
  opponentName: null,
  gameId: null,
  error: null,
  isConnected: false,
  isWaitingForOpponent: false,
  pingLatency: 0,
  players: [],
  setGameState: (gameState) => {
    if (gameState) {
      const { blockedPawns, blockingPawns } = updateBlockingStatus(gameState.board);
      const { deadZones, deadZoneCreatorPawns } = updateDeadZones(gameState.board, gameState.playerColors);
      const winCheck = checkWinCondition(gameState);

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
  setError: (error) => set({ error, isWaitingForOpponent: false }), // Stop waiting on error
  applyDeltaUpdates: (updates, seqId) => { 
    const currentState = get().gameState;
    if (!currentState) return;
    
    const newState = applyDeltaUpdatesToGameState(currentState, updates);
    
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
  setIsConnected: (connected) => set({ isConnected: connected }),
  setIsWaitingForOpponent: (waiting) => set({ isWaitingForOpponent: waiting }),
  clearStore: () => set({
    gameState: null,
    localPlayerId: null,
    opponentName: null,
    gameId: null,
    error: null,
    // isConnected: false, // Keep connection status
    isWaitingForOpponent: false,
    pingLatency: 0,
    players: [],
  }),
}));


export function useGameConnection() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const store = useGameStore();
  const lastPingSent = useRef<number | null>(null);
  const serverTimeOffset = useRef<number>(0);
  
  const syncTime = useCallback(() => {
    if (!socket || !socket.connected) return;
    lastPingSent.current = Date.now();
    socket.emit('ping_time');
  }, [socket]);
  
  useEffect(() => {
    const socketUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000');
    
    const socketInstance = io(socketUrl, {
      transports: ['websocket'],
      upgrade: false, 
      pingInterval: 25000,
      pingTimeout: 5000,
      reconnectionAttempts: 5, // Limit reconnection attempts
    });
    
    socketInstance.on('connect', () => {
      console.log('Connected to game server with ID:', socketInstance.id);
      store.setError(null);
      store.setIsConnected(true);
      syncTime();
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.log('Disconnected from game server:', reason);
      store.setIsConnected(false);
      if (reason !== 'io client disconnect') { // Don't show error if user intentionally disconnected
        store.setError("Disconnected from server. Attempting to reconnect...");
      }
    });
    
    socketInstance.on('connect_error', (err) => {
      console.error('Connection error:', err.message, err.name);
      store.setError(`Failed to connect: ${err.message}`);
      store.setIsConnected(false);
    });
    
    socketInstance.on('pong_time', (serverTime: number) => {
      if (lastPingSent.current) {
        const now = Date.now();
        const roundTripTime = now - lastPingSent.current;
        useGameStore.setState({ pingLatency: roundTripTime });
        serverTimeOffset.current = serverTime - (now - roundTripTime / 2);
        setTimeout(syncTime, 30000); // Ping every 30s
      }
    });
    
    setSocket(socketInstance);
    
    return () => {
      socketInstance.disconnect();
      console.log('Game connection hook cleanup, socket disconnected.');
      store.clearStore();
    };
  }, []); // Removed store dependencies to avoid re-triggering on store changes
  
  const getAdjustedTime = useCallback(() => {
    return Date.now() + serverTimeOffset.current;
  }, []);
  
  useEffect(() => {
    if (!socket) return;
    
    const handleGameCreated = ({ gameId, playerId, gameState, players, timestamp }: { gameId: string; playerId: PlayerId; gameState: Uint8Array; players: PlayerInfo[], timestamp: number }) => {
      try {
        const binaryState = LZString.decompressFromUint8Array(gameState);
        if (!binaryState) throw new Error("Failed to decompress game state.");
        const decodedState = deserializeGameState(binaryState);
        
        store.setGameId(gameId);
        store.setLocalPlayerId(playerId);
        store.setGameState(decodedState);
        store.setPlayers(players);
        store.setIsWaitingForOpponent(players.length < 2);
      } catch (error: any) {
        console.error('Error processing game_created:', error);
        store.setError(`Failed to process game data: ${error.message}`);
      }
    };

    const handleGameJoined = ({ gameId, playerId, gameState, players, opponentName, timestamp }: { gameId: string; playerId: PlayerId; gameState: Uint8Array; players: PlayerInfo[], opponentName: string | null, timestamp: number }) => {
       try {
        const binaryState = LZString.decompressFromUint8Array(gameState);
        if (!binaryState) throw new Error("Failed to decompress game state.");
        const decodedState = deserializeGameState(binaryState);

        store.setGameId(gameId);
        store.setLocalPlayerId(playerId);
        store.setGameState(decodedState);
        store.setPlayers(players);
        store.setOpponentName(opponentName);
        store.setIsWaitingForOpponent(players.length < 2 && !opponentName);
      } catch (error: any) {
        console.error('Error processing game_joined:', error);
        store.setError(`Failed to process game data: ${error.message}`);
      }
    };

    const handleOpponentJoined = ({ opponentName, players, timestamp }: { opponentName: string; players: PlayerInfo[], timestamp: number}) => {
        store.setOpponentName(opponentName);
        store.setPlayers(players);
        store.setIsWaitingForOpponent(false);
    };
    
    const handleGameStart = ({ gameState, players, timestamp }: { gameState: Uint8Array; players: PlayerInfo[], timestamp: number }) => {
        try {
            const binaryState = LZString.decompressFromUint8Array(gameState);
            if (!binaryState) throw new Error("Failed to decompress game state.");
            const decodedState = deserializeGameState(binaryState);
            store.setGameState(decodedState);
            store.setPlayers(players);
            store.setIsWaitingForOpponent(false);
        } catch (error: any) {
            console.error('Error processing game_start:', error);
            store.setError(`Failed to start game: ${error.message}`);
        }
    };
    
    const handleGameUpdated = ({ gameState, timestamp, fullUpdate }: { gameState: Uint8Array; timestamp: number; fullUpdate?: boolean}) => {
        try {
            const binaryState = LZString.decompressFromUint8Array(gameState);
            if (!binaryState) throw new Error("Failed to decompress game state.");
            const decodedState = deserializeGameState(binaryState);
            store.setGameState(decodedState);
        } catch (error: any) {
            console.error('Error processing game_updated:', error);
            store.setError(`Failed to update game: ${error.message}`);
        }
    };

    const handleGameDelta = ({ updates, seqId, timestamp }: { updates: any[]; seqId: number; timestamp: number }) => {
        try {
            store.applyDeltaUpdates(updates, seqId);
        } catch (error: any) {
            console.error('Error processing game_delta:', error);
            store.setError(`Failed to apply update: ${error.message}`);
            if (socket && store.gameId) {
              socket.emit('request_full_state', { gameId: store.gameId });
            }
        }
    };
    
    const handleOpponentDisconnected = ({ playerName, playerId, remainingPlayers, timestamp }: { playerName: string; playerId: PlayerId; remainingPlayers: PlayerInfo[], timestamp: number }) => {
        store.setError(`${playerName} has disconnected.`);
        store.setPlayers(remainingPlayers);
        store.setOpponentName(null); 
        store.setIsWaitingForOpponent(true); 
    };

    const handleError = ({ message }: { message: string}) => {
        store.setError(message);
    };

    socket.on('game_created', handleGameCreated);
    socket.on('game_joined', handleGameJoined);
    socket.on('opponent_joined', handleOpponentJoined);
    socket.on('game_start', handleGameStart);
    socket.on('game_updated', handleGameUpdated);
    socket.on('game_delta', handleGameDelta);
    socket.on('opponent_disconnected', handleOpponentDisconnected);
    socket.on('game_error', handleError);
    
    return () => {
      socket.off('game_created', handleGameCreated);
      socket.off('game_joined', handleGameJoined);
      socket.off('opponent_joined', handleOpponentJoined);
      socket.off('game_start', handleGameStart);
      socket.off('game_updated', handleGameUpdated);
      socket.off('game_delta', handleGameDelta);
      socket.off('opponent_disconnected', handleOpponentDisconnected);
      socket.off('game_error', handleError);
    };
  }, [socket, store]); // store is a stable reference from Zustand
  
  const createGame = useCallback((playerName: string, options = {}) => {
    if (!socket || !socket.connected) { store.setError("Not connected to server."); return; }
    socket.emit('create_game', { playerName, options, clientTimestamp: getAdjustedTime() });
  }, [socket, getAdjustedTime, store]);
  
  const joinGame = useCallback((gameIdToJoin: string, playerName: string) => {
    if (!socket || !socket.connected) { store.setError("Not connected to server."); return; }
    store.setGameId(gameIdToJoin); 
    socket.emit('join_game', { gameId: gameIdToJoin, playerName, clientTimestamp: getAdjustedTime() });
  }, [socket, getAdjustedTime, store]);
  
  const placePawnAction = useCallback((squareIndex: number) => { 
    if (!socket || !store.gameId || !socket.connected) { store.setError("Not connected or no game ID."); return null; } // Return null or throw
    const currentGameState = store.gameState;
    // Client-side prediction could be added here before emitting, but for now, rely on server update
    socket.emit('place_pawn', { gameId: store.gameId, squareIndex, clientTimestamp: getAdjustedTime() });
    return null; // Or return predicted state if implemented
  }, [socket, store.gameId, getAdjustedTime, store]);
  
  const movePawnAction = useCallback((fromIndex: number, toIndex: number) => { 
    if (!socket || !store.gameId || !socket.connected) { store.setError("Not connected or no game ID."); return null; }
    // Client-side prediction could be added here
    socket.emit('move_pawn', { gameId: store.gameId, fromIndex, toIndex, clientTimestamp: getAdjustedTime() });
    return null; // Or return predicted state
  }, [socket, store.gameId, getAdjustedTime, store]);

  const clearError = useCallback(() => {
    store.setError(null);
  }, [store]);
  
  return {
    gameState: store.gameState,
    localPlayerId: store.localPlayerId,
    opponentName: store.opponentName,
    gameId: store.gameId,
    error: store.error,
    isConnected: store.isConnected,
    isWaitingForOpponent: store.isWaitingForOpponent,
    pingLatency: store.pingLatency,
    players: store.players,
    createGame,
    joinGame,
    placePawnAction,
    movePawnAction,
    clearError,
  };
}

export { useGameStore };
