
import type { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import type { GameState, PlayerId } from './types'; 
import { createInitialGameState, PAWNS_PER_PLAYER } from './gameLogic';
import LZString from 'lz-string';

export interface StoredPlayer {
  id: string; 
  name: string;
  playerId: PlayerId; 
}
export interface GameOptions {
  isPublic?: boolean; 
  gameIdToCreate?: string;
  pawnsPerPlayer?: number;
  isMatchmaking?: boolean; // Added for matchmaking context
  isRanked?: boolean; // Added for matchmaking context
}
interface GameData {
  id: string;
  state: GameState;
  players: StoredPlayer[];
  lastActivity: number;
  options: GameOptions; 
  sequenceId: number;
}

export class GameStore {
  private redis: Redis | null;
  private inMemoryGames: Map<string, GameData>;
  private readonly gameKeyPrefix = 'game:';
  private readonly publicGamesKey = 'public_games';
  private readonly playerGameKeyPrefix = 'player_game:';
  private readonly gameTTL = 3600 * 24; // 24 hours in seconds for Redis EX
  private readonly gameTTLMs = this.gameTTL * 1000; // 24 hours in milliseconds for in-memory cleanup
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(redisClient: Redis | null) {
    this.redis = redisClient && redisClient.status === 'ready' ? redisClient : null;
    this.inMemoryGames = new Map<string, GameData>();
    
    if (!this.redis) {
      console.warn('GameStore: Redis client not provided or not connected. Using in-memory store. Game data will not persist.');
    } else {
      this.redis.on('error', (err) => console.error('GameStore Redis Error:', err));
    }
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.inMemoryGames.forEach((game, gameId) => {
        if (now - game.lastActivity > this.gameTTLMs) {
          console.log(`GameStore (in-memory): Cleaning up inactive game ${gameId}`);
          this.inMemoryGames.delete(gameId);
        }
      });
    }, 60 * 60 * 1000); // Check every hour
  }
  
  private getFullGameKey(gameId: string): string {
    return `${this.gameKeyPrefix}${gameId}`;
  }

  private async checkRedisConnection(): Promise<boolean> {
    if (!this.redis || this.redis.status !== 'ready') {
      if (this.redis && this.redis.status !== 'ready') {
        // console.warn('GameStore: Redis client is not connected. Using in-memory store for this operation.');
      }
      this.redis = null; // Ensure it's marked as unavailable if status is not ready
      return false;
    }
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('GameStore: Redis ping failed. Switching to in-memory store for this operation.', error);
      this.redis = null; // Mark as unavailable
      return false;
    }
  }

  async createGame(creatorSocketId: string, creatorName: string, options: GameOptions = {}): Promise<string> {
    const gameId = options.gameIdToCreate || uuidv4().substring(0, 8).toUpperCase();
    const pawns = options.pawnsPerPlayer || PAWNS_PER_PLAYER;
    const initialState = createInitialGameState(pawns);
    
    const gameData: GameData = {
      id: gameId,
      state: initialState,
      players: [{ id: creatorSocketId, name: creatorName, playerId: 1 as PlayerId }],
      lastActivity: Date.now(),
      options,
      sequenceId: 0
    };
    
    if (await this.checkRedisConnection() && this.redis) {
      try {
        const compressedData = LZString.compressToUTF16(JSON.stringify(gameData));
        await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL);
        if (options.isPublic) {
          await this.redis.zadd(this.publicGamesKey, Date.now(), gameId);
        }
        console.log(`GameStore (Redis): Created game ${gameId}`);
        return gameId;
      } catch (error) {
        console.error(`GameStore (Redis): Error creating game ${gameId}. Falling back to in-memory.`, error);
        // Fallback to in-memory if Redis operation fails
      }
    }
    
    // In-memory operation or fallback
    this.inMemoryGames.set(gameId, gameData);
    console.log(`GameStore (in-memory): Created game ${gameId}`);
    return gameId;
  }
  
  async getGame(gameId: string): Promise<GameData | null> {
    if (await this.checkRedisConnection() && this.redis) {
      try {
        const compressedData = await this.redis.get(this.getFullGameKey(gameId));
        if (!compressedData) return null;
        const gameDataString = LZString.decompressFromUTF16(compressedData);
        if (!gameDataString) {
          console.error('GameStore (Redis): Failed to decompress game data for gameId:', gameId);
          return null;
        }
        const gameData = JSON.parse(gameDataString) as GameData;
        return this.hydrateGameData(gameData);
      } catch (error) {
        console.error(`GameStore (Redis): Error getting game ${gameId}. Trying in-memory.`, error);
      }
    }
    
    // In-memory operation or fallback
    const gameData = this.inMemoryGames.get(gameId);
    return gameData ? this.hydrateGameData(JSON.parse(JSON.stringify(gameData))) : null;
  }

  private hydrateGameData(gameData: GameData): GameData {
    // Rehydrate Sets and Maps
    if (gameData.state.blockedPawnsInfo && !(gameData.state.blockedPawnsInfo instanceof Set)) {
      gameData.state.blockedPawnsInfo = new Set(Array.from(gameData.state.blockedPawnsInfo || []));
    }
    if (gameData.state.blockingPawnsInfo && !(gameData.state.blockingPawnsInfo instanceof Set)) {
      gameData.state.blockingPawnsInfo = new Set(Array.from(gameData.state.blockingPawnsInfo || []));
    }
    if (gameData.state.deadZoneSquares && !(gameData.state.deadZoneSquares instanceof Map)) {
      const deadZoneEntries = Array.isArray(gameData.state.deadZoneSquares) 
        ? gameData.state.deadZoneSquares 
        : Object.entries(gameData.state.deadZoneSquares || {});
      gameData.state.deadZoneSquares = new Map(deadZoneEntries.map(([k,v]: [string, PlayerId]) => [parseInt(k), v]));
    }
    if (gameData.state.deadZoneCreatorPawnsInfo && !(gameData.state.deadZoneCreatorPawnsInfo instanceof Set)) {
      gameData.state.deadZoneCreatorPawnsInfo = new Set(Array.from(gameData.state.deadZoneCreatorPawnsInfo || []));
    }
    return gameData;
  }
  
  async updateGameState(gameId: string, state: GameState): Promise<boolean> {
    if (await this.checkRedisConnection() && this.redis) {
      try {
        const game = await this.getGame(gameId); // Ensures we get the full game data for sequenceId etc.
        if (!game) {
          console.warn(`GameStore (Redis): Attempted to update non-existent game: ${gameId}`);
          return false;
        }
        game.state = state; 
        game.lastActivity = Date.now();
        game.sequenceId++; 
        const compressedData = LZString.compressToUTF16(JSON.stringify(game));
        await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL);
        return true;
      } catch (error) {
        console.error(`GameStore (Redis): Error updating game state for ${gameId}. Falling back to in-memory.`, error);
      }
    }
    
    // In-memory operation or fallback
    const game = this.inMemoryGames.get(gameId);
    if (!game) {
      console.warn(`GameStore (in-memory): Attempted to update non-existent game: ${gameId}`);
      return false;
    }
    game.state = state;
    game.lastActivity = Date.now();
    game.sequenceId++;
    return true;
  }
  
  async addPlayerToGame(gameId: string, socketId: string, playerName: string): Promise<{success: boolean, assignedPlayerId?: PlayerId, existingPlayers?: StoredPlayer[], error?: string}> {
    const gameData = await this.getGame(gameId); // This handles Redis/in-memory internally
    if (!gameData) return { success: false, error: 'Game not found.' };
    
    const existingPlayer = gameData.players.find(p => p.id === socketId);
    if (existingPlayer) { 
      return { success: true, assignedPlayerId: existingPlayer.playerId, existingPlayers: gameData.players };
    }

    if (gameData.players.length >= 2) {
      return { success: false, error: 'Game is full.' };
    }
    
    const assignedPlayerId = (gameData.players.length === 0 ? 1 : 2) as PlayerId; 
    gameData.players.push({ id: socketId, name: playerName, playerId: assignedPlayerId });
    gameData.lastActivity = Date.now();
    
    // Save back to store
    if (await this.checkRedisConnection() && this.redis) {
      try {
        const compressedData = LZString.compressToUTF16(JSON.stringify(gameData));
        await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL);
        if (gameData.options.isPublic && gameData.players.length === 2) { // If game is full
          await this.redis.zrem(this.publicGamesKey, gameId);
        }
      } catch (error) {
        console.error(`GameStore (Redis): Error saving player to game ${gameId}. In-memory state might be inconsistent if Redis was primary.`, error);
        // If Redis fails here, in-memory update is still needed for current operation
        this.inMemoryGames.set(gameId, gameData);
      }
    } else {
      this.inMemoryGames.set(gameId, gameData);
    }
    return { success: true, assignedPlayerId, existingPlayers: gameData.players };
  }
    
  async deleteGame(gameId: string): Promise<void> {
    if (await this.checkRedisConnection() && this.redis) {
      try {
        await this.redis.del(this.getFullGameKey(gameId));
        await this.redis.zrem(this.publicGamesKey, gameId);
        return;
      } catch (error) {
        console.error(`GameStore (Redis): Error deleting game ${gameId}. Trying in-memory.`, error);
      }
    }
    this.inMemoryGames.delete(gameId);
  }

  async removePlayerFromGame(gameId: string, socketId: string): Promise<StoredPlayer | null> {
    const game = await this.getGame(gameId); // Handles Redis/in-memory
    if (!game) return null;

    const playerIndex = game.players.findIndex(p => p.id === socketId);
    if (playerIndex === -1) return null;

    const removedPlayer = game.players.splice(playerIndex, 1)[0];
    game.lastActivity = Date.now();

    if (game.players.length === 0) {
      await this.deleteGame(gameId);
    } else {
      if (await this.checkRedisConnection() && this.redis) {
        try {
          const compressedData = LZString.compressToUTF16(JSON.stringify(game));
          await this.redis.set(this.getFullGameKey(gameId), compressedData, 'EX', this.gameTTL);
           // Re-add to public games if it's public and now has one player
          if (game.options.isPublic) {
            await this.redis.zadd(this.publicGamesKey, game.lastActivity, gameId);
          }
        } catch (error) {
          console.error(`GameStore (Redis): Error saving game after player removal ${gameId}.`, error);
          this.inMemoryGames.set(gameId, game); // Fallback to ensure in-memory is updated
        }
      } else {
         this.inMemoryGames.set(gameId, game);
      }
    }
    return removedPlayer;
  }

  async getPublicGames(limit = 10): Promise<any[] | { error: string }> {
    if (await this.checkRedisConnection() && this.redis) {
      try {
        const gameIds = await this.redis.zrevrange(this.publicGamesKey, 0, limit - 1);
        const gamesPipeline = this.redis.pipeline();
        gameIds.forEach(id => gamesPipeline.get(this.getFullGameKey(id)));
        const results = await gamesPipeline.exec();

        const publicGamesData: any[] = [];
        results?.forEach(([err, compressedData]) => {
          if (!err && compressedData) {
            try {
              const gameData = JSON.parse(LZString.decompressFromUTF16(compressedData as string)) as GameData;
               if (gameData.options?.isPublic && gameData.players.length < 2) {
                 publicGamesData.push({
                  id: gameData.id,
                  createdBy: gameData.players[0]?.name || 'Unknown',
                  playerCount: gameData.players.length,
                  created: gameData.lastActivity, // or gameData.createdAt
                  options: gameData.options
                });
              }
            } catch (parseError) {
              console.error('GameStore (Redis): Error parsing public game data', parseError);
            }
          }
        });
        return publicGamesData.sort((a, b) => b.created - a.created);
      } catch (error) {
         console.error('GameStore (Redis): Error fetching public games.', error);
         // Fall through to in-memory if Redis fails
      }
    }
    
    // Fallback to in-memory or if Redis is disabled
    console.warn('GameStore: Fetching public games from in-memory store. This is not suitable for multi-instance deployments.');
    const publicGamesData: any[] = [];
    let count = 0;
    for (const game of this.inMemoryGames.values()) {
      if (game.options?.isPublic && game.players.length < 2) {
        publicGamesData.push({
          id: game.id,
          createdBy: game.players[0]?.name || 'Unknown',
          playerCount: game.players.length,
          created: game.lastActivity,
          options: game.options,
        });
        count++;
        if (count >= limit) break;
      }
    }
    return publicGamesData.sort((a, b) => b.created - a.created);
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    // Note: Redis client disconnection is handled in server.ts for global clients
  }
}
