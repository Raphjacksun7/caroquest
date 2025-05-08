
import type { Player } from '@/types/game';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  const playerAccentColorVar = player === 1 ? '--player1-pawn-color' : '--player2-pawn-color'; // Can be different if desired

  return (
    <Card className={cn("shadow-lg", isCurrentPlayer && !winner ? 'ring-2 ring-offset-2 ring-[hsl(var(--primary))]' : '')}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-xl">
          <div className="flex items-center gap-2">
            <div 
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: `hsl(var(${playerPawnColorVar}))` }}
            ></div>
            {playerName} ({playerColorName})
          </div>
          {isCurrentPlayer && !winner && (
            <Badge variant="outline" className="border-[hsl(var(--primary))] text-[hsl(var(--primary))] animate-pulse">
              Your Turn
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Plays on {playerSquareColorName} squares.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <span>Pawns placed: {pawnsPlaced}/{maxPawns}</span>
          {winner === player && (
            <Badge style={{ backgroundColor: 'hsl(var(--highlight-win-line))', color: 'hsl(var(--foreground))' }} className="font-semibold">
              WINNER!
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
