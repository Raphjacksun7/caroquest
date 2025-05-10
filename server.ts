
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
// import { flatbuffers } from 'flatbuffers'; // Not used directly
// import { GameStateBuffer } from './src/lib/generated/game-state'; // Not used directly
import { setupGameSockets } from './src/lib/socketHandler';
import { setupMatchmaking } from './src/lib/matchmaking';
import { GameStore } from './src/lib/gameStore';
import { createAdapter } from '@socket.io/redis-adapter';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = parseInt(process.env.PORT || "3000", 10);

const redisConnectionString = process.env.REDIS_URL || 'redis://localhost:6379';
let redis: Redis | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let gameStore: GameStore;

async function initializeRedis() {
  try {
    const client = new Redis(redisConnectionString, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 100, 2000); // Exponential backoff
        console.warn(`Redis: Retrying connection (attempt ${times}), delay ${delay}ms`);
        return delay;
      },
      enableOfflineQueue: false, // Don't queue commands if not connected
    });

    await client.ping(); // Check connection
    console.log('Redis: Connected to server successfully.');
    redis = client; // Main client for GameStore
    
    // For Socket.IO adapter and pub/sub, duplicate connections are recommended
    pubClient = redis.duplicate();
    subClient = redis.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    console.log('Redis: Pub/Sub clients connected.');
    
    return true;
  } catch (err: any) {
    console.error('Redis: Failed to connect to Redis. Features requiring Redis (like remote multiplayer persistence and matchmaking) will be degraded or unavailable.', err.message);
    if (redis) {
      redis.disconnect();
      redis = null;
    }
    if (pubClient) {
        pubClient.disconnect();
        pubClient = null;
    }
    if (subClient) {
        subClient.disconnect();
        subClient = null;
    }
    return false;
  }
}

app.prepare().then(async () => {
  const redisAvailable = await initializeRedis();

  // Initialize game store with Redis if available, otherwise in-memory
  gameStore = new GameStore(redis); // gameStore will handle redis being null

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
      origin: process.env.NEXT_PUBLIC_BASE_URL ? process.env.NEXT_PUBLIC_BASE_URL.split(',') : "*",
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
  
  if (redisAvailable && pubClient && subClient) {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.IO: Redis adapter configured.');

    subClient.subscribe('game-events', (err) => {
      if (err) {
        console.error('Redis: Failed to subscribe to game-events', err);
      } else {
        console.log('Redis: Subscribed to game-events channel.');
      }
    });

    subClient.on('message', (channel, message) => {
      if (channel === 'game-events') {
        try {
          const event = JSON.parse(message);
          if (event.gameId && event.type && event.data) { // Ensure data exists
            io.to(event.gameId).emit(event.type, event.data);
          }
        } catch (e) {
          console.error('Redis: Error parsing game-event message:', e);
        }
      }
    });
  } else {
    console.warn('Socket.IO: Running without Redis adapter. Scalability will be limited to a single instance.');
    console.warn('Redis: Pub/Sub for game-events is disabled.');
  }
  
  setupMatchmaking(gameStore, redis); // Pass potentially null redis
  setupGameSockets(io, gameStore, redis); // Pass potentially null redis

  server.listen(port, (err?: any) => { // Added type for err
    if (err) {
        console.error("Failed to start server:", err);
        throw err;
    }
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Socket.IO server initialized. CORS origin: ${process.env.NEXT_PUBLIC_BASE_URL || "*"}`);
    if (!redisAvailable) {
      console.warn("> WARNING: Redis is not connected. Multiplayer features will be limited and game data will not persist across server restarts.");
    }
  });

  server.on('error', (err: NodeJS.ErrnoException) => { // Explicitly type err
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

const gracefulShutdown = () => {
  console.log('Initiating graceful shutdown...');
  if (redis) redis.disconnect();
  if (pubClient) pubClient.disconnect();
  if (subClient) subClient.disconnect();
  // Add any other cleanup tasks here
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
