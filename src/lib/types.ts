
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
  deadZoneCreatorPawnsInfo: Set<number>;
  winner: PlayerId | null;
  lastMove: { from: number | null, to: number } | null; 
  winningLine: number[] | null; 
  highlightedValidMoves?: number[];
}

export interface StoredPlayer {
  id: string; // Socket ID
  name: string;
  playerId: PlayerId; 
  isConnected: boolean; 
  isCreator: boolean;
  rating?: number; // Optional rating for matchmaking
}

export interface GameOptions {
  isPublic?: boolean; 
  gameIdToCreate?: string;
  pawnsPerPlayer?: number;
  isMatchmaking?: boolean; 
  isRanked?: boolean;      
}
    
