// gameLogic.ts - Core game logic separated from UI

export type PlayerId = 1 | 2;
export type SquareColor = 'light' | 'dark';
export type GamePhase = 'placement' | 'movement';

export interface Pawn {
  id: string; // e.g., `p1_1`, `p2_3`
  playerId: PlayerId;
  // color: SquareColor; // The type of square this pawn is allowed to be on - this seems redundant if playerColors dictate this
}

export interface SquareState {
  index: number; // 0-63
  row: number; // 0-7
  col: number; // 0-7
  boardColor: SquareColor; // The actual color of this board square (light or dark)
  pawn: Pawn | null;
  highlight?: 'selectedPawn' | 'validMove' | 'deadZoneIndicator' | 'lastMoveFrom' | 'lastMoveTo' | 'winningSquare';
}

export interface GameState {
  board: SquareState[];
  currentPlayerId: PlayerId;
  playerColors: Record<PlayerId, SquareColor>; // e.g., {1: 'light', 2: 'dark'}
  gamePhase: GamePhase;
  pawnsToPlace: Record<PlayerId, number>;
  placedPawns: Record<PlayerId, number>; // Total pawns placed by each player so far
  selectedPawnIndex: number | null; // For UI interaction, index of currently selected pawn
  blockedPawnsInfo: Set<number>; // Set of indices of pawns that are blocked
  blockingPawnsInfo: Set<number>; // Set of indices of pawns that are blocking others
  deadZoneSquares: Map<number, PlayerId>; // Map stores square_index -> player_id for whom this square is a dead zone for winning
  deadZoneCreatorPawnsInfo: Set<number>; // Set of indices of pawns that are creating dead zones
  winner: PlayerId | null;
  lastMove: { from: number | null, to: number } | null; // For UI to highlight last move
  winningLine: number[] | null; // Indices of squares in the winning line
}

export const BOARD_SIZE = 8;
export const PAWNS_PER_PLAYER = 6; // Can be adjusted to 5

/**
 * Initialize the game board with alternating light and dark squares
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
        boardColor: (row + col) % 2 === 0 ? 'light' : 'dark', // Standard chess board coloring
        pawn: null,
      });
    }
  }
  return board;
}

/**
 * Assign colors to players (which color squares they can use)
 */
export function assignPlayerColors(): Record<PlayerId, SquareColor> {
  // Player 1 gets light squares, Player 2 gets dark squares
  return { 1: 'light', 2: 'dark' };
}

/**
 * Create the initial game state
 */
export function createInitialGameState(): GameState {
  const playerColors = assignPlayerColors();
  return {
    board: initializeBoard(),
    currentPlayerId: 1,
    playerColors,
    gamePhase: 'placement',
    pawnsToPlace: { 1: PAWNS_PER_PLAYER, 2: PAWNS_PER_PLAYER },
    placedPawns: { 1: 0, 2: 0 },
    selectedPawnIndex: null,
    blockedPawnsInfo: new Set<number>(),
    blockingPawnsInfo: new Set<number>(),
    deadZoneSquares: new Map<number, PlayerId>(),
    deadZoneCreatorPawnsInfo: new Set<number>(),
    winner: null,
    lastMove: null,
    winningLine: null
  };
}

/**
 * Check if a placement is valid based on game rules
 */
export function isValidPlacement(
  squareIndex: number,
  playerId: PlayerId,
  gameState: Readonly<GameState>
): boolean {
  const square = gameState.board[squareIndex];
  if (!square || square.pawn) return false; // Square occupied
  if (square.boardColor !== gameState.playerColors[playerId]) return false; // Not player's assigned color square
  
  // Check if this is a restricted zone - a space between opponent's pawns
  const { row, col } = square;
  const opponentId = playerId === 1 ? 2 : 1;
  
  // Check horizontally (left-center-right)
  if (col > 0 && col < BOARD_SIZE - 1) {
    const leftIndex = row * BOARD_SIZE + (col - 1);
    const rightIndex = row * BOARD_SIZE + (col + 1);
    const leftSquare = gameState.board[leftIndex];
    const rightSquare = gameState.board[rightIndex];
    
    if (leftSquare?.pawn?.playerId === opponentId && 
        rightSquare?.pawn?.playerId === opponentId) {
      return false; // Restricted zone between opponent's pawns
    }
  }
  
  // Check vertically (top-center-bottom)
  if (row > 0 && row < BOARD_SIZE - 1) {
    const topIndex = (row - 1) * BOARD_SIZE + col;
    const bottomIndex = (row + 1) * BOARD_SIZE + col;
    const topSquare = gameState.board[topIndex];
    const bottomSquare = gameState.board[bottomIndex];
    
    if (topSquare?.pawn?.playerId === opponentId && 
        bottomSquare?.pawn?.playerId === opponentId) {
      return false; // Restricted zone between opponent's pawns
    }
  }
  
  return true;
}

