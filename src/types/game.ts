
export type Player = 1 | 2;
export type SquareColorType = 'light' | 'dark';
export type GamePhase = 'PLAYER_SETUP' | 'PLACEMENT' | 'MOVEMENT' | 'GAME_OVER';

export interface PawnPosition {
  row: number;
  col: number;
}

export interface BoardSquareData {
  player: Player | null;
  isBlocked: boolean; // Pawn on this square is blocked by opponent
  isBlocking: boolean; // Pawn on this square is part of a blocking pair
  isDeadZoneForOpponent: boolean; // This square (must be current player's color and empty) is a dead zone for opponent's win
}

export type GameBoardArray = BoardSquareData[][];

export interface PlayerAssignedColors {
  player1: SquareColorType;
  player2: SquareColorType;
}

export interface WinningLine {
  player: Player;
  positions: PawnPosition[];
}
