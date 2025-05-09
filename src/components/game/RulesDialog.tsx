
"use client";

import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/useTranslation';

interface RulesDialogProps {
  pawnsPerPlayer: number; 
}

export const RulesDialogContent = ({ pawnsPerPlayer }: RulesDialogProps) => {
  const { t } = useTranslation();

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-lg shadow-xl">
      <DialogHeader className="mb-4">
        <DialogTitle className="text-2xl font-bold text-center text-[hsl(var(--primary))]">{t('gameRulesTitle')}</DialogTitle>
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
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">{t('rulesBoardAndPieces')}</h3>
          <p>{t('rulesP1UsesLightP2UsesDark', { pawnsPerPlayer })}</p>
          
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">{t('rulesGamePhases')}</h3>
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>{t('rulesPlacementPhase')}</strong> {t('rulesPlacementDescription')}</li>
            <li><strong>{t('rulesMovementPhase')}</strong> {t('rulesMovementDescription')}</li>
          </ul>
        </TabsContent>
        
        <TabsContent value="blocking" className="space-y-4 text-sm">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">{t('rulesBlockingMechanics')}</h3>
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
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">{t('rulesWinningCondition')}</h3>
          <p>{t('rulesWinningDescription')}</p>
        </TabsContent>

        <TabsContent value="visuals" className="space-y-4 text-sm">
            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">{t('rulesVisualCues')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-2 border-opacity-75 border-[hsl(var(--player1-pawn-color))]"></div> {t('player1Pawn')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player2-pawn-color))] border-2 border-opacity-75 border-[hsl(var(--player2-pawn-color))]"></div> {t('player2Pawn')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] opacity-60 border-2 border-[hsl(var(--player1-pawn-color))] relative">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div> {t('blockedPawn')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-blocking-pawn-border))] relative">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                    </div> {t('pawnThatIsBlocking')}
                </div>
                 <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-creating-dead-zone-pawn-border))]"></div> {t('pawnCreatingDeadZone')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-selected-pawn))]"></div> {t('selectedPawn')}
                </div>
                <div className="flex items-center gap-2">
                     <div className="w-5 h-5 rounded-full bg-[hsl(var(--player1-pawn-color))] border-4 border-[hsl(var(--highlight-win-line))] animate-pulse"></div> {t('winningPawn')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-[hsl(var(--board-light-square))] flex items-center justify-center relative">
                        <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--highlight-dead-zone))] opacity-50 text-2xl font-bold pointer-events-none">×</div>
                    </div> {t('deadZoneSquare')}
                </div>
                 <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-[hsl(var(--board-light-square))] flex items-center justify-center relative">
                         <div className="absolute w-2 h-2 bg-[hsl(var(--highlight-valid-move))] rounded-full opacity-70 pointer-events-none" />
                    </div> {t('validMoveSquare')}
                </div>
            </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
};
