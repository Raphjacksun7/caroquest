
// gameLogic.ts
export type PlayerId = 1 | 2;
export type SquareColor = 'light' | 'dark';
export type GamePhase = 'placement' | 'movement';

export interface Pawn {
  id: string;
  playerId: PlayerId;
  color: SquareColor;
}

export interface SquareState {
  index: number;
  // row: number; // Removed as index is primary and row/col can be derived
  // col: number; // Removed as index is primary and row/col can be derived
  boardColor: SquareColor;
  pawn: Pawn | null;
  highlight?: 'selectedPawn' | 'validMove' | 'deadZoneIndicator'; 
}

export interface GameState {
  board: SquareState[];
  currentPlayerId: PlayerId;
  playerColors: Record<PlayerId, SquareColor>;
  gamePhase: GamePhase;
  pawnsToPlace: Record<PlayerId, number>;
  placedPawns: Record<PlayerId, number>;
  selectedPawnIndex: number | null;
  blockedPawnsInfo: Set<number>;
  blockingPawnsInfo: Set<number>;
  deadZoneSquares: Map<number, PlayerId>; // squareIndex -> playerId for whom it's a dead zone
  deadZoneCreatorPawns: Set<number>; // Pawns that are creating dead zones (renamed from deadZoneCreatorPawnsInfo)
  winner: PlayerId | null;
  lastMove: { from: number | null; to: number } | null;
  winningLine: number[] | null;
}

export const BOARD_SIZE = 8;
export const PAWNS_PER_PLAYER = 6;

