
import type { GameBoardArray, Player, PawnPosition, GamePhase, WinningLine, DeadZone, SquareColorType } from '@/types/game';
import { Square } from './Square';
import { BOARD_SIZE } from '@/config/game';
import { getSquareColorType as getBoardSquareColor } from '@/lib/gameUtils';

interface GameBoardProps {
  board: GameBoardArray;
  currentPlayer: Player;
  gamePhase: GamePhase;
  selectedPawn: PawnPosition | null;
  winningLine: WinningLine | null;
  deadZones: DeadZone[];
  validMoves: PawnPosition[];
  onSquareClick: (row: number, col: number) => void;
  winner: Player | null;
}

export const GameBoard = ({
  board,
  currentPlayer,
  gamePhase,
  selectedPawn,
  winningLine,
  deadZones,
  validMoves,
  onSquareClick,
  winner,
}: GameBoardProps) => {

  const isSquareDeadZoneForPlayer = (row: number, col: number, player: Player): boolean => {
    return deadZones.some(dz => dz.row === row && dz.col === col && dz.player === player);
  };

  return (
    <div
      className="grid grid-cols-8 gap-0 border-2 border-[hsl(var(--foreground))] bg-[hsl(var(--background))] shadow-2xl rounded overflow-hidden"
      // Fixed size, squares are w-14 h-14. 8 * 14 * (scaling factor if any)
      // Tailwind's JIT will calculate this based on content, or use explicit sizing on parent if needed.
      // Example: style={{ width: `${BOARD_SIZE * 3.5}rem`, height: `${BOARD_SIZE * 3.5}rem` }} if w-14 is 3.5rem
    >
      {board.map((rowSquares, rowIndex) =>
        rowSquares.map((squareData, colIndex) => {
          const squareColorType = getBoardSquareColor(rowIndex, colIndex);
          const isCurrentSelectedPawn = selectedPawn?.row === rowIndex && selectedPawn?.col === colIndex;
          const isValidMoveTarget = validMoves.some(p => p.row === rowIndex && p.col === colIndex);
          const isActualDeadZoneForCurrentPlayer = isSquareDeadZoneForPlayer(rowIndex, colIndex, currentPlayer);
          
          return (
            <Square
              key={`${rowIndex}-${colIndex}`}
              row={rowIndex}
              col={colIndex}
              squareData={squareData}
              squareColorType={squareColorType}
              isSelectedPawn={isCurrentSelectedPawn}
              isValidMove={isValidMoveTarget}
              isDeadZoneForCurrentPlayer={isActualDeadZoneForCurrentPlayer}
              currentPlayer={currentPlayer}
              gamePhase={gamePhase}
              winner={winner}
              onClick={onSquareClick}
            />
          );
        })
      )}
    </div>
  );
};
