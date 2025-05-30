// Core game logic, including board initialization, move validation, and state updates.
export const BOARD_SIZE = 8;
export const PAWNS_PER_PLAYER = 6;
export const WINNING_LINE_LENGTH = 4;
/**
 * Initializes the game board with alternating light and dark squares.
 * Each square is given a unique index, row, column, its board color,
 * and is initially empty with no highlight.
 * @returns An array of SquareState objects representing the initial board.
 */
export function initializeBoard() {
    const board = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const index = row * BOARD_SIZE + col;
            board.push({
                index,
                row,
                col,
                boardColor: (row + col) % 2 === 0 ? "light" : "dark",
                pawn: null,
                highlight: undefined, // Initialize highlight as undefined
            });
        }
    }
    return board;
}
/**
 * Assigns the square colors that each player will play on.
 * Player 1 plays on 'light' squares, Player 2 on 'dark' squares.
 * @returns A record mapping PlayerId to their assigned SquareColor.
 */
export function assignPlayerColors() {
    return { 1: "light", 2: "dark" };
}
/**
 * Creates the initial state for a new game.
 * @param options Optional game options, such as the number of pawns per player.
 * @returns The initial GameState object.
 */
export function createInitialGameState(options) {
    const pawnsCount = (options === null || options === void 0 ? void 0 : options.pawnsPerPlayer) || PAWNS_PER_PLAYER;
    const playerColors = assignPlayerColors();
    const defaultOptions = {
        // Define default options
        pawnsPerPlayer: pawnsCount,
        isPublic: false,
        isMatchmaking: false,
        isRanked: false,
    };
    return {
        board: initializeBoard(),
        currentPlayerId: 1, // Player 1 always starts
        playerColors,
        gamePhase: "placement",
        pawnsToPlace: { 1: pawnsCount, 2: pawnsCount },
        placedPawns: { 1: 0, 2: 0 },
        selectedPawnIndex: null,
        blockedPawnsInfo: new Set(),
        blockingPawnsInfo: new Set(),
        deadZoneSquares: new Map(),
        deadZoneCreatorPawnsInfo: new Set(),
        winner: null,
        lastMove: null,
        winningLine: null,
        highlightedValidMoves: [], // Initialize as empty array
        options: Object.assign(Object.assign({}, defaultOptions), options), // Merge provided options with defaults
    };
}
/**
 * Checks if placing a pawn at a given square is valid for the specified player.
 * @param gameState The current state of the game.
 * @param squareIndex The index of the square to place the pawn on.
 * @param playerId The ID of the player attempting the placement.
 * @returns True if the placement is valid, false otherwise.
 */
export function isValidPlacement(gameState, squareIndex, playerId) {
    var _a, _b, _c, _d;
    const square = gameState.board[squareIndex];
    // Check basic validity: square exists, is empty, matches player's color, and is not a dead zone for them.
    if (!square || square.pawn)
        return false;
    if (square.boardColor !== gameState.playerColors[playerId])
        return false;
    if (gameState.deadZoneSquares.get(squareIndex) === playerId)
        return false;
    const { row, col } = square;
    const opponentId = playerId === 1 ? 2 : 1;
    // Check for restricted zone (horizontal sandwich by opponent)
    if (col > 0 && col < BOARD_SIZE - 1) {
        const leftSquare = gameState.board[row * BOARD_SIZE + (col - 1)];
        const rightSquare = gameState.board[row * BOARD_SIZE + (col + 1)];
        if (((_a = leftSquare === null || leftSquare === void 0 ? void 0 : leftSquare.pawn) === null || _a === void 0 ? void 0 : _a.playerId) === opponentId &&
            ((_b = rightSquare === null || rightSquare === void 0 ? void 0 : rightSquare.pawn) === null || _b === void 0 ? void 0 : _b.playerId) === opponentId)
            return false;
    }
    // Check for restricted zone (vertical sandwich by opponent)
    if (row > 0 && row < BOARD_SIZE - 1) {
        const topSquare = gameState.board[(row - 1) * BOARD_SIZE + col];
        const bottomSquare = gameState.board[(row + 1) * BOARD_SIZE + col];
        if (((_c = topSquare === null || topSquare === void 0 ? void 0 : topSquare.pawn) === null || _c === void 0 ? void 0 : _c.playerId) === opponentId &&
            ((_d = bottomSquare === null || bottomSquare === void 0 ? void 0 : bottomSquare.pawn) === null || _d === void 0 ? void 0 : _d.playerId) === opponentId)
            return false;
    }
    return true;
}
/**
 * Checks if moving a pawn from a source square to a target square is valid.
 * @param gameState The current state of the game.
 * @param fromIndex The index of the square the pawn is moving from.
 * @param toIndex The index of the square the pawn is moving to.
 * @param playerId The ID of the player attempting the move.
 * @returns True if the move is valid, false otherwise.
 */
