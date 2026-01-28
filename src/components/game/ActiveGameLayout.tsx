"use client";

import React, { useState, useEffect, useRef } from "react";
import type { GameState, GameMode, PlayerId, Locale, AIStrategy } from "@/lib/types";
import { GameBoard } from "@/components/game/GameBoard";
import { SidePanel } from "./SidePanel";
import { TopPanelMobile } from "./TopPanelMobile";
import { Loader2, Smartphone, X, Home, Undo2, Redo2, BookOpen, Target, Zap } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { useInfoSystem } from "@/hooks/useInfoSystem";

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
  // Undo/Redo functionality
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  // AI Strategy toggle (only for AI mode)
  currentAiStrategy?: AIStrategy;
  onAiStrategyChange?: (strategy: AIStrategy) => void;
  // Info system for showing messages (from TopPanelMobile/SidePanel)
  onShowInfoMessage?: (message: string, duration?: number) => void;
}

export const ActiveGameLayout: React.FC<ActiveGameLayoutProps> = ({
  gameState,
  isAILoading,
  onSquareClick,
  onPawnDragStart,
  onPawnDrop,
  player1Name,
  player2Name,
  gameMode,
  localPlayerId,
  connectedGameId,
  onCopyGameLink,
  onResetGame,
  onOpenRules,
  onGoBackToMenu,
  onSetLanguage,
  currentLanguage,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  currentAiStrategy = "normal",
  onAiStrategyChange,
  onShowInfoMessage,
}) => {
  const [showMobileAlert, setShowMobileAlert] = useState(true);
  const { addTemporaryInfo } = useInfoSystem();
  const prevStrategyRef = useRef<AIStrategy>(currentAiStrategy);

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

  // Mobile Icon Bar - below alert
  const MobileIconBar = () => {
    const hasWinner = !!gameState?.winner;
    const showRedo = gameMode !== "remote" && onRedo !== undefined;
    const showUndo = onUndo !== undefined;
    
    return (
      <div className="lg:hidden px-4 pb-2">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={onGoBackToMenu}
            className="h-10 w-10"
            title="Home"
          >
            <Home className="h-5 w-5" />
          </Button>
          
          {/* Undo and Redo on same line if both exist */}
          {(showUndo || showRedo) && (
            <div className="flex items-center gap-2">
              {showUndo && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onUndo}
                  disabled={!canUndo || hasWinner}
                  className="h-10 w-10"
                  title={canUndo ? "Undo" : "No moves to undo"}
                >
                  <Undo2 className="h-5 w-5" />
                </Button>
              )}
              
              {showRedo && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onRedo}
                  disabled={!canRedo || hasWinner}
                  className="h-10 w-10"
                  title={canRedo ? "Redo" : "No moves to redo"}
                >
                  <Redo2 className="h-5 w-5" />
                </Button>
              )}
            </div>
          )}
          
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenRules}
            className="h-10 w-10"
            title="Rules"
          >
            <BookOpen className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  };

  // Track strategy changes and show info message (will be displayed by TopPanelMobile/SidePanel)
  useEffect(() => {
    if (gameMode === "ai" && prevStrategyRef.current !== currentAiStrategy) {
      console.log(`[AI Strategy] Changed from ${prevStrategyRef.current} to ${currentAiStrategy}`);
      
      const message = currentAiStrategy === "normal" 
        ? "Game mode back to normal"
        : "Game mode changed to aggressive";
      
      // Use TopPanelMobile's or SidePanel's info system if available, otherwise use local one
      const topPanelAddInfo = (window as any).__topPanelAddInfo;
      const sidePanelAddInfo = (window as any).__sidePanelAddInfo;
      const sharedAddInfo = topPanelAddInfo || sidePanelAddInfo;
      
      if (sharedAddInfo) {
        sharedAddInfo(message, 3000);
      } else {
        addTemporaryInfo(
          {
            type: "info",
            message: message,
            priority: 6,
          },
          3000
        );
      }
      
      prevStrategyRef.current = currentAiStrategy;
    }
  }, [currentAiStrategy, gameMode, addTemporaryInfo]);

  // AI Strategy Toggle - top right corner
  const AIStrategyToggle = () => {
    if (gameMode !== "ai" || !onAiStrategyChange) return null;
    
    const isNormal = currentAiStrategy === "normal";
    
    const handleStrategyChange = (newStrategy: AIStrategy) => {
      // Only change if different from current
      if (newStrategy !== currentAiStrategy) {
        console.log(`[AI Strategy Toggle] Switching from ${currentAiStrategy} to ${newStrategy}`);
        onAiStrategyChange(newStrategy);
      } else {
        console.log(`[AI Strategy Toggle] Already in ${newStrategy} mode, no change`);
      }
    };
    
    return (
      <div className="absolute top-4 right-4 z-50">
        <div className="relative flex flex-row items-center gap-0.5 rounded-lg border border-border bg-background/80 backdrop-blur-sm">
          {/* Sliding indicator */}
          <div
            className={`absolute inset-y-0 -z-10 w-9 transform-gpu rounded-lg border border-primary-foreground/20 bg-primary/40 backdrop-blur-md transition-transform duration-200 ${
              isNormal ? "translate-x-0" : "translate-x-[38px]"
            }`}
          />
          
          {/* Normal button */}
          <div
            onClick={() => handleStrategyChange("normal")}
            className="cursor-pointer rounded-lg px-2.5 py-1 transition hover:bg-muted/40"
            title="Normal Strategy"
          >
            <Target className="size-4" />
          </div>
          
          {/* Aggressive button */}
          <div
            onClick={() => handleStrategyChange("aggressive")}
            className="cursor-pointer rounded-lg px-2.5 py-1 transition hover:bg-muted/40"
            title="Aggressive Strategy"
          >
            <Zap className="size-4" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row items-stretch min-h-screen w-full bg-background text-foreground p-2 sm:p-4 gap-4 relative">
      {/* AI Strategy Toggle - Top Right Corner (inside container) */}
      <AIStrategyToggle />
      
      <MobileAlert />
      
      {/* Mobile Icon Bar - Below Alert */}
      <MobileIconBar />
      
      {/* Mobile Top Panel - All mobile UI logic */}
      <TopPanelMobile 
        gameState={gameState}
        gameMode={gameMode}
        player1Name={player1Name}
        player2Name={player2Name}
        localPlayerId={localPlayerId}
        onResetGame={onResetGame}
        onShowInfoMessage={onShowInfoMessage}
      />
      
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
        </div>
      </main>

      {/* Side Panel: Desktop only */}
      <div className="hidden lg:block w-full lg:w-auto lg:flex-shrink-0">
        <SidePanel
          gameState={gameState}
          player1Name={player1Name}
          player2Name={player2Name}
          gameMode={gameMode}
          localPlayerId={localPlayerId}
          connectedGameId={connectedGameId}
          onCopyGameLink={onCopyGameLink}
          onResetGame={onResetGame}
          onOpenRules={onOpenRules}
          onGoBackToMenu={onGoBackToMenu}
          onSetLanguage={onSetLanguage}
          currentLanguage={currentLanguage}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </div>
    </div>
  );
};