
"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, PlayerId } from '@/lib/types';
import { create } from 'zustand';
import LZString from 'lz-string';
import { deserializeGameState, createDeltaUpdate } from '@/lib/serialization'; // Assuming createDeltaUpdate is for client-side prediction or not used here.
import { applyDeltaUpdatesToGameState } from '@/lib/clientUtils'; // Renamed for clarity
import { updateBlockingStatus, updateDeadZones, checkWinCondition, createInitialGameState } from '@/lib/gameLogic';


export interface GameStoreState {
  gameState: GameState | null;
  localPlayerId: PlayerId | null; // Changed from playerId to localPlayerId
  opponentName: string | null;
  gameId: string | null;
  error: string | null;
  isConnected: boolean;
  isWaitingForOpponent: boolean;
  pingLatency: number;
  players: PlayerInfo[]; // Added to store player list
  setGameState: (state: GameState | null) => void;
  setError: (error: string | null) => void;
  applyDeltaUpdates: (updates: any[], seqId?: number) => void; // seqId is optional
  setPlayers: (players: PlayerInfo[]) => void;
  setGameId: (gameId: string | null) => void;
  setLocalPlayerId: (playerId: PlayerId | null) => void;
  setOpponentName: (name: string | null) => void;
  setIsConnected: (connected: boolean) => void;
  setIsWaitingForOpponent: (waiting: boolean) => void;
}

// Make sure PlayerInfo is defined or imported if it's a custom type
export interface PlayerInfo {
  id: string;
  name: string;
  playerId: PlayerId;
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
      // Ensure derived state is calculated on the client after receiving state
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
  setError: (error) => set({ error }),
  applyDeltaUpdates: (updates, seqId) => { // seqId can be used for ordering if needed
    const currentState = get().gameState;
    if (!currentState) return;
    
    const newState = applyDeltaUpdatesToGameState(currentState, updates); // Use the correct util
    
    // Recalculate derived state after applying deltas
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
}));