export function isValidMove(gameState, fromIndex, toIndex, playerId) {
    const fromSquare = gameState.board[fromIndex];
    const toSquare = gameState.board[toIndex];
    // Basic move validation
    if (!(fromSquare === null || fromSquare === void 0 ? void 0 : fromSquare.pawn) || fromSquare.pawn.playerId !== playerId)
        return false; // Not player's pawn
    if (!toSquare || toSquare.pawn)
        return false; // Destination occupied
    if (toSquare.boardColor !== gameState.playerColors[playerId])
        return false; // Not player's assigned color square
    if (gameState.blockedPawnsInfo.has(fromIndex))
        return false; // Cannot move blocked pawns
    if (gameState.deadZoneSquares.get(toIndex) === playerId)
        return false; // Cannot move to a dead zone
    return true; // "Move anywhere on your color" rule for Movement Phase.
}
/**
 * Updates the sets of blocked pawns (sandwiched) and blocking pawns (doing the sandwiching).
 * @param board The current game board state.
 * @returns An object containing sets of indices for blocked and blocking pawns.
 */
export function updateBlockingStatus(board) {
    const blockedPawns = new Set();
    const blockingPawns = new Set();
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const centerIdx = r * BOARD_SIZE + c;
            const centerSq = board[centerIdx];
            if (!(centerSq === null || centerSq === void 0 ? void 0 : centerSq.pawn))
                continue; // Only check squares with pawns
            // Horizontal blocking: P_Opponent - P_Center - P_Opponent
            if (c > 0 && c < BOARD_SIZE - 1) {
                const leftSq = board[r * BOARD_SIZE + (c - 1)];
                const rightSq = board[r * BOARD_SIZE + (c + 1)];
                if ((leftSq === null || leftSq === void 0 ? void 0 : leftSq.pawn) &&
                    (rightSq === null || rightSq === void 0 ? void 0 : rightSq.pawn) &&
                    leftSq.pawn.playerId === rightSq.pawn.playerId && // Both blockers are same player
                    leftSq.pawn.playerId !== centerSq.pawn.playerId // And different from center pawn
                ) {
                    blockedPawns.add(centerIdx);
                    blockingPawns.add(leftSq.index);
                    blockingPawns.add(rightSq.index);
                }
            }
            // Vertical blocking: P_Opponent / P_Center / P_Opponent
            if (r > 0 && r < BOARD_SIZE - 1) {
                const topSq = board[(r - 1) * BOARD_SIZE + c];
                const bottomSq = board[(r + 1) * BOARD_SIZE + c];
                if ((topSq === null || topSq === void 0 ? void 0 : topSq.pawn) &&
                    (bottomSq === null || bottomSq === void 0 ? void 0 : bottomSq.pawn) &&
                    topSq.pawn.playerId === bottomSq.pawn.playerId && // Both blockers are same player
                    topSq.pawn.playerId !== centerSq.pawn.playerId // And different from center pawn
                ) {
                    blockedPawns.add(centerIdx);
                    blockingPawns.add(topSq.index);
                    blockingPawns.add(bottomSq.index);
                }
            }
        }
    }
    return { blockedPawns, blockingPawns };
}
/**
 * Identifies dead zone squares and the pawns creating them.
 * A dead zone is an empty square of an opponent's color, sandwiched by two of the current player's pawns.
 * @param board The current game board state.
 * @param playerColors Mapping of player IDs to their assigned square colors.
 * @returns An object containing a map of dead zone squares (index -> player ID for whom it's dead)
 * and a set of indices for pawns creating these dead zones.
 */
