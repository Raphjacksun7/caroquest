// PURPOSE: Manages the state and lifecycle of all active game instances on the server.
import { nanoid } from 'nanoid';
import { createInitialGameState, PAWNS_PER_PLAYER, assignPlayerColors, initializeBoard, BOARD_SIZE } from './gameLogic';
class InMemoryGameStore {
    constructor() {
        this.inMemoryGames = new Map();
        this.cleanupTimeouts = new Map(); // Stores timeouts for scheduled game cleanup
        this.gameTTLMs = 24 * 60 * 60 * 1000; // Time-to-live for inactive games (24 hours)
        this.cleanupCheckIntervalMs = 30 * 60 * 1000; // Interval to check for very old games (30 minutes)
        this.periodicCleanupInterval = null;
        console.log('GameStore: Initialized in-memory store.');
        this.startPeriodicCleanup();
    }
    /**
     * Starts a periodic interval to clean up exceptionally old games
     * that might have missed their scheduled cleanup.
     */
    startPeriodicCleanup() {
        if (this.periodicCleanupInterval)
            clearInterval(this.periodicCleanupInterval);
        this.periodicCleanupInterval = setInterval(() => {
            const now = Date.now();
            this.inMemoryGames.forEach((game, gameId) => {
                if (!game.scheduledForCleanup && now - game.lastActivity > this.gameTTLMs * 2) {
                    console.log(`GameStore: Auto-cleaning exceptionally old game ${gameId} (last active: ${new Date(game.lastActivity).toISOString()})`);
                    this.deleteGameInternal(gameId);
                }
            });
        }, this.cleanupCheckIntervalMs);
    }
    /**
     * Schedules a game to be deleted after a period of inactivity (gameTTLMs).
     * @param gameId The ID of the game to schedule for cleanup.
     */
    scheduleGameCleanup(gameId) {
        const game = this.inMemoryGames.get(gameId);
        if (!game || game.scheduledForCleanup)
            return;
        this.cancelScheduledCleanup(gameId);
        const timeoutId = setTimeout(() => {
            console.log(`GameStore: Executing scheduled cleanup for inactive game ${gameId}.`);
            this.deleteGameInternal(gameId);
        }, this.gameTTLMs);
        this.cleanupTimeouts.set(gameId, timeoutId);
        game.scheduledForCleanup = true;
        console.log(`GameStore: Scheduled cleanup for game ${gameId} in ${this.gameTTLMs / (60 * 60 * 1000)} hours.`);
    }
    /**
     * Cancels a previously scheduled game cleanup.
     * @param gameId The ID of the game whose cleanup should be cancelled.
     */
    cancelScheduledCleanup(gameId) {
        const game = this.inMemoryGames.get(gameId);
        const timeoutId = this.cleanupTimeouts.get(gameId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.cleanupTimeouts.delete(gameId);
        }
        if (game === null || game === void 0 ? void 0 : game.scheduledForCleanup) {
            game.scheduledForCleanup = false;
            console.log(`GameStore: Cancelled scheduled cleanup for game ${gameId}.`);
        }
    }
    async deleteGameInternal(gameId) {
        this.cancelScheduledCleanup(gameId);
        this.inMemoryGames.delete(gameId);
        console.log(`GameStore: Deleted game ${gameId}.`);
    }
    async getGameStatus(gameId) {
        const game = this.inMemoryGames.get(gameId);
        if (!game)
            return { exists: false, hasActivePlayers: false, scheduledForCleanup: false };
        return {
            exists: true,
            hasActivePlayers: game.players.some(p => p.isConnected),
            scheduledForCleanup: !!game.scheduledForCleanup
        };
    }
    async createGame(creatorSocketId, creatorName, options = {}) {
        const gameId = options.gameIdToCreate || nanoid(8).toUpperCase();
        this.cancelScheduledCleanup(gameId);
        const pawnsCount = options.pawnsPerPlayer || PAWNS_PER_PLAYER;
        const initialState = createInitialGameState(Object.assign(Object.assign({}, options), { pawnsPerPlayer: pawnsCount }));
        initialState.currentPlayerId = 1;
        const gameData = {
            id: gameId,
            state: initialState,
            players: [{
                    id: creatorSocketId,
                    name: creatorName,
                    playerId: 1,
                    isConnected: true,
                    isCreator: true,
                    rating: options.isRanked ? 1000 : undefined
                }],
            lastActivity: Date.now(),
            options: Object.assign({ pawnsPerPlayer: pawnsCount }, options),
            sequenceId: 0,
            createdAt: Date.now(),
            scheduledForCleanup: false,
        };
        this.inMemoryGames.set(gameId, gameData);
        console.log(`GameStore: Created game ${gameId} for ${creatorName} (Player 1). Options: ${JSON.stringify(options)}`);
        return gameId;
    }
    hydrateGameState(state) {
        var _a, _b;
        const pawnsPerPlayer = ((_a = state.options) === null || _a === void 0 ? void 0 : _a.pawnsPerPlayer) || PAWNS_PER_PLAYER;
        const defaultOptions = { pawnsPerPlayer, isPublic: false, isMatchmaking: false, isRanked: false };
        return {
            board: (((_b = state.board) === null || _b === void 0 ? void 0 : _b.length) === BOARD_SIZE * BOARD_SIZE) ? state.board : initializeBoard(),
            playerColors: state.playerColors || assignPlayerColors(),
            currentPlayerId: (state.currentPlayerId === 1 || state.currentPlayerId === 2) ? state.currentPlayerId : 1,
            gamePhase: state.gamePhase || 'placement',
            pawnsToPlace: state.pawnsToPlace || { 1: pawnsPerPlayer, 2: pawnsPerPlayer },
            placedPawns: state.placedPawns || { 1: 0, 2: 0 },
            selectedPawnIndex: state.selectedPawnIndex !== undefined ? state.selectedPawnIndex : null,
            blockedPawnsInfo: new Set(state.blockedPawnsInfo || []),
            blockingPawnsInfo: new Set(state.blockingPawnsInfo || []),
            deadZoneSquares: new Map(state.deadZoneSquares || []),
            deadZoneCreatorPawnsInfo: new Set(state.deadZoneCreatorPawnsInfo || []),
            winner: state.winner !== undefined ? state.winner : null,
            lastMove: state.lastMove !== undefined ? state.lastMove : null,
            winningLine: state.winningLine !== undefined ? state.winningLine : null,
            highlightedValidMoves: state.highlightedValidMoves || [],
            options: Object.assign(Object.assign({}, defaultOptions), state.options),
        };
    }
    async getGame(gameId) {
        const gameData = this.inMemoryGames.get(gameId);
        if (!gameData)
            return null;
        gameData.lastActivity = Date.now();
        this.cancelScheduledCleanup(gameId);
        return Object.assign(Object.assign({}, gameData), { state: this.hydrateGameState(gameData.state), players: JSON.parse(JSON.stringify(gameData.players)), options: JSON.parse(JSON.stringify(gameData.options)) });
    }
    async updateGameState(gameId, newState) {
        const game = this.inMemoryGames.get(gameId);
        if (!game) {
            console.warn(`GameStore: Attempted to update non-existent game: ${gameId}`);
            return false;
        }
        this.cancelScheduledCleanup(gameId);
        game.state = this.hydrateGameState(newState);
        game.lastActivity = Date.now();
        game.sequenceId++;
        console.log(`GameStore: Updated game ${gameId}. Seq: ${game.sequenceId}, Turn: P${game.state.currentPlayerId}, Phase: ${game.state.gamePhase}`);
        return true;
    }
    async addPlayerToGame(gameId, socketId, playerName) {
        const gameData = this.inMemoryGames.get(gameId);
        if (!gameData)
            return { success: false, error: 'Game not found or has expired.' };
        this.cancelScheduledCleanup(gameId);
        gameData.lastActivity = Date.now();
        const existingPlayerBySocketId = gameData.players.find(p => p.id === socketId);
        if (existingPlayerBySocketId) {
            existingPlayerBySocketId.isConnected = true;
            existingPlayerBySocketId.name = playerName;
            console.log(`GameStore: ${playerName} (ID: ${socketId}) reconnected to game ${gameId} as Player ${existingPlayerBySocketId.playerId}`);
            return { success: true, assignedPlayerId: existingPlayerBySocketId.playerId, existingPlayers: gameData.players };
        }
        const existingPlayerByNameAndDisconnected = gameData.players.find(p => p.name === playerName && !p.isConnected);
        if (existingPlayerByNameAndDisconnected) {
            existingPlayerByNameAndDisconnected.id = socketId;
            existingPlayerByNameAndDisconnected.isConnected = true;
            console.log(`GameStore: ${playerName} (New ID: ${socketId}) reconnected by name to game ${gameId} as Player ${existingPlayerByNameAndDisconnected.playerId}`);
            return { success: true, assignedPlayerId: existingPlayerByNameAndDisconnected.playerId, existingPlayers: gameData.players };
        }
        if (gameData.players.some(p => p.name === playerName && p.isConnected)) {
            return { success: false, error: `Player name "${playerName}" is already in use in this game by an active player.` };
        }
        if (gameData.players.filter(p => p.isConnected).length >= 2) {
            return { success: false, error: 'Game is full. Cannot add new player.' };
        }
        const isPlayer1Taken = gameData.players.some(p => p.playerId === 1);
        const assignedPlayerId = isPlayer1Taken ? 2 : 1;
        gameData.players.push({
            id: socketId,
            name: playerName,
            playerId: assignedPlayerId,
            isConnected: true,
            isCreator: false,
            rating: gameData.options.isRanked ? 1000 : undefined
        });
        console.log(`GameStore: ${playerName} (ID: ${socketId}) joined game ${gameId} as Player ${assignedPlayerId}. Total players now: ${gameData.players.length}, Connected: ${gameData.players.filter(p => p.isConnected).length}`);
        return { success: true, assignedPlayerId, existingPlayers: gameData.players };
    }
    async removePlayerFromGame(gameId, socketId) {
        const game = this.inMemoryGames.get(gameId);
        if (!game)
            return null;
        const player = game.players.find(p => p.id === socketId);
        if (!player)
            return null;
        player.isConnected = false;
        game.lastActivity = Date.now();
        if (!game.players.some(p => p.isConnected)) {
            console.log(`GameStore: All players disconnected from game ${gameId}. Scheduling cleanup.`);
            this.scheduleGameCleanup(gameId);
        }
        return Object.assign({}, player);
    }
    destroy() {
        this.cleanupTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.cleanupTimeouts.clear();
        if (this.periodicCleanupInterval) {
            clearInterval(this.periodicCleanupInterval);
            this.periodicCleanupInterval = null;
        }
        this.inMemoryGames.clear();
        console.log('GameStore: Destroyed. All games and cleanup intervals cleared.');
    }
}
export const gameStore = new InMemoryGameStore();
