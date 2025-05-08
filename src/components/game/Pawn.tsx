
import type { Player } from '@/types/game';
import { cn } from '@/lib/utils';

interface PawnProps {
  player: Player;
  isBlocked?: boolean;
  isBlocking?: boolean;
}

export const Pawn = ({ player, isBlocked, isBlocking }: PawnProps) => {
  return (
    <div
      className={cn(
        'w-3/4 h-3/4 rounded-full flex items-center justify-center shadow-md transition-all duration-150 ease-in-out',
        player === 1 ? 'bg-[hsl(var(--player1-pawn-color))]' : 'bg-[hsl(var(--player2-pawn-color))]',
        isBlocked && 'opacity-50 ring-2 ring-offset-1 ring-[hsl(var(--highlight-blocked-pawn))]',
        isBlocking && 'ring-2 ring-offset-1 ring-[hsl(var(--highlight-blocking-pawn-border))]'
      )}
      aria-label={`Player ${player} pawn`}
    >
      {/* Optionally, add a subtle inner gloss or icon */}
    </div>
  );
};
