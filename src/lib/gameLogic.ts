// gameLogic.ts
export type PlayerId = 1 | 2;
export type SquareColor = 'light' | 'dark';
export type GamePhase = 'placement' | 'movement';

export interface Pawn {
  id: string; // e.g., `p1_1`, `p2_3`
  playerId: PlayerId;
  color: SquareColor; // The type of square this pawn is allowed to be on
}

export interface SquareState {
  index: number; // 0-63
  row: number; // 0-7
  col: number; // 0-7
  boardColor: SquareColor; // The actual color of this board square (light or dark)
  pawn: Pawn | null;
  highlight?: 'selectedPawn' | 'validMove' | 'deadZoneIndicator';
}

export interface GameState {
  board: SquareState[];
  currentPlayerId: PlayerId;
  playerColors: Record<PlayerId, SquareColor>; // e.g., {1: 'light', 2: 'dark'}
  gamePhase: GamePhase;
  pawnsToPlace: Record<PlayerId, number>;
  placedPawns: Record<PlayerId, number>; // Total pawns placed by each player so far
  selectedPawnIndex: number | null; // For UI interaction, index of currently selected pawn
  blockedPawnsInfo: Set<number>;
  blockingPawnsInfo: Set<number>;
  deadZoneSquares: Map<number, PlayerId>; // Map stores square_index -> player_id for whom this square is a dead zone for winning
  deadZoneCreatorPawnsInfo: Set<number>; // Pawns that are creating dead zones
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
  
  // Check if this square is a dead zone for the current player
  if (gameState.deadZoneSquares.get(squareIndex) === playerId) {
    return false; // Cannot place in a dead zone
  }
  
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
  if (gameState.blockedPawnsInfo.has(fromIndex)) return false; // Cannot move blocked pawns
  
  // Check if destination square is a dead zone for the current player
  if (gameState.deadZoneSquares.get(toIndex) === playerId) {
    return false; // Cannot move to a dead zone
  }

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

        // Check if left and right pawns belong to the same player and are different from the center pawn's player
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

        // Check if top and bottom pawns belong to the same player and are different from the center pawn's player
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
): { deadZones: Map<number, PlayerId>, deadZoneCreatorPawnsInfo: Set<number> } {
  const deadZones = new Map<number, PlayerId>(); // Square index -> player for whom it's a dead zone
  const deadZoneCreatorPawnsInfo = new Set<number>(); // Pawns creating dead zones
  
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
        // Check if both pawns belong to the same player
        if (leftSquare.pawn.playerId === rightSquare.pawn.playerId) {
          const playerCreating = leftSquare.pawn.playerId;
          // Check if center square is of the player's assigned color
          if (centerSquare.boardColor === playerColors[playerCreating]) {
            // This is a dead zone for the opponent
            const opponentPlayerId = playerCreating === 1 ? 2 : 1;
            deadZones.set(centerIndex, opponentPlayerId);
            deadZoneCreatorPawnsInfo.add(leftIndex);
            deadZoneCreatorPawnsInfo.add(rightIndex);
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
        // Check if both pawns belong to the same player
        if (topSquare.pawn.playerId === bottomSquare.pawn.playerId) {
          const playerCreating = topSquare.pawn.playerId;
          // Check if center square is of the player's assigned color
          if (centerSquare.boardColor === playerColors[playerCreating]) {
            // This is a dead zone for the opponent
            const opponentPlayerId = playerCreating === 1 ? 2 : 1;
            deadZones.set(centerIndex, opponentPlayerId);
            deadZoneCreatorPawnsInfo.add(topIndex);
            deadZoneCreatorPawnsInfo.add(bottomIndex);
          }
        }
      }
    }
  }
  
  return { deadZones, deadZoneCreatorPawnsInfo };
}

/**
 * Check if there's a winner in the current game state
 */
