// gameLogic.ts
export type PlayerId = 1 | 2;
export type SquareColor = 'light' | 'dark';
export type GamePhase = 'placement' | 'movement';

export interface Pawn {
  id: string;
  playerId: PlayerId;
  color: SquareColor; // The color of square this pawn can be on
}

export interface SquareState {
  index: number;
  row: number;
  col: number;
  boardColor: SquareColor; // Actual color of the square
  pawn: Pawn | null;
  highlight?: 'selectedPawn' | 'validMove' | 'deadZoneIndicator';
}

export interface GameState {
  board: SquareState[];
  currentPlayerId: PlayerId;
  playerColors: Record<PlayerId, SquareColor>; // Which color squares each player uses
  gamePhase: GamePhase;
  pawnsToPlace: Record<PlayerId, number>;
  placedPawns: Record<PlayerId, number>;
  selectedPawnIndex: number | null;
  blockedPawnsInfo: Set<number>; // Indices of pawns that are blocked
  blockingPawnsInfo: Set<number>; // Indices of pawns that are blocking others
  deadZoneSquares: Map<number, PlayerId>; // Map: square_index -> player_id for whom this square is a dead zone
  deadZoneCreatorPawnsInfo: Set<number>; // Indices of pawns creating dead zones
  winner: PlayerId | null;
  lastMove: { from: number | null; to: number } | null;
  winningLine: number[] | null;
  highlightedValidMoves?: number[]; // Optional: UI state for valid moves of selectedPawnIndex
}

export const BOARD_SIZE = 8;
export const PAWNS_PER_PLAYER = 6;

export function initializeBoard(): SquareState[] {
  const board: SquareState[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const index = row * BOARD_SIZE + col;
      board.push({
        index,
        row,
        col,
        boardColor: (row + col) % 2 === 0 ? 'light' : 'dark',
        pawn: null,
      });
    }
  }
  return board;
}

export function assignPlayerColors(): Record<PlayerId, SquareColor> {
  return { 1: 'light', 2: 'dark' }; // Player 1 uses light, Player 2 uses dark
}

export function createInitialGameState(pawnsCount: number = PAWNS_PER_PLAYER): GameState {
  const playerColors = assignPlayerColors();
  return {
    board: initializeBoard(),
    currentPlayerId: 1,
    playerColors,
    gamePhase: 'placement',
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
    highlightedValidMoves: [],
  };
}

// Helper to apply all derived state updates consistently
function applyDerivedStateUpdates(gameState: GameState, newBoard: SquareState[]): GameState {
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newBoard, gameState.playerColors);
  
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
    currentPlayerId: winner ? tempGameState.currentPlayerId : (tempGameState.currentPlayerId === 1 ? 2 : 1),
    selectedPawnIndex: null, // Always clear selection after a move/placement
    highlightedValidMoves: [], // Clear highlighted moves
  };
}


export function isValidPlacement(
  squareIndex: number,
  gameState: Readonly<GameState> // gameState now passed directly
): boolean {
  const playerId = gameState.currentPlayerId;
  const square = gameState.board[squareIndex];

  if (!square || square.pawn) return false;
  if (square.boardColor !== gameState.playerColors[playerId]) return false;
  if (gameState.deadZoneSquares.get(squareIndex) === playerId) return false;

  const { row, col } = square;
  const opponentId = playerId === 1 ? 2 : 1;

  // Horizontal restricted zone
  if (col > 0 && col < BOARD_SIZE - 1) {
    const leftSquare = gameState.board[row * BOARD_SIZE + (col - 1)];
    const rightSquare = gameState.board[row * BOARD_SIZE + (col + 1)];
    if (leftSquare?.pawn?.playerId === opponentId && rightSquare?.pawn?.playerId === opponentId) {
      return false;
    }
  }
  // Vertical restricted zone
  if (row > 0 && row < BOARD_SIZE - 1) {
    const topSquare = gameState.board[(row - 1) * BOARD_SIZE + col];
    const bottomSquare = gameState.board[(row + 1) * BOARD_SIZE + col];
    if (topSquare?.pawn?.playerId === opponentId && bottomSquare?.pawn?.playerId === opponentId) {
      return false;
    }
  }
  return true;
}

export function isValidMove(
  fromIndex: number,
  toIndex: number,
  gameState: Readonly<GameState> // gameState now passed directly
): boolean {
  const playerId = gameState.currentPlayerId;
  const fromSquare = gameState.board[fromIndex];
  const toSquare = gameState.board[toIndex];

  if (!fromSquare?.pawn || fromSquare.pawn.playerId !== playerId) return false;
  if (!toSquare || toSquare.pawn) return false;
  if (toSquare.boardColor !== gameState.playerColors[playerId]) return false;
  if (gameState.blockedPawnsInfo.has(fromIndex)) return false;
  if (gameState.deadZoneSquares.get(toIndex) === playerId) return false;

  return true;
}

