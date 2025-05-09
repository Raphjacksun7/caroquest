"use client";

import React, { useState, useEffect } from 'react';
import { GameBoard } from '@/components/game/GameBoard';
import { PlayerCard } from '@/components/game/PlayerCard';
import { ControlsCard } from '@/components/game/ControlsCard';
import { HistoryCard } from '@/components/game/HistoryCard';
import { StatusDisplay } from '@/components/game/StatusDisplay';
import { RulesDialogContent } from '@/components/game/RulesDialog';
import { WinnerDialog } from '@/components/game/WinnerDialog';
import { useDiagonalDomination } from '@/hooks/useDiagonalDomination';
import { Toaster } from "@/components/ui/toaster";
import { Dialog } from '@/components/ui/dialog';
import { DndProvider } from 'react-dnd'; // If using react-dnd
import { HTML5Backend } from 'react-dnd-html5-backend'; // If using react-dnd

export default function DiagonalDominationPage() {
  const {
    board,
    currentPlayer,
    gamePhase,
    pawnsPlaced,
    selectedPawn,
    winner,
    winningLine,
    handleSquareClick,
    resetGame,
    pawnsPerPlayer,
    changePawnsPerPlayerCount,
    deadZones,
    gameHistory,
    validMoves,
    handlePawnDragStart,
    handlePawnDrop,
  } = useDiagonalDomination();

  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false);
  const [isWinnerDialogOpen, setIsWinnerDialogOpen] = useState(false);

  useEffect(() => {
    if (winner) {
      setIsWinnerDialogOpen(true);
    } else {
      setIsWinnerDialogOpen(false);
    }
  }, [winner]);

  // For HTML5 Drag and Drop, context is implicit. For react-dnd, wrap with DndProvider.
  // We will use HTML5 Drag and Drop API first.

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
              gamePhase={gamePhase}
              currentPlayer={currentPlayer}
              winner={winner}
              selectedPawn={selectedPawn}
           />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,_1fr)_auto_minmax(280px,_1fr)] gap-4 sm:gap-6 items-start mt-4">
            {/* Left Column */}
            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
              <ControlsCard
                pawnsPerPlayer={pawnsPerPlayer}
                onPawnsChange={changePawnsPerPlayerCount}
                onReset={resetGame}
                onOpenRules={() => setIsRulesDialogOpen(true)}
              />
              <PlayerCard
                player={1}
                pawnsPlaced={pawnsPlaced[1]}
                maxPawns={pawnsPerPlayer}
                isCurrentPlayer={currentPlayer === 1 && !winner}
                winner={winner}
              />
              <PlayerCard
                player={2}
                pawnsPlaced={pawnsPlaced[2]}
                maxPawns={pawnsPerPlayer}
                isCurrentPlayer={currentPlayer === 2 && !winner}
                winner={winner}
              />
            </div>

            {/* Center Column - Game Board */}
            <div className="flex flex-col items-center justify-center">
              <GameBoard
                board={board}
                currentPlayer={currentPlayer}
                gamePhase={gamePhase}
                selectedPawn={selectedPawn}
                winningLine={winningLine}
                deadZones={deadZones}
                validMoves={validMoves}
                onSquareClick={handleSquareClick}
                winner={winner}
                onPawnDragStart={handlePawnDragStart}
                onPawnDrop={handlePawnDrop}
              />
            </div>

            {/* Right Column */}
            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
              <HistoryCard gameHistory={gameHistory} />
            </div>
          </div>
        </div>
      </main>
      <Toaster />
      
      <Dialog open={isRulesDialogOpen} onOpenChange={setIsRulesDialogOpen}>
        <RulesDialogContent pawnsPerPlayer={pawnsPerPlayer} />
      </Dialog>

      <WinnerDialog 
        winner={winner}
        isOpen={isWinnerDialogOpen}
        onOpenChange={setIsWinnerDialogOpen}
        onPlayAgain={resetGame}
      />
    </>
  );
}
