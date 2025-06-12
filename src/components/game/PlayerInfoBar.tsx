"use client";

import type { GameState, PlayerId } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CircleSmall } from 'lucide-react';

// FIX: The props interface is now corrected to accept individual properties.
interface PlayerInfoBarProps {
  playerName: string;
  playerId: PlayerId;
  isOpponent: boolean;
  isCurrentTurn: boolean;
  gameState: GameState;
}

export const PlayerInfoBar: React.FC<PlayerInfoBarProps> = ({ 
  playerName, 
  playerId, 
  isOpponent, 
  isCurrentTurn, 
  gameState 
}) => {
  const pawnsToPlace = gameState.gamePhase === 'placement' ? gameState.pawnsToPlace[playerId] : 0;
  const playerColorName = playerId === 1 ? 'Red' : 'Blue';
  const playerColorClass = playerId === 1 ? 'text-red-500' : 'text-blue-500';
  
  return (
    <div className={`w-full max-w-2xl p-3 bg-card/50 rounded-lg transition-all duration-300 ${isCurrentTurn ? 'ring-2 ring-primary shadow-lg' : 'opacity-70'}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={`https://api.dicebear.com/8.x/bottts/svg?seed=${playerName}`} alt={playerName} />
            <AvatarFallback>{playerName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-bold text-lg text-foreground">{playerName} {!isOpponent && '(You)'}</p>
            <p className={`text-sm font-medium ${playerColorClass}`}>{playerColorName}</p>
          </div>
        </div>

        {gameState.gamePhase === 'placement' && (
          <div className="flex items-center gap-2 text-foreground">
            <CircleSmall className="h-5 w-5" />
            <span className="font-mono text-lg font-semibold">{pawnsToPlace}</span>
            <span className="text-sm text-muted-foreground">to place</span>
          </div>
        )}
      </div>
    </div>
  );
};