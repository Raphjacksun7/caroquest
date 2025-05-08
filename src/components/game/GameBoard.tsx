
import type { GameBoardArray, Player, PawnPosition, GamePhase, PlayerAssignedColors, WinningLine } from '@/types/game';
import { Square } from './Square';
import { BOARD_SIZE } from '@/config/game';
import { getSquareColorType } from '@/lib/gameUtils';

interface GameBoardProps {
  board: GameBoardArray;
  onSquareClick: (row: number, col: number) => void;
  currentPlayer: Player;
  gamePhase: GamePhase;
  selectedPawn: PawnPosition | null;
  playerAssignedColors: PlayerAssignedColors;
  winningLine: WinningLine | null;
}

export const GameBoard = ({
  board,
  onSquareClick,
  currentPlayer,
  gamePhase,
  selectedPawn,
  playerAssignedColors,
  winningLine,
}: GameBoardProps) => {
  
  const isWinningSquare = (row: number, col: number) => {
    return winningLine?.positions.some(p => p.row === row && p.col === col) ?? false;
  };

  const getIsValidMove = (row: number, col: number): boolean => {
    const targetSquareColorType = getSquareColorType(row, col);
    const currentPlayerAssignedColor = currentPlayer === 1 ? playerAssignedColors.player1 : playerAssignedColors.player2;

    if (gamePhase === 'PLACEMENT') {
      return board[row][col].player === null && targetSquareColorType === currentPlayerAssignedColor;
    }
    if (gamePhase === 'MOVEMENT' && selectedPawn) {
      // Any empty square of assigned color is valid if a pawn is selected
      return board[row][col].player === null && targetSquareColorType === currentPlayerAssignedColor;
    }
    return false;
  };


  return (
    <div
      className="grid grid-cols-8 gap-0 border-2 border-foreground bg-background shadow-2xl rounded overflow-hidden relative"
      style={{ width: `${BOARD_SIZE * 4}rem`, height: `${BOARD_SIZE * 4}rem` }} // Adjust size as needed
    >
      {board.map((rowSquares, rowIndex) =>
        rowSquares.map((squareData, colIndex) => (
          <Square
            key={`${rowIndex}-${colIndex}`}
            row={rowIndex}
            col={colIndex}
            squareData={squareData}
            squareColorType={getSquareColorType(rowIndex, colIndex)}
            onClick={onSquareClick}
            currentPlayer={currentPlayer}
            gamePhase={gamePhase}
            selectedPawn={selectedPawn}
            playerAssignedColors={playerAssignedColors}
            isWinningSquare={isWinningSquare(rowIndex, colIndex)}
            isValidMove={getIsValidMove(rowIndex, colIndex)}
          />
        ))
      )}
    </div>
  );
};
