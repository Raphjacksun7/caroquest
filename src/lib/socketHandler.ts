
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { GameStore } from './gameStore'; 
import { 
  serializeGameState, 
  createDeltaUpdate 
} from './serialization';
import { 
  createInitialGameState, // Make sure this is exported from gameLogic if used here
  placePawn as placePawnLogic, // Alias to avoid conflict if there's a local 'placePawn'
  movePawn as movePawnLogic   // Alias to avoid conflict
} from './gameLogic'; // Corrected import path
import type { GameState, PlayerId, GameOptions, StoredPlayer } from './types';
import LZString from 'lz-string';

const RATE_LIMIT_CONFIG = {
  maxRequests: 20, 
  timeWindowMs: 1000 
};

const MOVE_TIMING_CONFIG = {
  minTimeBetweenMovesMs: 200, 
  maxClientServerTimeDriftMs: 5000 
};

interface ClientRateLimitInfo {
  count: number;
  lastResetTime: number;
}

export function setupGameSockets(io: SocketIOServer, gameStore: GameStore) {
  const clientRateLimits = new Map<string, ClientRateLimitInfo>();
  const gamePreviousStates = new Map<string, GameState>(); 

  io.use((socket, next) => {
    try {
      const clientIp = (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || socket.handshake.address;
      const currentTime = Date.now();
      
      let rateLimitInfo = clientRateLimits.get(clientIp);
      if (!rateLimitInfo || (currentTime - rateLimitInfo.lastResetTime > RATE_LIMIT_CONFIG.timeWindowMs)) {
        rateLimitInfo = { count: 1, lastResetTime: currentTime };
        clientRateLimits.set(clientIp, rateLimitInfo);
      } else {
        rateLimitInfo.count++;
        if (rateLimitInfo.count > RATE_LIMIT_CONFIG.maxRequests) {
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
    console.log('Socket.IO: New connection:', socket.id);
    let currentJoinedGameId: string | null = null; 

    socket.on('ping_time', () => {
      try {
        socket.emit('pong_time', Date.now());
      } catch (error) {
        console.error("Error emitting pong_time:", error);
      }
    });

    socket.on('create_game', async ({ playerName, options = {} }: {playerName: string, options?: GameOptions}) => {
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
        gamePreviousStates.set(gameId, JSON.parse(JSON.stringify(game.state)));
        
        const binaryState = serializeGameState(game.state);
        const compressedState = LZString.compressToUint8Array(binaryState);
        
        socket.emit('game_created', { 
          gameId, 
          playerId: 1 as PlayerId, 
          gameState: Array.from(compressedState), // Convert Uint8Array to number[]
          players: game.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId})),
          timestamp: Date.now()
        });
        console.log(`Socket.IO: Game created: ${gameId} by ${playerName} (Socket: ${socket.id})`);
      } catch (error: any) {
        console.error('Socket.IO: Error creating game:', error);
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
        
        const existingPlayer = game.players.find(p => p.id === socket.id);
        if (existingPlayer) {
            socket.join(gameId);
            currentJoinedGameId = gameId;
            if (!gamePreviousStates.has(gameId)) {
                 gamePreviousStates.set(gameId, JSON.parse(JSON.stringify(game.state)));
            }
            const binaryState = serializeGameState(game.state);
            const compressedState = LZString.compressToUint8Array(binaryState);
            socket.emit('game_joined', { 
              gameId, 
              playerId: existingPlayer.playerId, 
              gameState: Array.from(compressedState), // Convert Uint8Array to number[]
              players: game.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId})),
              opponentName: game.players.find(p => p.id !== socket.id)?.name || null,
              timestamp: Date.now()
            });
            console.log(`Socket.IO: ${existingPlayer.name} re-joined game: ${gameId}`);
            return;
        }

        if (game.players.length >= 2) {
          socket.emit('game_error', { message: 'Game is full.' });
          return;
        }
        
        const result = await gameStore.addPlayerToGame(gameId, socket.id, playerName.trim());
        
        if (!result.success || result.assignedPlayerId === undefined) { 
          socket.emit('game_error', { message: result.error || 'Failed to join game. Room might be full or an error occurred.' });
          return;
        }
        
        socket.join(gameId);
        currentJoinedGameId = gameId;
        const updatedGame = await gameStore.getGame(gameId); 
        if (!updatedGame) {
             socket.emit('game_error', { message: 'Failed to retrieve game after join.' });
             return;
        }
        gamePreviousStates.set(gameId, JSON.parse(JSON.stringify(updatedGame.state)));
        
        const binaryStateOnJoin = serializeGameState(updatedGame.state);
        const compressedStateOnJoin = LZString.compressToUint8Array(binaryStateOnJoin);
        
        socket.emit('game_joined', { 
          gameId, 
          playerId: result.assignedPlayerId, 
          gameState: Array.from(compressedStateOnJoin), // Convert Uint8Array to number[]
          players: updatedGame.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId})),
          opponentName: updatedGame.players.find(p => p.id !== socket.id)?.name || null,
          timestamp: Date.now()
        });
        
        const opponentJoinedPayload = { 
            opponentName: playerName, 
            players: updatedGame.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId})),
            timestamp: Date.now()
        };
        socket.to(gameId).emit('opponent_joined', opponentJoinedPayload);
        
        if (updatedGame.players.length === 2) {
            const gameStartPayload = { 
                gameState: Array.from(compressedStateOnJoin), // Convert Uint8Array to number[]
                players: updatedGame.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId})),
                timestamp: Date.now() 
            };
            io.to(gameId).emit('game_start', gameStartPayload);
            console.log(`Socket.IO: Game started: ${gameId}`);
        }
        console.log(`Socket.IO: Player ${playerName} (Player ${result.assignedPlayerId}) joined game: ${gameId}`);

      } catch (error: any) {
        console.error('Socket.IO: Error joining game:', error);
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
          if (Math.abs(serverTime - actionData.clientTimestamp) > MOVE_TIMING_CONFIG.maxClientServerTimeDriftMs) {
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

          const player = game.players.find(p => p.id === socket.id);
          if (!player || player.playerId !== game.state.currentPlayerId) {
            socket.emit('game_error', { message: 'Not your turn or not in game.' }); return;
          }
          
          let newState: GameState | null = null;
          const currentGameState = game.state; 

          if (actionType === 'place_pawn' && typeof actionData.squareIndex === 'number') {
            newState = placePawnLogic(currentGameState, actionData.squareIndex);
          } else if (actionType === 'move_pawn' && typeof actionData.fromIndex === 'number' && typeof actionData.toIndex === 'number') {
            newState = movePawnLogic(currentGameState, actionData.fromIndex, actionData.toIndex);
          }

          if (!newState) {
            socket.emit('game_error', { message: 'Invalid move.' }); return;
          }
          
          const updateSuccess = await gameStore.updateGameState(gameId, newState);
          if (!updateSuccess) {
            socket.emit('game_error', { message: 'Failed to update game state on server.' }); return;
          }
          
          const prevState = gamePreviousStates.get(gameId) || currentGameState; 
          const deltaUpdates = createDeltaUpdate(prevState, newState);
          gamePreviousStates.set(gameId, JSON.parse(JSON.stringify(newState))); 
          
          const updatedGame = await gameStore.getGame(gameId); 
          if (!updatedGame) { socket.emit('game_error', { message: 'Internal server error retrieving updated game.' }); return;}

          const shouldSendFullState = updatedGame.sequenceId % 10 === 0 || deltaUpdates.length > 10;

          if (shouldSendFullState) {
            const binaryStateFull = serializeGameState(newState);
            const compressedStateFull = LZString.compressToUint8Array(binaryStateFull); // Corrected variable name
            io.to(gameId).emit('game_updated', { 
              gameState: Array.from(compressedStateFull), // Convert Uint8Array to number[]
              timestamp: Date.now(),
              fullUpdate: true 
            });
          } else {
            io.to(gameId).emit('game_delta', {
              updates: deltaUpdates,
              seqId: updatedGame.sequenceId, 
              timestamp: Date.now()
            });
          }
        } catch (error: any) {
          console.error(`Socket.IO: Error handling ${actionType}:`, error);
          socket.emit('game_error', { message: `Failed to process ${actionType}: ${error.message || 'Unknown error'}` });
        }
    };

    socket.on('place_pawn', (data) => handlePlayerAction('place_pawn', data.gameId, data));
    socket.on('move_pawn', (data) => handlePlayerAction('move_pawn', data.gameId, data));

    socket.on('request_full_state', async ({ gameId }: { gameId: string}) => {
      try {
        const game = await gameStore.getGame(gameId);
        if (game) {
            const binaryStateFull = serializeGameState(game.state);
            const compressedStateFull = LZString.compressToUint8Array(binaryStateFull);
            const fullStateData = { 
                gameState: Array.from(compressedStateFull), // Convert Uint8Array to number[]
                timestamp: Date.now(),
                fullUpdate: true
            };
            socket.emit('game_updated', fullStateData);
        } else {
            socket.emit('game_error', { message: `Full state requested for non-existent game: ${gameId}` });
        }
      } catch (error: any) {
        console.error('Socket.IO: Error sending full state:', error);
        socket.emit('game_error', { message: `Failed to send full game state: ${error.message || 'Unknown error'}`});
      }
    });

    socket.on('disconnect', async (reason) => {
      console.log(`Socket.IO: Player disconnected: ${socket.id}, Reason: ${reason}`);
      if (currentJoinedGameId) {
        try {
          const removedPlayer = await gameStore.removePlayerFromGame(currentJoinedGameId, socket.id);
          if (removedPlayer) {
            const game = await gameStore.getGame(currentJoinedGameId); 
            const remainingPlayers = game ? game.players.map(p => ({id: p.id, name: p.name, playerId: p.playerId})) : [];
            
            const opponentDisconnectedPayload = {
              playerName: removedPlayer.name,
              playerId: removedPlayer.playerId,
              remainingPlayers,
              timestamp: Date.now()
            };
            io.to(currentJoinedGameId).emit('opponent_disconnected', opponentDisconnectedPayload);
            console.log(`Socket.IO: Player ${removedPlayer.name} (Socket: ${socket.id}) left game ${currentJoinedGameId}`);
            
            if (!game || game.players.length === 0) {
                 gamePreviousStates.delete(currentJoinedGameId);
            }
          }
        } catch (error: any) {
          console.error('Socket.IO: Error handling disconnection:', error);
        }
        currentJoinedGameId = null; 
      }
    });
  });
}
