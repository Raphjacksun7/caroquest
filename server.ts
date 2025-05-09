
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { setupGameSockets } from './src/lib/socketHandler';
// import { setupMatchmaking } from './src/lib/matchmaking'; // Matchmaking system removed
import { GameStore } from './src/lib/gameStore';

// Create Redis client for GameStore
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
// redisSub is no longer needed if not using pub/sub for cross-instance matchmaking/events

// Initialize game store with Redis
const gameStore = new GameStore(redis);

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = parseInt(process.env.PORT || "3000", 10);

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_BASE_URL || "*", 
      methods: ["GET", "POST"]
    },
    perMessageDeflate: {
      threshold: 1024, 
      zlibDeflateOptions: {
        chunkSize: 8 * 1024, 
        level: 6, 
        memLevel: 8 
      }
    },
    pingInterval: 25000,
    pingTimeout: 5000
  });
  
  // No Redis pub/sub for 'game-events' needed for simple ID-based joining
  // If scaling to multiple instances later, this might be reconsidered for other events.

  // Matchmaking system removed
  // setupMatchmaking(gameStore, redis, io); 

  // Setup game socket handlers
  setupGameSockets(io, gameStore, redis); // Pass redis if socketHandler needs it (e.g., for rate limiting or other features)

  server.listen(port, (err?: any) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}).catch(ex => {
  console.error(ex.stack)
  process.exit(1)
});
