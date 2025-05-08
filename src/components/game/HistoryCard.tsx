
import type { GameHistoryEntry } from '@/types/game';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HistoryCardProps {
  gameHistory: GameHistoryEntry[];
}

export const HistoryCard = ({ gameHistory }: HistoryCardProps) => {
  if (gameHistory.length === 0) {
    return (
        <Card className="shadow-lg">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl">Game History</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">No moves made yet.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Game History</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-40 w-full">
          <div className="space-y-1 pr-4">
            {gameHistory.slice().reverse().map((move, index) => {
              const playerPawnColorVar = move.player === 1 ? '--player1-pawn-color' : '--player2-pawn-color';
              const actionDescription = move.action === 'place' 
                ? `placed at ${String.fromCharCode(97 + move.to.col)}${BOARD_SIZE - move.to.row}` 
                : `moved from ${String.fromCharCode(97 + (move.from?.col ?? 0))}${BOARD_SIZE - (move.from?.row ?? 0)} to ${String.fromCharCode(97 + move.to.col)}${BOARD_SIZE - move.to.row}`;
              
              return (
                <div key={gameHistory.length - 1 - index} className="flex items-center gap-2 text-xs py-1 border-b border-border last:border-b-0">
                  <span className="font-mono w-6 text-muted-foreground">#{gameHistory.length - index}</span>
                  <div 
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: `hsl(var(${playerPawnColorVar}))` }}
                  ></div>
                  <span className="flex-grow">Player {move.player} {actionDescription}</span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Add BOARD_SIZE to be accessible, ideally from config
const BOARD_SIZE = 8;
