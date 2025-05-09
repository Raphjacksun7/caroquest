
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { Redis } from 'ioredis';
import type { GameStore } from './gameStore';
import { 
  serializeGameState, 
  // deserializeGameState, // Deserialization happens on client
  createDeltaUpdate
} from './serialization';
import { 
  placePawn, 
  movePawn,
  createInitialGameState
} from './gameLogic';
import type { GameState, PlayerId } from './types';
import type { PlayerInfo } from '@/types/socket'; // For player info structure used in game state
import LZString from 'lz-string';

const RATE_LIMIT = {
  maxRequests: 20, // Increased slightly
  timeWindow: 1000 // 1 second
};

const MOVE_TIMING = {
  minTimeBetweenMoves: 100, // Reduced for responsiveness
  maxTimeVariance: 1000 // Increased tolerance for client/server time diff
};

interface RateLimitInfo {
  count: number;
  lastReset: number;
}

export function setupGameSockets(io: SocketIOServer, gameStore: GameStore, redis: Redis) {
  const rateLimits = new Map<string, RateLimitInfo>();
  // Store previous game states per gameId to calculate deltas
  const previousStates = new Map<string, GameState>();

  io.use((socket, next) => {
    const clientIp = (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || socket.handshake.address;
    const now = Date.now();
    
    if (!rateLimits.has(clientIp)) {
      rateLimits.set(clientIp, { count: 1, lastReset: now });
    } else {
      const limit = rateLimits.get(clientIp)!;
      if (now - limit.lastReset > RATE_LIMIT.timeWindow) {
        limit.count = 1;
        limit.lastReset = now;
      } else if (limit.count >= RATE_LIMIT.maxRequests) {
        console.warn(`Rate limit exceeded for IP: ${clientIp}`);
        return next(new Error('Rate limit exceeded. Please try again shortly.'));
      } else {
        limit.count++;
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log('New connection:', socket.id);
    let currentJoinedGameId: string | null = null;

    socket.on('create_game', async ({ playerName, options = {} }: {playerName: string, options?: any}) => {
      try {
        if (!playerName || typeof playerName !== 'string' || playerName.length > 30) {
          socket.emit('game_error', { message: 'Invalid player name.' });
          return;
        }
        
        const gameId = await gameStore.createGame(socket.id, playerName, options);
        const game = await gameStore.getGame(gameId); // game will contain initial state
        
        if (!game) {
          socket.emit('game_error', { message: 'Failed to create game internal error.' });
          return;
        }

        socket.join(gameId);
        currentJoinedGameId = gameId;
        previousStates.set(gameId, game.state);
        
        const binaryState = serializeGameState(game.state);
        // Socket.IO v3+ handles binary data (Uint8Array) directly with default parser.
        // No need for LZString compression here if perMessageDeflate is enabled on server.
        
        socket.emit('game_created', { 
          gameId, 
          playerId: 1 as PlayerId, 
          gameState: binaryState, // Send binary
          players: game.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})),
          timestamp: Date.now()
        });
        
        console.log(`Game created: ${gameId} by ${playerName} (Socket: ${socket.id})`);
      } catch (error) {
        console.error('Error creating game:', error);
        socket.emit('game_error', { message: 'Failed to create game.' });
      }
    });

    socket.on('join_game', async ({ gameId, playerName }: {gameId: string, playerName: string}) => {
      try {
        if (!gameId || typeof gameId !== 'string' || !playerName || typeof playerName !== 'string' || playerName.length > 30) {
          socket.emit('game_error', { message: 'Invalid game ID or player name.' });
          return;
        }
        
        let game = await gameStore.getGame(gameId);
        if (!game) {
          socket.emit('game_error', { message: 'Game not found.' });
          return;
        }
        
        // Check if player is rejoining
        const existingPlayer = game.players.find(p => p.name === playerName);
        if (existingPlayer) {
            existingPlayer.id = socket.id; // Update socket ID
            // Re-save game with updated socket ID (GameStore might need updatePlayerSocket method)
            // For now, just rejoin the socket room
            socket.join(gameId);
            currentJoinedGameId = gameId;
            if (!previousStates.has(gameId)) previousStates.set(gameId, game.state);

            const binaryState = serializeGameState(game.state);
            socket.emit('game_joined', { 
              gameId, 
              playerId: existingPlayer.playerId, 
              gameState: binaryState,
              players: game.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})),
              timestamp: Date.now()
            });
             socket.to(gameId).emit('opponent_rejoined', { playerName: existingPlayer.name, players: game.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})) });
            console.log(`${existingPlayer.name} re-joined game: ${gameId}`);
            return;
        }


        if (game.players.length >= 2) {
          socket.emit('game_error', { message: 'Game is full.' });
          return;
        }
        
        const result = await gameStore.addPlayerToGame(gameId, socket.id, playerName);
        
        if (!result.success || !result.assignedPlayerId) {
          socket.emit('game_error', { message: 'Failed to join game. Room might be full or an error occurred.' });
          return;
        }
        
        socket.join(gameId);
        currentJoinedGameId = gameId;
        const updatedGame = await gameStore.getGame(gameId); // Get updated game data
        if (!updatedGame) {
             socket.emit('game_error', { message: 'Failed to retrieve game after join.' });
             return;
        }
        previousStates.set(gameId, updatedGame.state);
        
        const binaryState = serializeGameState(updatedGame.state);
        
        socket.emit('game_joined', { 
          gameId, 
          playerId: result.assignedPlayerId, 
          gameState: binaryState,
          players: updatedGame.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})),
          timestamp: Date.now()
        });
        
        io.to(gameId).emit('opponent_joined', { // Notify all in room, including new player
            opponentName: playerName, 
            opponentPlayerId: result.assignedPlayerId,
            players: updatedGame.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})) 
        });
        
        if (updatedGame.players.length === 2) {
            io.to(gameId).emit('game_start', { 
                gameState: binaryState, // Send initial state for game start
                players: updatedGame.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})),
                timestamp: Date.now() 
            });
            console.log(`Game started: ${gameId}`);
        }
        console.log(`Player ${playerName} (Player ${result.assignedPlayerId}) joined game: ${gameId}`);

      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('game_error', { message: 'Failed to join game.' });
      }
    });

    const handlePlayerAction = async (
        actionType: 'place_pawn' | 'move_pawn', 
        gameId: string, 
        actionData: { squareIndex?: number, fromIndex?: number, toIndex?: number, clientTimestamp: number }
      ) => {
        try {
          const serverTime = Date.now();
          if (Math.abs(serverTime - actionData.clientTimestamp) > MOVE_TIMING.maxTimeVariance) {
            socket.emit('game_error', { message: 'Time synchronization error. Please check your system clock.' });
            return;
          }
          
          if (!gameId || typeof gameId !== 'string') {
            socket.emit('game_error', { message: 'Invalid game ID.'}); return;
          }

          const game = await gameStore.getGame(gameId);
          if (!game) {
            socket.emit('game_error', { message: 'Game not found.' }); return;
          }

          const player = game.players.find((p: PlayerInfo) => p.id === socket.id);
          if (!player || player.playerId !== game.state.currentPlayerId) {
            socket.emit('game_error', { message: 'Not your turn or not in game.' }); return;
          }
          
          let newState: GameState | null = null;
          if (actionType === 'place_pawn' && typeof actionData.squareIndex === 'number') {
            newState = placePawn(game.state, actionData.squareIndex);
          } else if (actionType === 'move_pawn' && typeof actionData.fromIndex === 'number' && typeof actionData.toIndex === 'number') {
            newState = movePawn(game.state, actionData.fromIndex, actionData.toIndex);
          }

          if (!newState) {
            socket.emit('game_error', { message: 'Invalid move.' }); return;
          }
          
          await gameStore.updateGameState(gameId, newState);
          
          // Instead of delta, let's send full state for now, client can optimize rendering
          // const deltaUpdates = createDeltaUpdate(previousStates.get(gameId)!, newState);
          previousStates.set(gameId, newState); // Update stored previous state
          
          const binaryState = serializeGameState(newState);
          io.to(gameId).emit('game_updated', { 
            gameState: binaryState,
            timestamp: Date.now(),
            // fullUpdate: true // Indicate it's a full state for client
          });

          if (newState.winner) {
            io.to(gameId).emit('game_over', { winner: newState.winner, winningLine: newState.winningLine });
          }

        } catch (error) {
          console.error(`Error handling ${actionType}:`, error);
          socket.emit('game_error', { message: `Failed to process ${actionType}.` });
        }
    };

    socket.on('place_pawn', (data) => handlePlayerAction('place_pawn', data.gameId, data));
    socket.on('move_pawn', (data) => handlePlayerAction('move_pawn', data.gameId, data));

    socket.on('disconnect', async () => {
      console.log('Player disconnected:', socket.id);
      if (currentJoinedGameId) {
        try {
          const removedPlayer = await gameStore.removePlayerFromGame(currentJoinedGameId, socket.id);
          if (removedPlayer) {
            const game = await gameStore.getGame(currentJoinedGameId);
            const remainingPlayers = game ? game.players.map((p: PlayerInfo) => ({id: p.id, name: p.name, playerId: p.playerId})) : [];
            
            io.to(currentJoinedGameId).emit('opponent_disconnected', {
              playerName: removedPlayer.name,
              playerId: removedPlayer.playerId,
              remainingPlayers
            });
            console.log(`Player ${removedPlayer.name} left game ${currentJoinedGameId}`);

            if (game && game.players.length < 2 && !game.state.winner) {
                 // Could emit a game_paused or similar event
            }
          }
          previousStates.delete(currentJoinedGameId);
        } catch (error) {
          console.error('Error handling disconnection:', error);
        }
      }
      // Also remove from matchmaking if they were in queue
      await removeFromMatchmakingQueue(socket.id, redis);
    });

    socket.on('join_matchmaking', async ({ playerName, rating }: {playerName: string, rating: number}) => {
      try {
        if (!playerName || typeof playerName !== 'string' || playerName.length > 30) {
          socket.emit('game_error', { message: 'Invalid player name for matchmaking.' });
          return;
        }
        await addToMatchmakingQueue(socket.id, playerName, rating, redis);
        const queueSize = await redis.zcard('matchmaking_queue');
        socket.emit('matchmaking_joined', {
          message: 'Added to matchmaking queue.',
          position: queueSize, // Simplified: just show current queue size
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error joining matchmaking:', error);
        socket.emit('game_error', { message: 'Failed to join matchmaking queue.' });
      }
    });

    socket.on('leave_matchmaking', async () => {
      try {
        await removeFromMatchmakingQueue(socket.id, redis);
        socket.emit('matchmaking_left', {
          message: 'Removed from matchmaking queue.',
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error leaving matchmaking:', error);
        socket.emit('game_error', { message: 'Failed to leave matchmaking queue.' });
      }
    });
  });

  // Clean up stale games (e.g., inactive for 30 minutes)
  // This should be handled by Redis TTL or a separate cleanup job if not using Redis TTL effectively
  // setInterval(async () => {
  //   // Logic for cleaning games in GameStore if not solely relying on Redis TTL
  // }, 5 * 60 * 1000); 
}

// Helper functions for matchmaking queue (can be part of matchmaking.ts or here if simple)
async function addToMatchmakingQueue(socketId: string, playerName: string, rating: number, redis: Redis) {
  const playerData = { id: socketId, name: playerName, rating: rating || 1000, joinTime: Date.now() };
  await redis.set(`player:${socketId}`, JSON.stringify(playerData));
  await redis.zadd('matchmaking_queue', playerData.joinTime, socketId); // Score by join time for FIFO
}

async function removeFromMatchmakingQueue(socketId: string, redis: Redis) {
  await redis.zrem('matchmaking_queue', socketId);
  await redis.del(`player:${socketId}`);
}
