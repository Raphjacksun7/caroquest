
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
    if (board[row][col].player !== null) return false;

    if (gamePhase === 'PLACEMENT') {
      // Further restricted zone check is done in the hook, this is for basic UI indication
      return true; 
    }
    if (gamePhase === 'MOVEMENT' && selectedPawn) {
      // Cannot select a blocked pawn, that's handled in hook.
      // If a pawn is selected, any empty square of player's color is a potential target.
      return true;
    }
    return false;
  };
  
  const isSquareDeadZoneForCurrentPlayer = (row: number, col: number): boolean => {
    // A square is a dead zone for the currentPlayer if it's in deadZones with their player ID.
    // The 'player' field in DeadZone indicates for whom it's a dead zone.
    return deadZones.some(dz => dz.row === row && dz.col === col && dz.player === currentPlayer);
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
            isDeadZone={isSquareDeadZoneForCurrentPlayer(rowIndex, colIndex)} // Updated to pass specific check
          />
        ))
      )}
    </div>
  );
};
