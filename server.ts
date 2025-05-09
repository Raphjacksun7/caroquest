
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io'; // Renamed to avoid conflict
import Redis from 'ioredis';
// import { flatbuffers } from 'flatbuffers'; // Not directly used in server.ts, but in serialization
// import { GameStateBuffer } from './src/lib/generated/game-state'; // Not directly used here
import { setupGameSockets } from './src/lib/socketHandler';
import { setupMatchmaking } from './src/lib/matchmaking';
import { GameStore } from './src/lib/gameStore';

// Create Redis clients
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Initialize game store with Redis
const gameStore = new GameStore(redis);

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = parseInt(process.env.PORT || "3000", 10); // Use port 3000 as per new spec

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.io with compression
  const io = new SocketIOServer(server, { // Use renamed Server
    cors: {
      origin: process.env.NEXT_PUBLIC_BASE_URL || "*", // Allow all for dev
      methods: ["GET", "POST"]
    },
    // Enable compression
    perMessageDeflate: {
      threshold: 1024, // Only compress messages larger than 1KB
      zlibDeflateOptions: {
        // See zlib defaults.
        chunkSize: 8 * 1024, // 8KB
        level: 6, // Compression level (0-9)
        memLevel: 8 // Memory level (1-9)
      }
    },
    // Optimized ping settings
    pingInterval: 25000,
    pingTimeout: 5000
  });
  
  // Set up Redis pub/sub for cross-instance communication (relevant for scaled deployments)
  redisSub.subscribe('game-events', (err) => {
    if (err) {
      console.error('Failed to subscribe to Redis game-events:', err);
    } else {
      console.log('Subscribed to Redis game-events');
    }
  });
  redisSub.on('message', (channel, message) => {
    if (channel === 'game-events') {
      try {
        const event = JSON.parse(message);
        if (event.gameId && event.type) {
          // Forward the event to all clients in the game room
          io.to(event.gameId).emit(event.type, event.data);
        }
      } catch (e) {
        console.error('Error parsing Redis message:', e);
      }
    }
  });

  // Setup matchmaking system
  setupMatchmaking(gameStore, redis, io); // Pass io to matchmaking

  // Setup game socket handlers
  setupGameSockets(io, gameStore, redis);

  server.listen(port, (err?: any) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}).catch(ex => {
  console.error(ex.stack)
  process.exit(1)
});