export function updateBlockingStatus(board: Readonly<SquareState[]>): { 
  blockedPawns: Set<number>, 
  blockingPawns: Set<number> 
} {
  const blockedPawns = new Set<number>();
  const blockingPawns = new Set<number>();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const centerIdx = r * BOARD_SIZE + c;
      const centerSq = board[centerIdx];
      if (!centerSq?.pawn) continue;

      if (c > 0 && c < BOARD_SIZE - 1) {
        const leftSq = board[r * BOARD_SIZE + (c - 1)];
        const rightSq = board[r * BOARD_SIZE + (c + 1)];
        if (leftSq?.pawn && rightSq?.pawn &&
            leftSq.pawn.playerId === rightSq.pawn.playerId &&
            leftSq.pawn.playerId !== centerSq.pawn.playerId) {
          blockedPawns.add(centerIdx);
          blockingPawns.add(leftSq.index);
          blockingPawns.add(rightSq.index);
        }
      }
      if (r > 0 && r < BOARD_SIZE - 1) {
        const topSq = board[(r - 1) * BOARD_SIZE + c];
        const bottomSq = board[(r + 1) * BOARD_SIZE + c];
        if (topSq?.pawn && bottomSq?.pawn &&
            topSq.pawn.playerId === bottomSq.pawn.playerId &&
            topSq.pawn.playerId !== centerSq.pawn.playerId) {
          blockedPawns.add(centerIdx);
          blockingPawns.add(topSq.index);
          blockingPawns.add(bottomSq.index);
        }
      }
    }
  }
  return { blockedPawns, blockingPawns };
}

export function updateDeadZones(
  board: Readonly<SquareState[]>,
  playerColors: Readonly<Record<PlayerId, SquareColor>>
): { deadZones: Map<number, PlayerId>, deadZoneCreatorPawns: Set<number> } {
  const deadZones = new Map<number, PlayerId>();
  const deadZoneCreatorPawns = new Set<number>();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      // Horizontal: P - E - P
      if (c < BOARD_SIZE - 2) {
        const p1 = board[r * BOARD_SIZE + c];
        const empty = board[r * BOARD_SIZE + (c + 1)];
        const p2 = board[r * BOARD_SIZE + (c + 2)];
        if (p1?.pawn && p2?.pawn && !empty?.pawn && p1.pawn.playerId === p2.pawn.playerId) {
          // Dead zone is created on the player's OWN color square, affecting the OPPONENT
          if (empty.boardColor === playerColors[p1.pawn.playerId]) { 
            const opponentId = p1.pawn.playerId === 1 ? 2 : 1;
            deadZones.set(empty.index, opponentId);
            deadZoneCreatorPawns.add(p1.index);
            deadZoneCreatorPawns.add(p2.index);
          }
        }
      }
      // Vertical: P / E / P
      if (r < BOARD_SIZE - 2) {
        const p1 = board[r * BOARD_SIZE + c];
        const empty = board[(r + 1) * BOARD_SIZE + c];
        const p2 = board[(r + 2) * BOARD_SIZE + c];
        if (p1?.pawn && p2?.pawn && !empty?.pawn && p1.pawn.playerId === p2.pawn.playerId) {
          if (empty.boardColor === playerColors[p1.pawn.playerId]) {
            const opponentId = p1.pawn.playerId === 1 ? 2 : 1;
            deadZones.set(empty.index, opponentId);
            deadZoneCreatorPawns.add(p1.index);
            deadZoneCreatorPawns.add(p2.index);
          }
        }
      }
    }
  }
  return { deadZones, deadZoneCreatorPawns };
}


