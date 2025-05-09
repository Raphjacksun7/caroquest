
import type { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import type { GameState, PlayerId } from './types'; 
import { createInitialGameState } from './gameLogic';
import LZString from 'lz-string';

// Define a structure for Player in the store
export interface StoredPlayer {
  id: string; // socket id
  name: string;
  playerId: PlayerId; // 1 or 2
}
interface GameData {
  id: string;
  state: GameState;
  players: StoredPlayer[];
  lastActivity: number;
  options: GameOptions; 
  sequenceId: number;
}

export interface GameOptions {
  isPublic?: boolean; // Kept for potential future use, but not actively used for matchmaking
  gameIdToCreate?: string; // Allow specific game ID creation
}


export class GameStore {
  private redis: Redis;
  
  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }
  
  async createGame(creatorSocketId: string, creatorName: string, options: GameOptions = {}): Promise<string> {
    const gameId = options.gameIdToCreate || uuidv4().substring(0, 8).toUpperCase();
    const initialState = createInitialGameState();
    
    const gameData: GameData = {
      id: gameId,
      state: initialState,
      players: [{ id: creatorSocketId, name: creatorName, playerId: 1 as PlayerId }],
      lastActivity: Date.now(),
      options,
      sequenceId: 0
    };
    
    const compressedData = LZString.compressToUTF16(JSON.stringify(gameData));
    await this.redis.set(`game:${gameId}`, compressedData);
    await this.redis.expire(`game:${gameId}`, 3600 * 24); // 24 hours TTL for active games

    // No public games list for now
    // if (options.isPublic) {
    //   await this.redis.zadd('public_games', Date.now(), gameId);
    // }
    
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
      const gameData = JSON.parse(gameDataString) as GameData;
      // Ensure sets and maps are correctly rehydrated 
      gameData.state.blockedPawnsInfo = new Set(Array.from(gameData.state.blockedPawnsInfo || []));
      gameData.state.blockingPawnsInfo = new Set(Array.from(gameData.state.blockingPawnsInfo || []));
      // deadZoneSquares can be an array of [key, value] pairs from Object.entries
      const deadZoneEntries = Array.isArray(gameData.state.deadZoneSquares) 
        ? gameData.state.deadZoneSquares 
        : Object.entries(gameData.state.deadZoneSquares || {});
      gameData.state.deadZoneSquares = new Map(deadZoneEntries.map(([k,v]) => [parseInt(k), v as PlayerId]));
      gameData.state.deadZoneCreatorPawnsInfo = new Set(Array.from(gameData.state.deadZoneCreatorPawnsInfo || []));
      return gameData;
    } catch (error) {
      console.error('Error parsing game data for gameId:', gameId, error);
      await this.redis.del(`game:${gameId}`); // Delete corrupted data
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
    await this.redis.expire(`game:${gameId}`, 3600 * 24); // Refresh TTL
    
    return true;
  }
  
  async addPlayerToGame(gameId: string, socketId: string, playerName: string): Promise<{success: boolean, assignedPlayerId?: PlayerId, existingPlayers?: StoredPlayer[]}> {
    const game = await this.getGame(gameId);
    if (!game) return { success: false };
    
    if (game.players.find(p => p.id === socketId)) { // Player already in game (rejoin)
      return { success: true, assignedPlayerId: game.players.find(p=>p.id === socketId)!.playerId, existingPlayers: game.players };
    }

    if (game.players.length >= 2) {
      return { success: false }; // Game is full
    }
    
    const assignedPlayerId = (game.players.length + 1) as PlayerId; // Assign 1 or 2
    game.players.push({ id: socketId, name: playerName, playerId: assignedPlayerId });
    game.lastActivity = Date.now();
    
    const compressedData = LZString.compressToUTF16(JSON.stringify(game));
    await this.redis.set(`game:${gameId}`, compressedData);
    await this.redis.expire(`game:${gameId}`, 3600 * 24);
    
    // No public games list management here
    
    return { success: true, assignedPlayerId, existingPlayers: game.players };
  }
    
  async deleteGame(gameId: string): Promise<void> {
    await this.redis.del(`game:${gameId}`);
    // await this.redis.zrem('public_games', gameId); // No public list
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
      // If game becomes public again with one player (not relevant without public list)
      const compressedData = LZString.compressToUTF16(JSON.stringify(game));
      await this.redis.set(`game:${gameId}`, compressedData);
      await this.redis.expire(`game:${gameId}`, 3600*24);
    }
    return removedPlayer;
  }
}
