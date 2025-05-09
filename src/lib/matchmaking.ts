
import type { Redis } from 'ioredis';
import type { Server as SocketIOServer } from 'socket.io';
import type { GameStore } from './gameStore';
import type { PlayerId } from './types';

interface MatchmakingPlayerData {
  id: string; // socket.id
  name: string;
  rating: number;
  joinTime: number;
}

export function setupMatchmaking(gameStore: GameStore, redis: Redis, io: SocketIOServer) {
  const matchPlayersPeriodically = async () => {
    try {
      await matchPlayers(gameStore, redis, io);
    } catch (error) {
      console.error('Error in matchmaking:', error);
    }
  };

  const matchmakingInterval = setInterval(matchPlayersPeriodically, 5000); // Check every 5 seconds
  
  // Initial check
  matchPlayersPeriodically();

  return () => {
    clearInterval(matchmakingInterval);
  };
}

async function matchPlayers(gameStore: GameStore, redis: Redis, io: SocketIOServer) {
  // Get all players in matchmaking queue ordered by join time (score is timestamp)
  // We fetch socket IDs
  const playerSocketIds = await redis.zrange('matchmaking_queue', 0, -1); 
  
  if (playerSocketIds.length < 2) {
    return; // Not enough players to form a match
  }

  // Process players in pairs
  for (let i = 0; i < playerSocketIds.length - (playerSocketIds.length % 2); i += 2) {
    const player1SocketId = playerSocketIds[i];
    const player2SocketId = playerSocketIds[i + 1];

    const player1DataString = await redis.get(`player:${player1SocketId}`);
    const player2DataString = await redis.get(`player:${player2SocketId}`);

    if (!player1DataString || !player2DataString) {
      console.warn('Matchmaking: Player data missing, skipping pair.', { player1SocketId, player2SocketId });
      // Potentially remove these players from queue if data is consistently missing
      if(!player1DataString) await redis.zrem('matchmaking_queue', player1SocketId);
      if(!player2DataString) await redis.zrem('matchmaking_queue', player2SocketId);
      continue;
    }

    const player1Data: MatchmakingPlayerData = JSON.parse(player1DataString);
    const player2Data: MatchmakingPlayerData = JSON.parse(player2DataString);
    
    // Create a new game for these players
    // Player 1 (creator) is player1Data, Player 2 is player2Data
    const gameId = await gameStore.createGame(player1Data.id, player1Data.name, {
      isMatchmaking: true,
      isRanked: true, // Example option
      // Potentially add average rating or other matchmaking info to game options
    });
    
    // Add second player to the game
    const addPlayerResult = await gameStore.addPlayerToGame(gameId, player2Data.id, player2Data.name);

    if (!addPlayerResult.success) {
        console.error(`Matchmaking: Failed to add player ${player2Data.name} to game ${gameId}`);
        // Potentially re-queue players or handle error
        await gameStore.deleteGame(gameId); // Clean up partially created game
        continue; 
    }
    
    // Notify players they've been matched
    // It's better to emit to specific socket IDs than rely on Redis pub/sub for this initial notification
    io.to(player1SocketId).emit('matchmaking_success', { gameId, playerId: 1 as PlayerId });
    io.to(player2SocketId).emit('matchmaking_success', { gameId, playerId: 2 as PlayerId });
    
    console.log(`Matchmaking: Matched ${player1Data.name} and ${player2Data.name} into game ${gameId}`);

    // Remove players from matchmaking queue and delete their individual data
    await redis.zrem('matchmaking_queue', player1SocketId, player2SocketId);
    await redis.del(`player:${player1SocketId}`, `player:${player2SocketId}`);
  }
}

export async function addToMatchmakingQueue(socketId: string, playerName: string, rating: number, redis: Redis) {
  const playerData: MatchmakingPlayerData = {
    id: socketId,
    name: playerName,
    rating: rating || 1000, // Default rating
    joinTime: Date.now()
  };
  
  await redis.set(`player:${socketId}`, JSON.stringify(playerData));
  // Use joinTime as score to process older entries first (FIFO based on time)
  // Or use rating for skill-based matching (more complex to pair)
  // For simplicity, using joinTime for FIFO.
  await redis.zadd('matchmaking_queue', playerData.joinTime, socketId);
  
  return true;
}

export async function removeFromMatchmakingQueue(socketId: string, redis: Redis) {
  await redis.zrem('matchmaking_queue', socketId);
  await redis.del(`player:${socketId}`);
  return true;
}
