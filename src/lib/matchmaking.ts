
// import type { Redis } from 'ioredis'; // Redis removed
import type { GameStore } from './gameStore';
import type { PlayerId } from './types'; // Ensure PlayerId is available

interface MatchmakingPlayer {
  socketId: string;
  name: string;
  rating: number; // Example: ELO rating or skill level
  joinTime: number;
}

// In-memory queue for simplicity, replace with Redis for production
const matchmakingQueue: MatchmakingPlayer[] = [];

export function setupMatchmaking(gameStore: GameStore /*, redis: Redis */) { // Redis removed
  const matchmakingInterval = setInterval(async () => {
    try {
      await matchPlayers(gameStore /*, redis */); // Redis removed
    } catch (error) {
      console.error('Error in matchmaking:', error);
    }
  }, 5000); // Check every 5 seconds

  return () => {
    clearInterval(matchmakingInterval);
  };
}

async function matchPlayers(gameStore: GameStore /*, redis: Redis */) { // Redis removed
  // Sort by join time (FIFO) or rating for more complex matchmaking
  matchmakingQueue.sort((a, b) => a.joinTime - b.joinTime);

  while (matchmakingQueue.length >= 2) {
    const player1 = matchmakingQueue.shift();
    const player2 = matchmakingQueue.shift();

    if (player1 && player2) {
      try {
        const gameId = await gameStore.createGame(player1.socketId, player1.name, {
          isMatchmaking: true,
          // isRanked: true // Example option
        });
        
        const joinResult = await gameStore.addPlayerToGame(gameId, player2.socketId, player2.name);

        if (joinResult.success) {
          console.log(`Matchmaking: Matched ${player1.name} vs ${player2.name} in game ${gameId}`);
          
          // Notify players via socket directly (assuming io instance is passed or accessible)
          // This part needs access to the io instance, or events need to be emitted differently
          // For now, we'll assume the gameStore or socketHandler will notify.
          // Example:
          // io.to(player1.socketId).emit('match_found', { gameId, opponentName: player2.name, assignedPlayerId: 1 });
          // io.to(player2.socketId).emit('match_found', { gameId, opponentName: player1.name, assignedPlayerId: joinResult.assignedPlayerId });
          
          // This should ideally be handled by publishing an event that socketHandler listens to,
          // or by passing the `io` instance to matchmaking.
          // For now, the client's `game_created` and `game_joined` events will handle notifying them.
          
        } else {
          console.error(`Matchmaking: Failed to join player ${player2.name} to game ${gameId}`);
          // Put players back in queue or handle error
          matchmakingQueue.unshift(player2); // Add back player2
          matchmakingQueue.unshift(player1); // Add back player1 (order matters for FIFO)
          break; // Stop trying to match for now to avoid infinite loops on persistent errors
        }
      } catch (error) {
        console.error('Error creating or joining game in matchmaking:', error);
        // Put players back if game creation failed
        if (player2) matchmakingQueue.unshift(player2);
        if (player1) matchmakingQueue.unshift(player1);
        break;
      }
    }
  }
}

export async function addToMatchmaking(
  socketId: string,
  playerName: string,
  // redis: Redis, // Redis removed
  rating: number = 1000 // Default rating
): Promise<boolean> {
  // Remove if already in queue to prevent duplicates
  await removeFromMatchmaking(socketId /*, redis */); // Redis removed
  
  matchmakingQueue.push({
    socketId,
    name: playerName,
    rating,
    joinTime: Date.now(),
  });
  console.log(`Matchmaking: ${playerName} (ID: ${socketId}) added to queue.`);
  return true;
}

export async function removeFromMatchmaking(
  socketId: string
  // redis: Redis // Redis removed
): Promise<boolean> {
  const index = matchmakingQueue.findIndex(p => p.socketId === socketId);
  if (index > -1) {
    matchmakingQueue.splice(index, 1);
    console.log(`Matchmaking: Player ${socketId} removed from queue.`);
    return true;
  }
  return false;
}

export function getMatchmakingQueueSize(): number {
    return matchmakingQueue.length;
}
