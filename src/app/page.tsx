
"use client";

import { GameBoard } from '@/components/game/GameBoard';
import { GameInfo } from '@/components/game/GameInfo';
import { GameControls } from '@/components/game/GameControls';
import { GameRules } from '@/components/game/GameRules';
import { useDiagonalDomination } from '@/hooks/useDiagonalDomination'; // Corrected path if needed, or ensure file exists
import { Toaster } from "@/components/ui/toaster";

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
    getPlayerSquareColor,
  } = useDiagonalDomination();

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 selection:bg-[hsl(var(--primary))] selection:text-[hsl(var(--primary-foreground))]">
        <GameInfo
          currentPlayer={currentPlayer}
          gamePhase={gamePhase}
          winner={winner}
          pawnsPlaced={pawnsPlaced}
          maxPawns={pawnsPerPlayer} 
          getPlayerSquareColor={getPlayerSquareColor}
        />
        <GameBoard
          board={board}
          onSquareClick={handleSquareClick}
          currentPlayer={currentPlayer}
          gamePhase={gamePhase}
          selectedPawn={selectedPawn}
          winningLine={winningLine}
          deadZones={deadZones}
          getPlayerSquareColor={getPlayerSquareColor}
        />
        <GameControls 
          onReset={resetGame} 
          pawnsPerPlayer={pawnsPerPlayer} // This is a number
          onPawnsChange={changePawnsPerPlayerCount} // This expects a number
        />
        <GameRules />
      </main>
      <Toaster />
    </>
  );
}

    