"use client";

import React from 'react';
import type { GameState, GameMode, PlayerId, Locale } from "@/lib/types";
import { GameBoard } from "@/components/game/GameBoard";
import { SidePanel } from './SidePanel';
import { IconToolbar } from './IconToolbar';
import { Loader2 } from "lucide-react";
import { StatusDisplay } from "@/components/game/StatusDisplay";

// The props interface remains the same
interface ActiveGameLayoutProps {
  gameState: GameState | null;
  gameMode: GameMode;
  player1Name: string;
  player2Name: string;
  localPlayerId: PlayerId | null;
  isAILoading: boolean;
  currentLanguage: Locale;
  onSquareClick: (index: number) => void;
  onPawnDragStart: (pawnIndex: number) => void;
  onPawnDrop: (targetIndex: number) => void;
  onResetGame: () => void;
  onOpenRules: () => void;
  onGoBackToMenu: () => void;
  onSetLanguage: (lang: Locale) => void;
  onCopyGameLink: () => void;
  connectedGameId?: string | null;
}

export const ActiveGameLayout: React.FC<ActiveGameLayoutProps> = ({
  gameState,
  isAILoading,
  onSquareClick,
  onPawnDragStart,
  onPawnDrop,
  player1Name, // Destructure all props for clarity
  player2Name,
  ...rest
}) => {

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    // This is the main page container. It's now a flex-col on mobile
    // and a flex-row on large screens.
    <div className="flex flex-col lg:flex-row items-stretch min-h-screen w-full bg-background text-foreground p-2 sm:p-4 gap-4">
      
      {/* Vertical Icon Toolbar: on the Left for large screens */}
      <div className="hidden lg:flex flex-shrink-0">
        <IconToolbar {...rest} />
      </div>

      {/* Main Game Board Area */}
      <main className="flex-grow flex flex-col items-center justify-center w-full lg:w-auto p-0 lg:py-4">
        
        {/* Scalable Game Board Wrapper */}
        <div className="relative w-full max-w-[500px] lg:max-w-none lg:h-full lg:flex-grow aspect-square">
          <GameBoard
            gameState={gameState}
            onSquareClick={onSquareClick}
            onPawnDragStart={onPawnDragStart}
            onPawnDrop={onPawnDrop}
          />
          {isAILoading && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
      </main>

      {/* Side Panel: on the Right for large screens */}
      <div className="w-full lg:w-auto lg:flex-shrink-0">
          <SidePanel 
            gameState={gameState}
            player1Name={player1Name}
            player2Name={player2Name}
            gameMode={rest.gameMode}
            localPlayerId={rest.localPlayerId}
            connectedGameId={rest.connectedGameId}
            onCopyGameLink={rest.onCopyGameLink}
          />
      </div>

      {/* Icon Toolbar for Mobile: at the bottom of the screen */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border p-1">
         <IconToolbar {...rest} />
      </div>
    </div>
  );
};