export function useGameConnection() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const store = useGameStore();
  const lastPingSent = useRef<number | null>(null);
  const serverTimeOffset = useRef<number>(0);
  
  const syncTime = useCallback(() => {
    if (!socket || !socket.connected) return; // Ensure socket is connected
    lastPingSent.current = Date.now();
    socket.emit('ping_time');
  }, [socket]);
  
  useEffect(() => {
    const socketUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000');
    
    const socketInstance = io(socketUrl, {
      transports: ['websocket'],
      upgrade: false, // Important for Next.js environments sometimes
      pingInterval: 25000,
      pingTimeout: 5000
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
      if (reason === 'io server disconnect') {
        socketInstance.connect(); // Attempt to reconnect on server disconnect
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
        setTimeout(syncTime, 10000);
      }
    });
    
    setSocket(socketInstance);
    
    return () => {
      socketInstance.disconnect();
      console.log('Game connection hook cleanup, socket disconnected.');
    };
  }, [syncTime, store.setError, store.setIsConnected]); // store.setError, store.setIsConnected added for Zustand best practices
  
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
        store.setIsWaitingForOpponent(true);
      } catch (error: any) {
        console.error('Error processing game_created:', error);
        store.setError(`Failed to process game data: ${error.message}`);
      }
    };

    const handleGameJoined = ({ gameId, playerId, gameState, players, opponent, timestamp }: { gameId: string; playerId: PlayerId; gameState: Uint8Array; players: PlayerInfo[], opponent: string | null, timestamp: number }) => {
       try {
        const binaryState = LZString.decompressFromUint8Array(gameState);
        if (!binaryState) throw new Error("Failed to decompress game state.");
        const decodedState = deserializeGameState(binaryState);

        store.setGameId(gameId);
        store.setLocalPlayerId(playerId);
        store.setGameState(decodedState);
        store.setPlayers(players);
        store.setOpponentName(opponent);
        store.setIsWaitingForOpponent(players.length < 2);
      } catch (error: any) {
        console.error('Error processing game_joined:', error);
        store.setError(`Failed to process game data: ${error.message}`);
      }
    };

    const handleOpponentJoined = ({ opponentName, opponentPlayerId, players, timestamp }: { opponentName: string; opponentPlayerId: PlayerId; players: PlayerInfo[], timestamp: number}) => {
        store.setOpponentName(opponentName);
        store.setPlayers(players);
        store.setIsWaitingForOpponent(false);
    };
     const handleOpponentRejoined = ({ playerName, players }: { playerName: string, players: PlayerInfo[] }) => {
        store.setPlayers(players);
        // Assuming opponentName should be updated if they were the one rejoining.
        // This might need more context on how rejoining affects opponentName.
        const opponent = players.find(p => p.id !== socket.id);
        if (opponent) store.setOpponentName(opponent.name);
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
        store.setOpponentName(null); // Clear opponent name
        store.setIsWaitingForOpponent(true); // Game might be paused or waiting for reconnect
    };

    const handleError = ({ message }: { message: string}) => {
        store.setError(message);
    };

    const handleMatchmakingJoined = ({ message, position, timestamp } : {message: string, position: number, timestamp: number}) => {
        console.log(`Matchmaking: ${message} Position: ${position}`);
        // Update UI state for matchmaking status
    };
    const handleMatchmakingLeft = ({ message, timestamp } : {message: string, timestamp: number}) => {
        console.log(`Matchmaking: ${message}`);
        // Update UI state
    };
    const handleMatchmakingSuccess = ({ gameId, playerId, timestamp } : {gameId: string, playerId: PlayerId, timestamp: number}) => {
        console.log(`Matchmaking success: Joined game ${gameId} as Player ${playerId}`);
        // This event implies the client should join this game.
        // For now, we assume the homepage handles navigation or auto-join flow.
        // If this hook is used on a specific game page, this might re-trigger join.
        store.setGameId(gameId);
        store.setLocalPlayerId(playerId);
        // Request full game state if not automatically sent
        // socket.emit('join_game', { gameId, playerName: "Player" }); // Assuming a default name or get it from store/prompt
    };


    socket.on('game_created', handleGameCreated);
    socket.on('game_joined', handleGameJoined);
    socket.on('opponent_joined', handleOpponentJoined);
    socket.on('opponent_rejoined', handleOpponentRejoined);
    socket.on('game_start', handleGameStart);
    socket.on('game_updated', handleGameUpdated);
    socket.on('game_delta', handleGameDelta);
    socket.on('opponent_disconnected', handleOpponentDisconnected);
    socket.on('game_error', handleError);
    socket.on('matchmaking_joined', handleMatchmakingJoined);
    socket.on('matchmaking_left', handleMatchmakingLeft);
    socket.on('matchmaking_success', handleMatchmakingSuccess);
    
    return () => {
      socket.off('game_created', handleGameCreated);
      socket.off('game_joined', handleGameJoined);
      socket.off('opponent_joined', handleOpponentJoined);
      socket.off('opponent_rejoined', handleOpponentRejoined);
      socket.off('game_start', handleGameStart);
      socket.off('game_updated', handleGameUpdated);
      socket.off('game_delta', handleGameDelta);
      socket.off('opponent_disconnected', handleOpponentDisconnected);
      socket.off('game_error', handleError);
      socket.off('matchmaking_joined', handleMatchmakingJoined);
      socket.off('matchmaking_left', handleMatchmakingLeft);
      socket.off('matchmaking_success', handleMatchmakingSuccess);
    };
  }, [socket, store]);
  
  const createGame = useCallback((playerName: string, options = {}) => {
    if (!socket || !socket.connected) { store.setError("Not connected to server."); return; }
    socket.emit('create_game', { playerName, options, clientTimestamp: getAdjustedTime() });
  }, [socket, getAdjustedTime, store]);
  
  const joinGame = useCallback((gameIdToJoin: string, playerName: string) => {
    if (!socket || !socket.connected) { store.setError("Not connected to server."); return; }
    store.setGameId(gameIdToJoin); // Tentatively set gameId
    socket.emit('join_game', { gameId: gameIdToJoin, playerName, clientTimestamp: getAdjustedTime() });
  }, [socket, getAdjustedTime, store]);
  
  const placePawnAction = useCallback((squareIndex: number) => { // Renamed to avoid conflict
    if (!socket || !store.gameId || !socket.connected) { store.setError("Not connected or no game ID."); return; }
    socket.emit('place_pawn', { gameId: store.gameId, squareIndex, clientTimestamp: getAdjustedTime() });
  }, [socket, store.gameId, getAdjustedTime, store]);
  
  const movePawnAction = useCallback((fromIndex: number, toIndex: number) => { // Renamed
    if (!socket || !store.gameId || !socket.connected) { store.setError("Not connected or no game ID."); return; }
    socket.emit('move_pawn', { gameId: store.gameId, fromIndex, toIndex, clientTimestamp: getAdjustedTime() });
  }, [socket, store.gameId, getAdjustedTime, store]);
  
  const joinMatchmaking = useCallback((playerName: string, rating?: number) => {
    if (!socket || !socket.connected) { store.setError("Not connected to server."); return; }
    socket.emit('join_matchmaking', { playerName, rating, clientTimestamp: getAdjustedTime() });
  }, [socket, getAdjustedTime, store]);
  
  const leaveMatchmaking = useCallback(() => {
    if (!socket || !socket.connected) { store.setError("Not connected to server."); return; }
    socket.emit('leave_matchmaking', { clientTimestamp: getAdjustedTime() });
  }, [socket, getAdjustedTime, store]);

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
    joinMatchmaking,
    leaveMatchmaking,
    clearError,
  };
}

export { useGameStore }; // Exporting the store for direct use if needed