/**
 * Check if a move is valid based on game rules
 */
export function isValidMove(
  fromIndex: number,
  toIndex: number,
  playerId: PlayerId,
  gameState: Readonly<GameState>
): boolean {
  const fromSquare = gameState.board[fromIndex];
  const toSquare = gameState.board[toIndex];

  if (!fromSquare || !fromSquare.pawn || fromSquare.pawn.playerId !== playerId) return false; // Not player's pawn
  if (!toSquare || toSquare.pawn) return false; // Destination occupied
  if (toSquare.boardColor !== gameState.playerColors[playerId]) return false; // Not player's assigned color square

  // "Move anywhere on your color" rule for Movement Phase.
  return true;
}

/**
 * Update which pawns are blocked and which are blocking
 */
export function updateBlockingStatus(
  board: Readonly<SquareState[]>
): { blockedPawns: Set<number>, blockingPawns: Set<number> } {
  const blockedPawns = new Set<number>();
  const blockingPawns = new Set<number>();

  // Check horizontal blocking
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 1; col < BOARD_SIZE - 1; col++) {
      const centerIndex = row * BOARD_SIZE + col;
      const leftIndex = row * BOARD_SIZE + col - 1;
      const rightIndex = row * BOARD_SIZE + col + 1;

      const centerSquare = board[centerIndex];
      const leftSquare = board[leftIndex];
      const rightSquare = board[rightIndex];

      if (centerSquare?.pawn && leftSquare?.pawn && rightSquare?.pawn) {
        const opponentPawn = centerSquare.pawn; // Potential pawn to be blocked
        const leftBlockerPawn = leftSquare.pawn;
        const rightBlockerPawn = rightSquare.pawn;

        if (
          leftBlockerPawn.playerId === rightBlockerPawn.playerId &&
          leftBlockerPawn.playerId !== opponentPawn.playerId
        ) {
          blockedPawns.add(centerIndex);
          blockingPawns.add(leftIndex);
          blockingPawns.add(rightIndex);
        }
      }
    }
  }
  
  // Check vertical blocking
  for (let col = 0; col < BOARD_SIZE; col++) {
    for (let row = 1; row < BOARD_SIZE - 1; row++) {
      const centerIndex = row * BOARD_SIZE + col;
      const topIndex = (row - 1) * BOARD_SIZE + col;
      const bottomIndex = (row + 1) * BOARD_SIZE + col;

      const centerSquare = board[centerIndex];
      const topSquare = board[topIndex];
      const bottomSquare = board[bottomIndex];

      if (centerSquare?.pawn && topSquare?.pawn && bottomSquare?.pawn) {
        const opponentPawn = centerSquare.pawn; // Potential pawn to be blocked
        const topBlockerPawn = topSquare.pawn;
        const bottomBlockerPawn = bottomSquare.pawn;

        if (
          topBlockerPawn.playerId === bottomBlockerPawn.playerId &&
          topBlockerPawn.playerId !== opponentPawn.playerId
        ) {
          blockedPawns.add(centerIndex);
          blockingPawns.add(topIndex);
          blockingPawns.add(bottomIndex);
        }
      }
    }
  }
  
  return { blockedPawns, blockingPawns };
}

/**
 * Update the dead zone squares and identify pawns creating dead zones
 */
