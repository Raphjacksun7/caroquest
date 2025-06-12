
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { History } from 'lucide-react';
import { BOARD_SIZE } from '@/lib/gameLogic';
import { useTranslation } from '@/hooks/useTranslation';
import { GameState } from '@/lib/types';

interface HistoryCardProps {
  gameState: GameState;
}

export const HistoryCard = ({ gameState }: HistoryCardProps) => {
  const { t } = useTranslation();
  const { lastMove, board } = gameState;

  if (!lastMove) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
              <History size={20} className="text-[hsl(var(--primary))]"/>
              {t('lastMove')}
          </CardTitle>
          <CardDescription>{t('noMovesYet')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { from, to } = lastMove;
  const toSquare = board[to];
  const toCoord = `${String.fromCharCode(97 + toSquare.col)}${BOARD_SIZE - toSquare.row}`;
  const movedPawn = board[to]?.pawn; 
  
  let actionDescription = "";
  if (movedPawn) {
    const playerPawnColorVar = movedPawn.playerId === 1 ? '--player1-pawn-color' : '--player2-pawn-color';
    if (from === null) { // Placement
      actionDescription = t('playerPlacedAt', { id: movedPawn.playerId, coord: toCoord });
    } else { // Movement
      const fromSquare = board[from]; 
      const fromCoord = `${String.fromCharCode(97 + fromSquare.col)}${BOARD_SIZE - fromSquare.row}`;
      actionDescription = t('playerMovedFromTo', { id: movedPawn.playerId, fromCoord, toCoord });
    }

    return (
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
              <History size={20} className="text-[hsl(var(--primary))]"/>
              {t('lastMove')}
          </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-2.5 text-sm py-1.5 px-2 rounded-sm">
                <div 
                    className="w-3.5 h-3.5 rounded-full shrink-0 border-2 border-background shadow-sm"
                    style={{ backgroundColor: `hsl(var(${playerPawnColorVar}))` }}
                ></div>
                <span className="flex-grow text-foreground/90">{actionDescription}</span>
            </div>
        </CardContent>
      </Card>
    );
  }
  return null; 
};
