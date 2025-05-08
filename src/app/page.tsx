"use client";

import { GameBoard } from '@/components/game/GameBoard';
import { GameInfo } from '@/components/game/GameInfo';
import { GameControls } from '@/components/game/GameControls';
import { GameRules } from '@/components/game/GameRules';
import { useDiagonalDomination } from '@/hooks/useDiagonalDomination';
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
    handlePawnDragStart,
    handlePawnDrop,
    getValidMoveTargets,
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
          currentPlayer={currentPlayer}
          gamePhase={gamePhase}
          selectedPawn={selectedPawn}
          winningLine={winningLine}
          deadZones={deadZones}
          getPlayerSquareColor={getPlayerSquareColor}
          getValidMoveTargets={getValidMoveTargets}
          onSquareClick={handleSquareClick}
          onPawnDragStart={handlePawnDragStart}
          onPawnDrop={handlePawnDrop}
        />
        <GameControls 
          onReset={resetGame} 
          pawnsPerPlayer={pawnsPerPlayer}
          onPawnsChange={changePawnsPerPlayerCount}
        />
        <GameRules />
      </main>
      <Toaster />
    </>
  );
}