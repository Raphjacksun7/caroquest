import { v4 as uuidv4 } from 'uuid';
import type { GameState, PlayerId, StoredPlayer, GameOptions } from './types'; 
import { createInitialGameState, PAWNS_PER_PLAYER, assignPlayerColors, initializeBoard, BOARD_SIZE } from './gameLogic'; 
import { nanoid } from 'nanoid';

// Interface for the actual data stored for each game
interface GameData {
  id: string;
  state: GameState;
  players: StoredPlayer[];
  lastActivity: number;
  options: GameOptions;
  sequenceId: number;
  createdAt: number; 
}

export interface GameStore {
  createGame(creatorSocketId: string, creatorName: string, options?: GameOptions): Promise<string>;
  getGame(gameId: string): Promise<GameData | null>;
  updateGameState(gameId: string, state: GameState): Promise<boolean>;
  addPlayerToGame(gameId: string, socketId: string, playerName: string): Promise<{ success: boolean, assignedPlayerId?: PlayerId, existingPlayers?: StoredPlayer[], error?: string }>;
  deleteGame(gameId: string): Promise<void>;
  removePlayerFromGame(gameId: string, socketId: string): Promise<StoredPlayer | null>;
  getPublicGames(limit?: number): Promise<Array<Partial<GameData> & { playerCount: number, createdBy: string }>>;
  destroy(): void; 
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
    const gameId = options.gameIdToCreate || nanoid(8).toUpperCase();
    const pawns = options.pawnsPerPlayer || PAWNS_PER_PLAYER;
    const initialState = createInitialGameState(pawns); 

    const gameData: GameData = {
      id: gameId,
      state: initialState,
      players: [{ id: creatorSocketId, name: creatorName, playerId: 1 as PlayerId, isConnected: true, isCreator: true, rating: options.isRanked ? 1000: undefined }],
      lastActivity: Date.now(),
      options,
      sequenceId: 0,
      createdAt: Date.now(), 
    };

    this.inMemoryGames.set(gameId, gameData);
    console.log(`GameStore (in-memory): Created game ${gameId} for ${creatorName}`);
    return gameId;
  }
  
  private hydrateGameState(state: GameState): GameState {
    const board = (state.board && state.board.length === BOARD_SIZE * BOARD_SIZE) 
                  ? state.board 
                  : initializeBoard();

    return {
      ...state,
      board, 
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
    game.state = this.hydrateGameState(state); 
    game.lastActivity = Date.now();
    game.sequenceId++; 
    return true;
  }

  public async addPlayerToGame(gameId: string, socketId: string, playerName: string): Promise<{ success: boolean, assignedPlayerId?: PlayerId, existingPlayers?: StoredPlayer[], error?: string }> {
    const gameData = this.inMemoryGames.get(gameId);
    if (!gameData) return { success: false, error: 'Game not found.' };

    const existingPlayer = gameData.players.find(p => p.id === socketId);
    if (existingPlayer) {
      existingPlayer.name = playerName; 
      existingPlayer.isConnected = true;
      gameData.lastActivity = Date.now();
      return { success: true, assignedPlayerId: existingPlayer.playerId, existingPlayers: gameData.players };
    }

    if (gameData.players.filter(p => p.isConnected).length >= 2) {
      return { success: false, error: 'Game is full.' };
    }
    
    const assignedPlayerId = (gameData.players[0]?.playerId === 1 ? 2 : 1) as PlayerId;
    gameData.players.push({ id: socketId, name: playerName, playerId: assignedPlayerId, isConnected: true, isCreator: false, rating: gameData.options.isRanked ? 1000: undefined });
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
    
    const removedPlayer = { ...game.players[playerIndex], isConnected: false }; 
    game.players[playerIndex].isConnected = false; 
    game.lastActivity = Date.now();
    
    if (game.players.every(p => !p.isConnected)) {
        console.log(`GameStore (in-memory): All players disconnected from game ${gameId}. It will be cleaned up if inactive.`);
    }
    return removedPlayer;
  }
  
  public async getPublicGames(limit = 10): Promise<Array<Partial<GameData> & { playerCount: number, createdBy: string }>> {
    const publicGamesData: Array<Partial<GameData> & { playerCount: number, createdBy: string }> = [];
    let count = 0;

    const sortedGames = Array.from(this.inMemoryGames.values())
      .filter(game => game.options?.isPublic && game.players.filter(p => p.isConnected).length < 2) 
      .sort((a, b) => b.createdAt - a.createdAt); 

    for (const game of sortedGames) {
        publicGamesData.push({
          id: game.id,
          createdBy: game.players.find(p => p.isCreator)?.name || game.players[0]?.name || 'Unknown', 
          playerCount: game.players.filter(p => p.isConnected).length,
          createdAt: game.createdAt, 
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

export const gameStore: GameStore = new InMemoryGameStore();