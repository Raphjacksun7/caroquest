
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { Redis } from 'ioredis';
import type { GameStore } from './gameStore';
import { 
  serializeGameState, 
  // deserializeGameState, // Not needed on server side for emits
  createDeltaUpdate
} from './serialization';
import { 
  placePawn, 
  movePawn, 
  createInitialGameState // Used if game state corrupts or for new games
} from './gameLogic';
import type { GameState, PlayerId } from './types';
import type { PlayerInfo } from '@/types/socket'; 
import LZString from 'lz-string';

const RATE_LIMIT = {
  maxRequests: 20, 
  timeWindow: 1000 
};

const MOVE_TIMING = {
  minTimeBetweenMoves: 100, 
  maxTimeVariance: 1000 
};

interface RateLimitInfo {
  count: number;
  lastReset: number;
}

export function setupGameSockets(io: SocketIOServer, gameStore: GameStore, redis: Redis) {
  const rateLimits = new Map<string, RateLimitInfo>();
  const previousStates = new Map<string, GameState>(); // For delta updates

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

    socket.on('ping_time', () => {
      socket.emit('pong_time', Date.now());
    });

    socket.on('create_game', async ({ playerName, options = {} }: {playerName: string, options?: any}) => {
      try {
        if (!playerName || typeof playerName !== 'string' || playerName.length > 30) {
          socket.emit('game_error', { message: 'Invalid player name.' });
          return;
        }
        
        const gameId = await gameStore.createGame(socket.id, playerName, options);
        const game = await gameStore.getGame(gameId);
        
        if (!game) {
          socket.emit('game_error', { message: 'Failed to create game internal error.' });
          return;
        }

        socket.join(gameId);
        currentJoinedGameId = gameId;
        previousStates.set(gameId, game.state);
        
        const binaryState = serializeGameState(game.state);
        const compressedState = LZString.compressToUint8Array(binaryState);
        
        socket.emit('game_created', { 
          gameId, 
          playerId: 1 as PlayerId, 
          gameState: compressedState,
          players: game.players.map((p: any) => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})), // Ensure PlayerInfo structure
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
        
        const existingPlayer = game.players.find((p: any) => p.name === playerName);
        if (existingPlayer) {
            existingPlayer.id = socket.id; 
            // TODO: GameStore needs a method to update player socket ID or resave game.
            // For now, just rejoin the socket room if player details match.
            await gameStore.updateGameState(gameId, game.state); // Resave to update activity and potentially player list if it changes
            socket.join(gameId);
            currentJoinedGameId = gameId;
            if (!previousStates.has(gameId)) previousStates.set(gameId, game.state);

            const binaryState = serializeGameState(game.state);
            const compressedState = LZString.compressToUint8Array(binaryState);
            socket.emit('game_joined', { 
              gameId, 
              playerId: existingPlayer.playerId, 
              gameState: compressedState,
              players: game.players.map((p: any) => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})),
              opponent: game.players.find((p:any) => p.id !== socket.id)?.name || null,
              timestamp: Date.now()
            });
             socket.to(gameId).emit('opponent_rejoined', { playerName: existingPlayer.name, players: game.players.map((p:any) => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})) });
            console.log(`${existingPlayer.name} re-joined game: ${gameId}`);
            return;
        }


        if (game.players.length >= 2) {
          socket.emit('game_error', { message: 'Game is full.' });
          return;
        }
        
        const result = await gameStore.addPlayerToGame(gameId, socket.id, playerName);
        
        if (!result.success || result.assignedPlayerId === undefined) { // Check for assignedPlayerId
          socket.emit('game_error', { message: 'Failed to join game. Room might be full or an error occurred.' });
          return;
        }
        
        socket.join(gameId);
        currentJoinedGameId = gameId;
        const updatedGame = await gameStore.getGame(gameId);
        if (!updatedGame) {
             socket.emit('game_error', { message: 'Failed to retrieve game after join.' });
             return;
        }
        previousStates.set(gameId, updatedGame.state);
        
        const binaryState = serializeGameState(updatedGame.state);
        const compressedState = LZString.compressToUint8Array(binaryState);
        
        socket.emit('game_joined', { 
          gameId, 
          playerId: result.assignedPlayerId, 
          gameState: compressedState,
          players: updatedGame.players.map((p: any) => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})),
          opponent: updatedGame.players.find((p:any) => p.id !== socket.id)?.name || null,
          timestamp: Date.now()
        });
        
        io.to(gameId).emit('opponent_joined', { 
            opponentName: playerName, 
            opponentPlayerId: result.assignedPlayerId,
            players: updatedGame.players.map((p: any) => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})) ,
            timestamp: Date.now()
        });
        
        if (updatedGame.players.length === 2) {
            io.to(gameId).emit('game_start', { 
                gameState: compressedState, 
                players: updatedGame.players.map((p: any) => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})),
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

          const player = game.players.find((p: any) => p.id === socket.id); // Use PlayerInfo type
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
          
          const prevState = previousStates.get(gameId);
          const deltaUpdates = prevState ? createDeltaUpdate(prevState, newState) : [];
          previousStates.set(gameId, newState);
          
          const shouldSendFullState = game.sequenceId % 10 === 0 || deltaUpdates.length === 0 || deltaUpdates.length > 5; // Send full state if no delta or many changes

          if (shouldSendFullState) {
            const binaryState = serializeGameState(newState);
            const compressedState = LZString.compressToUint8Array(binaryState);
            io.to(gameId).emit('game_updated', { 
              gameState: compressedState,
              timestamp: Date.now(),
              fullUpdate: true 
            });
          } else {
            io.to(gameId).emit('game_delta', { 
              updates: deltaUpdates,
              seqId: game.sequenceId, // Use updated sequenceId from gameStore
              timestamp: Date.now()
            });
          }

          if (newState.winner) {
            // No need to send separate game_over if full state includes winner
            // io.to(gameId).emit('game_over', { winner: newState.winner, winningLine: newState.winningLine, timestamp: Date.now() });
          }

        } catch (error) {
          console.error(`Error handling ${actionType}:`, error);
          socket.emit('game_error', { message: `Failed to process ${actionType}.` });
        }
    };

    socket.on('place_pawn', (data) => handlePlayerAction('place_pawn', data.gameId, data));
    socket.on('move_pawn', (data) => handlePlayerAction('move_pawn', data.gameId, data));

    socket.on('request_full_state', async ({ gameId }: { gameId: string}) => {
        const game = await gameStore.getGame(gameId);
        if (game) {
            const binaryState = serializeGameState(game.state);
            const compressedState = LZString.compressToUint8Array(binaryState);
            socket.emit('game_updated', { 
                gameState: compressedState, 
                timestamp: Date.now(),
                fullUpdate: true
            });
        }
    });

    socket.on('disconnect', async () => {
      console.log('Player disconnected:', socket.id);
      if (currentJoinedGameId) {
        try {
          const removedPlayer = await gameStore.removePlayerFromGame(currentJoinedGameId, socket.id);
          if (removedPlayer) {
            const game = await gameStore.getGame(currentJoinedGameId);
            const remainingPlayers = game ? game.players.map((p: any) => ({id: p.id, name: p.name, playerId: p.playerId as PlayerId})) : [];
            
            io.to(currentJoinedGameId).emit('opponent_disconnected', {
              playerName: removedPlayer.name,
              playerId: removedPlayer.playerId,
              remainingPlayers,
              timestamp: Date.now()
            });
            console.log(`Player ${removedPlayer.name} left game ${currentJoinedGameId}`);
          }
          previousStates.delete(currentJoinedGameId);
        } catch (error) {
          console.error('Error handling disconnection:', error);
        }
      }
      await redis.zrem('matchmaking_queue', socket.id);
      await redis.del(`player:${socket.id}`);
    });

    socket.on('join_matchmaking', async ({ playerName, rating }: {playerName: string, rating?: number}) => {
      try {
        if (!playerName || typeof playerName !== 'string' || playerName.length > 30) {
          socket.emit('game_error', { message: 'Invalid player name for matchmaking.' });
          return;
        }
        await redis.zadd('matchmaking_queue', rating || 1000, socket.id);
        await redis.set(`player:${socket.id}`, JSON.stringify({ id: socket.id, name: playerName, rating: rating || 1000, joinTime: Date.now() }));
        
        socket.emit('matchmaking_joined', {
          message: 'Added to matchmaking queue.',
          position: await redis.zcount('matchmaking_queue', '-inf', '+inf'), // Total players in queue
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error joining matchmaking:', error);
        socket.emit('game_error', { message: 'Failed to join matchmaking queue.' });
      }
    });

    socket.on('leave_matchmaking', async () => {
      try {
        await redis.zrem('matchmaking_queue', socket.id);
        await redis.del(`player:${socket.id}`);
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
}
