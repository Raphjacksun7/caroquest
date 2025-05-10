
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { GameStore } from './gameStore';
import type { PlayerId } from './types'; // Assuming PlayerId is in types.ts

interface MatchmakingPlayer {
  socketId: string;
  name: string;
  rating: number; // Example, could be more complex
  joinTime: number;
}

// In-memory queue for matchmaking
const matchmakingQueue: MatchmakingPlayer[] = [];
let matchmakingInterval: NodeJS.Timeout | null = null;

export function setupMatchmaking(gameStore: GameStore, io: SocketIOServer) {
  console.log('Matchmaking: Using in-memory queue.');

  if (matchmakingInterval) {
    clearInterval(matchmakingInterval);
  }

  // Simple matchmaking: pair the first two players in the queue
  matchmakingInterval = setInterval(async () => {
    if (matchmakingQueue.length >= 2) {
      // Sort by join time to be fair (FIFO)
      matchmakingQueue.sort((a, b) => a.joinTime - b.joinTime);
      
      const player1 = matchmakingQueue.shift();
      const player2 = matchmakingQueue.shift();

      if (player1 && player2) {
        try {
          const gameId = await gameStore.createGame(player1.socketId, player1.name, { 
            isMatchmaking: true, 
            isRanked: true // Example option
          });
          
          // Player 2 joins the game created by Player 1
          const joinResult = await gameStore.addPlayerToGame(gameId, player2.socketId, player2.name);

          if (joinResult.success && joinResult.assignedPlayerId !== undefined) {
            console.log(`Matchmaking: Matched ${player1.name} vs ${player2.name} in game ${gameId}`);
            
            // Notify players
            const player1Socket = io.sockets.sockets.get(player1.socketId);
            const player2Socket = io.sockets.sockets.get(player2.socketId);

            if (player1Socket) {
              player1Socket.emit('match_found', { 
                gameId, 
                opponentName: player2.name, 
                assignedPlayerId: 1 as PlayerId // Creator is always P1
              });
            }
            if (player2Socket) {
              player2Socket.emit('match_found', { 
                gameId, 
                opponentName: player1.name, 
                assignedPlayerId: joinResult.assignedPlayerId 
              });
            }
          } else {
            console.error(`Matchmaking: Failed to join player ${player2.name} to game ${gameId}. Re-queuing.`);
            // Re-add players to queue if game setup failed
            if (player1) matchmakingQueue.unshift(player1); 
            if (player2) matchmakingQueue.unshift(player2);
          }
        } catch (error) {
          console.error('Matchmaking: Error creating or joining game for matched players:', error);
          // Re-add players to queue on error
          if (player1) matchmakingQueue.unshift(player1);
          if (player2) matchmakingQueue.unshift(player2);
        }
      }
    }
  }, 5000); // Check every 5 seconds

  // Clean up interval on shutdown (if server.ts calls a destroy method)
  return () => {
    if (matchmakingInterval) {
      clearInterval(matchmakingInterval);
      matchmakingInterval = null;
    }
    matchmakingQueue.length = 0; // Clear queue
    console.log('Matchmaking: Stopped and cleared in-memory queue.');
  };
}

export function addToMatchmakingQueue(socket: Socket, playerName: string, rating: number = 1000) {
  // Prevent duplicate entries
  if (matchmakingQueue.some(p => p.socketId === socket.id)) {
    socket.emit('matchmaking_error', { message: 'Already in queue.' });
    return;
  }
  
  const player: MatchmakingPlayer = { socketId: socket.id, name: playerName, rating, joinTime: Date.now() };
  matchmakingQueue.push(player);
  socket.emit('matchmaking_joined', { 
    message: 'Added to matchmaking queue.', 
    position: matchmakingQueue.length 
  });
  console.log(`Matchmaking: ${playerName} (ID: ${socket.id}) added to queue. Queue size: ${matchmakingQueue.length}`);
}

export function removeFromMatchmakingQueue(socketId: string) {
  const index = matchmakingQueue.findIndex(p => p.socketId === socketId);
  if (index > -1) {
    matchmakingQueue.splice(index, 1);
    console.log(`Matchmaking: Player ${socketId} removed from queue. Queue size: ${matchmakingQueue.length}`);
    return true;
  }
  return false;
}

export function getMatchmakingQueueSize(): number {
    return matchmakingQueue.length;
}
