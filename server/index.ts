
import { createServer } from 'http';
import { Server, Socket as ServerSocket } from 'socket.io';
import express from 'express';
import { 
  createInitialGameState, 
  placePawn, 
  movePawn,
  GameState,
  PlayerId,
  SquareState
} from '../src/lib/gameLogic'; // Adjust path as necessary

interface PlayerInfo {
  id: string; // Socket ID
  name: string;
  playerId: PlayerId;
}

interface GameRoom {
  state: GameState;
  players: PlayerInfo[];
  moves: Array<{ type: 'place' | 'move'; playerId: PlayerId; data: any }>;
  gameId: string;
}

const app = express();
const httpServer = createServer(app);

const allowedOrigins: string[] = [];
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:9002'); // Default Next.js dev port
  allowedOrigins.push('http://127.0.0.1:9002');
}
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
} else {
  if (process.env.NODE_ENV !== 'production') {
    console.warn("WARN: FRONTEND_URL environment variable is not set. CORS might block connections from your cloud IDE's public URL. Consider setting it in your .env file.");
  }
}


const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`CORS Error: Origin ${origin} not allowed. Allowed origins: ${allowedOrigins.join(', ')}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"]
  }
});

const games = new Map<string, GameRoom>();

io.on('connection', (socket: ServerSocket) => {
  console.log('New client connected:', socket.id);

  socket.on('create_game', ({ playerName, gameId: requestedGameId }: { playerName: string, gameId: string }) => {
    if (games.has(requestedGameId)) {
      socket.emit('game_error', { message: 'Game ID already exists. Try joining or use a different ID.' });
      return;
    }

    const newGame: GameRoom = {
      gameId: requestedGameId,
      state: createInitialGameState(),
      players: [{ id: socket.id, name: playerName, playerId: 1 }],
      moves: []
    };
    games.set(requestedGameId, newGame);
    socket.join(requestedGameId);
    socket.emit('game_created', { gameId: newGame.gameId, playerId: 1, gameState: newGame.state, players: newGame.players });
    console.log(`Game created: ${requestedGameId} by ${playerName} (Player 1)`);
  });

  socket.on('join_game', ({ gameId, playerName }: { gameId: string, playerName: string }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('game_error', { message: 'Game not found.' });
      return;
    }

    if (game.players.length >= 2) {
      const existingPlayer = game.players.find(p => p.id === socket.id);
      if (existingPlayer) { // Player is rejoining
        socket.join(gameId);
        socket.emit('game_joined', { gameId, playerId: existingPlayer.playerId, gameState: game.state, players: game.players });
         // Notify other player about rejoin if they exist
        const otherPlayer = game.players.find(p => p.id !== socket.id);
        if (otherPlayer) {
            socket.to(otherPlayer.id).emit('opponent_rejoined', { opponentName: existingPlayer.name });
        }
      } else {
        socket.emit('game_error', { message: 'Game is full.' });
      }
      return;
    }
    
    const newPlayerId = game.players[0].playerId === 1 ? 2 : 1;
    const newPlayer: PlayerInfo = { id: socket.id, name: playerName, playerId: newPlayerId };
    game.players.push(newPlayer);
    
    socket.join(gameId);
    socket.emit('game_joined', { gameId, playerId: newPlayerId, gameState: game.state, players: game.players });
    
    // Notify other player
    const otherPlayer = game.players.find(p => p.id !== socket.id);
    if (otherPlayer) {
      io.to(otherPlayer.id).emit('opponent_joined', { opponentName: playerName, opponentPlayerId: newPlayerId, players: game.players });
    }
    console.log(`${playerName} (Player ${newPlayerId}) joined game: ${gameId}`);

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

    const newState = placePawn(game.state, squareIndex);
    if (!newState) {
      return socket.emit('game_error', { message: 'Invalid placement.' });
    }
    
    game.state = newState;
    game.moves.push({ type: 'place', playerId: player.playerId, data: { squareIndex } });
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
    
    const newState = movePawn(game.state, fromIndex, toIndex);
    if (!newState) {
      return socket.emit('game_error', { message: 'Invalid move.' });
    }
    
    game.state = newState;
    game.moves.push({ type: 'move', playerId: player.playerId, data: { fromIndex, toIndex } });
    io.to(gameId).emit('game_updated', { gameState: game.state });
    if(newState.winner) {
      io.to(gameId).emit('game_over', { winner: newState.winner, winningLine: newState.winningLine });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    games.forEach((game, gameId) => {
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const disconnectedPlayer = game.players.splice(playerIndex, 1)[0];
        console.log(`${disconnectedPlayer.name} left game ${gameId}`);
        // Notify remaining player(s)
        if (game.players.length > 0) {
            io.to(gameId).emit('player_left', { playerName: disconnectedPlayer.name, playerId: disconnectedPlayer.playerId, remainingPlayers: game.players });
        }
        
        // If all players leave or conditions for game closure met, delete the game room
        if (game.players.length === 0) {
          games.delete(gameId);
          console.log(`Game room ${gameId} closed.`);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
  if (allowedOrigins.length === 0) {
    console.warn("WARN: No allowed origins configured for CORS. This might be an issue in production if FRONTEND_URL is not set.");
  } else {
    console.log("Allowed CORS origins:", allowedOrigins.join(', '));
  }
});
