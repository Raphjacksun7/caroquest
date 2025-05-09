"use client";

import type { Player } from '@/types/game';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { UserCircle2 } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  pawnsPlaced: number;
  maxPawns: number;
  isCurrentPlayer: boolean;
  winner: Player | null;
}

export const PlayerCard = ({ player, pawnsPlaced, maxPawns, isCurrentPlayer, winner }: PlayerCardProps) => {
  const playerName = player === 1 ? "Player 1" : "Player 2";
  const playerColorName = player === 1 ? "Red" : "Blue";
  const playerSquareColorName = player === 1 ? "Light" : "Dark";
  const playerPawnColorVar = player === 1 ? '--player1-pawn-color' : '--player2-pawn-color';
  
  return (
    <Card className={cn(
        "shadow-lg transition-all duration-300", 
        isCurrentPlayer && !winner ? 'ring-4 ring-offset-2 ring-[hsl(var(--primary))] shadow-primary/30' : 'ring-1 ring-border',
        winner === player ? 'bg-green-50 border-[hsl(var(--highlight-win-line))]' : '',
        winner && winner !== player ? 'opacity-70' : ''
      )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-xl">
          <div className="flex items-center gap-3">
            <div 
              className="w-6 h-6 rounded-full shadow-inner"
              style={{ backgroundColor: `hsl(var(${playerPawnColorVar}))` }}
            ></div>
            {playerName} ({playerColorName})
          </div>
          {isCurrentPlayer && !winner && (
            <Badge variant="outline" className="border-[hsl(var(--primary))] text-[hsl(var(--primary))] animate-pulse px-3 py-1 text-xs">
              YOUR TURN
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Plays on {playerSquareColorName} squares.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pawns on board: {pawnsPlaced}/{maxPawns}</span>
          {winner === player && (
            <Badge style={{ backgroundColor: 'hsl(var(--highlight-win-line))', color: 'hsl(var(--foreground))' }} className="font-semibold text-base px-3 py-1">
              WINNER!
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