export function checkWinCondition(gameState: Readonly<GameState>): { winner: PlayerId | null, winningLine: number[] | null } {
  const { board, playerColors, deadZoneSquares, blockedPawnsInfo, blockingPawnsInfo, deadZoneCreatorPawnsInfo } = gameState;
  const directions = [{ dr: 1, dc: 1 }, { dr: 1, dc: -1 }, { dr: -1, dc: 1 }, { dr: -1, dc: -1 }];

  for (const playerId of [1, 2] as PlayerId[]) {
    const playerAssignedColor = playerColors[playerId];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const startIdx = r * BOARD_SIZE + c;
        const startSq = board[startIdx];
        if (!startSq.pawn || startSq.pawn.playerId !== playerId || startSq.boardColor !== playerAssignedColor || 
            blockedPawnsInfo.has(startIdx) || blockingPawnsInfo.has(startIdx) || deadZoneCreatorPawnsInfo.has(startIdx)) continue;

        for (const dir of directions) {
          const line = [startIdx];
          let count = 1;
          for (let s = 1; s < 4; s++) {
            const nr = r + dir.dr * s;
            const nc = c + dir.dc * s;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
            const nextIdx = nr * BOARD_SIZE + nc;
            const nextSq = board[nextIdx];
            if (!nextSq.pawn || nextSq.pawn.playerId !== playerId || nextSq.boardColor !== playerAssignedColor ||
                blockedPawnsInfo.has(nextIdx) || blockingPawnsInfo.has(nextIdx) || deadZoneCreatorPawnsInfo.has(nextIdx) ||
                deadZoneSquares.get(nextIdx) === playerId) break;
            line.push(nextIdx);
            count++;
          }
          if (count >= 4) return { winner: playerId, winningLine: line };
        }
      }
    }
  }
  return { winner: null, winningLine: null };
}

export function getValidMoveDestinations(
  fromIndex: number, 
  gameState: Readonly<GameState> // gameState now passed directly
): number[] {
  const playerId = gameState.currentPlayerId;
  const validDestinations: number[] = [];
  const fromSquare = gameState.board[fromIndex];
  if (!fromSquare?.pawn || fromSquare.pawn.playerId !== playerId || gameState.blockedPawnsInfo.has(fromIndex)) {
    return [];
  }
  
  for (let i = 0; i < gameState.board.length; i++) {
    if (isValidMove(fromIndex, i, gameState)) {
      validDestinations.push(i);
    }
  }
  return validDestinations;
}

export function placePawn( 
  gameState: Readonly<GameState>,
  index: number
): GameState | null {
  if (!isValidPlacement(index, gameState)) return null;
  
  const playerId = gameState.currentPlayerId;
  const newPawn: Pawn = {
    id: `p${playerId}_${gameState.placedPawns[playerId] + 1}`,
    playerId,
    color: gameState.playerColors[playerId],
  };
  
  const newBoard = gameState.board.map((sq, i) => 
    i === index ? { ...sq, pawn: newPawn } : sq
  );
  
  const newPawnsToPlace = { ...gameState.pawnsToPlace, [playerId]: gameState.pawnsToPlace[playerId] - 1 };
  const newPlacedPawns = { ...gameState.placedPawns, [playerId]: gameState.placedPawns[playerId] + 1 };
  
  let nextPhase = gameState.gamePhase;
  if (newPawnsToPlace[1] === 0 && newPawnsToPlace[2] === 0) {
    nextPhase = 'movement';
  }
  
  const updatedGameStateBase = {
    ...gameState,
    pawnsToPlace: newPawnsToPlace,
    placedPawns: newPlacedPawns,
    gamePhase: nextPhase,
    lastMove: { from: null, to: index },
  };

  return applyDerivedStateUpdates(updatedGameStateBase, newBoard);
}

export function movePawn( 
  gameState: Readonly<GameState>,
  fromIndex: number,
  toIndex: number
): GameState | null {
  if (!isValidMove(fromIndex, toIndex, gameState)) return null;
  
  const pawnToMove = gameState.board[fromIndex].pawn;
  if (!pawnToMove) return null;

  const newBoard = gameState.board.map((sq, i) => {
    if (i === fromIndex) return { ...sq, pawn: null };
    if (i === toIndex) return { ...sq, pawn: pawnToMove };
    return sq;
  });
  
  const updatedGameStateBase = {
    ...gameState,
    lastMove: { from: fromIndex, to: toIndex },
  };

  return applyDerivedStateUpdates(updatedGameStateBase, newBoard);
}

export function highlightValidMoves(
  gameState: Readonly<GameState>,
  pawnIndex: number
): GameState {
  const validDestinations = getValidMoveDestinations(pawnIndex, gameState);
  
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
    highlightedValidMoves: validDestinations,
  };
}

export function clearHighlights(gameState: Readonly<GameState>): GameState {
  if (gameState.selectedPawnIndex === null && (gameState.highlightedValidMoves?.length || 0) === 0) {
    return gameState;
  }
  const newBoard = gameState.board.map(square => ({ ...square, highlight: undefined }));
  return {
    ...gameState,
    board: newBoard,
    selectedPawnIndex: null,
    highlightedValidMoves: [],
  };
}