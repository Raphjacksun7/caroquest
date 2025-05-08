
import type { Player, SquareColorType, PawnPosition, BoardSquareData, GamePhase, PlayerAssignedColors } from '@/types/game';
import { Pawn } from './Pawn';
import { cn } from '@/lib/utils';

interface SquareProps {
  row: number;
  col: number;
  squareData: BoardSquareData;
  squareColorType: SquareColorType;
  onClick: (row: number, col: number) => void;
  currentPlayer: Player;
  gamePhase: GamePhase;
  selectedPawn: PawnPosition | null;
  playerAssignedColors: PlayerAssignedColors;
  isWinningSquare: boolean;
  isValidMove: boolean; // Combines placement and movement validity
}

export const Square = ({
  row,
  col,
  squareData,
  squareColorType,
  onClick,
  currentPlayer,
  gamePhase,
  selectedPawn,
  playerAssignedColors,
  isWinningSquare,
  isValidMove,
}: SquareProps) => {
  const { player, isBlocked, isBlocking, isDeadZoneForOpponent } = squareData;

  const isSelected = selectedPawn?.row === row && selectedPawn?.col === col;
  const currentPlayerAssignedColor = currentPlayer === 1 ? playerAssignedColors.player1 : playerAssignedColors.player2;


  return (
    <button
      onClick={() => onClick(row, col)}
      className={cn(
        'w-12 h-12 md:w-16 md:h-16 flex items-center justify-center border border-black/10 transition-colors duration-150',
        squareColorType === 'light' ? 'bg-[hsl(var(--board-light-square))]' : 'bg-[hsl(var(--board-dark-square))]',
        isValidMove && !player && 'bg-opacity-70 bg-[hsl(var(--highlight-valid-move))] hover:bg-opacity-100',
        isSelected && 'ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn))]',
        isDeadZoneForOpponent && 'relative overflow-hidden', // For pseudo-element styling of dead zone
        isWinningSquare && 'bg-[hsl(var(--highlight-win-line))] bg-opacity-70 animate-pulse'
      )}
      aria-label={`Square ${row}, ${col}, ${squareColorType}, ${player ? `Player ${player} pawn` : 'Empty'}`}
      disabled={gamePhase === 'GAME_OVER'}
    >
      {isDeadZoneForOpponent && (
         <div className="absolute inset-0 flex items-center justify-center text-destructive opacity-30 text-3xl font-bold">X</div>
      )}
      {player && <Pawn player={player} isBlocked={isBlocked} isBlocking={isBlocking} />}
    </button>
  );
};

