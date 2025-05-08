
import type { Player, SquareColorType, PawnPosition, BoardSquareData, GamePhase } from '@/types/game';
import { Pawn } from './Pawn';
import { cn } from '@/lib/utils';

interface SquareProps {
  row: number;
  col: number;
  squareData: BoardSquareData;
  squareColorType: SquareColorType;
  onClick: (row: number, col: number) => void;
  gamePhase: GamePhase;
  selectedPawn: PawnPosition | null;
  isWinningSquare: boolean;
  isValidMove: boolean; 
  isDeadZone: boolean; // This should be true if the square is a dead zone FOR THE CURRENT PLAYER
}

export const Square = ({
  row,
  col,
  squareData,
  squareColorType,
  onClick,
  gamePhase,
  selectedPawn,
  isWinningSquare,
  isValidMove,
  isDeadZone, 
}: SquareProps) => {
  const { player, isBlocked, isBlocking, isCreatingDeadZone } = squareData;
  const isSelected = selectedPawn?.row === row && selectedPawn?.col === col;

  const squareBgColor = squareColorType === 'light' 
    ? 'bg-[hsl(var(--board-light-square))]' 
    : 'bg-[hsl(var(--board-dark-square))]';

  let conditionalClasses = '';
  if (isSelected) {
    conditionalClasses = 'ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn))]';
  } else if (isValidMove && !player) {
    conditionalClasses = 'bg-[hsl(var(--highlight-valid-move))] bg-opacity-70 hover:bg-opacity-100';
  }

  if (isWinningSquare) {
    conditionalClasses = `${conditionalClasses} bg-[hsl(var(--highlight-win-line))] bg-opacity-80 animate-pulse`;
  }

  return (
    <button
      onClick={() => onClick(row, col)}
      className={cn(
        'w-12 h-12 md:w-16 md:h-16 flex items-center justify-center border border-black/10 transition-colors duration-150 relative overflow-hidden',
        squareBgColor,
        conditionalClasses
      )}
      aria-label={`Square ${row}, ${col}, ${squareColorType}, ${player ? `Player ${player} piece` : 'Empty'}${isBlocked ? ', Blocked' : ''}${isBlocking ? ', Blocking' : ''}${isDeadZone ? ', Dead Zone for current player' : ''}`}
      disabled={gamePhase === 'GAME_OVER'}
    >
      {isDeadZone && player === null && ( 
         <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--highlight-dead-zone))] opacity-50 text-3xl font-bold pointer-events-none">X</div>
      )}
      {player && <Pawn player={player} isBlocked={isBlocked} isBlocking={isBlocking} isCreatingDeadZone={isCreatingDeadZone} />}
    </button>
  );
};
