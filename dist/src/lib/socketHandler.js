// PURPOSE: Manages Socket.IO connections, events, and orchestrates game interactions.
import { serializeGameState, createDeltaUpdate } from "./serialization";
import { placePawn as placePawnLogic, movePawn as movePawnLogic, PAWNS_PER_PLAYER, } from "./gameLogic";
import { addToMatchmakingQueue, removeFromMatchmakingQueue, } from "./matchmaking";
import { compress } from "./compression";
const RATE_LIMIT_CONFIG = {
    maxRequests: 30, // Max requests per time window
    timeWindowMs: 1000, // 1 second
};
// Stores the previous state of a game to calculate deltas for updates.
const gamePreviousStates = new Map();
/**
 * Sanitizes a GameState object to ensure all fields are valid and defaults are applied.
 * This is crucial before serializing or storing the state.
 * @param state The game state to sanitize.
 * @returns A sanitized GameState object.
 */
function sanitizeGameState(state) {
    const currentPlayerId = state.currentPlayerId === 1 || state.currentPlayerId === 2
        ? state.currentPlayerId
        : 1; // Default to Player 1 if invalid
    const defaultOptions = {
        pawnsPerPlayer: PAWNS_PER_PLAYER,
        isPublic: false,
        isMatchmaking: false,
        isRanked: false,
    };
    return Object.assign(Object.assign({}, state), { currentPlayerId, playerColors: state.playerColors || { 1: "light", 2: "dark" }, gamePhase: state.gamePhase || "placement", pawnsToPlace: state.pawnsToPlace || {
            1: PAWNS_PER_PLAYER,
            2: PAWNS_PER_PLAYER,
        }, placedPawns: state.placedPawns || { 1: 0, 2: 0 }, selectedPawnIndex: state.selectedPawnIndex !== undefined ? state.selectedPawnIndex : null, winner: state.winner !== undefined ? state.winner : null, lastMove: state.lastMove !== undefined ? state.lastMove : null, winningLine: state.winningLine !== undefined ? state.winningLine : null, blockedPawnsInfo: new Set(state.blockedPawnsInfo || []), blockingPawnsInfo: new Set(state.blockingPawnsInfo || []), deadZoneSquares: new Map(state.deadZoneSquares || []), deadZoneCreatorPawnsInfo: new Set(state.deadZoneCreatorPawnsInfo || []), options: Object.assign(Object.assign({}, defaultOptions), state.options), highlightedValidMoves: state.highlightedValidMoves || [] });
}
/**
 * Sets up all Socket.IO event handlers for game interactions.
 * @param io The main Socket.IO server instance.
 * @param gameStore The game store instance for managing game data.
 */
