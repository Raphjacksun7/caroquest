
import type { Player, GamePhase, SquareColorType } from '@/types/game';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GameInfoProps {
  currentPlayer: Player;
  gamePhase: GamePhase;
  winner: Player | null;
  pawnsPlaced: { [key in Player]: number };
  maxPawns: number;
  getPlayerSquareColor: (player: Player) => SquareColorType;
}

export const GameInfo = ({ currentPlayer, gamePhase, winner, pawnsPlaced, maxPawns, getPlayerSquareColor }: GameInfoProps) => {
  let statusText = '';
  
  const player1SquareColor = getPlayerSquareColor(1);
  const player2SquareColor = getPlayerSquareColor(2);

  if (winner) {
    statusText = `Player ${winner} (${winner === 1 ? "Red" : "Blue"}) Wins!`;
  } else if (gamePhase === 'PLAYER_SETUP') {
    statusText = 'Setting up game...';
  } else if (gamePhase === 'PLACEMENT') {
    statusText = `Placement: Player ${currentPlayer} (${currentPlayer === 1 ? "Red" : "Blue"})'s turn.`;
  } else if (gamePhase === 'MOVEMENT') {
    statusText = `Movement: Player ${currentPlayer} (${currentPlayer === 1 ? "Red" : "Blue"})'s turn.`;
  } else if (gamePhase === 'GAME_OVER') {
    statusText = `Game Over. ${winner ? `Player ${winner} (${winner === 1 ? "Red" : "Blue"}) won!` : 'It\'s a draw!'}`;
  }
  
  const currentPlayerColorHSL = currentPlayer === 1 ? 'var(--player1-pawn-color)' : 'var(--player2-pawn-color)';
  const playerIndicatorStyle = !winner ? {
      borderColor: `hsl(${currentPlayerColorHSL})`,
      color: `hsl(${currentPlayerColorHSL})`,
      borderWidth: '2px',
      borderStyle: 'solid',
      padding: '0.25rem 0.5rem',
      borderRadius: 'var(--radius)',
      display: 'inline-block',
  } : {};


  return (
    <Card className="mb-6 w-full max-w-md shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-center text-3xl font-bold text-[hsl(var(--primary))]">Diagonal Domination</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-lg font-semibold mb-3 transition-colors duration-300" style={playerIndicatorStyle}>
          {statusText}
        </p>
        <div className="flex justify-around text-sm mt-2">
            <div>
                <span className="font-semibold" style={{color: 'hsl(var(--player1-pawn-color))'}}>Player 1 (Red):</span> {player1SquareColor} squares
                {(gamePhase === 'PLACEMENT' || gamePhase === 'MOVEMENT') && <Badge variant="secondary" className="ml-2">{pawnsPlaced[1]}/{maxPawns}</Badge>}
            </div>
            <div>
                <span className="font-semibold" style={{color: 'hsl(var(--player2-pawn-color))'}}>Player 2 (Blue):</span> {player2SquareColor} squares
                {(gamePhase === 'PLACEMENT' || gamePhase === 'MOVEMENT') && <Badge variant="secondary" className="ml-2">{pawnsPlaced[2]}/{maxPawns}</Badge>}
            </div>
        </div>
         {gamePhase !== 'PLAYER_SETUP' && gamePhase !== 'GAME_OVER' && (
          <p className="mt-3 text-xs text-muted-foreground">
            {gamePhase === 'PLACEMENT' ? `Place pawns on empty ${getPlayerSquareColor(currentPlayer)} squares.` : `Move your pawn to an empty ${getPlayerSquareColor(currentPlayer)} square.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
