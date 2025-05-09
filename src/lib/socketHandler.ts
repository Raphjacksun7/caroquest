
import type { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { 
  createInitialGameState, 
  placePawn, 
  movePawn,
  type GameState, // Import GameState type
  type PlayerId
} from './gameLogic'; // Correct path assuming gameLogic.ts is in the same directory
import type { PlayerInfo } from '@/types/socket'; // Using existing PlayerInfo

interface GameRoom {
  state: GameState;
  players: PlayerInfo[];
  lastActivity: number;
  options?: any; // For future game options like 'isPublic'
}

// In-memory game storage (can be moved to Redis later)
const games = new Map<string, GameRoom>();

export function setupGameSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('New client connected via integrated server:', socket.id);

    // Create a new game
    socket.on('create_game', ({ playerName, gameId: requestedGameId, options = {} }: { playerName: string, gameId: string, options?: any }) => {
      // If a specific gameId is requested, check if it already exists
      if (games.has(requestedGameId)) {
        socket.emit('game_error', { message: 'Game ID already exists. Try joining or use a different ID.' });
        return;
      }
      
      const gameIdToUse = requestedGameId || uuidv4().substring(0, 8);

      const newPlayer: PlayerInfo = { id: socket.id, name: playerName, playerId: 1 };
      const game: GameRoom = {
        state: createInitialGameState(),
        players: [newPlayer],
        lastActivity: Date.now(),
        options
      };
      
      games.set(gameIdToUse, game);
      socket.join(gameIdToUse);
      
      socket.emit('game_created', { 
        gameId: gameIdToUse, 
        playerId: newPlayer.playerId, 
        gameState: game.state,
        players: game.players 
      });
      
      console.log(`Game created: ${gameIdToUse} by ${playerName} (Player 1)`);
    });

    // Join an existing game
    socket.on('join_game', ({ gameId, playerName }: { gameId: string, playerName: string }) => {
      const game = games.get(gameId);
      if (!game) {
        socket.emit('game_error', { message: 'Game not found.' });
        return;
      }
      
      // Check if player is rejoining
      const existingPlayer = game.players.find(p => p.name === playerName); // Simple name check for rejoin demonstration
      if (existingPlayer) {
          // If player exists, update their socket ID and rejoin them
          existingPlayer.id = socket.id;
          socket.join(gameId);
          socket.emit('game_joined', { 
            gameId, 
            playerId: existingPlayer.playerId, 
            gameState: game.state,
            players: game.players
          });
          // Notify other player about rejoin if they exist
          const otherPlayer = game.players.find(p => p.id !== socket.id);
            if (otherPlayer) {
                io.to(otherPlayer.id).emit('opponent_rejoined', { opponentName: existingPlayer.name, players: game.players });
            }
          console.log(`${existingPlayer.name} (Player ${existingPlayer.playerId}) re-joined game: ${gameId}`);
          return;
      }


      if (game.players.length >= 2) {
        socket.emit('game_error', { message: 'Game is full.' });
        return;
      }
      
      const newPlayerId = game.players[0].playerId === 1 ? 2 : 1;
      const newPlayer: PlayerInfo = { id: socket.id, name: playerName, playerId: newPlayerId };
      game.players.push(newPlayer);
      game.lastActivity = Date.now();
      socket.join(gameId);
      
      socket.emit('game_joined', { 
        gameId, 
        playerId: newPlayer.playerId, 
        gameState: game.state,
        players: game.players
      });
      
      const otherPlayer = game.players.find(p => p.id !== socket.id);
      if (otherPlayer) {
        io.to(otherPlayer.id).emit('opponent_joined', { opponentName: newPlayer.name, opponentPlayerId: newPlayer.playerId, players: game.players });
      }
      console.log(`${playerName} (Player ${newPlayer.playerId}) joined game: ${gameId}`);

      if (game.players.length === 2) {
        io.to(gameId).emit('game_start', { gameState: game.state, players: game.players });
        console.log(`Game started: ${gameId}`);
      }
    });

    socket.on('place_pawn', ({ gameId, squareIndex }: { gameId: string, squareIndex: number }) => {
      const game = games.get(gameId);
      if (!game) return socket.emit('game_error', { message: 'Game not found.' });

      const player = game.players.find(p => p.id === socket.id);
      if (!player || game.state.currentPlayerId !== player.playerId) {
        return socket.emit('game_error', { message: 'Not your turn or not in game.' });
      }
      
      game.lastActivity = Date.now();
      const newState = placePawn(game.state, squareIndex);
      if (!newState) {
        return socket.emit('game_error', { message: 'Invalid placement.' });
      }
      
      game.state = newState;
      io.to(gameId).emit('game_updated', { gameState: game.state });
      if(newState.winner) {
        io.to(gameId).emit('game_over', { winner: newState.winner, winningLine: newState.winningLine });
      }
    });

    socket.on('move_pawn', ({ gameId, fromIndex, toIndex }: { gameId: string, fromIndex: number, toIndex: number }) => {
      const game = games.get(gameId);
      if (!game) return socket.emit('game_error', { message: 'Game not found.' });

      const player = game.players.find(p => p.id === socket.id);
      if (!player || game.state.currentPlayerId !== player.playerId) {
        return socket.emit('game_error', { message: 'Not your turn or not in game.' });
      }
      
      game.lastActivity = Date.now();
      const newState = movePawn(game.state, fromIndex, toIndex);
      if (!newState) {
        return socket.emit('game_error', { message: 'Invalid move.' });
      }
      
      game.state = newState;
      io.to(gameId).emit('game_updated', { gameState: game.state });
      if(newState.winner) {
        io.to(gameId).emit('game_over', { winner: newState.winner, winningLine: newState.winningLine });
      }
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      games.forEach((game, gameId) => {
        const playerIndex = game.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          const disconnectedPlayer = game.players.splice(playerIndex, 1)[0];
          console.log(`${disconnectedPlayer.name} left game ${gameId}`);
          
          if (game.players.length > 0) {
            io.to(gameId).emit('player_left', { playerName: disconnectedPlayer.name, playerId: disconnectedPlayer.playerId, remainingPlayers: game.players });
          }
          
          if (game.players.length === 0) {
            games.delete(gameId);
            console.log(`Game room ${gameId} closed as all players left.`);
          }
        }
      });
    });
  });

  // Clean up stale games (e.g., inactive for 30 minutes)
  setInterval(() => {
    const now = Date.now();
    for (const [gameId, game] of games.entries()) {
      if (now - game.lastActivity > 30 * 60 * 1000) { // 30 minutes
        console.log(`Deleting stale game: ${gameId}`);
        games.delete(gameId);
        // Optionally, notify players if they are still connected to this game room
        io.to(gameId).emit('game_error', {message: 'Game has ended due to inactivity.'});
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}
