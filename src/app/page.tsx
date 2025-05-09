
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, PlayerId, SquareState, Pawn as PawnType } from '@/lib/gameLogic';
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


export default function DiagonalDominationPage() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false);
  const [isWinnerDialogOpen, setIsWinnerDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (gameState.winner) {
      setIsWinnerDialogOpen(true);
      toast({
        title: `Player ${gameState.winner} Wins!`,
        description: "Congratulations on your strategic victory!",
        duration: 5000,
      });
    } else {
      setIsWinnerDialogOpen(false);
    }
  }, [gameState.winner, toast]);

  const handleSquareClick = useCallback((index: number) => {
    const { gamePhase, currentPlayerId, selectedPawnIndex, winner } = gameState;

    if (winner) return;

    let newGameState: GameState | null = null;

    if (gamePhase === 'placement') {
      newGameState = placePawn(gameState, index);
      if (!newGameState) {
        toast({ title: "Invalid Placement", description: "Cannot place pawn here. Check rules.", variant: "destructive" });
      }
    } else { // movement phase
      if (selectedPawnIndex === null) {
        const square = gameState.board[index];
        if (square.pawn && square.pawn.playerId === currentPlayerId && !gameState.blockedPawnsInfo.has(index)) {
          newGameState = highlightValidMoves(gameState, index);
        } else if (square.pawn && square.pawn.playerId === currentPlayerId && gameState.blockedPawnsInfo.has(index)) {
          toast({ title: "Pawn Blocked", description: "This pawn is blocked and cannot move.", variant: "destructive" });
        }
      } else {
        if (selectedPawnIndex === index) { // Clicked on already selected pawn
             newGameState = clearHighlights(gameState); // Deselect
        } else {
            newGameState = movePawn(gameState, selectedPawnIndex, index);
            if (!newGameState) {
                 // If move is invalid, but clicked on another of player's own non-blocked pawns, select that one
                const clickedSquare = gameState.board[index];
                if (clickedSquare.pawn && clickedSquare.pawn.playerId === currentPlayerId && !gameState.blockedPawnsInfo.has(index)) {
                    newGameState = highlightValidMoves(gameState, index);
                } else {
                    toast({ title: "Invalid Move", description: "Cannot move pawn there.", variant: "destructive" });
                    newGameState = clearHighlights(gameState); // Clear selection on invalid move to other square
                }
            }
        }
      }
    }

    if (newGameState) {
      setGameState(newGameState);
    }
  }, [gameState, toast]);

  const resetGameHandler = useCallback(() => {
    setGameState(createInitialGameState());
    setIsWinnerDialogOpen(false);
    toast({ title: "Game Reset", description: "A new game has started."});
  }, [toast]);

  const handlePawnDragStart = (pawnIndex: number) => {
    const { gamePhase, currentPlayerId, winner, board, blockedPawnsInfo } = gameState;
    if (winner || gamePhase !== 'movement') return;

    const pawnSquare = board[pawnIndex];
    if (pawnSquare.pawn && pawnSquare.pawn.playerId === currentPlayerId && !blockedPawnsInfo.has(pawnSquare.index)) {
      setGameState(highlightValidMoves(gameState, pawnIndex));
    }
  };

  const handlePawnDrop = (targetIndex: number) => {
    const { selectedPawnIndex, winner } = gameState;
    if (winner || selectedPawnIndex === null) {
      // If drop is not valid or no pawn selected, clear highlights
      setGameState(clearHighlights(gameState));
      return;
    }

    const newGameState = movePawn(gameState, selectedPawnIndex, targetIndex);
    if (newGameState) {
      setGameState(newGameState);
    } else {
      toast({ title: "Invalid Move", description: "Cannot drop pawn there.", variant: "destructive" });
      // Clear highlights if drop was invalid
      setGameState(clearHighlights(gameState));
    }
  };
  
  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-2 sm:p-4 selection:bg-[hsl(var(--primary))] selection:text-[hsl(var(--primary-foreground))]">
        <div className="w-full max-w-7xl mx-auto">
          <header className="mb-4 sm:mb-6 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-[hsl(var(--primary))] tracking-tight">
              Diagonal Domination
            </h1>
          </header>
          
          <StatusDisplay
            gamePhase={gameState.gamePhase}
            currentPlayerId={gameState.currentPlayerId}
            winner={gameState.winner}
            selectedPawnIndex={gameState.selectedPawnIndex}
            board={gameState.board} // Pass board for context if needed by StatusDisplay
           />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,_1fr)_auto_minmax(280px,_1fr)] gap-4 sm:gap-6 items-start mt-4">
            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
              <ControlsCard
                onReset={resetGameHandler}
                onOpenRules={() => setIsRulesDialogOpen(true)}
                pawnsPerPlayer={PAWNS_PER_PLAYER} 
                onPawnsChange={() => {}} 
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
        isOpen={isWinnerDialogOpen}
        onOpenChange={setIsWinnerDialogOpen}
        onPlayAgain={resetGameHandler}
      />
    </>
  );
}
