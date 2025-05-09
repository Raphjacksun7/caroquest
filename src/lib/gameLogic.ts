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
  highlight?: 'selectedPawn' | 'validMove' | 'deadZoneIndicator'; // deadZoneIndicator for UI
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
  highlightedValidMoves?: number[]; // Optional: For UI state, managed client-side if needed
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
        highlight: undefined,
      });
    }
  }
  return board;
}

export function assignPlayerColors(): Record<PlayerId, SquareColor> {
  return { 1: 'light', 2: 'dark' };
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

export function isValidPlacement(
  squareIndex: number,
  playerId: PlayerId,
  gameState: Readonly<GameState>
): boolean {
  const square = gameState.board[squareIndex];
  if (!square || square.pawn) return false;
  if (square.boardColor !== gameState.playerColors[playerId]) return false;
  if (gameState.deadZoneSquares.get(squareIndex) === playerId) return false;

  const { row, col } = square;
  const opponentId = playerId === 1 ? 2 : 1;

  // Horizontal restricted zone check
  if (col > 0 && col < BOARD_SIZE - 1) {
    const leftSquare = gameState.board[row * BOARD_SIZE + (col - 1)];
    const rightSquare = gameState.board[row * BOARD_SIZE + (col + 1)];
    if (leftSquare?.pawn?.playerId === opponentId && rightSquare?.pawn?.playerId === opponentId) {
      return false;
    }
  }

  // Vertical restricted zone check
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
  playerId: PlayerId,
  gameState: Readonly<GameState>
): boolean {
  const fromSquare = gameState.board[fromIndex];
  const toSquare = gameState.board[toIndex];

  if (!fromSquare?.pawn || fromSquare.pawn.playerId !== playerId) return false;
  if (!toSquare || toSquare.pawn) return false;
  if (toSquare.boardColor !== gameState.playerColors[playerId]) return false;
  if (gameState.blockedPawnsInfo.has(fromIndex)) return false;
  if (gameState.deadZoneSquares.get(toIndex) === playerId) return false;

  return true;
}

export function updateBlockingStatus(
  board: Readonly<SquareState[]>
): { blockedPawns: Set<number>, blockingPawns: Set<number> } {
  const blockedPawns = new Set<number>();
  const blockingPawns = new Set<number>();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const centerIdx = r * BOARD_SIZE + c;
      const centerSq = board[centerIdx];
      if (!centerSq?.pawn) continue;

      // Horizontal check
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
      // Vertical check
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
): { deadZones: Map<number, PlayerId>, deadZoneCreatorPawnsInfo: Set<number> } {
  const deadZones = new Map<number, PlayerId>();
  const deadZoneCreatorPawnsInfo = new Set<number>();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      // Horizontal: P - E - P
      if (c < BOARD_SIZE - 2) {
        const p1 = board[r * BOARD_SIZE + c];
        const empty = board[r * BOARD_SIZE + (c + 1)];
        const p2 = board[r * BOARD_SIZE + (c + 2)];
        if (p1?.pawn && p2?.pawn && !empty?.pawn && p1.pawn.playerId === p2.pawn.playerId) {
          if (empty.boardColor === playerColors[p1.pawn.playerId]) { // Dead zone is on player's own color
            const opponentId = p1.pawn.playerId === 1 ? 2 : 1;
            deadZones.set(empty.index, opponentId);
            deadZoneCreatorPawnsInfo.add(p1.index);
            deadZoneCreatorPawnsInfo.add(p2.index);
          }
        }
      }
      // Vertical: P / E / P
      if (r < BOARD_SIZE - 2) {
        const p1 = board[r * BOARD_SIZE + c];
        const empty = board[(r + 1) * BOARD_SIZE + c];
        const p2 = board[(r + 2) * BOARD_SIZE + c];
        if (p1?.pawn && p2?.pawn && !empty?.pawn && p1.pawn.playerId === p2.pawn.playerId) {
           if (empty.boardColor === playerColors[p1.pawn.playerId]) { // Dead zone is on player's own color
            const opponentId = p1.pawn.playerId === 1 ? 2 : 1;
            deadZones.set(empty.index, opponentId);
            deadZoneCreatorPawnsInfo.add(p1.index);
            deadZoneCreatorPawnsInfo.add(p2.index);
          }
        }
      }
    }
  }
  return { deadZones, deadZoneCreatorPawnsInfo };
}

