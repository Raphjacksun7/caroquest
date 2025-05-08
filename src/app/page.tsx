
"use client";

import { GameBoard } from '@/components/game/GameBoard';
import { GameInfo } from '@/components/game/GameInfo';
import { GameControls } from '@/components/game/GameControls';
import { useDiagonalDomination } from '@/hooks/useDiagonalDomination';
import { PAWNS_PER_PLAYER } from '@/config/game';
import { Toaster } from "@/components/ui/toaster";


export default function DiagonalDominationPage() {
  const {
    board,
    currentPlayer,
    gamePhase,
    playerPawnsPlaced,
    selectedPawn,
    winner,
    winningLine,
    playerAssignedColors,
    handleSquareClick,
    resetGame,
  } = useDiagonalDomination();

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 selection:bg-[hsl(var(--primary))] selection:text-[hsl(var(--primary-foreground))]">
        <GameInfo
          currentPlayer={currentPlayer}
          gamePhase={gamePhase}
          winner={winner}
          playerAssignedColors={playerAssignedColors}
          pawnsPlaced={playerPawnsPlaced}
          maxPawns={PAWNS_PER_PLAYER}
        />
        <GameBoard
          board={board}
          onSquareClick={handleSquareClick}
          currentPlayer={currentPlayer}
          gamePhase={gamePhase}
          selectedPawn={selectedPawn}
          playerAssignedColors={playerAssignedColors}
          winningLine={winningLine}
        />
        <GameControls onReset={resetGame} />
      </main>
      <Toaster />
    </>
  );
}
