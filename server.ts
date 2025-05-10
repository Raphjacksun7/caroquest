
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { setupGameSockets } from './src/lib/socketHandler';
import { setupMatchmaking } from './src/lib/matchmaking';
// Import the gameStore instance directly
import { gameStore } from './src/lib/gameStore';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Ensure PORT environment variable is used, or default to 3000
const port = parseInt(process.env.PORT || "3000", 10);

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
      origin: "*", 
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
  
  // Setup matchmaking system (now in-memory)
  setupMatchmaking(io, gameStore);

  // Pass the instantiated gameStore to setupGameSockets
  setupGameSockets(io, gameStore);

  server.listen(port, (err?: any) => {
    if (err) {
        console.error("Failed to start server:", err);
        throw err;
    }
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Socket.IO server initialized. CORS origin: *`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Please use a different port.`);
    }
  });

}).catch(ex => {
  console.error("Error during app preparation or server start:", ex.stack || ex);
  process.exit(1);
});

const gracefulShutdown = () => {
  console.log('Initiating graceful shutdown...');
  // gameStore is now directly an instance of a class implementing GameStore interface
  if (gameStore && typeof gameStore.destroy === 'function') {
    gameStore.destroy();
  }
  // Ensure other resources are cleaned up if necessary
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