export function checkWinCondition(gameState: Readonly<GameState>): { winner: PlayerId | null, winningLine: number[] | null } {
  const { board, playerColors, deadZoneSquares, blockedPawnsInfo, blockingPawnsInfo, deadZoneCreatorPawnsInfo } = gameState;
  
  const diagonalDirections = [
    { dr: 1, dc: 1 }, { dr: 1, dc: -1 },
    { dr: -1, dc: 1 }, { dr: -1, dc: -1 },
  ];

  for (const playerId of [1, 2] as PlayerId[]) {
    const playerAssignedColor = playerColors[playerId];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const startIndex = r * BOARD_SIZE + c;
        const startSquare = board[startIndex];

        if (!startSquare.pawn || startSquare.pawn.playerId !== playerId ||
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
            const nextRow = r + direction.dr * step;
            const nextCol = c + direction.dc * step;

            if (nextRow < 0 || nextRow >= BOARD_SIZE || nextCol < 0 || nextCol >= BOARD_SIZE) break;

            const nextIndex = nextRow * BOARD_SIZE + nextCol;
            const nextSquare = board[nextIndex];

            if (!nextSquare.pawn || nextSquare.pawn.playerId !== playerId ||
                nextSquare.boardColor !== playerAssignedColor ||
                blockedPawnsInfo.has(nextIndex) ||
                blockingPawnsInfo.has(nextIndex) ||
                deadZoneCreatorPawnsInfo.has(nextIndex) ||
                deadZoneSquares.get(nextIndex) === playerId) { // Line cannot pass through a square that is a dead zone for the current player
              break;
            }
            lineIndices.push(nextIndex);
            count++;
          }
          if (count >= 4) return { winner: playerId, winningLine: lineIndices };
        }
      }
    }
  }
  return { winner: null, winningLine: null };
}

export function getValidMoveDestinations(
  fromIndex: number, 
  playerId: PlayerId, 
  gameState: Readonly<GameState>
): number[] {
  const validDestinations: number[] = [];
  const fromSquare = gameState.board[fromIndex];
  if (!fromSquare?.pawn || fromSquare.pawn.playerId !== playerId || gameState.blockedPawnsInfo.has(fromIndex)) {
    return [];
  }
  
  for (let i = 0; i < gameState.board.length; i++) {
    if (isValidMove(fromIndex, i, playerId, gameState)) {
      validDestinations.push(i);
    }
  }
  return validDestinations;
}

function applyCommonLogic(gameState: GameState, newBoard: SquareState[]): GameState {
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawnsInfo } = updateDeadZones(newBoard, gameState.playerColors);
  
  const tempGameState: GameState = {
    ...gameState,
    board: newBoard,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo: deadZoneCreatorPawnsInfo,
    selectedPawnIndex: null,
    highlightedValidMoves: [],
  };

  const { winner, winningLine } = checkWinCondition(tempGameState);
  return {
    ...tempGameState,
    winner,
    winningLine,
    currentPlayerId: winner ? tempGameState.currentPlayerId : (tempGameState.currentPlayerId === 1 ? 2 : 1),
  };
}


export function placePawn( 
  gameState: Readonly<GameState>,
  index: number
): GameState | null {
  const playerId = gameState.currentPlayerId;
  if (!isValidPlacement(index, playerId, gameState)) return null;
  
  const newPawn: Pawn = {
    id: `p${playerId}_${gameState.placedPawns[playerId] + 1}`,
    playerId,
    color: gameState.playerColors[playerId],
  };
  
  const newBoard = gameState.board.map((sq, i) => 
    i === index ? { ...sq, pawn: newPawn, highlight: undefined } : {...sq, highlight: undefined}
  );
  
  const newPawnsToPlace = { ...gameState.pawnsToPlace, [playerId]: gameState.pawnsToPlace[playerId] - 1 };
  const newPlacedPawns = { ...gameState.placedPawns, [playerId]: gameState.placedPawns[playerId] + 1 };
  
  let nextPhase = gameState.gamePhase;
  if (newPawnsToPlace[1] === 0 && newPawnsToPlace[2] === 0) {
    nextPhase = 'movement';
  }
  
  const updatedGameState = {
    ...gameState,
    pawnsToPlace: newPawnsToPlace,
    placedPawns: newPlacedPawns,
    gamePhase: nextPhase,
    lastMove: { from: null, to: index },
  };

  return applyCommonLogic(updatedGameState, newBoard);
}

export function movePawn( 
  gameState: Readonly<GameState>,
  fromIndex: number,
  toIndex: number
): GameState | null {
  const playerId = gameState.currentPlayerId;
  if (!isValidMove(fromIndex, toIndex, playerId, gameState)) return null;
  
  const pawnToMove = gameState.board[fromIndex].pawn;
  if (!pawnToMove) return null;

  const newBoard = gameState.board.map((sq, i) => {
    let newSq = {...sq, highlight: undefined };
    if (i === fromIndex) return { ...newSq, pawn: null };
    if (i === toIndex) return { ...newSq, pawn: pawnToMove };
    return newSq;
  });
  
  const updatedGameState = {
    ...gameState,
    lastMove: { from: fromIndex, to: toIndex },
  };

  return applyCommonLogic(updatedGameState, newBoard);
}

export function highlightValidMoves(
  gameState: Readonly<GameState>,
  pawnIndex: number
): GameState {
  const playerId = gameState.currentPlayerId;
  const validDestinations = getValidMoveDestinations(pawnIndex, playerId, gameState);
  
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
    return gameState; // No highlights to clear
  }
  const newBoard = gameState.board.map(square => ({ ...square, highlight: undefined }));
  return {
    ...gameState,
    board: newBoard,
    selectedPawnIndex: null,
    highlightedValidMoves: [],
  };
}
    