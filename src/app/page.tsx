
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, PlayerId } from '@/lib/gameLogic';
import { 
  createInitialGameState, 
  placePawn,
  movePawn,
  highlightValidMoves, 
  clearHighlights,
  BOARD_SIZE, 
  PAWNS_PER_PLAYER
} from '@/lib/gameLogic';

import { GameBoard } from '@/components/game/GameBoard';
import { PlayerCard } from '@/components/game/PlayerCard';
import { ControlsCard } from '@/components/game/ControlsCard';
import { HistoryCard } from '@/components/game/HistoryCard';
import { RulesDialogContent } from '@/components/game/RulesDialog'; 
import { WinnerDialog } from '@/components/game/WinnerDialog';
import { StatusDisplay } from '@/components/game/StatusDisplay';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Dialog } from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/useTranslation';

export default function DiagonalDominationPage() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false);
  const { toast } = useToast();
  const { t, currentLanguage } = useTranslation();

  useEffect(() => {
    document.title = t('diagonalDomination');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('pageDescription'));
    }
     // Set html lang attribute
    document.documentElement.lang = currentLanguage;
  }, [t, currentLanguage]);

  useEffect(() => {
    if (gameState.winner) {
      toast({
        title: t('playerWins', { winner: gameState.winner }),
        description: t('congratulations'),
        duration: 5000,
      });
    }
  }, [gameState.winner, toast, t]);

  const handleSquareClick = useCallback((index: number) => {
    const { gamePhase, currentPlayerId, selectedPawnIndex, winner, board } = gameState;

    if (winner) return;

    let newGameState: GameState | null = null;

    if (gamePhase === 'placement') {
      newGameState = placePawn(gameState, index);
      if (!newGameState) {
        toast({ title: t('invalidPlacement'), description: t('invalidPlacementDescription'), variant: "destructive" });
      }
    } else { // movement phase
      if (selectedPawnIndex === null) { // No pawn selected, try to select one
        const square = board[index];
        if (square.pawn && square.pawn.playerId === currentPlayerId && !gameState.blockedPawnsInfo.has(index)) {
          newGameState = highlightValidMoves(gameState, index);
        } else if (square.pawn && square.pawn.playerId === currentPlayerId && gameState.blockedPawnsInfo.has(index)) {
          toast({ title: t('pawnBlocked'), description: t('pawnBlockedDescription'), variant: "destructive" });
        }
      } else { // A pawn is selected
        if (selectedPawnIndex === index) { // Clicked on already selected pawn
             newGameState = clearHighlights(gameState); // Deselect
        } else { // Attempting to move to a new square or select another pawn
            const targetSquare = board[index];
            if (targetSquare.highlight === 'validMove') { // If clicked on a valid move square
                newGameState = movePawn(gameState, selectedPawnIndex, index);
                if (!newGameState) { 
                     toast({ title: t('invalidMove'), description: t('invalidMoveDescription'), variant: "destructive" });
                     newGameState = clearHighlights(gameState); 
                }
            } else if (targetSquare.pawn && targetSquare.pawn.playerId === currentPlayerId && !gameState.blockedPawnsInfo.has(index)) {
                newGameState = highlightValidMoves(gameState, index);
            } else {
                toast({ title: t('invalidAction'), description: t('invalidActionDescription'), variant: "destructive" });
                newGameState = clearHighlights(gameState); 
            }
        }
      }
    }

    if (newGameState) {
      setGameState(newGameState);
    }
  }, [gameState, toast, t]);

  const resetGameHandler = useCallback(() => {
    setGameState(createInitialGameState());
    toast({ title: t('gameReset'), description: t('gameResetDescription')});
  }, [toast, t]);

  const handlePawnDragStart = useCallback((pawnIndex: number) => {
    const { gamePhase, currentPlayerId, winner, board, blockedPawnsInfo } = gameState;
    if (winner || gamePhase !== 'movement') return;

    const pawnSquare = board[pawnIndex];
    if (pawnSquare.pawn && pawnSquare.pawn.playerId === currentPlayerId && !blockedPawnsInfo.has(pawnSquare.index)) {
      setGameState(highlightValidMoves(gameState, pawnIndex));
    }
  }, [gameState]);

  const handlePawnDrop = useCallback((targetIndex: number) => {
    const { selectedPawnIndex, winner, board } = gameState;
    if (winner || selectedPawnIndex === null) {
      setGameState(clearHighlights(gameState));
      return;
    }
    
    const targetSquare = board[targetIndex];
    if (targetSquare.highlight === 'validMove') {
        const newGameState = movePawn(gameState, selectedPawnIndex, targetIndex);
        if (newGameState) {
          setGameState(newGameState);
        } else { 
          toast({ title: t('invalidDrop'), description: t('invalidDropDescription'), variant: "destructive" });
          setGameState(clearHighlights(gameState));
        }
    } else {
        toast({ title: t('invalidDrop'), description: t('invalidDropDescription'), variant: "destructive" });
        setGameState(clearHighlights(gameState));
    }
  }, [gameState, toast, t]);
  
  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-2 sm:p-4 selection:bg-[hsl(var(--primary))] selection:text-[hsl(var(--primary-foreground))]">
        <div className="w-full max-w-7xl mx-auto">
          <header className="mb-4 sm:mb-6 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-[hsl(var(--primary))] tracking-tight">
              {t('diagonalDomination')}
            </h1>
          </header>
          
          <StatusDisplay
            gameState={gameState}
           />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,_1fr)_auto_minmax(280px,_1fr)] gap-4 sm:gap-6 items-start mt-4">
            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
              <ControlsCard
                onReset={resetGameHandler}
                onOpenRules={() => setIsRulesDialogOpen(true)}
                pawnsPerPlayer={PAWNS_PER_PLAYER} 
                isGameActive={!gameState.winner}
              />
              <PlayerCard
                playerId={1}
                gameState={gameState}
              />
              <PlayerCard
                playerId={2}
                gameState={gameState}
              />
            </div>

            <div className="flex flex-col items-center justify-center">
              <GameBoard
                gameState={gameState}
                onSquareClick={handleSquareClick}
                onPawnDragStart={handlePawnDragStart}
                onPawnDrop={handlePawnDrop}
              />
            </div>

            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
               <HistoryCard gameState={gameState} />
            </div>
          </div>
        </div>
      </main>
      <Toaster />
      
      <Dialog open={isRulesDialogOpen} onOpenChange={setIsRulesDialogOpen}>
        <RulesDialogContent pawnsPerPlayer={PAWNS_PER_PLAYER}/>
      </Dialog>

      <WinnerDialog 
        winner={gameState.winner}
        isOpen={!!gameState.winner} 
        onOpenChange={(open) => { if (!open && gameState.winner) resetGameHandler(); }} 
        onPlayAgain={resetGameHandler}
      />
    </>
  );
}
