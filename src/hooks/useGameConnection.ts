
"use client";
import type { ReactNode } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, PlayerId } from '@/lib/gameLogic'; // Ensure correct path
import type { PlayerInfo } from '@/types/socket'; // Define this type

export interface UseGameConnectionReturn {
  gameState: GameState | null;
  localPlayerId: PlayerId | null;
  players: PlayerInfo[];
  isConnected: boolean;
  error: string | null;
  gameId: string | null;
  createGame: (playerName: string, gameId: string) => void;
  joinGame: (playerName: string, gameId: string) => void;
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

  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001');
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to socket server');
    });

    socketInstance.on('game_created', (data: { gameId: string; playerId: PlayerId; gameState: GameState }) => {
      console.log('Game created:', data);
      setCurrentGameId(data.gameId);
      setLocalPlayerId(data.playerId);
      setGameState(data.gameState);
      // Assuming players info might come with game_created or game_joined
    });

    socketInstance.on('game_joined', (data: { gameId: string; playerId: PlayerId; gameState: GameState; players: PlayerInfo[] }) => {
      console.log('Game joined:', data);
      setCurrentGameId(data.gameId);
      setLocalPlayerId(data.playerId);
      setGameState(data.gameState);
      setPlayers(data.players);
    });
    
    socketInstance.on('opponent_joined', (data: { opponentName: string, opponentPlayerId: PlayerId, players: PlayerInfo[] }) => {
      console.log('Opponent joined:', data);
      setPlayers(data.players); // Update player list
      // Potentially update GameState if needed, or trigger a toast
    });
    
    socketInstance.on('opponent_rejoined', (data: { opponentName: string }) => {
        console.log('Opponent rejoined:', data);
        // Could show a toast message
    });

    socketInstance.on('game_start', (data: { gameState: GameState, players: PlayerInfo[] }) => {
      console.log('Game start:', data);
      setGameState(data.gameState);
      setPlayers(data.players);
    });

    socketInstance.on('game_updated', (data: { gameState: GameState }) => {
      console.log('Game updated');
      setGameState(data.gameState);
    });

    socketInstance.on('game_over', (data: { winner: PlayerId, winningLine: number[] | null }) => {
      console.log('Game over:', data);
      if (gameState) {
        setGameState({ ...gameState, winner: data.winner, winningLine: data.winningLine });
      }
      // Consider showing a winner dialog or toast
    });
    
    socketInstance.on('player_left', (data: { playerName: string, playerId: PlayerId, remainingPlayers: PlayerInfo[] }) => {
        console.log('Player left:', data);
        setPlayers(data.remainingPlayers);
        // Potentially end game or show message
        if (data.remainingPlayers.length < 2 && gameState && !gameState.winner) {
            // Example: if a player leaves and the game wasn't over, the remaining player might win by default
            // This logic depends on game rules for abandonment
            // setGameState(prev => prev ? {...prev, winner: data.remainingPlayers[0]?.playerId} : null);
        }
    });

    socketInstance.on('game_error', (data: { message: string }) => {
      console.error('Game error:', data.message);
      setError(data.message);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from socket server');
      // Optionally reset game state or show a disconnected message
      // setError("Disconnected. Please refresh or try again.");
      // setGameState(null); 
      // setLocalPlayerId(null);
      // setPlayers([]);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []); // Removed gameState from dependencies to avoid re-running on every gameState change from server

  const createGame = useCallback((playerName: string, gameId: string) => {
    if (socket && isConnected) {
      socket.emit('create_game', { playerName, gameId });
    }
  }, [socket, isConnected]);

  const joinGame = useCallback((playerName: string, gameId: string) => {
    if (socket && isConnected) {
      socket.emit('join_game', { playerName, gameId });
    }
  }, [socket, isConnected]);

  const placePawnAction = useCallback((squareIndex: number) => {
    if (socket && isConnected && currentGameId) {
      socket.emit('place_pawn', { gameId: currentGameId, squareIndex });
    }
  }, [socket, isConnected, currentGameId]);

  const movePawnAction = useCallback((fromIndex: number, toIndex: number) => {
    if (socket && isConnected && currentGameId) {
      socket.emit('move_pawn', { gameId: currentGameId, fromIndex, toIndex });
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
    placePawnAction,
    movePawnAction,
    clearError,
  };
}
