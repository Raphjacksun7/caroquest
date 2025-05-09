
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

  const matchmakingInterval = setInterval(matchPlayersPeriodically, 5000); 
  
  matchPlayersPeriodically();

  return () => {
    clearInterval(matchmakingInterval);
  };
}

async function matchPlayers(gameStore: GameStore, redis: Redis, io: SocketIOServer) {
  const playerSocketIds = await redis.zrange('matchmaking_queue', 0, -1); 
  
  if (playerSocketIds.length < 2) {
    return; 
  }

  for (let i = 0; i < playerSocketIds.length - (playerSocketIds.length % 2); i += 2) {
    const player1SocketId = playerSocketIds[i];
    const player2SocketId = playerSocketIds[i + 1];

    const player1DataString = await redis.get(`player:${player1SocketId}`);
    const player2DataString = await redis.get(`player:${player2SocketId}`);

    if (!player1DataString || !player2DataString) {
      console.warn('Matchmaking: Player data missing, skipping pair.', { player1SocketId, player2SocketId });
      if(!player1DataString) await redis.zrem('matchmaking_queue', player1SocketId);
      if(!player2DataString) await redis.zrem('matchmaking_queue', player2SocketId);
      continue;
    }

    const player1Data: MatchmakingPlayerData = JSON.parse(player1DataString);
    const player2Data: MatchmakingPlayerData = JSON.parse(player2DataString);
    
    const gameId = await gameStore.createGame(player1Data.id, player1Data.name, {
      isMatchmaking: true,
      isRanked: true, 
    });
    
    const addPlayerResult = await gameStore.addPlayerToGame(gameId, player2Data.id, player2Data.name);

    if (!addPlayerResult.success) {
        console.error(`Matchmaking: Failed to add player ${player2Data.name} to game ${gameId}`);
        await gameStore.deleteGame(gameId); 
        continue; 
    }
    
    // Instead of Redis pub/sub for this initial notification, emit directly to sockets
    io.to(player1SocketId).emit('matchmaking_success', { gameId, playerId: 1 as PlayerId, timestamp: Date.now() });
    io.to(player2SocketId).emit('matchmaking_success', { gameId, playerId: 2 as PlayerId, timestamp: Date.now() });
    
    console.log(`Matchmaking: Matched ${player1Data.name} and ${player2Data.name} into game ${gameId}`);

    await redis.zrem('matchmaking_queue', player1SocketId, player2SocketId);
    await redis.del(`player:${player1SocketId}`, `player:${player2SocketId}`);
  }
}
// addToMatchmaking and removeFromMatchmaking are now handled in socketHandler.ts
// to ensure they are called when a player joins/leaves matchmaking via socket events.
