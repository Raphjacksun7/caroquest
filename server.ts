// FILE: server.ts
// PURPOSE: Initializes and runs the Next.js application, HTTP server, and Socket.IO server.

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer, ServerOptions } from "socket.io";
import { setupGameSockets } from "./src/lib/socketHandler"; 
import { startMatchmakingProcessor } from "./src/lib/matchmaking"; 
import { gameStore } from "./src/lib/gameStore"; 

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const port: number = parseInt(process.env.PORT || "3000", 10);

app.prepare().then(async () => {
    const httpServer = createServer((req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
      } catch (err) {
        console.error("SERVER: Error handling HTTP request:", err);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });

    const socketIoOptions: Partial<ServerOptions> = {
      cors: {
        origin: "*", 
        methods: ["GET", "POST"],
      },
      path: "/api/socketio/", 
      pingInterval: 25000, 
      pingTimeout: 5000,   
    };

    const io = new SocketIOServer(httpServer, socketIoOptions);
    console.log("SERVER: Socket.IO server instance created.");

    io.engine.on("connection_error", (err: any) => {
      console.error("SERVER: Socket.IO Engine Connection Error Details:");
      console.error(`  Code: ${err.code}, Message: ${err.message}`);
      if (err.context) console.error(`  Context: ${JSON.stringify(err.context)}`);
    });

    const cleanupMatchmaking = startMatchmakingProcessor(io, gameStore);
    setupGameSockets(io, gameStore);

    httpServer.listen(port, (err?: any) => {
      if (err) {
        console.error("SERVER: Failed to start HTTP server:", err);
        throw err;
      }
      console.log(`SERVER: > HTTP Ready on http://localhost:${port}`);
      console.log(`SERVER: > Socket.IO initialized at path /api/socketio/`);
    });

    httpServer.on("error", (err: NodeJS.ErrnoException) => {
      console.error("SERVER: HTTP Server runtime error:", err);
      if (err.code === "EADDRINUSE") {
        console.error(`SERVER: Port ${port} is already in use.`);
        process.exit(1);
      }
    });

    const gracefulShutdown = (signal: string) => {
      console.log(`SERVER: Received ${signal}. Initiating graceful shutdown...`);
      cleanupMatchmaking();
      
      console.log("SERVER: Closing HTTP server...");
      httpServer.close((closeErr?: Error) => {
        if (closeErr) console.error("SERVER: Error closing HTTP server:", closeErr);
        else console.log("SERVER: HTTP server closed.");

        console.log("SERVER: Destroying game store...");
        try {
          gameStore.destroy();
          console.log("SERVER: GameStore destroyed.");
        } catch (storeErr) {
          console.error("SERVER: Error destroying GameStore:", storeErr);
        }

        console.log("SERVER: Closing Socket.IO server...");
        io.close((ioErr?: Error) => {
          if (ioErr) console.error("SERVER: Error closing Socket.IO server:", ioErr);
          else console.log("SERVER: Socket.IO server closed.");
          
          console.log("SERVER: Graceful shutdown complete. Exiting process.");
          process.exit(closeErr || ioErr ? 1 : 0);
        });
      });

      setTimeout(() => {
        console.error("SERVER: Graceful shutdown timed out. Forcing exit.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  }).catch((ex) => {
    console.error("SERVER: Critical error during application preparation or server start:", ex.stack || ex);
    process.exit(1);
  });
