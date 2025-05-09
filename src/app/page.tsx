
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, PlayerId } from '@/lib/gameLogic';
import { 
  createInitialGameState, 
  placePawn,
  movePawn,
  highlightValidMoves, 
  clearHighlights,
  BOARD_SIZE, // Keep if needed by UI elements not in gameLogic
  PAWNS_PER_PLAYER // Keep if needed by UI elements not in gameLogic
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
  // Winner dialog is now controlled by gameState.winner directly in WinnerDialog component
  const { toast } = useToast();

  useEffect(() => {
    if (gameState.winner) {
      toast({
        title: `Player ${gameState.winner} Wins!`,
        description: "Congratulations on your strategic victory!",
        duration: 5000,
      });
    }
  }, [gameState.winner, toast]);

  const handleSquareClick = useCallback((index: number) => {
    const { gamePhase, currentPlayerId, selectedPawnIndex, winner, board } = gameState;

    if (winner) return;

    let newGameState: GameState | null = null;

    if (gamePhase === 'placement') {
      newGameState = placePawn(gameState, index);
      if (!newGameState) {
        toast({ title: "Invalid Placement", description: "Cannot place pawn here. Ensure the square is of your color, not occupied, not a restricted zone, and not a dead zone for you.", variant: "destructive" });
      }
    } else { // movement phase
      if (selectedPawnIndex === null) { // No pawn selected, try to select one
        const square = board[index];
        if (square.pawn && square.pawn.playerId === currentPlayerId && !gameState.blockedPawnsInfo.has(index)) {
          newGameState = highlightValidMoves(gameState, index);
        } else if (square.pawn && square.pawn.playerId === currentPlayerId && gameState.blockedPawnsInfo.has(index)) {
          toast({ title: "Pawn Blocked", description: "This pawn is blocked and cannot move.", variant: "destructive" });
        }
      } else { // A pawn is selected
        if (selectedPawnIndex === index) { // Clicked on already selected pawn
             newGameState = clearHighlights(gameState); // Deselect
        } else { // Attempting to move to a new square or select another pawn
            const targetSquare = board[index];
            if (targetSquare.highlight === 'validMove') { // If clicked on a valid move square
                newGameState = movePawn(gameState, selectedPawnIndex, index);
                if (!newGameState) { // Should ideally not happen if highlight is 'validMove' and logic is correct
                     toast({ title: "Invalid Move", description: "Cannot move pawn there. Please check rules.", variant: "destructive" });
                     newGameState = clearHighlights(gameState); 
                }
            } else if (targetSquare.pawn && targetSquare.pawn.playerId === currentPlayerId && !gameState.blockedPawnsInfo.has(index)) {
                // Clicked on another of player's own non-blocked pawns, select that one
                newGameState = highlightValidMoves(gameState, index);
            } else {
                // Clicked on an invalid square (e.g., opponent's pawn, empty non-valid square)
                toast({ title: "Invalid Action", description: "Cannot move there or invalid selection.", variant: "destructive" });
                newGameState = clearHighlights(gameState); // Clear selection
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
    toast({ title: "Game Reset", description: "A new game has started."});
  }, [toast]);

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
        } else { // Should not happen if highlight is validMove
          toast({ title: "Invalid Move", description: "Cannot drop pawn there.", variant: "destructive" });
          setGameState(clearHighlights(gameState));
        }
    } else {
        toast({ title: "Invalid Drop", description: "Cannot drop pawn on this square.", variant: "destructive" });
        setGameState(clearHighlights(gameState));
    }
  }, [gameState, toast]);
  
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
            board={gameState.board} 
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
        isOpen={!!gameState.winner} // Control directly by winner state
        onOpenChange={(open) => { if (!open && gameState.winner) resetGameHandler(); }} // Reset if dialog is closed after win
        onPlayAgain={resetGameHandler}
      />
    </>
  );
}
