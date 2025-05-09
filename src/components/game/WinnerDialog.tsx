
"use client";

import type { PlayerId } from '@/lib/gameLogic';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card'; 
import { Award } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface WinnerDialogProps {
  winner: PlayerId | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayAgain: () => void;
}

export const WinnerDialog = ({ winner, isOpen, onOpenChange, onPlayAgain }: WinnerDialogProps) => {
  const { t } = useTranslation();

  if (!isOpen || !winner) return null;

  const winnerColorVar = winner === 1 ? '--player1-pawn-color' : '--player2-pawn-color';
  const winnerName = winner === 1 ? t('redPawns') : t('bluePawns');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 rounded-lg shadow-xl">
        <Card className="border-0">
            <DialogHeader className="p-6 pb-4">
                <DialogTitle className="flex flex-col items-center text-center text-2xl font-bold">
                <Award style={{ color: `hsl(var(${winnerColorVar}))` }} size={48} className="mb-3" />
                {t('playerWins', { winner })} ({winnerName})
                </DialogTitle>
                <DialogDescription className="text-center pt-2">
                {t('congratulations')}
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="p-6 pt-4 bg-muted/50 rounded-b-lg">
                <Button onClick={() => { onPlayAgain(); onOpenChange(false); }} className="w-full" size="lg">
                    {t('playAgain')}
                </Button>
            </DialogFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
};
