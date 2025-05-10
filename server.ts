
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
// import Redis from 'ioredis'; // Redis removed
// import { flatbuffers } from 'flatbuffers'; // Not used directly in this file
// import { GameStateBuffer } from './src/lib/generated/game-state'; // Not used directly
import { setupGameSockets } from './src/lib/socketHandler';
// import { setupMatchmaking } from './src/lib/matchmaking'; // Matchmaking system removed
import { GameStore } from './src/lib/gameStore';

// const redisConnectionString = process.env.REDIS_URL || 'redis://localhost:6379'; // Redis removed

// Create Redis client for GameStore // Redis removed
/*
const redisClientOptions = {
  retryStrategy: (times: number) => { // Added type for 'times'
    const delay = Math.min(times * 50, 2000); // Max 2s delay
    console.warn(`Redis: Retrying connection (attempt ${times}), delay ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
};
*/

// const redis = new Redis(redisConnectionString, redisClientOptions); // Redis removed
// const redisSub = new Redis(redisConnectionString, redisClientOptions); // Redis removed

/* Redis event listeners removed
redis.on('connect', () => {
  console.log('Redis: Connected to server.');
});
redis.on('ready', () => {
  console.log('Redis: Client is ready.');
});
redis.on('error', (err) => {
  console.error('Redis: Connection error:', err.message);
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
*/

// Initialize game store with an in-memory solution
const gameStore = new GameStore(); // Changed from new GameStore(redis)

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = parseInt(process.env.PORT || "3000", 10);

app.prepare().then(() => {
  const server = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
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
  
  // No Redis pub/sub needed for in-memory store

  // Matchmaking system removed
  // setupMatchmaking(gameStore, redis); 

  // Setup game socket handlers
  setupGameSockets(io, gameStore); // Removed redis argument

  server.listen(port, (err?: any) => {
    if (err) {
        console.error("Failed to start server:", err);
        // process.exit(1); // Exit if server fails to start
        throw err; // Re-throw for Next.js to handle if it can
    }
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Socket.IO server initialized. CORS origin: ${process.env.NEXT_PUBLIC_BASE_URL || "*"}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Please use a different port.`);
    }
    process.exit(1);
  });

}).catch(ex => {
  console.error("Error during app preparation or server start:", ex.stack || ex);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  // redis.quit(); // Redis removed
  // if (redisSub) redisSub.quit(); // Redis removed
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  // redis.quit(); // Redis removed
  // if (redisSub) redisSub.quit(); // Redis removed
  process.exit(0);
});