export function updateDeadZones(
  board: Readonly<SquareState[]>,
  playerColors: Readonly<Record<PlayerId, SquareColor>>
): { deadZones: Map<number, PlayerId>, deadZoneCreatorPawns: Set<number> } {
  const deadZones = new Map<number, PlayerId>(); 
  const deadZoneCreatorPawns = new Set<number>(); 
  
  // Check horizontal dead zones
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE - 2; col++) {
      const leftIndex = row * BOARD_SIZE + col;
      const centerIndex = row * BOARD_SIZE + (col + 1);
      const rightIndex = row * BOARD_SIZE + (col + 2);
      
      const leftSquare = board[leftIndex];
      const centerSquare = board[centerIndex];
      const rightSquare = board[rightIndex];
      
      if (leftSquare?.pawn && !centerSquare?.pawn && rightSquare?.pawn) {
        if (leftSquare.pawn.playerId === rightSquare.pawn.playerId) {
          const playerCreating = leftSquare.pawn.playerId;
          if (centerSquare.boardColor === playerColors[playerCreating]) {
            const opponentPlayerId = playerCreating === 1 ? 2 : 1;
            deadZones.set(centerIndex, opponentPlayerId);
            deadZoneCreatorPawns.add(leftIndex);
            deadZoneCreatorPawns.add(rightIndex);
          }
        }
      }
    }
  }
  
  // Check vertical dead zones
  for (let col = 0; col < BOARD_SIZE; col++) {
    for (let row = 0; row < BOARD_SIZE - 2; row++) {
      const topIndex = row * BOARD_SIZE + col;
      const centerIndex = (row + 1) * BOARD_SIZE + col;
      const bottomIndex = (row + 2) * BOARD_SIZE + col;
      
      const topSquare = board[topIndex];
      const centerSquare = board[centerIndex];
      const bottomSquare = board[bottomIndex];
      
      if (topSquare?.pawn && !centerSquare?.pawn && bottomSquare?.pawn) {
        if (topSquare.pawn.playerId === bottomSquare.pawn.playerId) {
          const playerCreating = topSquare.pawn.playerId;
          if (centerSquare.boardColor === playerColors[playerCreating]) {
            const opponentPlayerId = playerCreating === 1 ? 2 : 1;
            deadZones.set(centerIndex, opponentPlayerId);
            deadZoneCreatorPawns.add(topIndex);
            deadZoneCreatorPawns.add(bottomIndex);
          }
        }
      }
    }
  }
  
  return { deadZones, deadZoneCreatorPawns };
}

/**
 * Check if there's a winner in the current game state
 */
export function checkWinCondition(gameState: Readonly<GameState>): { winner: PlayerId | null, winningLine: number[] | null } {
  const { board, playerColors, deadZoneSquares, blockedPawnsInfo, blockingPawnsInfo, deadZoneCreatorPawnsInfo } = gameState;
  
  const diagonalDirections = [
    { dr: 1, dc: 1 },   // Down-Right
    { dr: 1, dc: -1 },  // Down-Left
    // No need to check Up-Right and Up-Left separately if iterating all start squares
  ];

  for (const playerId of [1, 2] as PlayerId[]) {
    const playerAssignedColor = playerColors[playerId];
    
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const startIndex = r * BOARD_SIZE + c;
        
        for (const direction of diagonalDirections) {
          const lineIndices: number[] = [];
          let possibleWin = true;
          
          for (let step = 0; step < 4; step++) {
            const currentRow = r + direction.dr * step;
            const currentCol = c + direction.dc * step;
            
            if (currentRow < 0 || currentRow >= BOARD_SIZE || currentCol < 0 || currentCol >= BOARD_SIZE) {
              possibleWin = false;
              break;
            }
            
            const currentIndex = currentRow * BOARD_SIZE + currentCol;
            const currentSquare = board[currentIndex];
            
            if (!currentSquare.pawn || 
                currentSquare.pawn.playerId !== playerId || 
                currentSquare.boardColor !== playerAssignedColor ||
                blockedPawnsInfo.has(currentIndex) || 
                blockingPawnsInfo.has(currentIndex) || 
                deadZoneCreatorPawnsInfo.has(currentIndex) ||
                deadZoneSquares.get(currentIndex) === playerId) {
              possibleWin = false;
              break;
            }
            lineIndices.push(currentIndex);
          }
          
          if (possibleWin && lineIndices.length === 4) {
            return { winner: playerId, winningLine: lineIndices };
          }
        }
      }
    }
  }
  
  return { winner: null, winningLine: null };
}


/**
 * Get all valid move destinations for a selected pawn
 */
