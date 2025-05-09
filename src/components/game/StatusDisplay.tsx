"use client";

import type { Player, GamePhase, PawnPosition } from '@/types/game';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Swords, Hourglass, Flag, Zap } from 'lucide-react'; // Added Zap for selection

interface StatusDisplayProps {
  gamePhase: GamePhase;
  currentPlayer: Player;
  winner: Player | null;
  selectedPawn: PawnPosition | null;
}

export const StatusDisplay = ({ gamePhase, currentPlayer, winner, selectedPawn }: StatusDisplayProps) => {
  let statusText = '';
  let statusDescription = '';
  let IconComponent = Hourglass;

  if (winner) {
    statusText = `Player ${winner} Wins!`;
    statusDescription = "Congratulations! The game has concluded.";
    IconComponent = Flag;
  } else {
    const playerColorName = currentPlayer === 1 ? "Red" : "Blue";
    statusText = `Player ${currentPlayer}'s (${playerColorName}) Turn`;
    IconComponent = Swords;

    switch (gamePhase) {
      case 'PLACEMENT':
        statusDescription = 'Place your pawns on your designated color squares.';
        break;
      case 'MOVEMENT':
        if (selectedPawn) {
          statusDescription = `Pawn at ${String.fromCharCode(97 + selectedPawn.col)}${8 - selectedPawn.row} selected. Move to a valid square.`;
          IconComponent = Zap; // Icon for active selection/action
        } else {
          statusDescription = 'Select one of your pawns to move, or click and drag.';
        }
        break;
      default:
        statusDescription = 'Game is loading...';
    }
  }

  return (
    <div className={cn(
      "text-center mb-4 p-3 rounded-lg shadow-md border transition-all duration-300",
      winner ? "bg-[hsl(var(--highlight-win-line))] text-foreground" : "bg-card text-card-foreground",
      !winner && currentPlayer === 1 ? "border-[hsl(var(--player1-pawn-color))]" : "",
      !winner && currentPlayer === 2 ? "border-[hsl(var(--player2-pawn-color))]" : ""
    )}>
      <div className="flex items-center justify-center gap-2">
        <IconComponent size={22} className={cn(winner ? "text-foreground" : "text-[hsl(var(--primary))]")} />
        <h2 className="text-xl sm:text-2xl font-semibold">{statusText}</h2>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{statusDescription}</p>
    </div>
  );
};
