
"use client";

import React, { useState } from 'react';
import { GameBoard } from '@/components/game/GameBoard';
import { PlayerCard } from '@/components/game/PlayerCard';
import { ControlsCard } from '@/components/game/ControlsCard';
import { HistoryCard } from '@/components/game/HistoryCard';
import { StatusCard } from '@/components/game/StatusCard';
import { RulesDialogContent } from '@/components/game/RulesDialog';
import { WinnerDialog } from '@/components/game/WinnerDialog';
import { useDiagonalDomination } from '@/hooks/useDiagonalDomination';
import { Toaster } from "@/components/ui/toaster";
import { Dialog } from '@/components/ui/dialog'; // Import Dialog for RulesDialog trigger

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
    getPlayerSquareColor, // Keep if used by any sub-component not directly getting it
    gameHistory,
    validMoves,
  } = useDiagonalDomination();

  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false);
  const [isWinnerDialogOpen, setIsWinnerDialogOpen] = useState(false);

  React.useEffect(() => {
    if (winner) {
      setIsWinnerDialogOpen(true);
    } else {
      setIsWinnerDialogOpen(false);
    }
  }, [winner]);

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-2 sm:p-4 selection:bg-[hsl(var(--primary))] selection:text-[hsl(var(--primary-foreground))]">
        <div className="w-full max-w-6xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-6 text-center text-[hsl(var(--primary))] tracking-tight">
            Diagonal Domination
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4 sm:gap-6 items-start">
            {/* Left Column */}
            <div className="space-y-4 sm:space-y-6">
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
            <div className="flex flex-col items-center">
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
              />
            </div>

            {/* Right Column */}
            <div className="space-y-4 sm:space-y-6">
              <StatusCard 
                gamePhase={gamePhase}
                currentPlayer={currentPlayer}
                winner={winner}
                pawnsPerPlayer={pawnsPerPlayer}
                selectedPawn={selectedPawn}
              />
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
