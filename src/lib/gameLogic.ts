// Core game logic, including board initialization, move validation, and state updates.

import type {
  GameState,
  PlayerId,
  SquareState,
  Pawn,
  SquareColor,
  GamePhase,
  GameOptions,
} from "./types";

export const BOARD_SIZE = 8;
export const PAWNS_PER_PLAYER = 6;
export const WINNING_LINE_LENGTH = 4;

/**
 * Initializes the game board with alternating light and dark squares.
 * Each square is given a unique index, row, column, its board color,
 * and is initially empty with no highlight.
 * @returns An array of SquareState objects representing the initial board.
 */
export function initializeBoard(): SquareState[] {
  const board: SquareState[] = [];
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
export function assignPlayerColors(): Record<PlayerId, SquareColor> {
  return { 1: "light", 2: "dark" };
}

/**
 * Creates the initial state for a new game.
 * @param options Optional game options, such as the number of pawns per player.
 * @returns The initial GameState object.
 */
export function createInitialGameState(options?: GameOptions): GameState {
  const pawnsCount = options?.pawnsPerPlayer || PAWNS_PER_PLAYER;
  const playerColors = assignPlayerColors();
  const defaultOptions: GameOptions = {
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
    blockedPawnsInfo: new Set<number>(),
    blockingPawnsInfo: new Set<number>(),
    deadZoneSquares: new Map<number, PlayerId>(),
    deadZoneCreatorPawnsInfo: new Set<number>(),
    winner: null,
    lastMove: null,
    winningLine: null,
    highlightedValidMoves: [], // Initialize as empty array
    options: { ...defaultOptions, ...options }, // Merge provided options with defaults
  };
}

/**
 * Checks if placing a pawn at a given square is valid for the specified player.
 * @param gameState The current state of the game.
 * @param squareIndex The index of the square to place the pawn on.
 * @param playerId The ID of the player attempting the placement.
 * @returns True if the placement is valid, false otherwise.
 */
export function isValidPlacement(
  gameState: Readonly<GameState>,
  squareIndex: number,
  playerId: PlayerId
): boolean {
  const square = gameState.board[squareIndex];
  // Check basic validity: square exists, is empty, matches player's color, and is not a dead zone for them.
  if (!square || square.pawn) return false;
  if (square.boardColor !== gameState.playerColors[playerId]) return false;
  if (gameState.deadZoneSquares.get(squareIndex) === playerId) return false;

  const { row, col } = square;
  const opponentId = playerId === 1 ? 2 : 1;

  // Check for restricted zone (horizontal sandwich by opponent)
  if (col > 0 && col < BOARD_SIZE - 1) {
    const leftSquare = gameState.board[row * BOARD_SIZE + (col - 1)];
    const rightSquare = gameState.board[row * BOARD_SIZE + (col + 1)];
    if (
      leftSquare?.pawn?.playerId === opponentId &&
      rightSquare?.pawn?.playerId === opponentId
    )
      return false;
  }
  // Check for restricted zone (vertical sandwich by opponent)
  if (row > 0 && row < BOARD_SIZE - 1) {
    const topSquare = gameState.board[(row - 1) * BOARD_SIZE + col];
    const bottomSquare = gameState.board[(row + 1) * BOARD_SIZE + col];
    if (
      topSquare?.pawn?.playerId === opponentId &&
      bottomSquare?.pawn?.playerId === opponentId
    )
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
export function isValidMove(
  gameState: Readonly<GameState>,
  fromIndex: number,
  toIndex: number,
  playerId: PlayerId
): boolean {
  const fromSquare = gameState.board[fromIndex];
  const toSquare = gameState.board[toIndex];

  // Basic move validation
  if (!fromSquare?.pawn || fromSquare.pawn.playerId !== playerId) return false; // Not player's pawn
  if (!toSquare || toSquare.pawn) return false; // Destination occupied
  if (toSquare.boardColor !== gameState.playerColors[playerId]) return false; // Not player's assigned color square
  if (gameState.blockedPawnsInfo.has(fromIndex)) return false; // Cannot move blocked pawns
  if (gameState.deadZoneSquares.get(toIndex) === playerId) return false; // Cannot move to a dead zone

  return true; // "Move anywhere on your color" rule for Movement Phase.
}

/**
 * Updates the sets of blocked pawns (sandwiched) and blocking pawns (doing the sandwiching).
 * @param board The current game board state.
 * @returns An object containing sets of indices for blocked and blocking pawns.
 */
export function updateBlockingStatus(board: Readonly<SquareState[]>): {
  blockedPawns: Set<number>;
  blockingPawns: Set<number>;
} {
  const blockedPawns = new Set<number>();
  const blockingPawns = new Set<number>();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const centerIdx = r * BOARD_SIZE + c;
      const centerSq = board[centerIdx];
      if (!centerSq?.pawn) continue; // Only check squares with pawns

      // Horizontal blocking: P_Opponent - P_Center - P_Opponent
      if (c > 0 && c < BOARD_SIZE - 1) {
        const leftSq = board[r * BOARD_SIZE + (c - 1)];
        const rightSq = board[r * BOARD_SIZE + (c + 1)];
        if (
          leftSq?.pawn &&
          rightSq?.pawn &&
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
        if (
          topSq?.pawn &&
          bottomSq?.pawn &&
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
export function updateDeadZones(
  board: Readonly<SquareState[]>,
  playerColors: Readonly<Record<PlayerId, SquareColor>>
): { deadZones: Map<number, PlayerId>; deadZoneCreatorPawns: Set<number> } {
  const deadZones = new Map<number, PlayerId>();
  const deadZoneCreatorPawns = new Set<number>();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const currentSq = board[r * BOARD_SIZE + c];
      if (currentSq.pawn) continue; // Dead zones must be empty squares

      // Horizontal: P_Creator - E_OpponentColor - P_Creator
      if (c > 0 && c < BOARD_SIZE - 1) {
        const leftSq = board[r * BOARD_SIZE + (c - 1)];
        const rightSq = board[r * BOARD_SIZE + (c + 1)];
        if (
          leftSq?.pawn &&
          rightSq?.pawn &&
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
        if (
          topSq?.pawn &&
          bottomSq?.pawn &&
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
 * OPTIMIZED: Only checks diagonals passing through the last moved piece.
 * Considers blocked pawns, blocking pawns, dead zone creators, and dead zones.
 * @param gameState The current state of the game.
 * @param lastMoveIndex Optional index of the last move to optimize checking
 * @returns An object containing the winner's PlayerId and the winning line, or nulls if no winner.
 */
export function checkWinCondition(
  gameState: Readonly<GameState>,
  lastMoveIndex?: number
): {
  winner: PlayerId | null;
  winningLine: number[] | null;
} {
  const {
    board,
    playerColors,
    deadZoneSquares,
    blockedPawnsInfo,
    blockingPawnsInfo,
    deadZoneCreatorPawnsInfo,
  } = gameState;

  // OPTIMIZATION: If lastMoveIndex provided, only check around that square
  if (lastMoveIndex !== undefined && lastMoveIndex >= 0) {
    const lastSquare = board[lastMoveIndex];
    if (lastSquare?.pawn) {
      const playerId = lastSquare.pawn.playerId;
      const result = checkWinAroundSquare(
        board,
        lastMoveIndex,
        playerId,
        playerColors,
        deadZoneSquares,
        blockedPawnsInfo,
        blockingPawnsInfo,
        deadZoneCreatorPawnsInfo
      );
      if (result.winner) return result;
    }
  }

  // Fallback to full board check (for game load, rematch, etc.)
  const directions = [
    { dr: 1, dc: 1 }, // Down-Right
    { dr: 1, dc: -1 }, // Down-Left
  ];

  for (const playerId of [1, 2] as PlayerId[]) {
    const playerAssignedColor = playerColors[playerId];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        for (const dir of directions) {
          const line: number[] = [];
          let possible = true;
          for (let step = 0; step < WINNING_LINE_LENGTH; step++) {
            const curR = r + dir.dr * step;
            const curC = c + dir.dc * step;

            if (
              curR < 0 ||
              curR >= BOARD_SIZE ||
              curC < 0 ||
              curC >= BOARD_SIZE
            ) {
              possible = false;
              break;
            }
            const idx = curR * BOARD_SIZE + curC;
            const sq = board[idx];

            if (
              !sq.pawn ||
              sq.pawn.playerId !== playerId ||
              sq.boardColor !== playerAssignedColor ||
              blockedPawnsInfo.has(idx) ||
              blockingPawnsInfo.has(idx) ||
              deadZoneCreatorPawnsInfo.has(idx) ||
              deadZoneSquares.get(idx) === playerId
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
  return { winner: null, winningLine: null };
}

/**
 * OPTIMIZATION: Helper function to check win condition only around a specific square.
 * This is much faster than checking the entire board (O(8) vs O(256)).
 * @param board The game board
 * @param squareIndex Index of the square to check around
 * @param playerId Player who owns the pawn at squareIndex
 * @returns Win result or null
 */
function checkWinAroundSquare(
  board: Readonly<SquareState[]>,
  squareIndex: number,
  playerId: PlayerId,
  playerColors: Readonly<Record<PlayerId, SquareColor>>,
  deadZoneSquares: ReadonlyMap<number, PlayerId>,
  blockedPawnsInfo: ReadonlySet<number>,
  blockingPawnsInfo: ReadonlySet<number>,
  deadZoneCreatorPawnsInfo: ReadonlySet<number>
): { winner: PlayerId | null; winningLine: number[] | null } {
  const square = board[squareIndex];
  const { row, col } = square;
  const playerAssignedColor = playerColors[playerId];

  const directions = [
    { dr: 1, dc: 1 }, // Down-Right
    { dr: 1, dc: -1 }, // Down-Left
  ];

  for (const dir of directions) {
    // Find the start of the potential line in this direction
    let startR = row;
    let startC = col;
    
    // Move backwards to find the start point
    while (true) {
      const nextR = startR - dir.dr;
      const nextC = startC - dir.dc;
      if (nextR < 0 || nextR >= BOARD_SIZE || nextC < 0 || nextC >= BOARD_SIZE) {
        break;
      }
      startR = nextR;
      startC = nextC;
    }

    // Now check forward from the start point
    const line: number[] = [];
    let possible = true;
    
    for (let step = 0; step < WINNING_LINE_LENGTH; step++) {
      const curR = startR + dir.dr * step;
      const curC = startC + dir.dc * step;

      if (curR < 0 || curR >= BOARD_SIZE || curC < 0 || curC >= BOARD_SIZE) {
        possible = false;
        break;
      }

      const idx = curR * BOARD_SIZE + curC;
      const sq = board[idx];

      if (
        !sq.pawn ||
        sq.pawn.playerId !== playerId ||
        sq.boardColor !== playerAssignedColor ||
        blockedPawnsInfo.has(idx) ||
        blockingPawnsInfo.has(idx) ||
        deadZoneCreatorPawnsInfo.has(idx) ||
        deadZoneSquares.get(idx) === playerId
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

  return { winner: null, winningLine: null };
}

/**
 * Processes a pawn placement action.
 * @param gameState The current game state.
 * @param squareIndex The index of the square where the pawn is to be placed.
 * @param actingPlayerId The ID of the player performing the action.
 * @returns A new GameState if the placement is valid, otherwise null.
 */
export function placePawn(
  gameState: Readonly<GameState>,
  squareIndex: number,
  actingPlayerId: PlayerId
): GameState | null {
  // Ensure it's the current player's turn
  if (gameState.currentPlayerId !== actingPlayerId) {
    console.error(
      `gameLogic.placePawn: Turn mismatch. Game expects P${gameState.currentPlayerId}, but P${actingPlayerId} acted.`
    );
    return null;
  }
  // Validate placement
  if (!isValidPlacement(gameState, squareIndex, actingPlayerId)) {
    console.log(
      `gameLogic.placePawn: Invalid placement for P${actingPlayerId} at ${squareIndex}.`
    );
    return null;
  }

  const newPawn: Pawn = {
    id: `p${actingPlayerId}_${gameState.placedPawns[actingPlayerId] + 1}`, // Generate unique pawn ID
    playerId: actingPlayerId,
    color: gameState.playerColors[actingPlayerId], // Pawn's color matches player's assigned square color
  };

  // Create new board with the placed pawn
  const newBoard = gameState.board.map(
    (sq, i) =>
      i === squareIndex
        ? { ...sq, pawn: newPawn, highlight: undefined } // Place pawn and clear highlight
        : { ...sq, highlight: undefined } // Clear highlights from other squares
  );

  // Update pawn counts
  const newPawnsToPlace = {
    ...gameState.pawnsToPlace,
    [actingPlayerId]: gameState.pawnsToPlace[actingPlayerId] - 1,
  };
  const newPlacedPawns = {
    ...gameState.placedPawns,
    [actingPlayerId]: gameState.placedPawns[actingPlayerId] + 1,
  };

  // Determine next game phase
  let nextGamePhase = gameState.gamePhase;
  if (newPawnsToPlace[1] === 0 && newPawnsToPlace[2] === 0) {
    nextGamePhase = "movement";
  }

  // Update blocking and dead zone statuses based on the new board
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(
    newBoard,
    gameState.playerColors
  );

  // Create a temporary state to check for win condition
  const tempGameState: GameState = {
    ...gameState, // Spread existing state
    board: newBoard,
    pawnsToPlace: newPawnsToPlace,
    placedPawns: newPlacedPawns,
    gamePhase: nextGamePhase,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
    selectedPawnIndex: null, // Reset selection
    lastMove: { from: null, to: squareIndex }, // Record placement as a "move"
    options: { ...gameState.options }, // Preserve game options
  };

  // Check for win condition (optimized: only check around the placement)
  const { winner, winningLine } = checkWinCondition(tempGameState, squareIndex);

  // Determine next player
  const nextPlayerId = actingPlayerId === 1 ? 2 : 1;

  // Return the final new game state
  return {
    ...tempGameState,
    winner,
    winningLine,
    currentPlayerId: winner ? actingPlayerId : nextPlayerId, // If game ends, current player is the winner
  };
}

/**
 * Processes a pawn movement action.
 * @param gameState The current game state.
 * @param fromIndex The index of the square the pawn is moving from.
 * @param toIndex The index of the square the pawn is moving to.
 * @param actingPlayerId The ID of the player performing the action.
 * @returns A new GameState if the move is valid, otherwise null.
 */
export function movePawn(
  gameState: Readonly<GameState>,
  fromIndex: number,
  toIndex: number,
  actingPlayerId: PlayerId
): GameState | null {
  // Ensure it's the current player's turn
  if (gameState.currentPlayerId !== actingPlayerId) {
    console.error(
      `gameLogic.movePawn: Turn mismatch. Game expects P${gameState.currentPlayerId}, but P${actingPlayerId} acted.`
    );
    return null;
  }
  // Validate move
  if (!isValidMove(gameState, fromIndex, toIndex, actingPlayerId)) {
    console.log(
      `gameLogic.movePawn: Invalid move for P${actingPlayerId} from ${fromIndex} to ${toIndex}.`
    );
    return null;
  }

  const pawnToMove = gameState.board[fromIndex].pawn;
  // This check is redundant if isValidMove is comprehensive but good for safety
  if (!pawnToMove || pawnToMove.playerId !== actingPlayerId) return null;

  // Create new board with the moved pawn
  const newBoard = gameState.board.map((sq, i) => {
    let newSq = { ...sq, highlight: undefined }; // Clear highlights
    if (i === fromIndex) return { ...newSq, pawn: null }; // Empty the source square
    if (i === toIndex) return { ...newSq, pawn: pawnToMove }; // Place pawn in destination
    return newSq;
  });

  // Update blocking and dead zone statuses
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(
    newBoard,
    gameState.playerColors
  );

  // Create temporary state for win check
  const tempGameState: GameState = {
    ...gameState, // Spread existing state
    board: newBoard,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
    selectedPawnIndex: null, // Reset selection
    lastMove: { from: fromIndex, to: toIndex }, // Record move
    options: { ...gameState.options }, // Preserve game options
  };

  // Check for win condition (optimized: only check around the move)
  const { winner, winningLine } = checkWinCondition(tempGameState, toIndex);

  // Determine next player
  const nextPlayerId = actingPlayerId === 1 ? 2 : 1;

  // Return final new game state
  return {
    ...tempGameState,
    winner,
    winningLine,
    currentPlayerId: winner ? actingPlayerId : nextPlayerId,
  };
}

/**
 * Gets a list of valid destination square indices for a pawn.
 * @param gameState The current game state.
 * @param fromIndex The index of the pawn to get moves for.
 * @param playerId The ID of the player owning the pawn.
 * @returns An array of valid destination square indices.
 */
export function getValidMoveDestinations(
  gameState: Readonly<GameState>,
  fromIndex: number,
  playerId: PlayerId
): number[] {
  const validDests: number[] = [];
  const fromSq = gameState.board[fromIndex];
  // Ensure the pawn exists, belongs to the player, and is not blocked
  if (
    !fromSq?.pawn ||
    fromSq.pawn.playerId !== playerId ||
    gameState.blockedPawnsInfo.has(fromIndex)
  ) {
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
export function highlightValidMoves(
  gameState: Readonly<GameState>,
  pawnIndex: number
): GameState {
  const { currentPlayerId } = gameState;
  const pawnToSelect = gameState.board[pawnIndex]?.pawn;

  // If selection is invalid (no pawn, not current player's pawn, or pawn is blocked), clear all highlights.
  if (
    !pawnToSelect ||
    pawnToSelect.playerId !== currentPlayerId ||
    gameState.blockedPawnsInfo.has(pawnIndex)
  ) {
    return clearHighlights(gameState);
  }

  const validDestinations = getValidMoveDestinations(
    gameState,
    pawnIndex,
    currentPlayerId
  );

  // Create new board state with highlights
  const newBoard = gameState.board.map((square, i) => {
    let highlightValue: SquareState["highlight"] = undefined; // Explicitly type highlightValue
    if (i === pawnIndex) {
      highlightValue = "selectedPawn";
    } else if (validDestinations.includes(i)) {
      highlightValue = "validMove";
    }
    return { ...square, highlight: highlightValue };
  });
  return { ...gameState, board: newBoard, selectedPawnIndex: pawnIndex };
}

/**
 * Clears all highlights from the board and resets the selected pawn index.
 * @param gameState The current game state.
 * @returns A new GameState with highlights cleared.
 */
export function clearHighlights(gameState: Readonly<GameState>): GameState {
  const newBoard = gameState.board.map((square) => ({
    ...square,
    highlight: undefined, // Set highlight to undefined for all squares
  }));
  return { ...gameState, board: newBoard, selectedPawnIndex: null };
}
