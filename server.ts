
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { setupGameSockets } from './src/lib/socketHandler';
// import { setupMatchmaking } from './src/lib/matchmaking'; // Matchmaking with Redis removed for now
import { GameStore } from './src/lib/gameStore';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize in-memory game store
const gameStore = new GameStore();

app.prepare().then(async () => {
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
      origin: (process.env.NEXT_PUBLIC_BASE_URL ? process.env.NEXT_PUBLIC_BASE_URL.split(',') : "*"),
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
  
  console.log('Socket.IO: Using in-memory adapter. Multiplayer features will be limited to a single server instance.');
  
  // Matchmaking with Redis is removed. If a simple in-memory matchmaking is needed, it would be set up here.
  // For now, direct game creation/joining will be the focus.
  // setupMatchmaking(gameStore, io); 

  setupGameSockets(io, gameStore);

  server.listen(port, (err?: any) => {
    if (err) {
        console.error("Failed to start server:", err);
        throw err;
    }
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Socket.IO server initialized. CORS origin: ${process.env.NEXT_PUBLIC_BASE_URL || "*"}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Please use a different port.`);
    }
    // No process.exit(1) here to allow Next.js to handle its lifecycle in dev
  });

}).catch(ex => {
  console.error("Error during app preparation or server start:", ex.stack || ex);
  process.exit(1);
});

const gracefulShutdown = () => {
  console.log('Initiating graceful shutdown...');
  if (gameStore) {
    gameStore.destroy(); // Ensure GameStore has a destroy method for cleanup
  }
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
