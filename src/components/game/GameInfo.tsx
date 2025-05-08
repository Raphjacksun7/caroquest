
import type { Player, GamePhase, PlayerAssignedColors } from '@/types/game';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GameInfoProps {
  currentPlayer: Player;
  gamePhase: GamePhase;
  winner: Player | null;
  playerAssignedColors: PlayerAssignedColors;
  pawnsPlaced: { [key in Player]: number };
  maxPawns: number;
}

export const GameInfo = ({ currentPlayer, gamePhase, winner, playerAssignedColors, pawnsPlaced, maxPawns }: GameInfoProps) => {
  let statusText = '';
  let playerColorIndicatorStyle = {};

  if (winner) {
    statusText = `Player ${winner} Wins!`;
  } else if (gamePhase === 'PLAYER_SETUP') {
    statusText = 'Setting up game...';
  } else if (gamePhase === 'PLACEMENT') {
    statusText = `Placement Phase: Player ${currentPlayer}'s turn.`;
    statusText += ` (Pawns placed: ${pawnsPlaced[currentPlayer]}/${maxPawns})`;
  } else if (gamePhase === 'MOVEMENT') {
    statusText = `Movement Phase: Player ${currentPlayer}'s turn.`;
  } else if (gamePhase === 'GAME_OVER') {
    statusText = `Game Over. ${winner ? `Player ${winner} won!` : 'It\'s a draw!'}`;
  }
  
  const currentPlayerColorHSL = currentPlayer === 1 ? 'var(--player1-pawn-color)' : 'var(--player2-pawn-color)';
  playerColorIndicatorStyle = {
      borderColor: `hsl(${currentPlayerColorHSL})`,
      color: `hsl(${currentPlayerColorHSL})`,
  };


  return (
    <Card className="mb-6 w-full max-w-md shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-center text-3xl font-bold text-[hsl(var(--primary))]">Diagonal Domination</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-lg font-semibold mb-2 transition-colors duration-300" style={!winner ? playerColorIndicatorStyle : {}}>
          {statusText}
        </p>
        <div className="flex justify-around text-sm mt-2">
            <div>
                <span className="font-semibold" style={{color: 'hsl(var(--player1-pawn-color))'}}>Player 1:</span> {playerAssignedColors.player1} squares
                {gamePhase === 'PLACEMENT' && <Badge variant="secondary" className="ml-2">{pawnsPlaced[1]}/{maxPawns}</Badge>}
            </div>
            <div>
                <span className="font-semibold" style={{color: 'hsl(var(--player2-pawn-color))'}}>Player 2:</span> {playerAssignedColors.player2} squares
                {gamePhase === 'PLACEMENT' && <Badge variant="secondary" className="ml-2">{pawnsPlaced[2]}/{maxPawns}</Badge>}
            </div>
        </div>
        {gamePhase !== 'PLAYER_SETUP' && gamePhase !== 'GAME_OVER' && (
          <p className="mt-2 text-xs text-muted-foreground">
            {gamePhase === 'PLACEMENT' ? 'Click on an empty square of your color to place a pawn.' : 'Click your pawn, then an empty square of your color to move.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
