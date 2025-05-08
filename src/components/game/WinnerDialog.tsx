
import type { Player } from '@/types/game';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card'; // Card can be used inside Dialog for styling
import { Award } from 'lucide-react';

interface WinnerDialogProps {
  winner: Player | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayAgain: () => void;
}

export const WinnerDialog = ({ winner, isOpen, onOpenChange, onPlayAgain }: WinnerDialogProps) => {
  if (!isOpen || !winner) return null;

  const winnerColorVar = winner === 1 ? '--player1-pawn-color' : '--player2-pawn-color';
  const winnerName = winner === 1 ? "Red" : "Blue";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 rounded-lg shadow-xl">
        <Card className="border-0">
            <DialogHeader className="p-6 pb-4">
                <DialogTitle className="flex flex-col items-center text-center text-2xl font-bold">
                <Award style={{ color: `hsl(var(${winnerColorVar}))` }} size={48} className="mb-3" />
                Player {winner} ({winnerName}) Wins!
                </DialogTitle>
                <DialogDescription className="text-center pt-2">
                Congratulations on your strategic victory!
                </DialogDescription>
            </DialogHeader>
            {/* Optional: CardContent for more details if needed */}
            <DialogFooter className="p-6 pt-4 bg-muted/50 rounded-b-lg">
                <Button onClick={() => { onPlayAgain(); onOpenChange(false); }} className="w-full" size="lg">
                    Play Again
                </Button>
            </DialogFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
};
