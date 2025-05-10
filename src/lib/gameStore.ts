
import { v4 as uuidv4 } from 'uuid';
import type { GameState, PlayerId } from './types'; 
import { createInitialGameState, PAWNS_PER_PLAYER, assignPlayerColors } from './gameLogic'; // assignPlayerColors added

export interface StoredPlayer {
  id: string; // Socket ID
  name: string;
  playerId: PlayerId; 
}
export interface GameOptions {
  isPublic?: boolean; 
  gameIdToCreate?: string;
  pawnsPerPlayer?: number;
  isMatchmaking?: boolean; // Retained for potential future use with in-memory matchmaking
  isRanked?: boolean;      // Retained for potential future use
}
interface GameData {
  id: string;
  state: GameState;
  players: StoredPlayer[];
  lastActivity: number;
  options: GameOptions; 
  sequenceId: number; // For delta updates
}

export class GameStore {
  private inMemoryGames: Map<string, GameData>;
  private readonly gameTTLMs = 3600 * 24 * 1000; // 24 hours in milliseconds for in-memory cleanup
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.inMemoryGames = new Map<string, GameData>();
    console.log('GameStore: Initialized in-memory store.');
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval); // Clear existing interval if any
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
    console.log(`GameStore (in-memory): Created game ${gameId} for ${creatorName}`);
    return gameId;
  }
  
  private hydrateGameState(state: GameState): GameState {
    // Ensure complex types are correctly instantiated if they were stringified/parsed
    return {
      ...state,
      playerColors: state.playerColors || assignPlayerColors(),
      blockedPawnsInfo: new Set(Array.from(state.blockedPawnsInfo || [])),
      blockingPawnsInfo: new Set(Array.from(state.blockingPawnsInfo || [])),
      deadZoneSquares: new Map((Array.isArray(state.deadZoneSquares) ? state.deadZoneSquares : Object.entries(state.deadZoneSquares || {})).map(([k,v]:[string, PlayerId]) => [parseInt(k),v])),
      deadZoneCreatorPawnsInfo: new Set(Array.from(state.deadZoneCreatorPawnsInfo || [])),
      pawnsToPlace: state.pawnsToPlace || { 1: PAWNS_PER_PLAYER, 2: PAWNS_PER_PLAYER },
      placedPawns: state.placedPawns || { 1:0, 2:0 }
    };
  }

  async getGame(gameId: string): Promise<GameData | null> {
    const gameData = this.inMemoryGames.get(gameId);
    if (!gameData) return null;

    // Return a deep copy to prevent direct mutation of stored state
    const deepCopiedGameData = JSON.parse(JSON.stringify(gameData)) as GameData;
    deepCopiedGameData.state = this.hydrateGameState(deepCopiedGameData.state);
    return deepCopiedGameData;
  }
  
  async updateGameState(gameId: string, state: GameState): Promise<boolean> {
    const game = this.inMemoryGames.get(gameId);
    if (!game) {
      console.warn(`GameStore (in-memory): Attempted to update non-existent game: ${gameId}`);
      return false;
    }
    // Game state from gameLogic functions should already be a new object.
    // We hydrate it here to ensure Sets/Maps are correctly formed before storing.
    game.state = this.hydrateGameState(state); 
    game.lastActivity = Date.now();
    game.sequenceId++;
    // No need to call this.inMemoryGames.set(gameId, game) as `game` is a reference to the object in the map.
    return true;
  }
  
  async addPlayerToGame(gameId: string, socketId: string, playerName: string): Promise<{success: boolean, assignedPlayerId?: PlayerId, existingPlayers?: StoredPlayer[], error?: string}> {
    const gameData = this.inMemoryGames.get(gameId);
    if (!gameData) return { success: false, error: 'Game not found.' };
    
    const existingPlayer = gameData.players.find(p => p.id === socketId);
    if (existingPlayer) { 
      // Player is rejoining
      existingPlayer.name = playerName; // Update name if changed
      gameData.lastActivity = Date.now();
      return { success: true, assignedPlayerId: existingPlayer.playerId, existingPlayers: gameData.players };
    }

    if (gameData.players.length >= 2) {
      return { success: false, error: 'Game is full.' };
    }
    
    const assignedPlayerId = (gameData.players[0]?.playerId === 1 ? 2 : 1) as PlayerId; 
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
      this.deleteGame(gameId);
    }
    return removedPlayer;
  }

  async getPublicGames(limit = 10): Promise<any[] | { error: string }> {
    const publicGamesData: any[] = [];
    let count = 0;
    
    const sortedGames = Array.from(this.inMemoryGames.values())
      .sort((a,b) => b.lastActivity - a.lastActivity); // Sort by most recent activity

    for (const game of sortedGames) {
      if (game.options?.isPublic && game.players.length < 2) {
        publicGamesData.push({
          id: game.id,
          createdBy: game.players[0]?.name || 'Unknown',
          playerCount: game.players.length,
          created: game.createdAt, // Use createdAt for listing
          options: game.options,
        });
        count++;
        if (count >= limit) break;
      }
    }
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
