
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
// import { flatbuffers } from 'flatbuffers'; // Not used directly in this file
// import { GameStateBuffer } from './src/lib/generated/game-state'; // Not used directly
import { setupGameSockets } from './src/lib/socketHandler';
// import { setupMatchmaking } from './src/lib/matchmaking'; // Matchmaking system removed
import { GameStore } from './src/lib/gameStore';

const redisConnectionString = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client for GameStore
const redisClientOptions = {
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000); // Max 2s delay
    console.warn(`Redis: Retrying connection (attempt ${times}), delay ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3, // Optional: limit retries for individual commands
};

const redis = new Redis(redisConnectionString, redisClientOptions);
// const redisSub = new Redis(redisConnectionString, redisClientOptions); // redisSub no longer needed for simple direct-to-game ID joining

redis.on('connect', () => {
  console.log('Redis: Connected to server.');
});
redis.on('ready', () => {
  console.log('Redis: Client is ready.');
});
redis.on('error', (err) => {
  console.error('Redis: Connection error:', err.message);
  // Depending on the app's resilience strategy, you might want to exit or attempt to operate without Redis.
  // For this game, Redis is critical for game state.
});
redis.on('close', () => {
  console.log('Redis: Connection closed.');
});
redis.on('reconnecting', () => {
  console.log('Redis: Reconnecting...');
});
redis.on('end', () => {
  console.log('Redis: Connection ended. This usually means all retry attempts failed.');
});


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

  // Matchmaking system removed
  // setupMatchmaking(gameStore, redis); 

  // Setup game socket handlers
  setupGameSockets(io, gameStore, redis); // Pass redis if socketHandler needs it

  server.listen(port, (err?: any) => {
    if (err) {
        console.error("Failed to start server:", err);
        throw err;
    }
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Socket.IO server initialized. CORS origin: ${process.env.NEXT_PUBLIC_BASE_URL || "*"}`);
  });
}).catch(ex => {
  console.error("Error during app preparation or server start:", ex.stack || ex);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server and Redis connections');
  redis.quit();
  // if (redisSub) redisSub.quit(); // If redisSub was used
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server and Redis connections');
  redis.quit();
  // if (redisSub) redisSub.quit(); // If redisSub was used
  process.exit(0);
});
