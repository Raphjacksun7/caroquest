
"use client";

import type { PlayerId, GameState } from '@/lib/gameLogic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface PlayerCardProps {
  playerId: PlayerId;
  playerName: string; // Added playerName
  isLocalPlayer: boolean; // Added to indicate if this card represents the local player
  gameState: GameState;
}

export const PlayerCard = ({ playerId, playerName, isLocalPlayer, gameState }: PlayerCardProps) => {
  const { t } = useTranslation();
  const { currentPlayerId, playerColors, pawnsToPlace, placedPawns, gamePhase, winner } = gameState;
  
  const playerAssignedColorName = playerColors[playerId] === 'light' 
    ? t('lightSquares') 
    : t('darkSquares');
  
  const playerPawnColorName = playerId === 1 ? t('redPawns') : t('bluePawns');

  const playerPawnColorVar = playerId === 1 ? '--player1-pawn-color' : '--player2-pawn-color';
  const isCurrentTurn = currentPlayerId === playerId && !winner;
  
  const pawnsInfo = gamePhase === 'placement' 
    ? t('pawnsToPlace', { count: pawnsToPlace[playerId] })
    : t('pawnsOnBoard', { count: placedPawns[playerId] });

  return (
    <Card className={cn(
        "shadow-lg transition-all duration-300", 
        isCurrentTurn ? 'ring-4 ring-offset-2 ring-[hsl(var(--primary))] shadow-primary/30' : 'ring-1 ring-border',
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
            {playerName} {isLocalPlayer && `(${t('you')})`} ({playerPawnColorName})
          </div>
          {isCurrentTurn && (
            <Badge variant="outline" className="border-[hsl(var(--primary))] text-[hsl(var(--primary))] animate-pulse px-3 py-1 text-xs">
              {t('yourTurn')}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{t('playsOnColorSquares', { color: playerAssignedColorName.toLowerCase() })}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{pawnsInfo}</span>
          {winner === playerId && (
            <Badge style={{ backgroundColor: 'hsl(var(--highlight-win-line))', color: 'hsl(var(--foreground))' }} className="font-semibold text-base px-3 py-1">
              {t('winnerExclamation')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
