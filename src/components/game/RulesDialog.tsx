
"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { Lock, Shield, Zap } from 'lucide-react';

interface RulesDialogProps {
  pawnsPerPlayer: number; 
}

export const RulesDialog = ({ pawnsPerPlayer }: RulesDialogProps) => {
  const { t } = useTranslation();

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-lg shadow-xl">
      <DialogHeader className="mb-4">
        <DialogTitle className="text-2xl font-bold text-center text-primary">{t('gameRulesTitle')}</DialogTitle>
        <DialogDescription className="text-center text-muted-foreground">
          {t('learnHowToPlay')}
        </DialogDescription>
      </DialogHeader>
      
      <Tabs defaultValue="basics" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-4">
          <TabsTrigger value="basics">{t('rulesBasics')}</TabsTrigger>
          <TabsTrigger value="blocking">{t('rulesBlocking')}</TabsTrigger>
          <TabsTrigger value="winning">{t('rulesWinning')}</TabsTrigger>
          <TabsTrigger value="visuals">{t('rulesVisuals')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basics" className="space-y-4 text-sm">
          <h3 className="text-lg font-semibold text-foreground">{t('rulesBoardAndPieces')}</h3>
          <p>{t('rulesP1UsesLightP2UsesDark', { pawnsPerPlayer })}</p>
          
          <h3 className="text-lg font-semibold text-foreground">{t('rulesGamePhases')}</h3>
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>{t('rulesPlacementPhase')}</strong> {t('rulesPlacementDescription')}</li>
            <li><strong>{t('rulesMovementPhase')}</strong> {t('rulesMovementDescription')}</li>
          </ul>
        </TabsContent>
        
        <TabsContent value="blocking" className="space-y-4 text-sm">
          <h3 className="text-lg font-semibold text-foreground">{t('rulesBlockingMechanics')}</h3>
          <ul className="list-disc ml-5 space-y-1">
            <li>{t('rulesBlockingDescription1')}</li>
            <li>{t('rulesBlockingDescription2')}</li>
            <li>{t('rulesBlockingDescription3')}</li>
            <li>{t('rulesBlockingDescription4')}</li>
            <li>{t('rulesBlockingDescription5')}</li>
            <li>{t('rulesBlockingDescription6')}</li>
          </ul>
        </TabsContent>
        
        <TabsContent value="winning" className="space-y-4 text-sm">
          <h3 className="text-lg font-semibold text-foreground">{t('rulesWinningCondition')}</h3>
          <p>{t('rulesWinningDescription')}</p>
        </TabsContent>

        <TabsContent value="visuals" className="space-y-4 text-sm">
            <h3 className="text-lg font-semibold text-foreground">{t('rulesVisualCues')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-2 border-opacity-75 border-[hsl(var(--player1-pawn-color))]"></div> {t('player1Pawn')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player2-pawn-color))] border-2 border-opacity-75 border-[hsl(var(--player2-pawn-color))]"></div> {t('player2Pawn')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] opacity-60 border-2 border-[hsl(var(--player1-pawn-color))] relative flex items-center justify-center">
                      <Lock className="w-3 h-3 text-white"/>
                    </div> {t('blockedPawn')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-blocking-pawn-border))] relative flex items-center justify-center">
                        <Shield className="w-3 h-3 text-white"/>
                    </div> {t('pawnThatIsBlocking')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-creating-dead-zone-pawn-border))] relative flex items-center justify-center">
                      <Zap className="w-3 h-3 text-white"/>
                    </div> {t('pawnCreatingDeadZone')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-selected-pawn))]"></div> {t('selectedPawn')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-win-line))] animate-pulse"></div> {t('winningPawn')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-[hsl(var(--board-light-square))] flex items-center justify-center relative border border-muted">
                        <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--highlight-dead-zone-marker))] opacity-50 text-2xl font-bold pointer-events-none">×</div>
                    </div> {t('deadZoneSquare')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-[hsl(var(--board-light-square))] flex items-center justify-center relative border border-muted">
                        <div className="absolute w-2 h-2 bg-[hsl(var(--highlight-valid-move-indicator))] rounded-full opacity-70 pointer-events-none" />
                    </div> {t('validMoveSquare')}
                </div>
            </div>
        </TabsContent>
      </Tabs>
      <DialogFooter className="mt-6">
          <Button onClick={() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) (dialog as any).onOpenChange?.(false);
          }}>{t('close')}</Button>
      </DialogFooter>
    </DialogContent>
  );
};
    

    