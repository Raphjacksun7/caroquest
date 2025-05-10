
import { v4 as uuidv4 } from 'uuid';
import type { GameState, PlayerId, StoredPlayer, GameOptions } from './types'; 
import { createInitialGameState, PAWNS_PER_PLAYER, assignPlayerColors } from './gameLogic'; 

interface GameData {
  id: string;
  state: GameState;
  players: StoredPlayer[];
  lastActivity: number;
  options: GameOptions; 
  sequenceId: number; 
  createdAt: Date; 
}

export class GameStore {
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
  
  public createGame(creatorSocketId: string, creatorName: string, options: GameOptions = {}): string {
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
      createdAt: new Date(), // Ensure createdAt is initialized
    };
    
    this.inMemoryGames.set(gameId, gameData);
    console.log(`GameStore (in-memory): Created game ${gameId} for ${creatorName}`);
    return gameId;
  }
  
  private hydrateGameState(state: GameState): GameState {
    return {
      ...state,
      playerColors: state.playerColors || assignPlayerColors(),
      blockedPawnsInfo: new Set(Array.from(state.blockedPawnsInfo || [])),
      blockingPawnsInfo: new Set(Array.from(state.blockingPawnsInfo || [])),
      deadZoneSquares: new Map((Array.isArray(state.deadZoneSquares) ? gameState.deadZoneSquares : Object.entries(gameState.deadZoneSquares || {})).map(([k,v]:[string, PlayerId]) => [parseInt(k),v])),
      deadZoneCreatorPawnsInfo: new Set(Array.from(state.deadZoneCreatorPawnsInfo || [])),
      pawnsToPlace: state.pawnsToPlace || { 1: PAWNS_PER_PLAYER, 2: PAWNS_PER_PLAYER },
      placedPawns: state.placedPawns || { 1:0, 2:0 }
    };
  }

  public getGame(gameId: string): GameData | null {
    const gameData = this.inMemoryGames.get(gameId);
    if (!gameData) return null;

    const deepCopiedGameData = JSON.parse(JSON.stringify(gameData)) as GameData;
    deepCopiedGameData.state = this.hydrateGameState(deepCopiedGameData.state);
    deepCopiedGameData.createdAt = new Date(gameData.createdAt); 
    return deepCopiedGameData;
  }
  
  public updateGameState(gameId: string, state: GameState): boolean {
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
  
  public addPlayerToGame(gameId: string, socketId: string, playerName: string): {success: boolean, assignedPlayerId?: PlayerId, existingPlayers?: StoredPlayer[], error?: string}> {
    const gameData = this.inMemoryGames.get(gameId);
    if (!gameData) return { success: false, error: 'Game not found.' };
    
    const existingPlayer = gameData.players.find(p => p.id === socketId);
    if (existingPlayer) { 
      existingPlayer.name = playerName; 
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
    
  public deleteGame(gameId: string): void {
    this.inMemoryGames.delete(gameId);
    console.log(`GameStore (in-memory): Deleted game ${gameId}`);
  }

  public removePlayerFromGame(gameId: string, socketId: string): StoredPlayer | null {
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

  public getPublicGames(limit = 10): Array<Partial<GameData> & { playerCount: number, createdBy: string }> {
    const publicGamesData: Array<Partial<GameData> & { playerCount: number, createdBy: string }> = [];
    let count = 0;
    
    const sortedGames = Array.from(this.inMemoryGames.values())
      .sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort by creation time

    for (const game of sortedGames) {
      if (game.options?.isPublic && game.players.length < 2) {
        publicGamesData.push({
          id: game.id,
          createdBy: game.players[0]?.name || 'Unknown',
          playerCount: game.players.length,
          createdAt: game.createdAt, 
          options: game.options,
        });
        count++;
        if (count >= limit) break;
      }
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
