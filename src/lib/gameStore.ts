
// import type { Redis } from 'ioredis'; // Redis removed
import { v4 as uuidv4 } from 'uuid';
import type { GameState, PlayerId } from './types'; 
import { createInitialGameState } from './gameLogic';
// import LZString from 'lz-string'; // LZString removed for game state storage for now

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
  // private redis: Redis; // Redis removed
  private games: Map<string, GameData>;
  private readonly gameKeyPrefix = 'game:'; // Not used with in-memory store but kept for potential future use
  private readonly publicGamesKey = 'public_games'; // Not used with in-memory store
  private readonly playerGameKeyPrefix = 'player_game:'; // Not used
  private readonly gameTTL = 3600 * 24 * 1000; // 24 hours in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null;


  constructor(/* redisClient: Redis */) { // Redis removed
    // this.redis = redisClient; // Redis removed
    this.games = new Map<string, GameData>();
    // this.redis.on('error', (err) => console.error('GameStore Redis Error:', err)); // Redis removed
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.games.forEach((game, gameId) => {
        if (now - game.lastActivity > this.gameTTL) {
          console.log(`GameStore: Cleaning up inactive game ${gameId}`);
          this.games.delete(gameId);
        }
      });
    }, 60 * 60 * 1000); // Check every hour
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
      // const compressedData = LZString.compressToUTF16(JSON.stringify(gameData)); // Compression removed for now
      // await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL / 1000); // Redis removed
      this.games.set(gameId, gameData);
      // No public games list for now as per simplified requirements
      return gameId;
    } catch (error) {
      console.error(`Error creating game ${gameId} in store:`, error);
      throw new Error(`Failed to create game in store: ${(error as Error).message}`);
    }
  }
  
  async getGame(gameId: string): Promise<GameData | null> {
    try {
      // const compressedData = await this.redis.get(this.getFullGameKey(gameId)); // Redis removed
      const gameData = this.games.get(gameId);
      if (!gameData) return null;
      
      // const gameDataString = LZString.decompressFromUTF16(compressedData); // Decompression removed
      // if (!gameDataString) {
      //   console.error('Failed to decompress game data for gameId:', gameId);
      //   return null;
      // }
      // const gameData = JSON.parse(gameDataString) as GameData; // Parsing removed
      
      // Create a deep copy to avoid direct mutation of stored state
      const gameDataCopy = JSON.parse(JSON.stringify(gameData));

      // Rehydrate Sets and Maps
      gameDataCopy.state.blockedPawnsInfo = new Set(Array.from(gameDataCopy.state.blockedPawnsInfo || []));
      gameDataCopy.state.blockingPawnsInfo = new Set(Array.from(gameDataCopy.state.blockingPawnsInfo || []));
      
      const deadZoneEntries = Array.isArray(gameDataCopy.state.deadZoneSquares) 
        ? gameDataCopy.state.deadZoneSquares 
        : Object.entries(gameDataCopy.state.deadZoneSquares || {});
      gameDataCopy.state.deadZoneSquares = new Map(deadZoneEntries.map(([k,v]: [string, PlayerId]) => [parseInt(k), v]));
      
      gameDataCopy.state.deadZoneCreatorPawnsInfo = new Set(Array.from(gameDataCopy.state.deadZoneCreatorPawnsInfo || []));
      
      return gameDataCopy;
    } catch (error) {
      console.error(`Error getting game ${gameId} from store:`, error);
      return null;
    }
  }
  
  async updateGameState(gameId: string, state: GameState): Promise<boolean> {
    try {
      const game = this.games.get(gameId); // Get direct reference for update
      if (!game) {
        console.warn(`Attempted to update non-existent game: ${gameId}`);
        return false;
      }
      
      game.state = state; 
      game.lastActivity = Date.now();
      game.sequenceId++; 
      
      // const compressedData = LZString.compressToUTF16(JSON.stringify(game)); // Compression removed
      // await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL / 1000); // Refresh TTL // Redis removed
      // With in-memory, the object is already updated.
      return true;
    } catch (error) {
      console.error(`Error updating game state for ${gameId} in store:`, error);
      return false; 
    }
  }
  
  async addPlayerToGame(gameId: string, socketId: string, playerName: string): Promise<{success: boolean, assignedPlayerId?: PlayerId, existingPlayers?: StoredPlayer[], error?: string}> {
    try {
      const game = this.games.get(gameId); // Get direct reference
      if (!game) return { success: false, error: 'Game not found.' };
      
      const existingPlayer = game.players.find(p => p.id === socketId);
      if (existingPlayer) { 
        return { success: true, assignedPlayerId: existingPlayer.playerId, existingPlayers: game.players };
      }

      if (game.players.length >= 2) {
        return { success: false, error: 'Game is full.' };
      }
      
      const assignedPlayerId = (game.players.length === 0 ? 1 : 2) as PlayerId; 
      game.players.push({ id: socketId, name: playerName, playerId: assignedPlayerId });
      game.lastActivity = Date.now();
      
      // const compressedData = LZString.compressToUTF16(JSON.stringify(game)); // Compression removed
      // await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL / 1000); // Redis removed
      return { success: true, assignedPlayerId, existingPlayers: game.players };
    } catch (error) {
      console.error(`Error adding player to game ${gameId} in store:`, error);
      return { success: false, error: `Failed to add player: ${(error as Error).message}` };
    }
  }
    
  async deleteGame(gameId: string): Promise<void> {
    try {
      // await this.redis.del(this.getFullGameKey(gameId)); // Redis removed
      this.games.delete(gameId);
    } catch (error) {
      console.error(`Error deleting game ${gameId} from store:`, error);
    }
  }

  async removePlayerFromGame(gameId: string, socketId: string): Promise<StoredPlayer | null> {
    try {
      const game = this.games.get(gameId); // Get direct reference
      if (!game) return null;

      const playerIndex = game.players.findIndex(p => p.id === socketId);
      if (playerIndex === -1) return null;

      const removedPlayer = game.players.splice(playerIndex, 1)[0];
      game.lastActivity = Date.now();

      if (game.players.length === 0) {
        await this.deleteGame(gameId);
      } else {
        // const compressedData = LZString.compressToUTF16(JSON.stringify(game)); // Compression removed
        // await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL / 1000); // Redis removed
        // Game object is already updated in memory
      }
      return removedPlayer;
    } catch (error) {
      console.error(`Error removing player from game ${gameId} in store:`, error);
      return null;
    }
  }

  // For listing public games (if needed later, would require options.isPublic)
  async getPublicGames(limit = 10): Promise<any[]> {
    const publicGamesData: any[] = [];
    let count = 0;
    for (const [gameId, game] of this.games.entries()) {
      if (game.options?.isPublic && game.players.length < 2) {
        publicGamesData.push({
          id: game.id,
          createdBy: game.players[0]?.name || 'Unknown',
          playerCount: game.players.length,
          created: game.lastActivity,
        });
        count++;
        if (count >= limit) break;
      }
    }
    // Sort by creation time (most recent first) if needed
    return publicGamesData.sort((a, b) => b.created - a.created);
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
