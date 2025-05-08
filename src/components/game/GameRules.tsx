
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const GameRules = () => {
  return (
    <Card className="mt-8 w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-xl font-semibold">Game Rules</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Player 1 (Red) plays on Light squares. Player 2 (Blue) plays on Dark squares.</li>
          <li><strong>Placement Phase:</strong> Players take turns placing one pawn at a time on any empty square of their assigned color until all pawns are placed.</li>
          <li><strong>Movement Phase:</strong> Players take turns moving one of their pawns to any empty square of their assigned color.</li>
          <li><strong>Winning:</strong> Be the first to align 4 of your pawns diagonally.</li>
          <li><strong>Blocked Pawns:</strong> A pawn is blocked if it's horizontally "sandwiched" between two of the opponent's pawns (e.g., O-X-O). Blocked pawns (X) cannot move and cannot be part of a winning line.</li>
          <li><strong>Blocking Pawns:</strong> Pawns that form the "sandwich" (O) also cannot be part of a winning line.</li>
          <li><strong>Dead Zones:</strong> If a player has two of their own pawns on their colored squares horizontally separated by one empty square of their color (e.g., P - P), that empty square becomes a "dead zone" for the OPPONENT. The opponent cannot use that dead zone square as part of their winning diagonal line. (Indicated by an 'X' on empty squares).</li>
        </ul>
      </CardContent>
    </Card>
  );
};
