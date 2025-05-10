
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { Redis } from 'ioredis';
import type { GameStore, StoredPlayer } from './gameStore'; // Ensure StoredPlayer is exported from gameStore
import { 
  serializeGameState, 
  // deserializeGameState, // Not used on server-side directly for updates
  createDeltaUpdate // Used for delta updates if implemented
} from './serialization';
import { 
  placePawn, 
  movePawn, 
  // createInitialGameState // GameStore handles initial state
} from './gameLogic';
import type { GameState, PlayerId } from './types';
// import { v4 as uuidv4 } from 'uuid'; // GameStore handles ID generation
import LZString from 'lz-string';

const RATE_LIMIT = {
  maxRequests: 20, // Increased from 10 for slightly more leniency
  timeWindow: 1000 // 1 second
};

const MOVE_TIMING = {
  minTimeBetweenMoves: 200, // Adjusted from 300ms
  maxTimeVariance: 3000 // Increased variance for potential client clock drift
};

interface RateLimitInfo {
  count: number;
  lastReset: number;
}

export function setupGameSockets(io: SocketIOServer, gameStore: GameStore, redis: Redis) { // redis might not be needed if GameStore handles all redis interactions
  const rateLimits = new Map<string, RateLimitInfo>();
  const previousStates = new Map<string, GameState>(); 

  io.use((socket, next) => {
    try {
      const clientIp = (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || socket.handshake.address;
      const now = Date.now();
      
      let limitInfo = rateLimits.get(clientIp);
      if (!limitInfo || (now - limitInfo.lastReset > RATE_LIMIT.timeWindow)) {
        limitInfo = { count: 1, lastReset: now };
        rateLimits.set(clientIp, limitInfo);
      } else {
        limitInfo.count++;
        if (limitInfo.count > RATE_LIMIT.maxRequests) {
          console.warn(`Rate limit exceeded for IP: ${clientIp}`);
          return next(new Error('Rate limit exceeded. Please try again shortly.'));
        }
      }
      next();
    } catch (error) {
        console.error("Error in rate limiting middleware:", error);
        next(new Error("Internal server error during rate limit check."));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log('New connection:', socket.id);
    let currentJoinedGameId: string | null = null; // Track game ID per socket

    socket.on('ping_time', () => {
      try {
        socket.emit('pong_time', Date.now());
      } catch (error) {
        console.error("Error emitting pong_time:", error);
      }
    });

    socket.on('create_game', async ({ playerName, options = {} }: {playerName: string, options?: any}) => {
      try {
        if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0 || playerName.length > 30) {
          socket.emit('game_error', { message: 'Invalid player name.' });
          return;
        }
        
        const gameId = await gameStore.createGame(socket.id, playerName.trim(), options);
        const game = await gameStore.getGame(gameId);
        
        if (!game) {
          socket.emit('game_error', { message: 'Failed to create game (internal error).' });
          return;
        }

        socket.join(gameId);
        currentJoinedGameId = gameId;
        previousStates.set(gameId, game.state);
        
        const binaryState = serializeGameState(game.state);
        // gameState is Uint8Array. LZString expects string for compressToUint8Array. This is incorrect usage.
        // Assuming serializeGameState produces a string or needs a different compression.
        // For now, let's assume serializeGameState returns Uint8Array and we send it directly or compress correctly.
        // If serializeGameState returns string:
        // const compressedState = LZString.compressToUint8Array(JSON.stringify(game.state));
        // If serializeGameState returns Uint8Array (as it seems to be intended):
        const compressedState = binaryState; // Send uncompressed or use a Uint8Array-compatible compression

        socket.emit('game_created', { 
          gameId, 
          playerId: 1 as PlayerId, 
          gameState: compressedState,
          players: game.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId})), // Ensure structure matches PlayerInfo
          timestamp: Date.now()
        });
        
        console.log(`Game created: ${gameId} by ${playerName} (Socket: ${socket.id})`);
      } catch (error: any) {
        console.error('Error creating game:', error);
        socket.emit('game_error', { message: `Failed to create game: ${error.message || 'Unknown error'}` });
      }
    });

    socket.on('join_game', async ({ gameId, playerName }: {gameId: string, playerName: string}) => {
      try {
        if (!gameId || typeof gameId !== 'string' || !playerName || typeof playerName !== 'string' || playerName.trim().length === 0 || playerName.length > 30) {
          socket.emit('game_error', { message: 'Invalid game ID or player name.' });
          return;
        }
        
        let game = await gameStore.getGame(gameId);
        if (!game) {
          socket.emit('game_error', { message: 'Game not found.' });
          return;
        }
        
        const existingPlayer = game.players.find((p: StoredPlayer) => p.id === socket.id);
        if (existingPlayer) {
            socket.join(gameId);
            currentJoinedGameId = gameId;
            if (!previousStates.has(gameId)) previousStates.set(gameId, game.state);

            const binaryState = serializeGameState(game.state);
            const compressedState = binaryState; 
            socket.emit('game_joined', { 
              gameId, 
              playerId: existingPlayer.playerId, 
              gameState: compressedState,
              players: game.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId})),
              opponentName: game.players.find((p:StoredPlayer) => p.id !== socket.id)?.name || null,
              timestamp: Date.now()
            });
            console.log(`${existingPlayer.name} re-joined game: ${gameId}`);
            return;
        }

        if (game.players.length >= 2) {
          socket.emit('game_error', { message: 'Game is full.' });
          return;
        }
        
        const result = await gameStore.addPlayerToGame(gameId, socket.id, playerName.trim());
        
        if (!result.success || result.assignedPlayerId === undefined) { 
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
        const compressedState = binaryState;
        
        socket.emit('game_joined', { 
          gameId, 
          playerId: result.assignedPlayerId, 
          gameState: compressedState,
          players: updatedGame.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId})),
          opponentName: updatedGame.players.find((p:StoredPlayer) => p.id !== socket.id)?.name || null,
          timestamp: Date.now()
        });
        
        io.to(gameId).emit('opponent_joined', { 
            opponentName: playerName, 
            players: updatedGame.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId})),
            timestamp: Date.now()
        });
        
        if (updatedGame.players.length === 2) {
            io.to(gameId).emit('game_start', { 
                gameState: compressedState, 
                players: updatedGame.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId})),
                timestamp: Date.now() 
            });
            console.log(`Game started: ${gameId}`);
        }
        console.log(`Player ${playerName} (Player ${result.assignedPlayerId}) joined game: ${gameId}`);

      } catch (error: any) {
        console.error('Error joining game:', error);
        socket.emit('game_error', { message: `Failed to join game: ${error.message || 'Unknown error'}` });
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

          const player = game.players.find((p: StoredPlayer) => p.id === socket.id);
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
          
          const updateSuccess = await gameStore.updateGameState(gameId, newState);
          if (!updateSuccess) {
            socket.emit('game_error', { message: 'Failed to update game state on server.' }); return;
          }
          
          const prevState = previousStates.get(gameId);
          const deltaUpdates = prevState ? createDeltaUpdate(prevState, newState) : [];
          previousStates.set(gameId, newState);
          
          const currentFullGame = await gameStore.getGame(gameId); 
          if (!currentFullGame) { // Should not happen if updateGameState succeeded
             socket.emit('game_error', { message: 'Internal server error retrieving updated game.' }); return;
          }
          const shouldSendFullState = !currentFullGame || currentFullGame.sequenceId % 10 === 0 || deltaUpdates.length === 0 || deltaUpdates.length > 5; 

          const binaryStateToSend = serializeGameState(newState);
          const compressedStateToSend = binaryStateToSend; // Or apply LZString if it works for Uint8Array

          if (shouldSendFullState) {
            io.to(gameId).emit('game_updated', { 
              gameState: compressedStateToSend,
              timestamp: Date.now(),
              fullUpdate: true 
            });
          } else {
            io.to(gameId).emit('game_delta', { 
              updates: deltaUpdates,
              seqId: currentFullGame.sequenceId, 
              timestamp: Date.now()
            });
          }
        } catch (error: any) {
          console.error(`Error handling ${actionType}:`, error);
          socket.emit('game_error', { message: `Failed to process ${actionType}: ${error.message || 'Unknown error'}` });
        }
    };

    socket.on('place_pawn', (data) => handlePlayerAction('place_pawn', data.gameId, data));
    socket.on('move_pawn', (data) => handlePlayerAction('move_pawn', data.gameId, data));

    socket.on('request_full_state', async ({ gameId }: { gameId: string}) => {
      try {
        const game = await gameStore.getGame(gameId);
        if (game) {
            const binaryState = serializeGameState(game.state);
            const compressedState = binaryState; 
            socket.emit('game_updated', { 
                gameState: compressedState, 
                timestamp: Date.now(),
                fullUpdate: true
            });
        } else {
            socket.emit('game_error', { message: `Full state requested for non-existent game: ${gameId}` });
        }
      } catch (error: any) {
        console.error('Error sending full state:', error);
        socket.emit('game_error', { message: `Failed to send full game state: ${error.message || 'Unknown error'}`});
      }
    });

    socket.on('disconnect', async (reason) => {
      console.log(`Player disconnected: ${socket.id}, Reason: ${reason}`);
      if (currentJoinedGameId) {
        try {
          const removedPlayer = await gameStore.removePlayerFromGame(currentJoinedGameId, socket.id);
          if (removedPlayer) {
            const game = await gameStore.getGame(currentJoinedGameId); // Get potentially updated game
            const remainingPlayers = game ? game.players.map((p: StoredPlayer) => ({id: p.id, name: p.name, playerId: p.playerId})) : [];
            
            io.to(currentJoinedGameId).emit('opponent_disconnected', {
              playerName: removedPlayer.name,
              playerId: removedPlayer.playerId,
              remainingPlayers,
              timestamp: Date.now()
            });
            console.log(`Player ${removedPlayer.name} (Socket: ${socket.id}) left game ${currentJoinedGameId}`);
            
            if (!game || game.players.length === 0) {
                 previousStates.delete(currentJoinedGameId);
                 // Game will be cleaned up by GameStore if it becomes empty
            }
          }
        } catch (error: any) {
          console.error('Error handling disconnection:', error);
          // Avoid emitting error to a disconnected socket directly
        }
        currentJoinedGameId = null; // Clear game ID for this socket
      }
    });
  });
}
