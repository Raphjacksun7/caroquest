
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
  row: number; 
  col: number; 
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
  deadZoneSquares: Map<number, PlayerId>; 
  deadZoneCreatorPawnsInfo: Set<number>; // Ensured this matches gameLogic
  winner: PlayerId | null;
  lastMove: { from: number | null, to: number } | null; 
  winningLine: number[] | null; 
  // highlightedValidMoves is not part of the core GameState from gameLogic.ts
  // It's a UI-derived state, so it should be handled client-side if needed
  // or passed around with gameState if essential for server processing (unlikely for this)
}