export function setupGameSockets(io, gameStore) {
    const clientRateLimits = new Map();
    // Middleware for basic rate limiting
    io.use((socket, next) => {
        var _a;
        try {
            const clientIp = ((_a = socket.handshake.headers["x-forwarded-for"]) === null || _a === void 0 ? void 0 : _a.split(",")[0].trim()) || socket.handshake.address;
            const currentTime = Date.now();
            let rateLimitInfo = clientRateLimits.get(clientIp);
            if (!rateLimitInfo ||
                currentTime - rateLimitInfo.lastResetTime >
                    RATE_LIMIT_CONFIG.timeWindowMs) {
                rateLimitInfo = { count: 1, lastResetTime: currentTime };
                clientRateLimits.set(clientIp, rateLimitInfo);
            }
            else {
                rateLimitInfo.count++;
                if (rateLimitInfo.count > RATE_LIMIT_CONFIG.maxRequests) {
                    console.warn(`SERVER: Rate limit exceeded for IP: ${clientIp}, Socket ID: ${socket.id}`);
                    return next(new Error("Rate limit exceeded."));
                }
            }
            next();
        }
        catch (error) {
            console.error("SERVER: Error in rate limiting middleware:", error);
            next(new Error("Internal server error during rate limit check."));
        }
    });
    io.on("connection", (socket) => {
        console.log("SERVER: New connection:", socket.id);
        let currentJoinedGameId = null;
        let lastActionTime = 0; // Renamed from lastMoveTime for clarity
        socket.on("ping_time", () => socket.emit("pong_time", Date.now()));
        // Matchmaking events
        socket.on("join_matchmaking", ({ playerName, rating }) => {
            console.log(`SERVER: Matchmaking join request from ${playerName} (Socket: ${socket.id})`);
            addToMatchmakingQueue(socket, playerName, rating || 1000);
        });
        socket.on("leave_matchmaking", () => {
            console.log(`SERVER: Matchmaking leave request from Socket: ${socket.id}`);
            removeFromMatchmakingQueue(socket.id);
        });
        // Game creation
        socket.on("create_game", async ({ playerName, options = {} }) => {
            console.log(`SERVER: Create game request from ${playerName} (Socket: ${socket.id}), Options: ${JSON.stringify(options)}`);
            try {
                if (!(playerName === null || playerName === void 0 ? void 0 : playerName.trim())) {
                    socket.emit("game_error", {
                        message: "Player name is required.",
                        errorType: "JOIN_FAILED",
                    });
                    return;
                }
                const gameId = await gameStore.createGame(socket.id, playerName.trim(), options);
                const game = await gameStore.getGame(gameId); // Fetch the created game
                if (!game) {
                    socket.emit("game_error", {
                        message: "Failed to create game instance on server.",
                        errorType: "SERVER_ERROR",
                    });
                    return;
                }
                socket.join(gameId);
                currentJoinedGameId = gameId;
                const sanitizedState = sanitizeGameState(game.state);
                gamePreviousStates.set(gameId, JSON.parse(JSON.stringify(sanitizedState))); // Store for delta calculation
                const creatorPlayer = game.players.find((p) => p.isCreator);
                console.log(`SERVER: Game ${gameId} created by ${creatorPlayer === null || creatorPlayer === void 0 ? void 0 : creatorPlayer.name} (P${creatorPlayer === null || creatorPlayer === void 0 ? void 0 : creatorPlayer.playerId}). Current turn: P${sanitizedState.currentPlayerId}. Emitting 'game_created'.`);
                const binaryState = serializeGameState(sanitizedState);
                const compressedState = compress(binaryState); // Correct compression
                socket.emit("game_created", {
                    gameId,
                    playerId: creatorPlayer === null || creatorPlayer === void 0 ? void 0 : creatorPlayer.playerId,
                    gameState: compressedState, // Send compressed Uint8Array
                    players: game.players,
                    options: game.options,
                    waiting: true,
                });
            }
            catch (error) {
                console.error("SERVER: Error creating game:", error.message, error.stack);
                socket.emit("game_error", {
                    message: `Server error creating game: ${error.message}`,
                    errorType: "SERVER_ERROR",
                });
            }
        });
        // Joining an existing game
        socket.on("join_game", async ({ gameId, playerName, options }) => {
            var _a, _b;
            console.log(`SERVER: Join game request from ${playerName} (Socket: ${socket.id}) for game ${gameId}`);
            try {
                if (!gameId || !(playerName === null || playerName === void 0 ? void 0 : playerName.trim())) {
                    socket.emit("game_error", {
                        message: "Game ID and player name are required.",
                        errorType: "JOIN_FAILED",
                        gameId,
                    });
                    return;
                }
                const gameStatus = await gameStore.getGameStatus(gameId);
                if (!gameStatus.exists) {
                    socket.emit("game_error", {
                        message: "Game does not exist or has expired.",
                        errorType: "GAME_NOT_FOUND",
                        gameId,
                    });
                    return;
                }
                const result = await gameStore.addPlayerToGame(gameId, socket.id, playerName.trim());
                if (!result.success ||
                    !result.assignedPlayerId ||
                    !result.existingPlayers) {
                    socket.emit("game_error", {
                        message: result.error || "Failed to join game.",
                        errorType: ((_a = result.error) === null || _a === void 0 ? void 0 : _a.includes("full"))
                            ? "GAME_FULL"
                            : "JOIN_FAILED",
                        gameId,
                    });
                    return;
                }
                socket.join(gameId);
                currentJoinedGameId = gameId;
                const updatedGame = await gameStore.getGame(gameId);
                if (!updatedGame) {
                    socket.emit("game_error", {
                        message: "Failed to retrieve game details after join.",
                        errorType: "SERVER_ERROR",
                        gameId,
                    });
                    return;
                }
                const sanitizedState = sanitizeGameState(updatedGame.state);
                gamePreviousStates.set(gameId, JSON.parse(JSON.stringify(sanitizedState)));
                const connectedCount = updatedGame.players.filter((p) => p.isConnected).length;
                console.log(`SERVER: Player ${playerName} (P${result.assignedPlayerId}) joined ${gameId}. Turn: P${sanitizedState.currentPlayerId}. Emitting 'game_joined'.`);
                const binaryState = serializeGameState(sanitizedState);
                const compressedState = compress(binaryState);
                socket.emit("game_joined", {
                    gameId,
                    playerId: result.assignedPlayerId,
                    gameState: compressedState,
                    players: updatedGame.players,
                    opponentName: (_b = updatedGame.players.find((p) => p.id !== socket.id)) === null || _b === void 0 ? void 0 : _b.name,
                    options: updatedGame.options,
                    waiting: connectedCount < 2,
                });
                if (connectedCount === 2) {
                    console.log(`SERVER: Both players connected in ${gameId}. Turn P${sanitizedState.currentPlayerId}. Broadcasting 'opponent_joined' and 'game_start'.`);
                    // Notify the other player
                    socket
                        .to(gameId)
                        .emit("opponent_joined", {
                        opponentName: playerName,
                        players: updatedGame.players,
                    });
                    // Start the game for everyone
                    io.to(gameId).emit("game_start", {
                        gameState: compressedState,
                        players: updatedGame.players,
                        options: updatedGame.options,
                    });
                }
            }
            catch (error) {
                console.error(`SERVER: Error joining game ${gameId}:`, error.message, error.stack);
                socket.emit("game_error", {
                    message: `Server error joining game: ${error.message}`,
                    errorType: "SERVER_ERROR",
                    gameId,
                });
            }
        });
        // Handling player actions (place_pawn, move_pawn)
        const handlePlayerAction = async (actionType, gameId, actionData // clientTimestamp removed as it's not used server-side for validation
        ) => {
            console.log(`SERVER: Action '${actionType}' for game ${gameId} from socket ${socket.id}. Data: ${JSON.stringify(actionData)}`);
            try {
                const serverTime = Date.now();
                if (serverTime - lastActionTime < 100) {
                    console.warn(`SERVER: Action too fast from ${socket.id}, ignoring.`);
                    return;
                }
                lastActionTime = serverTime;
                const game = await gameStore.getGame(gameId);
                if (!game) {
                    socket.emit("game_error", {
                        message: "Game not found.",
                        errorType: "GAME_NOT_FOUND",
                        gameId,
                    });
                    return;
                }
                // Allow actions even if one player temporarily disconnects in a 2-player game, but not if game hasn't fully started
                if (game.players.length < 2 && !game.options.isMatchmaking) {
                    // isMatchmaking check might be redundant if game_start is robust
                    socket.emit("game_error", {
                        message: "Waiting for opponent to connect.",
                        errorType: "JOIN_FAILED",
                    });
                    return;
                }
                const player = game.players.find((p) => p.id === socket.id);
                if (!player) {
                    socket.emit("game_error", {
                        message: "Player not found in this game.",
                        errorType: "JOIN_FAILED",
                    });
                    return;
                }
                const currentState = sanitizeGameState(game.state);
                console.log(`SERVER: Processing action for ${player.name} (P${player.playerId}). Game turn P${currentState.currentPlayerId}. Phase: ${currentState.gamePhase}`);
                if (player.playerId !== currentState.currentPlayerId) {
                    console.warn(`SERVER: TURN VALIDATION FAILED for ${actionType}. Player ${player.name} (P${player.playerId}) | Game Turn P${currentState.currentPlayerId}.`);
                    socket.emit("game_error", {
                        message: `Not your turn! It's Player ${currentState.currentPlayerId}'s turn.`,
                        errorType: "JOIN_FAILED",
                    });
                    return;
                }
                let newState = null;
                console.log(`SERVER: Calling game logic for ${actionType}. Player P${player.playerId} acting. State turn P${currentState.currentPlayerId}`);
                if (actionType === "place_pawn" &&
                    typeof actionData.squareIndex === "number") {
                    newState = placePawnLogic(currentState, actionData.squareIndex, player.playerId); // Pass actingPlayerId
                }
                else if (actionType === "move_pawn" &&
                    typeof actionData.fromIndex === "number" &&
                    typeof actionData.toIndex === "number") {
                    newState = movePawnLogic(currentState, actionData.fromIndex, actionData.toIndex, player.playerId); // Pass actingPlayerId
                }
                if (!newState) {
                    console.warn(`SERVER: GAME LOGIC VALIDATION FAILED. Action '${actionType}' by P${player.playerId} was invalid (gameLogic returned null).`);
                    socket.emit("game_error", {
                        message: "Invalid move. Please check game rules.",
                        errorType: "INVALID_MOVE",
                    });
                    return;
                }
                const sanitizedNewState = sanitizeGameState(newState); // Sanitize the state returned by game logic
                console.log(`SERVER: Action ${actionType} by P${player.playerId} successful. New state turn: P${sanitizedNewState.currentPlayerId}. Phase: ${sanitizedNewState.gamePhase}`);
                await gameStore.updateGameState(gameId, sanitizedNewState);
                const previousStateForDelta = gamePreviousStates.get(gameId) || currentState;
                const deltaUpdates = createDeltaUpdate(previousStateForDelta, sanitizedNewState);
                gamePreviousStates.set(gameId, JSON.parse(JSON.stringify(sanitizedNewState)));
                const updatedGameData = await gameStore.getGame(gameId);
                if (!updatedGameData) {
                    console.error(`SERVER: Failed to get game data for ${gameId} after update.`);
                    return;
                }
                // Determine if a full state update or delta update should be sent
                const shouldSendFullState = updatedGameData.sequenceId % 10 === 0 ||
                    deltaUpdates.length > 10 ||
                    actionType === "place_pawn"; // Send full state more often during placement
                if (shouldSendFullState) {
                    console.log(`SERVER: Sending full game_updated for ${gameId}. SeqId: ${updatedGameData.sequenceId}. Turn: P${sanitizedNewState.currentPlayerId}`);
                    const binaryFullState = serializeGameState(sanitizedNewState);
                    const compressedFullState = compress(binaryFullState);
                    io.to(gameId).emit("game_updated", {
                        gameState: compressedFullState,
                        options: updatedGameData.options,
                        fullUpdate: true,
                    });
                }
                else {
                    console.log(`SERVER: Sending game_delta for ${gameId}. SeqId: ${updatedGameData.sequenceId}, ${deltaUpdates.length} changes. Turn: P${sanitizedNewState.currentPlayerId}`);
                    io.to(gameId).emit("game_delta", {
                        updates: deltaUpdates,
                        seqId: updatedGameData.sequenceId,
                    });
                }
            }
            catch (error) {
                console.error(`SERVER: Error handling ${actionType} for game ${gameId}:`, error.message, error.stack);
                socket.emit("game_error", {
                    message: `Server error processing move: ${error.message}`,
                    errorType: "SERVER_ERROR",
                });
            }
        };
        socket.on("place_pawn", (data) => handlePlayerAction("place_pawn", data.gameId, data));
        socket.on("move_pawn", (data) => handlePlayerAction("move_pawn", data.gameId, data));
        socket.on("request_full_state", async ({ gameId }) => {
            console.log(`SERVER: Full state request for game ${gameId} from socket ${socket.id}`);
            try {
                const game = await gameStore.getGame(gameId);
                if (game) {
                    const sanitizedState = sanitizeGameState(game.state);
                    console.log(`SERVER: Sending requested full state for ${gameId}. Turn: P${sanitizedState.currentPlayerId}`);
                    const binaryState = serializeGameState(sanitizedState);
                    const compressedState = compress(binaryState);
                    socket.emit("game_updated", {
                        gameState: compressedState,
                        options: game.options,
                        fullUpdate: true,
                    });
                }
                else {
                    socket.emit("game_error", {
                        message: "Cannot send full state, game not found.",
                        errorType: "GAME_NOT_FOUND",
                        gameId,
                    });
                }
            }
            catch (error) {
                console.error(`SERVER: Error sending full state for ${gameId}:`, error.message, error.stack);
                socket.emit("game_error", {
                    message: `Error retrieving state: ${error.message}`,
                    errorType: "SERVER_ERROR",
                    gameId,
                });
            }
        });
        socket.on("disconnect", async (reason) => {
            console.log(`SERVER: Player disconnected: ${socket.id}, Reason: ${reason}`);
            removeFromMatchmakingQueue(socket.id);
            if (currentJoinedGameId) {
                const gameIdBeforeAsync = currentJoinedGameId; // Capture current value
                try {
                    const removedPlayer = await gameStore.removePlayerFromGame(gameIdBeforeAsync, socket.id);
                    if (removedPlayer) {
                        console.log(`SERVER: Player ${removedPlayer.name} (P${removedPlayer.playerId}) marked as disconnected from game ${gameIdBeforeAsync}`);
                        const game = await gameStore.getGame(gameIdBeforeAsync);
                        if (game) {
                            // Game might have been cleaned up if this was the last player
                            io.to(gameIdBeforeAsync).emit("opponent_disconnected", {
                                playerName: removedPlayer.name,
                                playerId: removedPlayer.playerId,
                                remainingPlayers: game.players,
                            });
                            if (!game.players.some((p) => p.isConnected)) {
                                console.log(`SERVER: All players disconnected from ${gameIdBeforeAsync}. Cleanup was scheduled by gameStore.`);
                                gamePreviousStates.delete(gameIdBeforeAsync);
                            }
                        }
                        else {
                            console.log(`SERVER: Game ${gameIdBeforeAsync} no longer exists after player disconnect (possibly cleaned up).`);
                            gamePreviousStates.delete(gameIdBeforeAsync);
                        }
                    }
                }
                catch (error) {
                    console.error(`SERVER: Error handling disconnection for game ${gameIdBeforeAsync}:`, error.message, error.stack);
                }
                currentJoinedGameId = null;
            }
        });
    });
}