export function checkWinCondition(gameState: Readonly<GameState>): { winner: PlayerId | null, winningLine: number[] | null } {
  const { board, playerColors, deadZoneSquares, blockedPawnsInfo, blockingPawnsInfo, deadZoneCreatorPawnsInfo } = gameState;
  
  const diagonalDirections = [
    { dr: 1, dc: 1 },   // Down-Right
    { dr: 1, dc: -1 },  // Down-Left
    { dr: -1, dc: 1 },  // Up-Right
    { dr: -1, dc: -1 }, // Up-Left
  ];

  for (const playerId of [1, 2] as PlayerId[]) {
    const playerAssignedColor = playerColors[playerId]; 
    
    for (let startRow = 0; startRow < BOARD_SIZE; startRow++) {
      for (let startCol = 0; startCol < BOARD_SIZE; startCol++) {
        const startIndex = startRow * BOARD_SIZE + startCol;
        const startSquare = board[startIndex];
        
        if (!startSquare.pawn || 
            startSquare.pawn.playerId !== playerId || 
            startSquare.boardColor !== playerAssignedColor || 
            blockedPawnsInfo.has(startIndex) || 
            blockingPawnsInfo.has(startIndex) || 
            deadZoneCreatorPawnsInfo.has(startIndex)) {
          continue;
        }
        
        for (const direction of diagonalDirections) {
          const lineIndices = [startIndex];
          let count = 1;
          
          for (let step = 1; step < 4; step++) {
            const nextRow = startRow + direction.dr * step;
            const nextCol = startCol + direction.dc * step;
            
            if (nextRow < 0 || nextRow >= BOARD_SIZE || nextCol < 0 || nextCol >= BOARD_SIZE) {
              break;
            }
            
            const nextIndex = nextRow * BOARD_SIZE + nextCol;
            const nextSquare = board[nextIndex];
            
            if (!nextSquare.pawn || 
                nextSquare.pawn.playerId !== playerId || 
                nextSquare.boardColor !== playerAssignedColor || 
                blockedPawnsInfo.has(nextIndex) || 
                blockingPawnsInfo.has(nextIndex) || 
                deadZoneCreatorPawnsInfo.has(nextIndex) ||
                deadZoneSquares.get(nextIndex) === playerId) { 
              break;
            }
            
            lineIndices.push(nextIndex);
            count++;
          }
          
          if (count >= 4) {
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
    return []; 
  }
  
  for (const square of gameState.board) {
    const { index, boardColor, pawn } = square;
     // Must be empty and player's assigned color
    if (!pawn && boardColor === gameState.playerColors[playerId]) {
      // Must not be a dead zone for this player
      if (gameState.deadZoneSquares.get(index) !== playerId) {
        validDestinations.push(index);
      }
    }
  }
  
  return validDestinations;
}

/**
 * Update the board after a placement action
 */
export function placePawn( 
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
    color: playerColors[currentPlayerId],
  };
  
  const newBoard = board.map((sq, i) => i === index ? { ...sq, pawn: newPawn, highlight: undefined } : {...sq, highlight: undefined});
  
  const newPawnsToPlace = { ...pawnsToPlace, [currentPlayerId]: pawnsToPlace[currentPlayerId] - 1 };
  const newPlacedPawns = { ...placedPawns, [currentPlayerId]: placedPawns[currentPlayerId] + 1 };
  
  let nextPhase: GamePhase = gameState.gamePhase;
  if (newPawnsToPlace[1] === 0 && newPawnsToPlace[2] === 0) {
    nextPhase = 'movement';
  }
  
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawnsInfo } = updateDeadZones(newBoard, playerColors); // Corrected variable name
  
  const tempGameState: GameState = {
    ...gameState,
    board: newBoard,
    pawnsToPlace: newPawnsToPlace,
    placedPawns: newPlacedPawns,
    gamePhase: nextPhase,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo, // Corrected variable name
    selectedPawnIndex: null, 
    lastMove: { from: null, to: index },
  };
  
  const { winner, winningLine } = checkWinCondition(tempGameState);

  return {
    ...tempGameState,
    winner,
    winningLine,
    currentPlayerId: winner ? gameState.currentPlayerId : (currentPlayerId === 1 ? 2 : 1),
  };
}

/**
 * Update the board after a move action
 */
export function movePawn( 
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
    let newSq = {...sq, highlight: undefined }; 
    if (i === fromIndex) return { ...newSq, pawn: null };
    if (i === toIndex) return { ...newSq, pawn: pawnToMove };
    return newSq;
  });
  
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawnsInfo } = updateDeadZones(newBoard, playerColors); // Corrected variable name
  
  const tempGameState: GameState = {
    ...gameState,
    board: newBoard,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo, // Corrected variable name
    selectedPawnIndex: null, 
    lastMove: { from: fromIndex, to: toIndex },
  };

  const { winner, winningLine } = checkWinCondition(tempGameState);

  return {
    ...tempGameState,
    winner,
    winningLine,
    currentPlayerId: winner ? gameState.currentPlayerId : (currentPlayerId === 1 ? 2 : 1),
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