export function getValidMoveDestinations(
  fromIndex: number, 
  playerId: PlayerId, 
  gameState: Readonly<GameState>
): number[] {
  const validDestinations: number[] = [];
  if (gameState.board[fromIndex]?.pawn?.playerId !== playerId || gameState.blockedPawnsInfo.has(fromIndex)) {
    return []; // Not player's pawn or pawn is blocked
  }
  
  for (let i = 0; i < gameState.board.length; i++) {
    if (isValidMove(fromIndex, i, playerId, gameState)) {
      validDestinations.push(i);
    }
  }
  
  return validDestinations;
}

/**
 * Update the board after a placement action
 */
export function placePawnAction( // Renamed to avoid conflict
  gameState: Readonly<GameState>,
  index: number
): GameState | null {
  const { currentPlayerId, pawnsToPlace, board, placedPawns, playerColors } = gameState;
  
  if (!isValidPlacement(index, currentPlayerId, gameState)) {
    return null; 
  }
  
  const newPawn: Pawn = {
    id: `p${currentPlayerId}_${placedPawns[currentPlayerId] + 1}`,
    playerId: currentPlayerId,
  };
  
  const newBoard = board.map((sq, i) => i === index ? { ...sq, pawn: newPawn } : sq);
  
  const newPawnsToPlace = { ...pawnsToPlace, [currentPlayerId]: pawnsToPlace[currentPlayerId] - 1 };
  const newPlacedPawns = { ...placedPawns, [currentPlayerId]: placedPawns[currentPlayerId] + 1 };
  
  let nextPhase = gameState.gamePhase;
  if (newPawnsToPlace[1] === 0 && newPawnsToPlace[2] === 0) {
    nextPhase = 'movement';
  }
  
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newBoard, playerColors);
  
  const tempGameState: GameState = {
    ...gameState,
    board: newBoard,
    pawnsToPlace: newPawnsToPlace,
    placedPawns: newPlacedPawns,
    gamePhase: nextPhase,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
  };
  
  const { winner, winningLine } = checkWinCondition(tempGameState);

  return {
    ...tempGameState,
    winner,
    winningLine,
    currentPlayerId: winner ? gameState.currentPlayerId : (currentPlayerId === 1 ? 2 : 1),
    selectedPawnIndex: null,
    lastMove: { from: null, to: index },
  };
}

/**
 * Update the board after a move action
 */
export function movePawnAction( // Renamed to avoid conflict
  gameState: Readonly<GameState>,
  fromIndex: number,
  toIndex: number
): GameState | null {
  const { currentPlayerId, board, playerColors } = gameState;
  
  if (!isValidMove(fromIndex, toIndex, currentPlayerId, gameState)) {
    return null; 
  }
  
  const pawnToMove = board[fromIndex].pawn;
  if (!pawnToMove) return null;

  const newBoard = board.map((sq, i) => {
    if (i === fromIndex) return { ...sq, pawn: null };
    if (i === toIndex) return { ...sq, pawn: pawnToMove };
    return sq;
  });
  
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newBoard, playerColors);
  
  const tempGameState: GameState = {
    ...gameState,
    board: newBoard,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
  };

  const { winner, winningLine } = checkWinCondition(tempGameState);

  return {
    ...tempGameState,
    winner,
    winningLine,
    currentPlayerId: winner ? gameState.currentPlayerId : (currentPlayerId === 1 ? 2 : 1),
    selectedPawnIndex: null,
    lastMove: { from: fromIndex, to: toIndex },
  };
}


/**
 * Highlight valid move destinations on the board
 */
export function highlightValidMoves(
  gameState: Readonly<GameState>,
  pawnIndex: number
): GameState {
  const { currentPlayerId } = gameState;
  const validDestinations = getValidMoveDestinations(pawnIndex, currentPlayerId, gameState);
  
  const newBoard = gameState.board.map((square, i) => {
    let newHighlight: SquareState['highlight'] = undefined;
    if (i === pawnIndex) {
      newHighlight = 'selectedPawn';
    } else if (validDestinations.includes(i)) {
      newHighlight = 'validMove';
    }
    return { ...square, highlight: newHighlight };
  });
  
  return {
    ...gameState,
    board: newBoard,
    selectedPawnIndex: pawnIndex,
  };
}

/**
 * Clear all highlights from the board
 */
export function clearHighlights(gameState: Readonly<GameState>): GameState {
  const newBoard = gameState.board.map(square => ({ ...square, highlight: undefined }));
  
  return {
    ...gameState,
    board: newBoard,
    selectedPawnIndex: null,
  };
}
