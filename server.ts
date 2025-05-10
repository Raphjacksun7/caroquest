
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { setupGameSockets } from './src/lib/socketHandler';
import { setupMatchmaking } from './src/lib/matchmaking';
import { gameStore } from './src/lib/gameStore'; 

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

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
  
  setupMatchmaking(io, gameStore); 
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
      process.exit(1); 
    }
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}. Initiating graceful shutdown...`);
    
    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        console.error('Error closing HTTP server:', err);
        process.exit(1); // Exit with error if server close fails
      }
      console.log('HTTP server closed.');

      // Cleanup game store
      if (gameStore && typeof gameStore.destroy === 'function') {
        try {
          gameStore.destroy();
          console.log('GameStore destroyed.');
        } catch (storeError) {
          console.error('Error destroying GameStore:', storeError);
        }
      }
      
      // Disconnect Socket.IO clients
      io.close((ioErr) => {
        if (ioErr) {
          console.error('Error closing Socket.IO server:', ioErr);
        } else {
          console.log('Socket.IO server closed.');
        }
        // Exit process once all cleanup is done
        process.exit(0);
      });
    });

    // Force close server after timeout if graceful shutdown fails
    setTimeout(() => {
      console.error('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000); // 10 seconds timeout
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

}).catch(ex => {
  console.error("Error during app preparation or server start:", ex.stack || ex);
  process.exit(1);
});
