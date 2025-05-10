
import type { Redis } from 'ioredis';
import type { GameStore } from './gameStore';
import type { PlayerId } from './types';

interface MatchmakingPlayer {
  socketId: string;
  name: string;
  rating: number;
  joinTime: number;
}

// In-memory queue as a fallback if Redis is not available
const inMemoryMatchmakingQueue: MatchmakingPlayer[] = [];
let matchmakingInterval: NodeJS.Timeout | null = null;

export function setupMatchmaking(gameStore: GameStore, redis: Redis | null) {
  if (!redis || redis.status !== 'ready') {
    console.warn('Matchmaking: Redis not available. Matchmaking will use in-memory queue (not recommended for production).');
  }

  // Clear previous interval if any
  if (matchmakingInterval) {
    clearInterval(matchmakingInterval);
  }

  matchmakingInterval = setInterval(async () => {
    try {
      await matchPlayers(gameStore, redis);
    } catch (error) {
      console.error('Error in matchmaking:', error);
    }
  }, 5000); // Check every 5 seconds

  // Return a cleanup function
  return () => {
    if (matchmakingInterval) {
      clearInterval(matchmakingInterval);
      matchmakingInterval = null;
    }
  };
}

async function matchPlayers(gameStore: GameStore, redis: Redis | null) {
  let playersToMatch: MatchmakingPlayer[] = [];

  if (redis && redis.status === 'ready') {
    try {
      // Get all players in matchmaking queue ordered by join time (using score as joinTime)
      const rawPlayers = await redis.zrange('matchmaking_queue', 0, -1, 'WITHSCORES');
      
      for (let i = 0; i < rawPlayers.length; i += 2) {
        const socketId = rawPlayers[i];
        const joinTime = parseInt(rawPlayers[i+1], 10);
        const playerDataString = await redis.get(`player_matchmaking_data:${socketId}`);
        if (playerDataString) {
          const playerData = JSON.parse(playerDataString);
          playersToMatch.push({ socketId, name: playerData.name, rating: playerData.rating, joinTime });
        } else {
          // Player data missing, remove from queue
          await redis.zrem('matchmaking_queue', socketId);
        }
      }
    } catch (err) {
      console.error("Matchmaking: Redis error during player fetch. Using in-memory queue as fallback for this cycle.", err);
      playersToMatch = [...inMemoryMatchmakingQueue]; // Fallback for this cycle
      playersToMatch.sort((a, b) => a.joinTime - b.joinTime);
    }
  } else {
    // Use in-memory queue if Redis is not available
    playersToMatch = [...inMemoryMatchmakingQueue];
    playersToMatch.sort((a, b) => a.joinTime - b.joinTime);
  }


  while (playersToMatch.length >= 2) {
    const player1 = playersToMatch.shift();
    const player2 = playersToMatch.shift();

    if (player1 && player2) {
      try {
        const gameId = await gameStore.createGame(player1.socketId, player1.name, {
          isMatchmaking: true,
          isRanked: true // Example option
        });
        
        const joinResult = await gameStore.addPlayerToGame(gameId, player2.socketId, player2.name);

        if (joinResult.success) {
          console.log(`Matchmaking: Matched ${player1.name} vs ${player2.name} in game ${gameId}`);
          
          // Notify players via socket.io (directly, assuming io instance is available via gameStore or globally)
          // This needs access to the io instance from socketHandler.ts or through event bus
          const gameDataForMatch = { gameId, opponentNamePlayer1: player2.name, opponentNamePlayer2: player1.name, assignedPlayerId1: 1 as PlayerId, assignedPlayerId2: joinResult.assignedPlayerId };

          if (redis && redis.status === 'ready') {
            redis.publish('game-events', JSON.stringify({ 
                type: 'match_found', 
                gameId: player1.socketId, // Use socketId as a temporary room for direct message
                data: { gameId, opponentName: player2.name, assignedPlayerId: 1 as PlayerId }
            }));
            redis.publish('game-events', JSON.stringify({ 
                type: 'match_found', 
                gameId: player2.socketId, // Use socketId as a temporary room for direct message
                data: { gameId, opponentName: player1.name, assignedPlayerId: joinResult.assignedPlayerId }
            }));
          } else {
            // Direct emit if no Redis pub/sub (requires io instance here)
            // This part is problematic without direct io access. It's better if socketHandler reacts to gameStore events or gameStore uses an event emitter.
            // For now, client polls or waits for `game_created`/`game_joined` if matchmaking initiated by client.
          }
          
          // Remove players from Redis queue if they were fetched from there
          if (redis && redis.status === 'ready') {
            await redis.zrem('matchmaking_queue', player1.socketId, player2.socketId);
            await redis.del(`player_matchmaking_data:${player1.socketId}`);
            await redis.del(`player_matchmaking_data:${player2.socketId}`);
          } else {
            // Remove from in-memory if fetched from there (or if Redis failed)
            const idx1 = inMemoryMatchmakingQueue.findIndex(p => p.socketId === player1.socketId);
            if (idx1 > -1) inMemoryMatchmakingQueue.splice(idx1, 1);
            const idx2 = inMemoryMatchmakingQueue.findIndex(p => p.socketId === player2.socketId);
            if (idx2 > -1) inMemoryMatchmakingQueue.splice(idx2, 1);
          }
        } else {
          console.error(`Matchmaking: Failed to join player ${player2.name} to game ${gameId}. Re-queuing.`);
          playersToMatch.unshift(player2); 
          playersToMatch.unshift(player1); 
          break; 
        }
      } catch (error) {
        console.error('Matchmaking: Error creating or joining game. Re-queuing.', error);
        if (player2) playersToMatch.unshift(player2);
        if (player1) playersToMatch.unshift(player1);
        break;
      }
    }
  }
}

