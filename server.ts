import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { setupGameSockets } from './src/lib/socketHandler';
import { setupMatchmaking } from './src/lib/matchmaking';
import { gameStore, GameStore } from './src/lib/gameStore';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port: number = parseInt(process.env.PORT || "3000", 10);

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    try {
      // Log Socket.IO related requests for debugging
      if (req.url && (req.url.includes('/socket.io/') || req.url.includes('/api/socketio'))) {
        console.log(`[Socket.IO Debug] Received request: ${req.method} ${req.url}`);
      }
      
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling HTTP request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Initialize Socket.IO with path EXACTLY matching client
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["*"]
    },
    // Support both transport methods
    transports: ['polling', 'websocket'],
    // IMPORTANT: Use /api/socketio to match client
    path: "socket.io",
    // Increase timeouts for better reliability
    connectTimeout: 30000,
    pingInterval: 25000,
    pingTimeout: 20000
  });

  // Debug connection events
  io.engine.on("connection_error", (err: any) => {
    console.error("SERVER: Socket.IO Engine Connection Error:");
    console.error(`  Code: ${err.code}`);
    console.error(`  Message: ${err.message}`);
    console.error(`  Context: ${JSON.stringify(err.context || {})}`);
    if (err.req) {
        console.error(`  Request URL: ${err.req.url}`);
        console.error(`  Request Headers: ${JSON.stringify(err.req.headers)}`);
    }
  });
  
  // Add basic connection handler for immediate testing
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} using transport: ${socket.conn.transport.name}`);
    
    // Simple ping/pong for testing
    socket.on('ping_time', () => {
      console.log(`Received ping from ${socket.id}`);
      socket.emit('pong_time', Date.now());
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
    });
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
    console.log(`> Socket.IO server listening at path: socketio`);
  });

    server.on("error", (err: NodeJS.ErrnoException) => {
      console.error("Server error:", err);
      if (err.code === "EADDRINUSE") {
        console.error(
          `Port ${port} is already in use. Please use a different port.`
        );
        process.exit(1);
      }
    });

    const gracefulShutdown = (signal: string) => {
      console.log(`Received ${signal}. Initiating graceful shutdown...`);

      server.close((err) => {
        if (err) {
          console.error("Error closing HTTP server:", err);
          process.exit(1);
        }
        console.log("HTTP server closed.");

        if (gameStore && typeof gameStore.destroy === "function") {
          try {
            gameStore.destroy();
            console.log("GameStore destroyed.");
          } catch (storeError) {
            console.error("Error destroying GameStore:", storeError);
          }
        } else {
          console.warn(
            "GameStore not available or destroy method missing during shutdown."
          );
        }

        io.close((ioErr) => {
          if (ioErr) {
            console.error("Error closing Socket.IO server:", ioErr);
          } else {
            console.log("Socket.IO server closed.");
          }
          console.log("Exiting process.");
          process.exit(0);
        });
      });

      setTimeout(() => {
        console.error("Graceful shutdown timed out. Forcing exit.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  })
  .catch((ex) => {
    console.error(
      "Error during app preparation or server start:",
      ex.stack || ex
    );
    process.exit(1);
  });
