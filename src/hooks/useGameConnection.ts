
"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, PlayerId } from '@/lib/types';
import type { PlayerInfo } from '@/types/socket'; // Assuming PlayerInfo has { id: string, name: string, playerId: PlayerId }
import { deserializeGameState } from '@/lib/serialization'; // For FlatBuffers
import { createInitialGameState, updateBlockingStatus, updateDeadZones, checkWinCondition } from '@/lib/gameLogic'; // For applying deltas

// Helper to apply delta updates to game state
// This is a simplified version; a robust one would handle all possible state changes.
function applyDeltaUpdates(currentState: GameState, updates: { type: string, changes: any }[]): GameState {
  let newState = { ...currentState, board: [...currentState.board.map(sq => ({...sq}))] }; // Deep copy board

  for (const update of updates) {
    switch (update.type) {
      case 'player_turn':
        newState.currentPlayerId = update.changes.currentPlayerId;
        break;
      case 'game_phase':
        newState.gamePhase = update.changes.gamePhase;
        break;
      case 'board_update':
        update.changes.squares.forEach((sqUpdate: { index: number, pawn: any, highlight?: any }) => {
          if (newState.board[sqUpdate.index]) {
            newState.board[sqUpdate.index].pawn = sqUpdate.pawn;
            newState.board[sqUpdate.index].highlight = sqUpdate.highlight; // Assuming highlight is part of delta
          }
        });
        // After board updates, recalculate derived states
        const { blockedPawns, blockingPawns } = updateBlockingStatus(newState.board);
        const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newState.board, newState.playerColors);
        newState.blockedPawnsInfo = blockedPawns;
        newState.blockingPawnsInfo = blockingPawns;
        newState.deadZoneSquares = deadZones;
        newState.deadZoneCreatorPawnsInfo = deadZoneCreatorPawns;
        break;
      case 'game_over':
        newState.winner = update.changes.winner;
        newState.winningLine = update.changes.winningLine;
        break;
      case 'pawns_to_place_update':
        newState.pawnsToPlace = update.changes;
        break;
      case 'selection_update':
        newState.selectedPawnIndex = update.changes.selectedPawnIndex;
        // If selection clears, or a new pawn is selected, client might need to re-highlight
        // For simplicity, this is not fully handled here, client UI might call highlightValidMoves
        break;
      // Add more cases for other state parts if they are sent as deltas
      default:
        console.warn('Unknown delta update type:', update.type);
    }
  }
  // Crucially, re-check win condition if not already game_over, as board changes might lead to win
  if (!newState.winner) {
    const winCheck = checkWinCondition(newState);
    newState.winner = winCheck.winner;
    newState.winningLine = winCheck.winningLine;
  }
  return newState;
}


export interface UseGameConnectionReturn {
  gameState: GameState | null;
  localPlayerId: PlayerId | null;
  players: PlayerInfo[]; // Now using PlayerInfo from types/socket
  isConnected: boolean;
  error: string | null;
  gameId: string | null; // The ID of the game the user is connected to
  createGame: (playerName: string, options?: any) => void;
  joinGame: (playerName: string, gameIdToJoin: string) => void;
  joinMatchmaking: (playerName: string, rating?: number) => void;
  leaveMatchmaking: () => void;
  placePawnAction: (squareIndex: number) => void;
  movePawnAction: (fromIndex: number, toIndex: number) => void;
  clearError: () => void;
}

