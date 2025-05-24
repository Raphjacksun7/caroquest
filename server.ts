
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

const port: number = parseInt(process.env.PORT || "3000", 10);

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('SERVER: Error handling HTTP request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new SocketIOServer(server, { 
    cors: {
      origin: "*", 
      methods: ["GET", "POST"],
    },
    path: "/api/socketio/", 
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
  console.log('SERVER: Socket.IO server instance created on custom server.');

  io.engine.on("connection_error", (err: any) => {
    console.error("SERVER: Socket.IO Engine Connection Error:");
    console.error(`  Code: ${err.code}`);
    console.error(`  Message: ${err.message}`);
    if (err.context) {
      console.error(`  Context: ${JSON.stringify(err.context)}`);
    }
    if (err.req) {
        console.error(`  Request URL: ${err.req.url}`);
        console.error(`  Request Headers: ${JSON.stringify(err.req.headers)}`);
    }
  });
  
  console.log('SERVER: Socket.IO: Using in-memory adapter. Multiplayer features will be limited to a single server instance.');
  
  setupMatchmaking(io, gameStore); 
  setupGameSockets(io, gameStore);

  server.listen(port, (err?: Error) => { 
    if (err) {
        console.error("SERVER: Failed to start HTTP server:", err);
        throw err;
    }
    console.log(`SERVER: > Ready on http://localhost:${port}`);
    console.log(`SERVER: > Socket.IO server initialized at path /api/socketio/. CORS origin: *`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => { 
    console.error('SERVER: HTTP Server error:', err); 
    if (err.code === 'EADDRINUSE') {
      console.error(`SERVER: Port ${port} is already in use. Please use a different port.`);
      process.exit(1);
    }
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`SERVER: Received ${signal}. Initiating graceful shutdown...`);
    
    server.close((err?: Error) => { 
      if (err) {
        console.error('SERVER: Error closing HTTP server:', err);
      } else {
        console.log('SERVER: HTTP server closed.');
      }

      if (gameStore && typeof gameStore.destroy === 'function') {
        try {
          gameStore.destroy();
          console.log('SERVER: GameStore destroyed.');
        } catch (storeError) {
          console.error('SERVER: Error destroying GameStore:', storeError);
        }
      } else {
        console.warn('SERVER: GameStore not available or destroy method missing during shutdown.');
      }
      
      io.close((ioErr?: Error) => { 
        if (ioErr) {
          console.error('SERVER: Error closing Socket.IO server:', ioErr);
        } else {
          console.log('SERVER: Socket.IO server closed.');
        }
        console.log('SERVER: Exiting process.');
        process.exit(err || ioErr ? 1 : 0); 
      });
    });

    setTimeout(() => {
      console.error('SERVER: Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000); 
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

}).catch(ex => {
  console.error("SERVER: Error during app preparation or server start:", ex.stack || ex); 
  process.exit(1);
});
