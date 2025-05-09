"use client";

import type { GameHistoryEntry } from '@/types/game';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History } from 'lucide-react'; // Using History icon
import { BOARD_SIZE } from '@/config/game';

interface HistoryCardProps {
  gameHistory: GameHistoryEntry[];
}

export const HistoryCard = ({ gameHistory }: HistoryCardProps) => {
  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
            <History size={20} className="text-[hsl(var(--primary))]"/>
            Game History
        </CardTitle>
        {gameHistory.length === 0 && (
            <CardDescription>No moves made yet.</CardDescription>
        )}
      </CardHeader>
      {gameHistory.length > 0 && (
        <CardContent>
          <ScrollArea className="h-64 w-full pr-1"> {/* Increased height */}
            <div className="space-y-2">
              {gameHistory.map((move, index) => { // Already reversed in hook
                const playerPawnColorVar = move.player === 1 ? '--player1-pawn-color' : '--player2-pawn-color';
                const actionDescription = move.action === 'place' 
                  ? `placed at ${String.fromCharCode(97 + move.to.col)}${BOARD_SIZE - move.to.row}` 
                  : `moved from ${String.fromCharCode(97 + (move.from?.col ?? 0))}${BOARD_SIZE - (move.from?.row ?? 0)} to ${String.fromCharCode(97 + move.to.col)}${BOARD_SIZE - move.to.row}`;
                
                return (
                  <div 
                    key={index} 
                    className="flex items-center gap-2.5 text-xs py-1.5 px-2 border-b border-border last:border-b-0 rounded-sm hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-mono w-7 text-muted-foreground">#{gameHistory.length - index}</span>
                    <div 
                      className="w-3.5 h-3.5 rounded-full shrink-0 border-2 border-background shadow-sm"
                      style={{ backgroundColor: `hsl(var(${playerPawnColorVar}))` }}
                    ></div>
                    <span className="flex-grow text-foreground/90">Player {move.player} {actionDescription}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
};
