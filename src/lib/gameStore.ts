
import { v4 as uuidv4 } from 'uuid';
import type { GameState, PlayerId } from './types'; 
import { createInitialGameState, PAWNS_PER_PLAYER, assignPlayerColors } from './gameLogic';

export interface StoredPlayer {
  id: string; 
  name: string;
  playerId: PlayerId; 
}
export interface GameOptions {
  isPublic?: boolean; 
  gameIdToCreate?: string;
  pawnsPerPlayer?: number;
  isMatchmaking?: boolean;
  isRanked?: boolean;
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
  private inMemoryGames: Map<string, GameData>;
  private readonly publicGamesKey = 'public_games'; // Still used for identifying public games in memory
  private readonly gameTTLMs = 3600 * 24 * 1000; // 24 hours in milliseconds for in-memory cleanup
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.inMemoryGames = new Map<string, GameData>();
    console.warn('GameStore: Using in-memory store. Game data will not persist across server restarts and is not suitable for multi-instance deployments.');
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
    
    this.inMemoryGames.set(gameId, gameData);
    console.log(`GameStore (in-memory): Created game ${gameId}`);
    return gameId;
  }
  
  async getGame(gameId: string): Promise<GameData | null> {
    const gameData = this.inMemoryGames.get(gameId);
    // Return a deep copy to prevent direct mutation of stored state
    return gameData ? this.hydrateGameData(JSON.parse(JSON.stringify(gameData))) : null;
  }

  private hydrateGameData(gameData: GameData): GameData {
    // Rehydrate Sets and Maps that might have been lost in JSON stringification
    // Ensure playerColors exists if it was not part of the stored gameData
    gameData.state.playerColors = gameData.state.playerColors || assignPlayerColors();
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
    const game = this.inMemoryGames.get(gameId);
    if (!game) {
      console.warn(`GameStore (in-memory): Attempted to update non-existent game: ${gameId}`);
      return false;
    }
    game.state = state; // State should already be a new object from gameLogic
    game.lastActivity = Date.now();
    game.sequenceId++;
    return true;
  }
  
  async addPlayerToGame(gameId: string, socketId: string, playerName: string): Promise<{success: boolean, assignedPlayerId?: PlayerId, existingPlayers?: StoredPlayer[], error?: string}> {
    const gameData = this.inMemoryGames.get(gameId);
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
    
    return { success: true, assignedPlayerId, existingPlayers: gameData.players };
  }
    
  async deleteGame(gameId: string): Promise<void> {
    this.inMemoryGames.delete(gameId);
    console.log(`GameStore (in-memory): Deleted game ${gameId}`);
  }

  async removePlayerFromGame(gameId: string, socketId: string): Promise<StoredPlayer | null> {
    const game = this.inMemoryGames.get(gameId);
    if (!game) return null;

    const playerIndex = game.players.findIndex(p => p.id === socketId);
    if (playerIndex === -1) return null;

    const removedPlayer = game.players.splice(playerIndex, 1)[0];
    game.lastActivity = Date.now();

    if (game.players.length === 0) {
      this.deleteGame(gameId); // No Redis zrem needed
    }
    return removedPlayer;
  }

  async getPublicGames(limit = 10): Promise<any[] | { error: string }> {
    const publicGamesData: any[] = [];
    let count = 0;
    // Iterate in reverse order of insertion (approximates newest first for Map)
    const gameEntries = Array.from(this.inMemoryGames.entries()).reverse();

    for (const [gameId, game] of gameEntries) {
      if (game.options?.isPublic && game.players.length < 2) {
        publicGamesData.push({
          id: game.id,
          createdBy: game.players[0]?.name || 'Unknown',
          playerCount: game.players.length,
          created: game.lastActivity, // Use lastActivity as creation proxy
          options: game.options,
        });
        count++;
        if (count >= limit) break;
      }
    }
    // Already sorted by "newest" (lastActivity) effectively due to reverse iteration
    return publicGamesData;
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.inMemoryGames.clear();
    console.log('GameStore (in-memory): Destroyed and cleared all games.');
  }
}
