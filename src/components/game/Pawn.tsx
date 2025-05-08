import type { Player } from '@/types/game';
import { cn } from '@/lib/utils';

interface PawnProps {
  player: Player;
  isBlocked?: boolean;
  isBlocking?: boolean;
  isCreatingDeadZone?: boolean;
}

export const Pawn = ({ player, isBlocked, isBlocking, isCreatingDeadZone }: PawnProps) => {
  const playerColorClass = player === 1 
    ? 'bg-[hsl(var(--player1-pawn-color))]' 
    : 'bg-[hsl(var(--player2-pawn-color))]';
  
  return (
    <div
      className={cn(
        'w-3/4 h-3/4 rounded-full flex items-center justify-center shadow-md transition-all duration-150 ease-in-out border-2 border-transparent', // Added transparent border for layout consistency
        playerColorClass,
        isBlocked && 'opacity-50 ring-1 ring-offset-1 ring-[hsl(var(--highlight-blocked-pawn))]', // Ring for blocked
        isBlocking && 'border-[hsl(var(--highlight-blocking-pawn-border))]', // Border for blocking
        isCreatingDeadZone && 'border-[hsl(var(--highlight-creating-dead-zone-pawn-border))]' // Border for creating dead zone
      )}
      aria-label={`Player ${player} pawn ${isBlocked ? ' (blocked)' : ''}${isBlocking ? ' (blocking)' : ''}${isCreatingDeadZone ? ' (creating dead zone)' : ''}`}
    >
      {/* Inner visual cue could be added here if desired */}
    </div>
  );
};