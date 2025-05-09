
import type { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import type { GameState, PlayerId } from './types'; // Ensure PlayerId is imported if used for assignedPlayerId
import { createInitialGameState } from './gameLogic';
import LZString from 'lz-string';

// Define a structure for Player in the store if it differs from socket PlayerInfo
interface StoredPlayer {
  id: string; // socket id
  name: string;
  playerId: PlayerId; // 1 or 2
}
interface GameData {
  id: string;
  state: GameState;
  players: StoredPlayer[];
  lastActivity: number;
  options: any;
  sequenceId: number;
}


export class GameStore {
  private redis: Redis;
  
  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }
  
  async createGame(creatorId: string, creatorName: string, options: any = {}): Promise<string> {
    const gameId = uuidv4().substring(0, 8);
    const initialState = createInitialGameState();
    
    const gameData: GameData = {
      id: gameId,
      state: initialState,
      players: [{ id: creatorId, name: creatorName, playerId: 1 as PlayerId }],
      lastActivity: Date.now(),
      options,
      sequenceId: 0
    };
    
    const compressedData = LZString.compressToUTF16(JSON.stringify(gameData));
    await this.redis.set(`game:${gameId}`, compressedData);
    await this.redis.expire(`game:${gameId}`, 30 * 60); // 30 minutes
    
    if (options.isPublic) {
      await this.redis.zadd('public_games', Date.now(), gameId);
    }
    
    return gameId;
  }
  
  async getGame(gameId: string): Promise<GameData | null> {
    const compressedData = await this.redis.get(`game:${gameId}`);
    if (!compressedData) return null;
    
    try {
      const gameDataString = LZString.decompressFromUTF16(compressedData);
      if (!gameDataString) {
        console.error('Failed to decompress game data for gameId:', gameId);
        return null;
      }
      const gameData = JSON.parse(gameDataString);
      return gameData;
    } catch (error) {
      console.error('Error parsing game data for gameId:', gameId, error);
      return null;
    }
  }
  
  async updateGameState(gameId: string, state: GameState): Promise<boolean> {
    const game = await this.getGame(gameId);
    if (!game) return false;
    
    game.state = state;
    game.lastActivity = Date.now();
    game.sequenceId++;
    
    const compressedData = LZString.compressToUTF16(JSON.stringify(game));
    await this.redis.set(`game:${gameId}`, compressedData);
    await this.redis.expire(`game:${gameId}`, 30 * 60);
    
    return true;
  }
  
  async addPlayerToGame(gameId: string, socketId: string, playerName: string): Promise<{success: boolean, assignedPlayerId?: PlayerId}> {
    const game = await this.getGame(gameId);
    if (!game) return { success: false };
    
    if (game.players.length >= 2) {
      return { success: false }; // Game is full
    }
    
    // Second player is always PlayerId 2
    const assignedPlayerId = 2 as PlayerId;
    game.players.push({ id: socketId, name: playerName, playerId: assignedPlayerId });
    game.lastActivity = Date.now(); // Update activity on player join
    
    const compressedData = LZString.compressToUTF16(JSON.stringify(game));
    await this.redis.set(`game:${gameId}`, compressedData);
    await this.redis.expire(`game:${gameId}`, 30 * 60);
    
    if (game.options.isPublic) {
      await this.redis.zrem('public_games', gameId); // Remove from public list as it's now full
    }
    
    return { success: true, assignedPlayerId };
  }
  
  async getPublicGames(limit = 10): Promise<any[]> {
    const gameIds = await this.redis.zrevrange('public_games', 0, limit - 1);
    
    const gamesPromises = gameIds.map(gameId => this.getGame(gameId));
    const resolvedGames = await Promise.all(gamesPromises);

    return resolvedGames
      .filter(game => game !== null)
      .map(game => ({
        id: game!.id,
        createdBy: game!.players[0]?.name || 'Unknown',
        playerCount: game!.players.length,
        created: game!.lastActivity, // Using lastActivity as creation/update timestamp
        options: game!.options
      }));
  }
  
  async deleteGame(gameId: string): Promise<void> {
    await this.redis.del(`game:${gameId}`);
    await this.redis.zrem('public_games', gameId);
  }

  async removePlayerFromGame(gameId: string, socketId: string): Promise<StoredPlayer | null> {
    const game = await this.getGame(gameId);
    if (!game) return null;

    const playerIndex = game.players.findIndex(p => p.id === socketId);
    if (playerIndex === -1) return null;

    const removedPlayer = game.players.splice(playerIndex, 1)[0];
    game.lastActivity = Date.now();

    if (game.players.length === 0) {
      await this.deleteGame(gameId);
    } else {
      // If the game was public and now has one player, re-add to public games if applicable
      if (game.options.isPublic && game.players.length === 1) {
        await this.redis.zadd('public_games', Date.now(), gameId);
      }
      const compressedData = LZString.compressToUTF16(JSON.stringify(game));
      await this.redis.set(`game:${gameId}`, compressedData);
      await this.redis.expire(`game:${gameId}`, 30 * 60);
    }
    return removedPlayer;
  }
}
