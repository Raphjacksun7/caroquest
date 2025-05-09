
"use client";
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, PlayerId } from '@/lib/gameLogic';
import type { PlayerInfo } from '@/types/socket';

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
    // Determine socket URL based on environment
    // For integrated server, it's the same origin.
    const socketUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:9002');
    
    const socketInstance = io(socketUrl, {
      // Recommended to use WebSocket transport primarily
      transports: ['websocket'],
    });
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to socket server at:', socketUrl);
    });

    socketInstance.on('game_created', (data: { gameId: string; playerId: PlayerId; gameState: GameState; players: PlayerInfo[] }) => {
      console.log('Game created:', data);
      setCurrentGameId(data.gameId);
      setLocalPlayerId(data.playerId);
      setGameState(data.gameState);
      setPlayers(data.players);
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
      setPlayers(data.players);
      // Optionally show a toast: `${data.opponentName} has joined!`
    });
    
    socketInstance.on('opponent_rejoined', (data: { opponentName: string, players: PlayerInfo[] }) => {
        console.log('Opponent re-joined:', data);
        setPlayers(data.players);
        // Optionally show a toast: `${data.opponentName} has re-joined!`
    });

    socketInstance.on('game_start', (data: { gameState: GameState, players: PlayerInfo[] }) => {
      console.log('Game start:', data);
      setGameState(data.gameState);
      setPlayers(data.players);
    });

    socketInstance.on('game_updated', (data: { gameState: GameState }) => {
      setGameState(data.gameState);
    });

    socketInstance.on('game_over', (data: { winner: PlayerId, winningLine: number[] | null }) => {
      console.log('Game over:', data);
      if (gameState) { // Ensure gameState is not null before spreading
        setGameState(prevGameState => prevGameState ? { ...prevGameState, winner: data.winner, winningLine: data.winningLine } : null);
      }
    });
    
    socketInstance.on('player_left', (data: { playerName: string, playerId: PlayerId, remainingPlayers: PlayerInfo[] }) => {
        console.log('Player left:', data);
        setPlayers(data.remainingPlayers);
        if (data.remainingPlayers.length < 2 && gameState && !gameState.winner) {
            // Handle game ending if one player leaves
        }
    });

    socketInstance.on('game_error', (data: { message: string }) => {
      console.error('Game error:', data.message);
      setError(data.message);
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Disconnected from socket server:', reason);
      // setError("Disconnected from server. Please try refreshing.");
    });
    
    socketInstance.on('connect_error', (err) => {
      console.error('Connection Error:', err.message);
      setError(`Failed to connect to server: ${err.message}. Ensure the server is running and accessible.`);
      setIsConnected(false);
    });


    return () => {
      socketInstance.disconnect();
    };
  }, []); // GameState removed from deps

  const createGame = useCallback((playerName: string, gameId: string) => {
    if (socket && isConnected) {
      socket.emit('create_game', { playerName, gameId });
    } else {
      setError("Not connected to server. Cannot create game.");
    }
  }, [socket, isConnected]);

  const joinGame = useCallback((playerName: string, gameId: string) => {
    if (socket && isConnected) {
      socket.emit('join_game', { playerName, gameId });
    } else {
      setError("Not connected to server. Cannot join game.");
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
