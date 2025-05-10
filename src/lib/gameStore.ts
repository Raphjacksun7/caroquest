
import { v4 as uuidv4 } from 'uuid';
import type { GameState, PlayerId, StoredPlayer, GameOptions } from './types'; // Ensure GameOptions is used from types
import { createInitialGameState, PAWNS_PER_PLAYER, assignPlayerColors } from './gameLogic';

// Interface for the actual data stored for each game
interface GameData {
  id: string;
  state: GameState;
  players: StoredPlayer[];
  lastActivity: number;
  options: GameOptions;
  sequenceId: number;
  createdAt: number; // Ensure this is part of the interface
}

export interface GameStore {
  createGame(creatorSocketId: string, creatorName: string, options?: GameOptions): Promise<string>;
  getGame(gameId: string): Promise<GameData | null>;
  updateGameState(gameId: string, state: GameState): Promise<boolean>;
  addPlayerToGame(gameId: string, socketId: string, playerName: string): Promise<{ success: boolean, assignedPlayerId?: PlayerId, existingPlayers?: StoredPlayer[], error?: string }>;
  deleteGame(gameId: string): Promise<void>;
  removePlayerFromGame(gameId: string, socketId: string): Promise<StoredPlayer | null>;
  getPublicGames(limit?: number): Promise<Array<Partial<GameData> & { playerCount: number, createdBy: string }>>;
  destroy(): void; // Added destroy method to the interface
}

class InMemoryGameStore implements GameStore {
  private inMemoryGames: Map<string, GameData>;
  private readonly gameTTLMs = 3600 * 24 * 1000; // 24 hours in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.inMemoryGames = new Map<string, GameData>();
    console.log('GameStore: Initialized in-memory store.');
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
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

  public async createGame(creatorSocketId: string, creatorName: string, options: GameOptions = {}): Promise<string> {
    const gameId = options.gameIdToCreate || uuidv4().substring(0, 8).toUpperCase();
    const pawns = options.pawnsPerPlayer || PAWNS_PER_PLAYER;
    const initialState = createInitialGameState(pawns);

    const gameData: GameData = {
      id: gameId,
      state: initialState,
      players: [{ id: creatorSocketId, name: creatorName, playerId: 1 as PlayerId }],
      lastActivity: Date.now(),
      options,
      sequenceId: 0,
      createdAt: Date.now(), // Initialize createdAt
    };

    this.inMemoryGames.set(gameId, gameData);
    console.log(`GameStore (in-memory): Created game ${gameId} for ${creatorName}`);
    return gameId;
  }

  private hydrateGameState(state: GameState): GameState {
    // Ensure all complex types are properly instantiated if they were stringified/parsed
    return {
      ...state,
      playerColors: state.playerColors || assignPlayerColors(),
      blockedPawnsInfo: new Set(Array.from(state.blockedPawnsInfo || [])),
      blockingPawnsInfo: new Set(Array.from(state.blockingPawnsInfo || [])),
      deadZoneSquares: new Map(
        (Array.isArray(state.deadZoneSquares) 
          ? state.deadZoneSquares 
          : Object.entries(state.deadZoneSquares || {})
        ).map(([k, v]: [string | number, PlayerId]) => [Number(k),v])
      ),
      deadZoneCreatorPawnsInfo: new Set(Array.from(state.deadZoneCreatorPawnsInfo || [])),
      pawnsToPlace: state.pawnsToPlace || {1: PAWNS_PER_PLAYER, 2: PAWNS_PER_PLAYER},
      placedPawns: state.placedPawns || {1:0, 2:0}
    };
  }
  
  public async getGame(gameId: string): Promise<GameData | null> {
    const gameData = this.inMemoryGames.get(gameId);
    if (!gameData) return null;
    
    // Deep copy to prevent direct modification of stored state if needed,
    // though with in-memory, direct reference might be fine if careful.
    // For simplicity, returning a structured clone to match potential DB behavior.
    const deepCopiedGameData = JSON.parse(JSON.stringify(gameData)) as GameData;
    deepCopiedGameData.state = this.hydrateGameState(deepCopiedGameData.state);
    return deepCopiedGameData;
  }

  public async updateGameState(gameId: string, state: GameState): Promise<boolean> {
    const game = this.inMemoryGames.get(gameId);
    if (!game) {
      console.warn(`GameStore (in-memory): Attempted to update non-existent game: ${gameId}`);
      return false;
    }
    game.state = this.hydrateGameState(state); // Ensure proper hydration
    game.lastActivity = Date.now();
    game.sequenceId++; 
    return true;
  }

  public async addPlayerToGame(gameId: string, socketId: string, playerName: string): Promise<{ success: boolean, assignedPlayerId?: PlayerId, existingPlayers?: StoredPlayer[], error?: string }> {
    const gameData = this.inMemoryGames.get(gameId);
    if (!gameData) return { success: false, error: 'Game not found.' };

    const existingPlayer = gameData.players.find(p => p.id === socketId);
    if (existingPlayer) {
      // Player is rejoining, update their name if changed, or just confirm presence
      existingPlayer.name = playerName; // Update name if needed
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

  public async deleteGame(gameId: string): Promise<void> {
    this.inMemoryGames.delete(gameId);
    console.log(`GameStore (in-memory): Deleted game ${gameId}`);
  }

  public async removePlayerFromGame(gameId: string, socketId: string): Promise<StoredPlayer | null> {
    const game = this.inMemoryGames.get(gameId);
    if (!game) return null;

    const playerIndex = game.players.findIndex(p => p.id === socketId);
    if (playerIndex === -1) return null;
    
    const removedPlayer = game.players.splice(playerIndex, 1)[0];
    game.lastActivity = Date.now();

    // Optional: Delete game if no players are left
    if (game.players.length === 0) {
      this.deleteGame(gameId);
    }
    return removedPlayer;
  }
  
  public async getPublicGames(limit = 10): Promise<Array<Partial<GameData> & { playerCount: number, createdBy: string }>> {
    const publicGamesData: Array<Partial<GameData> & { playerCount: number, createdBy: string }> = [];
    let count = 0;

    // Sort games by creation time (newest first)
    const sortedGames = Array.from(this.inMemoryGames.values())
      .filter(game => game.options?.isPublic && game.players.length < 2) // Ensure options exists
      .sort((a, b) => b.createdAt - a.createdAt); // Use createdAt for sorting

    for (const game of sortedGames) {
        publicGamesData.push({
          id: game.id,
          createdBy: game.players[0]?.name || 'Unknown', // Handle case where players array might be empty
          playerCount: game.players.length,
          createdAt: game.createdAt, // Use game.createdAt
          options: game.options,
        });
        count++;
        if (count >= limit) break;
    }
    return publicGamesData;
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.inMemoryGames.clear();
    console.log('GameStore (in-memory): Destroyed and cleared all games.');
  }
}

// Export a singleton instance for use throughout the server-side application
export const gameStore: GameStore = new InMemoryGameStore();
