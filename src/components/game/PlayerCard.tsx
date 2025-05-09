
"use client";

import type { PlayerId, GameState } from '@/lib/gameLogic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PlayerCardProps {
  playerId: PlayerId;
  gameState: GameState;
}

export const PlayerCard = ({ playerId, gameState }: PlayerCardProps) => {
  const { currentPlayerId, playerColors, pawnsToPlace, placedPawns, gamePhase, winner } = gameState;

  const playerName = `Player ${playerId}`;
  const playerAssignedColorName = playerColors[playerId] === 'light' ? "Light" : "Dark";
  const playerPawnColorVar = playerId === 1 ? '--player1-pawn-color' : '--player2-pawn-color';
  const isCurrent = currentPlayerId === playerId && !winner;
  
  const pawnsInfo = gamePhase === 'placement' 
    ? `${pawnsToPlace[playerId]} to place`
    : `${placedPawns[playerId]} on board`;

  return (
    <Card className={cn(
        "shadow-lg transition-all duration-300", 
        isCurrent ? 'ring-4 ring-offset-2 ring-[hsl(var(--primary))] shadow-primary/30' : 'ring-1 ring-border',
        winner === playerId ? 'bg-green-50 border-[hsl(var(--highlight-win-line))]' : '',
        winner && winner !== playerId ? 'opacity-70' : ''
      )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-xl">
          <div className="flex items-center gap-3">
            <div 
              className="w-6 h-6 rounded-full shadow-inner"
              style={{ backgroundColor: `hsl(var(${playerPawnColorVar}))` }}
            ></div>
            {playerName} ({playerColors[playerId] === 'light' ? 'Red' : 'Blue'})
          </div>
          {isCurrent && (
            <Badge variant="outline" className="border-[hsl(var(--primary))] text-[hsl(var(--primary))] animate-pulse px-3 py-1 text-xs">
              YOUR TURN
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Plays on {playerAssignedColorName} squares.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{pawnsInfo}</span>
          {winner === playerId && (
            <Badge style={{ backgroundColor: 'hsl(var(--highlight-win-line))', color: 'hsl(var(--foreground))' }} className="font-semibold text-base px-3 py-1">
              WINNER!
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