export async function addToMatchmakingQueue(
  socketId: string,
  playerName: string,
  redis: Redis | null,
  rating: number = 1000
): Promise<{success: boolean, message?: string, position?: number}> {
  const player: MatchmakingPlayer = { socketId, name: playerName, rating, joinTime: Date.now() };

  if (redis && redis.status === 'ready') {
    try {
      // Remove if already in queue to prevent duplicates (defensive)
      await redis.zrem('matchmaking_queue', socketId);
      await redis.del(`player_matchmaking_data:${socketId}`);

      await redis.set(`player_matchmaking_data:${socketId}`, JSON.stringify({ name: playerName, rating }));
      await redis.zadd('matchmaking_queue', player.joinTime, socketId); // Score by join time for FIFO
      const position = await redis.zrank('matchmaking_queue', socketId);
      console.log(`Matchmaking (Redis): ${playerName} (ID: ${socketId}) added to queue at position ${position}.`);
      return { success: true, position: position !== null ? position + 1 : undefined };
    } catch (err) {
      console.error("Matchmaking (Redis): Error adding to queue. Falling back to in-memory.", err);
      // Fall through to in-memory if Redis fails
    }
  }
  
  // In-memory operation or fallback
  const existingIndex = inMemoryMatchmakingQueue.findIndex(p => p.socketId === socketId);
  if (existingIndex > -1) inMemoryMatchmakingQueue.splice(existingIndex, 1);
  inMemoryMatchmakingQueue.push(player);
  inMemoryMatchmakingQueue.sort((a,b) => a.joinTime - b.joinTime); // Ensure order
  const position = inMemoryMatchmakingQueue.findIndex(p => p.socketId === socketId) + 1;
  console.log(`Matchmaking (in-memory): ${playerName} (ID: ${socketId}) added to queue at position ${position}.`);
  return { success: true, position };
}

export async function removeFromMatchmakingQueue(
  socketId: string,
  redis: Redis | null
): Promise<boolean> {
  if (redis && redis.status === 'ready') {
    try {
      const removedCount = await redis.zrem('matchmaking_queue', socketId);
      await redis.del(`player_matchmaking_data:${socketId}`);
      if (removedCount > 0) {
        console.log(`Matchmaking (Redis): Player ${socketId} removed from queue.`);
        return true;
      }
    } catch (err) {
      console.error("Matchmaking (Redis): Error removing from queue. Trying in-memory.", err);
      // Fall through
    }
  }

  // In-memory operation or fallback
  const index = inMemoryMatchmakingQueue.findIndex(p => p.socketId === socketId);
  if (index > -1) {
    inMemoryMatchmakingQueue.splice(index, 1);
    console.log(`Matchmaking (in-memory): Player ${socketId} removed from queue.`);
    return true;
  }
  return false;
}

export function getMatchmakingQueueSize(redis: Redis | null): Promise<number> {
    if (redis && redis.status === 'ready') {
        return redis.zcard('matchmaking_queue');
    }
    return Promise.resolve(inMemoryMatchmakingQueue.length);
}
