"use client";

import React, { useState } from "react";
import type { GameState, GameMode, PlayerId, Locale } from "@/lib/types";
import { GameBoard } from "@/components/game/GameBoard";
import { SidePanel } from "./SidePanel";
import { IconToolbar } from "./IconToolbar";
import { Loader2, Smartphone, X } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";

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
  player1Name,
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

  const [showMobileAlert, setShowMobileAlert] = useState(true);

  const MobileAlert = () => (
    <div className="lg:hidden p-4">
      {showMobileAlert && (
        <Alert className="border-orange-200 bg-orange-50">
          <Smartphone className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 pr-8">
            We don't support full functionality on mobile web yet. Use laptop
            for full experience.
          </AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="absolute right-2 top-2 h-6 w-6 p-0 text-orange-600 hover:bg-orange-100"
            onClick={() => setShowMobileAlert(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row items-stretch min-h-screen w-full bg-background text-foreground p-2 sm:p-4 gap-4">
      <MobileAlert />
      {/* Main Game Board Area */}
      <main className="flex-grow flex flex-col items-center justify-center w-full lg:w-auto p-4 lg:p-8">
        {/* Scalable Game Board Wrapper */}
        <div className="relative w-full h-full max-w-[min(500px,calc(100vw-2rem))] max-h-[min(500px,calc(100vh-8rem))] lg:max-w-[min(600px,calc(100vw-24rem))] lg:max-h-[min(600px,calc(100vh-4rem))] xl:max-w-[min(700px,calc(100vw-28rem))] xl:max-h-[min(700px,calc(100vh-4rem))] aspect-square flex items-center justify-center">
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

      {/* Side Panel: Desktop version OR Mobile alert */}
      <div className="w-full lg:w-auto lg:flex-shrink-0">
        <SidePanel
          gameState={gameState}
          player1Name={player1Name}
          player2Name={player2Name}
          gameMode={rest.gameMode}
          localPlayerId={rest.localPlayerId}
          connectedGameId={rest.connectedGameId}
          onCopyGameLink={rest.onCopyGameLink}
          onResetGame={rest.onResetGame}
          onOpenRules={rest.onOpenRules}
        />
      </div>

      {/* Icon Toolbar for Mobile: at the bottom of the screen */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border p-1">
        <IconToolbar {...rest} />
      </div>
    </div>
  );
};