export function updateDeadZones(board, playerColors) {
    const deadZones = new Map();
    const deadZoneCreatorPawns = new Set();
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const currentSq = board[r * BOARD_SIZE + c];
            if (currentSq.pawn)
                continue; // Dead zones must be empty squares
            // Horizontal: P_Creator - E_OpponentColor - P_Creator
            if (c > 0 && c < BOARD_SIZE - 1) {
                const leftSq = board[r * BOARD_SIZE + (c - 1)];
                const rightSq = board[r * BOARD_SIZE + (c + 1)];
                if ((leftSq === null || leftSq === void 0 ? void 0 : leftSq.pawn) &&
                    (rightSq === null || rightSq === void 0 ? void 0 : rightSq.pawn) &&
                    leftSq.pawn.playerId === rightSq.pawn.playerId // Pawns belong to the same player
                ) {
                    const creatorPlayerId = leftSq.pawn.playerId;
                    const opponentPlayerId = creatorPlayerId === 1 ? 2 : 1;
                    // Dead zone is created on an empty square of the *opponent's* assigned color
                    if (currentSq.boardColor === playerColors[opponentPlayerId]) {
                        deadZones.set(currentSq.index, opponentPlayerId); // This square is dead for the opponent
                        deadZoneCreatorPawns.add(leftSq.index);
                        deadZoneCreatorPawns.add(rightSq.index);
                    }
                }
            }
            // Vertical: P_Creator / E_OpponentColor / P_Creator
            if (r > 0 && r < BOARD_SIZE - 1) {
                const topSq = board[(r - 1) * BOARD_SIZE + c];
                const bottomSq = board[(r + 1) * BOARD_SIZE + c];
                if ((topSq === null || topSq === void 0 ? void 0 : topSq.pawn) &&
                    (bottomSq === null || bottomSq === void 0 ? void 0 : bottomSq.pawn) &&
                    topSq.pawn.playerId === bottomSq.pawn.playerId // Pawns belong to the same player
                ) {
                    const creatorPlayerId = topSq.pawn.playerId;
                    const opponentPlayerId = creatorPlayerId === 1 ? 2 : 1;
                    // Dead zone is created on an empty square of the *opponent's* assigned color
                    if (currentSq.boardColor === playerColors[opponentPlayerId]) {
                        deadZones.set(currentSq.index, opponentPlayerId); // This square is dead for the opponent
                        deadZoneCreatorPawns.add(topSq.index);
                        deadZoneCreatorPawns.add(bottomSq.index);
                    }
                }
            }
        }
    }
    return { deadZones, deadZoneCreatorPawns };
}
/**
 * Checks if a player has won by forming a diagonal of 4 pawns.
 * Considers blocked pawns, blocking pawns, dead zone creators, and dead zones.
 * @param gameState The current state of the game.
 * @returns An object containing the winner's PlayerId and the winning line, or nulls if no winner.
 */
export function checkWinCondition(gameState) {
    const { board, playerColors, deadZoneSquares, blockedPawnsInfo, blockingPawnsInfo, deadZoneCreatorPawnsInfo, } = gameState;
    // Only need to check two main diagonal directions (down-right, down-left)
    // as starting points will cover all possibilities.
    const directions = [
        { dr: 1, dc: 1 }, // Down-Right
        { dr: 1, dc: -1 }, // Down-Left
    ];
    for (const playerId of [1, 2]) {
        const playerAssignedColor = playerColors[playerId];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                // For each square, check if it's a potential start of a winning line
                for (const dir of directions) {
                    const line = [];
                    let possible = true;
                    for (let step = 0; step < WINNING_LINE_LENGTH; step++) {
                        const curR = r + dir.dr * step;
                        const curC = c + dir.dc * step;
                        // Check bounds
                        if (curR < 0 ||
                            curR >= BOARD_SIZE ||
                            curC < 0 ||
                            curC >= BOARD_SIZE) {
                            possible = false;
                            break;
                        }
                        const idx = curR * BOARD_SIZE + curC;
                        const sq = board[idx];
                        // Check conditions for a valid pawn in the winning line
                        if (!sq.pawn || // Must have a pawn
                            sq.pawn.playerId !== playerId || // Must be player's own pawn
                            sq.boardColor !== playerAssignedColor || // Must be on player's assigned color square
                            blockedPawnsInfo.has(idx) || // Pawn cannot be blocked
                            blockingPawnsInfo.has(idx) || // Pawn cannot be actively blocking another
                            deadZoneCreatorPawnsInfo.has(idx) || // Pawn cannot be creating a dead zone
                            deadZoneSquares.get(idx) === playerId // Square cannot be a dead zone for this player
                        ) {
                            possible = false;
                            break;
                        }
                        line.push(idx);
                    }
                    if (possible && line.length === WINNING_LINE_LENGTH) {
                        return { winner: playerId, winningLine: line };
                    }
                }
            }
        }
    }
    return { winner: null, winningLine: null }; // No winner
}
/**
 * Processes a pawn placement action.
 * @param gameState The current game state.
 * @param squareIndex The index of the square where the pawn is to be placed.
 * @param actingPlayerId The ID of the player performing the action.
 * @returns A new GameState if the placement is valid, otherwise null.
 */