export function useGameConnection(): UseGameConnectionReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<PlayerId | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  
  // Ref to store the latest game state for applying deltas
  const gameStateRef = useRef<GameState | null>(null);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);


  useEffect(() => {
    const socketUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:9002');
    
    const socketInstance = io(socketUrl, {
      transports: ['websocket'], // Recommended for real-time games
    });
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to socket server at:', socketUrl, 'Socket ID:', socketInstance.id);
      setError(null); // Clear previous connection errors
    });

    socketInstance.on('game_created', (data: { gameId: string; playerId: PlayerId; gameState: Uint8Array; players: PlayerInfo[]; timestamp: number }) => {
      console.log('Game created:', data.gameId);
      setCurrentGameId(data.gameId);
      setLocalPlayerId(data.playerId);
      const newGameState = deserializeGameState(data.gameState);
      setGameState(newGameState);
      setPlayers(data.players);
      setError(null);
    });

    socketInstance.on('game_joined', (data: { gameId: string; playerId: PlayerId; gameState: Uint8Array; players: PlayerInfo[]; timestamp: number }) => {
      console.log('Game joined:', data.gameId);
      setCurrentGameId(data.gameId);
      setLocalPlayerId(data.playerId);
      const newGameState = deserializeGameState(data.gameState);
      setGameState(newGameState);
      setPlayers(data.players);
      setError(null);
    });
    
    socketInstance.on('opponent_joined', (data: { opponentName: string, opponentPlayerId: PlayerId, players: PlayerInfo[] }) => {
        console.log('Opponent joined:', data.opponentName);
        setPlayers(data.players); // Update player list
        // Potentially update gameState if it also arrives, or trigger a refresh
    });

    socketInstance.on('opponent_rejoined', (data: { playerName: string, players: PlayerInfo[] }) => {
        console.log('Opponent re-joined:', data.playerName);
        setPlayers(data.players);
    });


    socketInstance.on('game_start', (data: { gameState: Uint8Array; players: PlayerInfo[]; timestamp: number }) => {
      console.log('Game start received');
      const newGameState = deserializeGameState(data.gameState);
      setGameState(newGameState);
      setPlayers(data.players); // Ensure players list is updated at game start
    });

    socketInstance.on('game_updated', (data: { gameState: Uint8Array; timestamp: number; /* fullUpdate?: boolean */ }) => {
      // Assuming all 'game_updated' are full binary states for now as per simplified socketHandler
      const newGameState = deserializeGameState(data.gameState);
      setGameState(newGameState);
    });

    socketInstance.on('game_delta', (data: { updates: { type: string, changes: any }[]; seqId: number; timestamp: number }) => {
      if (gameStateRef.current) {
        const updatedState = applyDeltaUpdates(gameStateRef.current, data.updates);
        setGameState(updatedState);
      } else {
        // If current state is null, might need to request a full state update
        console.warn("Received delta update but no current game state to apply to. Requesting full state might be needed.");
      }
    });
    
    socketInstance.on('game_over', (data: { winner: PlayerId, winningLine: number[] | null }) => {
        console.log('Game over event received:', data);
        setGameState(prev => prev ? { ...prev, winner: data.winner, winningLine: data.winningLine } : null);
    });
    
    socketInstance.on('opponent_disconnected', (data: { playerName: string, playerId: PlayerId, remainingPlayers: PlayerInfo[] }) => {
        console.log('Opponent disconnected:', data.playerName);
        setPlayers(data.remainingPlayers);
        // Optionally, if game was ongoing and only one player left, update game state (e.g. pause, or declare winner by forfeit)
        if (data.remainingPlayers.length < 2 && gameStateRef.current && !gameStateRef.current.winner) {
            // Example: Forfeit
            // setGameState(prev => prev ? {...prev, winner: data.remainingPlayers[0]?.playerId, winningLine: null} : null);
            setError(`${data.playerName} disconnected. Game ended.`);
        }
    });

    socketInstance.on('matchmaking_success', (data: { gameId: string, playerId: PlayerId }) => {
        console.log(`Matchmaking success! Joined game ${data.gameId} as Player ${data.playerId}`);
        // Client should now navigate to /game/[gameId] or auto-join this game
        setCurrentGameId(data.gameId); // Set game ID
        setLocalPlayerId(data.playerId); // Set player ID
        // Game state will arrive via 'game_joined' or 'game_start' if matchmaking server emits it
        // Or client needs to emit 'join_game' for this gameId with their name
        // For simplicity, let's assume client has a stored name or prompts for it.
        // This part depends on the exact flow from matchmaking to game join.
        // If 'join_game' is needed: socketInstance.emit('join_game', { gameId: data.gameId, playerName: "MyName" });
        setError(null); // Clear any matchmaking errors
    });

    socketInstance.on('matchmaking_joined', (data: { message: string, position: number }) => {
        console.log('Joined matchmaking queue:', data.message, 'Position:', data.position);
        // Update UI to show user is in queue
    });

    socketInstance.on('matchmaking_left', (data: { message: string }) => {
        console.log('Left matchmaking queue:', data.message);
        // Update UI
    });

    socketInstance.on('game_error', (data: { message: string }) => {
      console.error('Game error from server:', data.message);
      setError(data.message);
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Disconnected from socket server:', reason);
      // Don't set error for normal disconnects, only for connect_error
      // setError("Disconnected from server. Attempting to reconnect...");
    });
    
    socketInstance.on('connect_error', (err) => {
      console.error('Connection Error:', err.message, err.name, err.stack);
      setError(`Failed to connect to game server: ${err.message}. Server might be down or busy.`);
      setIsConnected(false);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []); // Removed gameId, playerName from dependencies to prevent re-socketing on their change after initial setup

  const createGame = useCallback((playerName: string, options: any = {}) => {
    if (socket && isConnected) {
      socket.emit('create_game', { playerName, options });
    } else {
      setError("Not connected to server. Cannot create game.");
    }
  }, [socket, isConnected]);

  const joinGame = useCallback((playerName: string, gameIdToJoin: string) => {
    if (socket && isConnected) {
      setCurrentGameId(gameIdToJoin); // Tentatively set gameId, actual confirmation via game_joined
      socket.emit('join_game', { gameId: gameIdToJoin, playerName });
    } else {
      setError("Not connected to server. Cannot join game.");
    }
  }, [socket, isConnected]);

  const joinMatchmaking = useCallback((playerName: string, rating?: number) => {
    if (socket && isConnected) {
      socket.emit('join_matchmaking', { playerName, rating });
    } else {
      setError("Not connected. Cannot join matchmaking.");
    }
  }, [socket, isConnected]);

  const leaveMatchmaking = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('leave_matchmaking');
    }
  }, [socket, isConnected]);

  const placePawnAction = useCallback((squareIndex: number) => {
    if (socket && isConnected && currentGameId) {
      socket.emit('place_pawn', { gameId: currentGameId, squareIndex, clientTimestamp: Date.now() });
    }
  }, [socket, isConnected, currentGameId]);

  const movePawnAction = useCallback((fromIndex: number, toIndex: number) => {
    if (socket && isConnected && currentGameId) {
      socket.emit('move_pawn', { gameId: currentGameId, fromIndex, toIndex, clientTimestamp: Date.now() });
    }
  }, [socket, isConnected, currentGameId]);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    gameState,
    localPlayerId,
    players,
    isConnected,
    error,
    gameId: currentGameId,
    createGame,
    joinGame,
    joinMatchmaking,
    leaveMatchmaking,
    placePawnAction,
    movePawnAction,
    clearError,
  };
}