export function initializeBoard(): SquareState[] {
  const board: SquareState[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      board.push({
        index: row * BOARD_SIZE + col,
        // row, // Removed
        // col, // Removed
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

export function createInitialGameState(): GameState {
  return {
    board: initializeBoard(),
    currentPlayerId: 1,
    playerColors: assignPlayerColors(),
    gamePhase: 'placement',
    pawnsToPlace: { 1: PAWNS_PER_PLAYER, 2: PAWNS_PER_PLAYER },
    placedPawns: { 1: 0, 2: 0 },
    selectedPawnIndex: null,
    blockedPawnsInfo: new Set<number>(),
    blockingPawnsInfo: new Set<number>(),
    deadZoneSquares: new Map<number, PlayerId>(),
    deadZoneCreatorPawns: new Set<number>(), // Renamed from deadZoneCreatorPawnsInfo
    winner: null,
    lastMove: null,
    winningLine: null,
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

  const row = Math.floor(squareIndex / BOARD_SIZE);
  const col = squareIndex % BOARD_SIZE;
  const opponentId = playerId === 1 ? 2 : 1;

  // Horizontal check for restricted zone
  if (col > 0 && col < BOARD_SIZE - 1) {
    const leftSquare = gameState.board[row * BOARD_SIZE + (col - 1)];
    const rightSquare = gameState.board[row * BOARD_SIZE + (col + 1)];
    if (leftSquare?.pawn?.playerId === opponentId && rightSquare?.pawn?.playerId === opponentId) {
      return false;
    }
  }
  // Vertical check for restricted zone
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
  return !!fromSquare?.pawn &&
         fromSquare.pawn.playerId === playerId &&
         !!toSquare &&
         !toSquare.pawn &&
         toSquare.boardColor === gameState.playerColors[playerId] &&
         !gameState.blockedPawnsInfo.has(fromIndex); 
}

export function updateBlockingStatus(
  board: Readonly<SquareState[]>
): { blockedPawns: Set<number>; blockingPawns: Set<number> } {
  const blockedPawns = new Set<number>();
  const blockingPawns = new Set<number>();

  // Horizontal blocking
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 1; col < BOARD_SIZE - 1; col++) {
      const centerIndex = row * BOARD_SIZE + col;
      const leftIndex = row * BOARD_SIZE + (col - 1);
      const rightIndex = row * BOARD_SIZE + (col + 1);
      
      const [left, center, right] = [
        board[leftIndex],
        board[centerIndex],
        board[rightIndex],
      ];

      if (center?.pawn && left?.pawn && right?.pawn &&
          left.pawn.playerId === right.pawn.playerId &&
          left.pawn.playerId !== center.pawn.playerId) { 
        blockedPawns.add(centerIndex);
        blockingPawns.add(left.index);
        blockingPawns.add(right.index);
      }
    }
  }

  // Vertical blocking
  for (let col = 0; col < BOARD_SIZE; col++) {
    for (let row = 1; row < BOARD_SIZE - 1; row++) {
      const centerIndex = row * BOARD_SIZE + col;
      const topIndex = (row - 1) * BOARD_SIZE + col;
      const bottomIndex = (row + 1) * BOARD_SIZE + col;

      const [top, center, bottom] = [
        board[topIndex],
        board[centerIndex],
        board[bottomIndex],
      ];

      if (center?.pawn && top?.pawn && bottom?.pawn &&
          top.pawn.playerId === bottom.pawn.playerId &&
          top.pawn.playerId !== center.pawn.playerId) { 
        blockedPawns.add(centerIndex);
        blockingPawns.add(top.index);
        blockingPawns.add(bottom.index);
      }
    }
  }

  return { blockedPawns, blockingPawns };
}

export function updateDeadZones(
  board: Readonly<SquareState[]>,
  playerColors: Readonly<Record<PlayerId, SquareColor>>
): { deadZones: Map<number, PlayerId>; creators: Set<number> } { 
  const deadZones = new Map<number, PlayerId>();
  const creators = new Set<number>();

  // Horizontal dead zones
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE - 2; col++) {
      const p1Index = row * BOARD_SIZE + col;
      const emptyIndex = row * BOARD_SIZE + (col + 1);
      const p2Index = row * BOARD_SIZE + (col + 2);
      const [p1, empty, p2] = [ board[p1Index], board[emptyIndex], board[p2Index] ];

      if (p1?.pawn && p2?.pawn && !empty?.pawn &&
          p1.pawn.playerId === p2.pawn.playerId &&
          empty.boardColor === playerColors[p1.pawn.playerId]) { 
        const opponentId = p1.pawn.playerId === 1 ? 2 : 1;
        deadZones.set(empty.index, opponentId); 
        creators.add(p1.index);
        creators.add(p2.index);
      }
    }
  }

  // Vertical dead zones
  for (let col = 0; col < BOARD_SIZE; col++) {
    for (let row = 0; row < BOARD_SIZE - 2; row++) {
      const p1Index = row * BOARD_SIZE + col;
      const emptyIndex = (row + 1) * BOARD_SIZE + col;
      const p2Index = (row + 2) * BOARD_SIZE + col;
      const [p1, empty, p2] = [ board[p1Index], board[emptyIndex], board[p2Index] ];
      

      if (p1?.pawn && p2?.pawn && !empty?.pawn &&
          p1.pawn.playerId === p2.pawn.playerId &&
          empty.boardColor === playerColors[p1.pawn.playerId]) { 
        const opponentId = p1.pawn.playerId === 1 ? 2 : 1;
        deadZones.set(empty.index, opponentId); 
        creators.add(p1.index);
        creators.add(p2.index);
      }
    }
  }
  return { deadZones, creators };
}

export function checkWinCondition(
  gameState: Readonly<GameState>
): { winner: PlayerId | null; winningLine: number[] | null } {
  const { board, playerColors, deadZoneSquares, blockedPawnsInfo, blockingPawnsInfo, deadZoneCreatorPawns } = gameState;

  const checkDirection = (
    startSquareIndex: number, 
    dr: number,
    dc: number,
    playerId: PlayerId 
  ): number[] | null => {
    const line = [startSquareIndex];
    let row = Math.floor(startSquareIndex / BOARD_SIZE);
    let col = startSquareIndex % BOARD_SIZE;
    
    for (let i = 1; i < 4; i++) {
      row += dr;
      col += dc;
      if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
      
      const currentIndex = row * BOARD_SIZE + col;
      const currentSquare = board[currentIndex];
      
      if (!currentSquare?.pawn ||
          currentSquare.pawn.playerId !== playerId || 
          currentSquare.boardColor !== playerColors[playerId] || 
          blockedPawnsInfo.has(currentIndex) ||
          blockingPawnsInfo.has(currentIndex) ||
          deadZoneCreatorPawns.has(currentIndex) || // Use correct property name
          deadZoneSquares.get(currentIndex) === playerId) { 
        return null;
      }
      line.push(currentIndex);
    }
    return line;
  };

  for (const playerId of [1, 2] as PlayerId[]) {
    const colorOfPlayer = playerColors[playerId]; 
    
    for (const square of gameState.board) {
      if (!square.pawn || 
          square.pawn.playerId !== playerId || 
          square.boardColor !== colorOfPlayer ||
          blockedPawnsInfo.has(square.index) ||
          blockingPawnsInfo.has(square.index) ||
          deadZoneCreatorPawns.has(square.index)) continue; // Use correct property name

      const directions = [
        { dr: 1, dc: 1 }, { dr: 1, dc: -1 },
        { dr: -1, dc: 1 }, { dr: -1, dc: -1 }
      ];

      for (const dir of directions) {
        const line = checkDirection(square.index, dir.dr, dir.dc, playerId); 
        if (line) return { winner: playerId, winningLine: line };
      }
    }
  }

  return { winner: null, winningLine: null };
}

export function placePawn(
  gameState: Readonly<GameState>,
  index: number
): GameState | null {
  if (!isValidPlacement(index, gameState.currentPlayerId, gameState)) return null;

  const newBoard = gameState.board.map(s => ({...s})); 
  const playerId = gameState.currentPlayerId;
  const pawn: Pawn = {
    id: `p${playerId}_${gameState.placedPawns[playerId] + 1}`,
    playerId,
    color: gameState.playerColors[playerId],
  };

  newBoard[index] = { ...newBoard[index], pawn };
  
  const newPawnsToPlace = { ...gameState.pawnsToPlace };
  newPawnsToPlace[playerId]--;
  
  const newPlacedPawns = { ...gameState.placedPawns };
  newPlacedPawns[playerId]++;
  
  const nextPhase = (newPawnsToPlace[1] === 0 && newPawnsToPlace[2] === 0) ? 'movement' : 'placement';
  
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, creators } = updateDeadZones(newBoard, gameState.playerColors); 
  
  const newState: GameState = {
    ...gameState,
    board: newBoard,
    pawnsToPlace: newPawnsToPlace,
    placedPawns: newPlacedPawns,
    gamePhase: nextPhase,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawns: creators, // Assign 'creators' to 'deadZoneCreatorPawns'
    lastMove: { from: null, to: index },
    selectedPawnIndex: null, 
  };

  const { winner, winningLine } = checkWinCondition(newState);
  if (winner) {
    return { ...newState, winner, winningLine, currentPlayerId: gameState.currentPlayerId }; 
  }
  return { ...newState, currentPlayerId: gameState.currentPlayerId === 1 ? 2 : 1 };
}

