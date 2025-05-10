
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
  isPublic?: boolean; 
  gameIdToCreate?: string; 
}


export class GameStore {
  private redis: Redis;
  private readonly gameKeyPrefix = 'game:';
  private readonly publicGamesKey = 'public_games';
  private readonly playerGameKeyPrefix = 'player_game:'; // For tracking which game a player is in
  private readonly gameTTL = 3600 * 24; // 24 hours

  constructor(redisClient: Redis) {
    this.redis = redisClient;
    this.redis.on('error', (err) => console.error('GameStore Redis Error:', err));
  }
  
  private getFullGameKey(gameId: string): string {
    return `${this.gameKeyPrefix}${gameId}`;
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
    
    try {
      const compressedData = LZString.compressToUTF16(JSON.stringify(gameData));
      await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL);
      // No public games list for now as per simplified requirements
      return gameId;
    } catch (error) {
      console.error(`Error creating game ${gameId} in Redis:`, error);
      throw new Error(`Failed to create game in store: ${(error as Error).message}`);
    }
  }
  
  async getGame(gameId: string): Promise<GameData | null> {
    try {
      const compressedData = await this.redis.get(this.getFullGameKey(gameId));
      if (!compressedData) return null;
      
      const gameDataString = LZString.decompressFromUTF16(compressedData);
      if (!gameDataString) {
        console.error('Failed to decompress game data for gameId:', gameId);
        // Consider deleting corrupted data or logging for investigation
        // await this.redis.del(this.getFullGameKey(gameId)); 
        return null;
      }
      const gameData = JSON.parse(gameDataString) as GameData;
      
      // Rehydrate Sets and Maps
      gameData.state.blockedPawnsInfo = new Set(Array.from(gameData.state.blockedPawnsInfo || []));
      gameData.state.blockingPawnsInfo = new Set(Array.from(gameData.state.blockingPawnsInfo || []));
      
      const deadZoneEntries = Array.isArray(gameData.state.deadZoneSquares) 
        ? gameData.state.deadZoneSquares 
        : Object.entries(gameData.state.deadZoneSquares || {});
      gameData.state.deadZoneSquares = new Map(deadZoneEntries.map(([k,v]) => [parseInt(k), v as PlayerId]));
      
      gameData.state.deadZoneCreatorPawnsInfo = new Set(Array.from(gameData.state.deadZoneCreatorPawnsInfo || []));
      
      return gameData;
    } catch (error) {
      console.error(`Error getting game ${gameId} from Redis:`, error);
      // It's possible the data is corrupted if parsing fails
      return null;
    }
  }
  
  async updateGameState(gameId: string, state: GameState): Promise<boolean> {
    try {
      const game = await this.getGame(gameId); // Use getGame to ensure rehydration and consistent data structure
      if (!game) return false;
      
      game.state = state; // The state passed in should already be the complete, correct state
      game.lastActivity = Date.now();
      game.sequenceId++; 
      
      const compressedData = LZString.compressToUTF16(JSON.stringify(game));
      await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL); // Refresh TTL
      return true;
    } catch (error) {
      console.error(`Error updating game state for ${gameId} in Redis:`, error);
      return false; // Indicate failure
    }
  }
  
  async addPlayerToGame(gameId: string, socketId: string, playerName: string): Promise<{success: boolean, assignedPlayerId?: PlayerId, existingPlayers?: StoredPlayer[]}> {
    try {
      const game = await this.getGame(gameId);
      if (!game) return { success: false, error: 'Game not found.' } as any; // Added error property
      
      const existingPlayer = game.players.find(p => p.id === socketId);
      if (existingPlayer) { 
        return { success: true, assignedPlayerId: existingPlayer.playerId, existingPlayers: game.players };
      }

      if (game.players.length >= 2) {
        return { success: false, error: 'Game is full.' } as any;
      }
      
      const assignedPlayerId = (game.players.length === 0 ? 1 : 2) as PlayerId; // Ensure correct assignment
      game.players.push({ id: socketId, name: playerName, playerId: assignedPlayerId });
      game.lastActivity = Date.now();
      
      const compressedData = LZString.compressToUTF16(JSON.stringify(game));
      await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL);
      return { success: true, assignedPlayerId, existingPlayers: game.players };
    } catch (error) {
      console.error(`Error adding player to game ${gameId} in Redis:`, error);
      return { success: false, error: `Failed to add player: ${(error as Error).message}` } as any;
    }
  }
    
  async deleteGame(gameId: string): Promise<void> {
    try {
      await this.redis.del(this.getFullGameKey(gameId));
    } catch (error) {
      console.error(`Error deleting game ${gameId} from Redis:`, error);
    }
  }

  async removePlayerFromGame(gameId: string, socketId: string): Promise<StoredPlayer | null> {
    try {
      const game = await this.getGame(gameId);
      if (!game) return null;

      const playerIndex = game.players.findIndex(p => p.id === socketId);
      if (playerIndex === -1) return null;

      const removedPlayer = game.players.splice(playerIndex, 1)[0];
      game.lastActivity = Date.now();

      if (game.players.length === 0) {
        await this.deleteGame(gameId);
      } else {
        const compressedData = LZString.compressToUTF16(JSON.stringify(game));
        await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL);
      }
      return removedPlayer;
    } catch (error) {
      console.error(`Error removing player from game ${gameId} in Redis:`, error);
      return null;
    }
  }
}