export function placePawn(gameState, squareIndex, actingPlayerId) {
    // Ensure it's the current player's turn
    if (gameState.currentPlayerId !== actingPlayerId) {
        console.error(`gameLogic.placePawn: Turn mismatch. Game expects P${gameState.currentPlayerId}, but P${actingPlayerId} acted.`);
        return null;
    }
    // Validate placement
    if (!isValidPlacement(gameState, squareIndex, actingPlayerId)) {
        console.log(`gameLogic.placePawn: Invalid placement for P${actingPlayerId} at ${squareIndex}.`);
        return null;
    }
    const newPawn = {
        id: `p${actingPlayerId}_${gameState.placedPawns[actingPlayerId] + 1}`, // Generate unique pawn ID
        playerId: actingPlayerId,
        color: gameState.playerColors[actingPlayerId], // Pawn's color matches player's assigned square color
    };
    // Create new board with the placed pawn
    const newBoard = gameState.board.map((sq, i) => i === squareIndex
        ? Object.assign(Object.assign({}, sq), { pawn: newPawn, highlight: undefined }) : Object.assign(Object.assign({}, sq), { highlight: undefined }) // Clear highlights from other squares
    );
    // Update pawn counts
    const newPawnsToPlace = Object.assign(Object.assign({}, gameState.pawnsToPlace), { [actingPlayerId]: gameState.pawnsToPlace[actingPlayerId] - 1 });
    const newPlacedPawns = Object.assign(Object.assign({}, gameState.placedPawns), { [actingPlayerId]: gameState.placedPawns[actingPlayerId] + 1 });
    // Determine next game phase
    let nextGamePhase = gameState.gamePhase;
    if (newPawnsToPlace[1] === 0 && newPawnsToPlace[2] === 0) {
        nextGamePhase = "movement";
    }
    // Update blocking and dead zone statuses based on the new board
    const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
    const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newBoard, gameState.playerColors);
    // Create a temporary state to check for win condition
    const tempGameState = Object.assign(Object.assign({}, gameState), { board: newBoard, pawnsToPlace: newPawnsToPlace, placedPawns: newPlacedPawns, gamePhase: nextGamePhase, blockedPawnsInfo: blockedPawns, blockingPawnsInfo: blockingPawns, deadZoneSquares: deadZones, deadZoneCreatorPawnsInfo: deadZoneCreatorPawns, selectedPawnIndex: null, lastMove: { from: null, to: squareIndex }, options: Object.assign({}, gameState.options) });
    // Check for win condition
    const { winner, winningLine } = checkWinCondition(tempGameState);
    // Determine next player
    const nextPlayerId = actingPlayerId === 1 ? 2 : 1;
    // Return the final new game state
    return Object.assign(Object.assign({}, tempGameState), { winner,
        winningLine, currentPlayerId: winner ? actingPlayerId : nextPlayerId });
}
/**
 * Processes a pawn movement action.
 * @param gameState The current game state.
 * @param fromIndex The index of the square the pawn is moving from.
 * @param toIndex The index of the square the pawn is moving to.
 * @param actingPlayerId The ID of the player performing the action.
 * @returns A new GameState if the move is valid, otherwise null.
 */
