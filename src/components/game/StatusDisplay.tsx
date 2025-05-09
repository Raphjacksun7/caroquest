
"use client";

import type { PlayerId, GamePhase, GameState, SquareState } from '@/lib/gameLogic';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Swords, Hourglass, Flag, Zap, HelpCircleIcon } from 'lucide-react';
import { BOARD_SIZE } from '@/lib/gameLogic';

interface StatusDisplayProps {
  gamePhase: GamePhase;
  currentPlayerId: PlayerId;
  winner: PlayerId | null;
  selectedPawnIndex: number | null;
  board: SquareState[];
}

export const StatusDisplay = ({ gamePhase, currentPlayerId, winner, selectedPawnIndex, board }: StatusDisplayProps) => {
  let statusText = '';
  let statusDescription = '';
  let IconComponent = Hourglass;

  if (winner) {
    statusText = `Player ${winner} Wins!`;
    statusDescription = "Congratulations! The game has concluded.";
    IconComponent = Flag;
  } else {
    const playerColorName = currentPlayerId === 1 ? "Red (Light Sq.)" : "Blue (Dark Sq.)";
    statusText = `Player ${currentPlayerId}'s Turn (${playerColorName})`;
    IconComponent = Swords;

    switch (gamePhase) {
      case 'placement':
        statusDescription = 'Place your pawns on your designated color squares.';
        break;
      case 'movement':
        if (selectedPawnIndex !== null) {
          const selectedSquare = board[selectedPawnIndex];
          statusDescription = `Pawn at ${String.fromCharCode(97 + selectedSquare.col)}${BOARD_SIZE - selectedSquare.row} selected. Move to a valid square.`;
          IconComponent = Zap; 
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
      !winner && currentPlayerId === 1 ? "border-[hsl(var(--player1-pawn-color))]" : "",
      !winner && currentPlayerId === 2 ? "border-[hsl(var(--player2-pawn-color))]" : ""
    )}>
      <div className="flex items-center justify-center gap-2">
        <IconComponent size={22} className={cn(winner ? "text-foreground" : "text-[hsl(var(--primary))]")} />
        <h2 className="text-xl sm:text-2xl font-semibold">{statusText}</h2>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{statusDescription}</p>
    </div>
  );
};
