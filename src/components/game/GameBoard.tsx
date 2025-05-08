
import type { GameBoardArray, Player, PawnPosition, GamePhase, WinningLine, DeadZone, SquareColorType } from '@/types/game';
import { Square } from './Square';
import { BOARD_SIZE } from '@/config/game';
import { getSquareColorType } from '@/lib/gameUtils';

interface GameBoardProps {
  board: GameBoardArray;
  onSquareClick: (row: number, col: number) => void;
  currentPlayer: Player;
  gamePhase: GamePhase;
  selectedPawn: PawnPosition | null;
  winningLine: WinningLine | null;
  deadZones: DeadZone[];
  getPlayerSquareColor: (player: Player) => SquareColorType;
}

export const GameBoard = ({
  board,
  onSquareClick,
  currentPlayer,
  gamePhase,
  selectedPawn,
  winningLine,
  deadZones,
  getPlayerSquareColor,
}: GameBoardProps) => {
  
  const isWinningSquare = (row: number, col: number) => {
    return winningLine?.positions.some(p => p.row === row && p.col === col) ?? false;
  };

  const getIsValidMoveForDisplay = (row: number, col: number): boolean => {
    const targetBoardSquareColor = getSquareColorType(row, col);
    const currentPlayerRequiredSquareColor = getPlayerSquareColor(currentPlayer);

    if (targetBoardSquareColor !== currentPlayerRequiredSquareColor) return false;
    if (board[row][col].player !== null) return false; // Can't move to occupied square

    if (gamePhase === 'PLACEMENT') {
      return true; // Valid if empty and correct color
    }
    if (gamePhase === 'MOVEMENT' && selectedPawn) {
      // Any empty square of current player's assigned color is potentially valid for movement destination
      // The hook's handleSquareClick will do final validation (e.g. if it's the same square)
      return true;
    }
    return false;
  };
  
  const isSquareDeadZone = (row: number, col: number): boolean => {
    return deadZones.some(dz => dz.row === row && dz.col === col);
  };

  return (
    <div
      className="grid grid-cols-8 gap-0 border-2 border-foreground bg-background shadow-2xl rounded overflow-hidden relative"
      style={{ width: `${BOARD_SIZE * 4}rem`, height: `${BOARD_SIZE * 4}rem` }}
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
            gamePhase={gamePhase}
            selectedPawn={selectedPawn}
            isWinningSquare={isWinningSquare(rowIndex, colIndex)}
            isValidMove={getIsValidMoveForDisplay(rowIndex, colIndex)}
            isDeadZone={isSquareDeadZone(rowIndex, colIndex)}
          />
        ))
      )}
    </div>
  );
};