export function movePawn(
  gameState: Readonly<GameState>,
  fromIndex: number,
  toIndex: number
): GameState | null {
  if (!isValidMove(fromIndex, toIndex, gameState.currentPlayerId, gameState)) return null;

  const newBoard = gameState.board.map(s => ({...s})); 
  const pawn = newBoard[fromIndex].pawn!;
  newBoard[fromIndex] = { ...newBoard[fromIndex], pawn: null };
  newBoard[toIndex] = { ...newBoard[toIndex], pawn };

  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, creators } = updateDeadZones(newBoard, gameState.playerColors); 

  const newState: GameState = {
    ...gameState,
    board: newBoard,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawns: creators, // Assign 'creators' to 'deadZoneCreatorPawns'
    lastMove: { from: fromIndex, to: toIndex },
    selectedPawnIndex: null, 
  };

  const { winner, winningLine } = checkWinCondition(newState);
  if (winner) {
     return { ...newState, winner, winningLine, currentPlayerId: gameState.currentPlayerId }; 
  }
  return { ...newState, currentPlayerId: gameState.currentPlayerId === 1 ? 2 : 1 };
}


export function highlightValidMoves(
  gameState: Readonly<GameState>,
  pawnIndex: number
): GameState {
  const { currentPlayerId, board } = gameState;
  const validDestinations: number[] = [];

  if (board[pawnIndex]?.pawn?.playerId !== currentPlayerId) {
    return { ...gameState, selectedPawnIndex: null }; 
  }
  
  for (let i = 0; i < board.length; i++) {
    if (isValidMove(pawnIndex, i, currentPlayerId, gameState)) {
      validDestinations.push(i);
    }
  }
  
  const newBoard = board.map((square, i) => {
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

export function clearHighlights(gameState: Readonly<GameState>): GameState {
  const newBoard = gameState.board.map(square => ({ ...square, highlight: undefined }));
  return {
    ...gameState,
    board: newBoard,
    selectedPawnIndex: null,
  };
}