export function movePawn(gameState, fromIndex, toIndex, actingPlayerId) {
    // Ensure it's the current player's turn
    if (gameState.currentPlayerId !== actingPlayerId) {
        console.error(`gameLogic.movePawn: Turn mismatch. Game expects P${gameState.currentPlayerId}, but P${actingPlayerId} acted.`);
        return null;
    }
    // Validate move
    if (!isValidMove(gameState, fromIndex, toIndex, actingPlayerId)) {
        console.log(`gameLogic.movePawn: Invalid move for P${actingPlayerId} from ${fromIndex} to ${toIndex}.`);
        return null;
    }
    const pawnToMove = gameState.board[fromIndex].pawn;
    // This check is redundant if isValidMove is comprehensive but good for safety
    if (!pawnToMove || pawnToMove.playerId !== actingPlayerId)
        return null;
    // Create new board with the moved pawn
    const newBoard = gameState.board.map((sq, i) => {
        let newSq = Object.assign(Object.assign({}, sq), { highlight: undefined }); // Clear highlights
        if (i === fromIndex)
            return Object.assign(Object.assign({}, newSq), { pawn: null }); // Empty the source square
        if (i === toIndex)
            return Object.assign(Object.assign({}, newSq), { pawn: pawnToMove }); // Place pawn in destination
        return newSq;
    });
    // Update blocking and dead zone statuses
    const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
    const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newBoard, gameState.playerColors);
    // Create temporary state for win check
    const tempGameState = Object.assign(Object.assign({}, gameState), { board: newBoard, blockedPawnsInfo: blockedPawns, blockingPawnsInfo: blockingPawns, deadZoneSquares: deadZones, deadZoneCreatorPawnsInfo: deadZoneCreatorPawns, selectedPawnIndex: null, lastMove: { from: fromIndex, to: toIndex }, options: Object.assign({}, gameState.options) });
    // Check for win condition
    const { winner, winningLine } = checkWinCondition(tempGameState);
    // Determine next player
    const nextPlayerId = actingPlayerId === 1 ? 2 : 1;
    // Return final new game state
    return Object.assign(Object.assign({}, tempGameState), { winner,
        winningLine, currentPlayerId: winner ? actingPlayerId : nextPlayerId });
}
/**
 * Gets a list of valid destination square indices for a pawn.
 * @param gameState The current game state.
 * @param fromIndex The index of the pawn to get moves for.
 * @param playerId The ID of the player owning the pawn.
 * @returns An array of valid destination square indices.
 */
export function getValidMoveDestinations(gameState, fromIndex, playerId) {
    const validDests = [];
    const fromSq = gameState.board[fromIndex];
    // Ensure the pawn exists, belongs to the player, and is not blocked
    if (!(fromSq === null || fromSq === void 0 ? void 0 : fromSq.pawn) ||
        fromSq.pawn.playerId !== playerId ||
        gameState.blockedPawnsInfo.has(fromIndex)) {
        return [];
    }
    // Iterate over all squares to check for valid moves
    gameState.board.forEach((toSq) => {
        if (isValidMove(gameState, fromIndex, toSq.index, playerId)) {
            validDests.push(toSq.index);
        }
    });
    return validDests;
}
/**
 * Highlights the selected pawn and its valid move destinations.
 * @param gameState The current game state.
 * @param pawnIndex The index of the pawn selected by the player.
 * @returns A new GameState with updated highlights.
 */
export function highlightValidMoves(gameState, pawnIndex) {
    var _a;
    const { currentPlayerId } = gameState;
    const pawnToSelect = (_a = gameState.board[pawnIndex]) === null || _a === void 0 ? void 0 : _a.pawn;
    // If selection is invalid (no pawn, not current player's pawn, or pawn is blocked), clear all highlights.
    if (!pawnToSelect ||
        pawnToSelect.playerId !== currentPlayerId ||
        gameState.blockedPawnsInfo.has(pawnIndex)) {
        return clearHighlights(gameState);
    }
    const validDestinations = getValidMoveDestinations(gameState, pawnIndex, currentPlayerId);
    // Create new board state with highlights
    const newBoard = gameState.board.map((square, i) => {
        let highlightValue = undefined; // Explicitly type highlightValue
        if (i === pawnIndex) {
            highlightValue = "selectedPawn";
        }
        else if (validDestinations.includes(i)) {
            highlightValue = "validMove";
        }
        return Object.assign(Object.assign({}, square), { highlight: highlightValue });
    });
    return Object.assign(Object.assign({}, gameState), { board: newBoard, selectedPawnIndex: pawnIndex });
}
/**
 * Clears all highlights from the board and resets the selected pawn index.
 * @param gameState The current game state.
 * @returns A new GameState with highlights cleared.
 */
export function clearHighlights(gameState) {
    const newBoard = gameState.board.map((square) => (Object.assign(Object.assign({}, square), { highlight: undefined })));
    return Object.assign(Object.assign({}, gameState), { board: newBoard, selectedPawnIndex: null });
}
