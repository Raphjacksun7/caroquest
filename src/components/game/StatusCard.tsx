
import type { Player, GamePhase } from '@/types/game';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoIcon } from 'lucide-react';

interface StatusCardProps {
  gamePhase: GamePhase;
  currentPlayer: Player;
  winner: Player | null;
  pawnsPerPlayer: number;
  selectedPawn: {row: number, col: number} | null;
}

export const StatusCard = ({ gamePhase, currentPlayer, winner, pawnsPerPlayer, selectedPawn }: StatusCardProps) => {
  let phaseText = '';
  let phaseDescription = '';

  switch (gamePhase) {
    case 'PLACEMENT':
      phaseText = 'Placement Phase';
      phaseDescription = `Place all ${pawnsPerPlayer} pawns. Click on an empty square of your color.`;
      break;
    case 'MOVEMENT':
      phaseText = 'Movement Phase';
      phaseDescription = selectedPawn 
        ? 'Click on a highlighted square to move your pawn.' 
        : 'Click on one of your pawns to select it.';
      break;
    case 'GAME_OVER':
      phaseText = 'Game Over';
      phaseDescription = winner ? `Player ${winner} has won!` : "The game has ended.";
      break;
    default:
      phaseText = 'Loading...';
      phaseDescription = 'Please wait while the game is being set up.';
  }
  
  const currentPlayerPawnColorVar = currentPlayer === 1 ? '--player1-pawn-color' : '--player2-pawn-color';

  return (
    <Card className="shadow-lg w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <InfoIcon size={20} className="text-[hsl(var(--primary))]"/>
          Game Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold mb-1 text-muted-foreground">Current Phase:</h3>
          <Badge variant="secondary" className="text-base">{phaseText}</Badge>
          <p className="text-xs text-muted-foreground mt-1">{phaseDescription}</p>
        </div>
        
        {!winner && (
          <div>
            <h3 className="text-sm font-semibold mb-1 text-muted-foreground">Current Turn:</h3>
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: `hsl(var(${currentPlayerPawnColorVar}))` }}
              ></div>
              <span className="font-medium">Player {currentPlayer} ({currentPlayer === 1 ? "Red" : "Blue"})</span>
            </div>
          </div>
        )}
        {winner && (
             <div className="font-semibold text-lg text-center py-2 rounded-md bg-[hsl(var(--highlight-win-line))] text-[hsl(var(--foreground))]">
                Player {winner} Wins!
             </div>
        )}
      </CardContent>
    </Card>
  );
};
