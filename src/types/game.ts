
export type Player = 1 | 2;
export type SquareColorType = 'light' | 'dark';
export type GamePhase = 'PLAYER_SETUP' | 'PLACEMENT' | 'MOVEMENT' | 'GAME_OVER';

export interface PawnPosition {
  row: number;
  col: number;
}

export interface BoardSquareData {
  player: Player | null; // Piece on the square (null, 1, or 2)
  isBlocked: boolean;    // This pawn is blocked
  isBlocking: boolean;   // This pawn is part of a blocking formation
  isCreatingDeadZone: boolean; // This pawn is part of forming a dead zone and cannot be used in a winning line
}

export type GameBoardArray = BoardSquareData[][];

export interface PlayerAssignedColors { // Defines which color squares each player plays on
  player1: SquareColorType; // Player 1 plays on light squares
  player2: SquareColorType; // Player 2 plays on dark squares
}

export interface WinningLine {
  player: Player;
  positions: PawnPosition[];
}

export interface DeadZone {
  row: number;
  col: number;
  player: Player; // Player for whom this square is a dead zone (cannot use for winning line)
}

