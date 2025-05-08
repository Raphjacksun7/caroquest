
import type { Player, BoardSquareData, PawnPosition } from '@/types/game';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PawnProps {
  player: Player;
  squareData: BoardSquareData;
  isSelected: boolean;
  isCurrentPlayerPawn: boolean;
  gamePhase: GamePhase;
  hasWinner: boolean;
}

export const Pawn = ({ player, squareData, isSelected, isCurrentPlayerPawn, gamePhase, hasWinner }: PawnProps) => {
  const { isBlocked, isBlocking, isCreatingDeadZone, isPartOfWinningLine } = squareData;

  const playerColorClass = player === 1 
    ? 'bg-[hsl(var(--player1-pawn-color))] border-[hsl(var(--player1-pawn-color))]' 
    : 'bg-[hsl(var(--player2-pawn-color))] border-[hsl(var(--player2-pawn-color))]';
  
  let dynamicBorderClass = 'border-opacity-75'; // Default border for player color
  let animationClass = '';

  if (isPartOfWinningLine) {
    dynamicBorderClass = 'border-[hsl(var(--highlight-win-line))] border-4';
    animationClass = 'animate-pulse';
  } else if (isBlocking) {
    dynamicBorderClass = 'border-[hsl(var(--highlight-blocking-pawn-border))] border-4';
  } else if (isCreatingDeadZone) {
    dynamicBorderClass = 'border-[hsl(var(--highlight-creating-dead-zone-pawn-border))] border-4';
  } else if (isSelected) {
    dynamicBorderClass = 'border-[hsl(var(--highlight-selected-pawn))] border-4 ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn))]';
  }

  let tooltipContent = '';
  if (isBlocked) tooltipContent = 'This pawn is blocked.';
  else if (isBlocking) tooltipContent = 'This pawn is blocking an opponent.';
  else if (isCreatingDeadZone) tooltipContent = 'This pawn is creating a dead zone.';
  
  if (isPartOfWinningLine) tooltipContent = 'Part of the winning line!';
  else if (isBlocked && !isPartOfWinningLine) tooltipContent += ' Cannot be used in a winning diagonal.';
  else if ((isBlocking || isCreatingDeadZone) && !isPartOfWinningLine) tooltipContent += ' Cannot be used in a winning diagonal.';


  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all duration-200 border-2',
              playerColorClass,
              isBlocked && 'opacity-50 cursor-not-allowed',
              dynamicBorderClass,
              animationClass,
              isCurrentPlayerPawn && gamePhase === 'MOVEMENT' && !hasWinner && !isBlocked && 'cursor-grab hover:scale-110 active:scale-105',
              !isCurrentPlayerPawn && 'cursor-default',
              hasWinner && 'cursor-default'
            )}
            aria-label={`Player ${player} pawn ${isBlocked ? ' (blocked)' : ''}${isBlocking ? ' (blocking)' : ''}${isCreatingDeadZone ? ' (creating dead zone)' : ''}${isPartOfWinningLine ? ' (winning)' : ''}${isSelected ? ' (selected)' : ''}`}
          >
            {/* Optional: Inner visual cue or icon */}
          </div>
        </TooltipTrigger>
        {tooltipContent && (
          <TooltipContent>
            <p>{tooltipContent}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};
