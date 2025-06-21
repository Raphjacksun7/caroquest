"use client";

import React from "react";
import type { GameState, GameMode } from "@/lib/types";
import { SelectScreen } from "./SelectScreen"; // NEW: Import SelectScreen instead of SelectGameModeScreen
import { ActiveGameLayout } from "./ActiveGameLayout";
import { WaitingRoom } from "./WaitingRoom";
import { Loader2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation"; 

// Updated interface to include shared link props
interface SelectScreenProps {
  onStartGameMode: (mode: GameMode) => Promise<void>;
  player1Name: string;
  setPlayer1Name: (name: string) => void;
  player2Name: string;
  setPlayer2Name: (name: string) => void;
  remotePlayerNameInput: string;
  setRemotePlayerNameInput: (name: string) => void;
  remoteGameIdInput: string;
  setRemoteGameIdInput: (id: string) => void;
  aiDifficulty: 'easy' | 'medium' | 'hard';
  setAiDifficulty: (difficulty: 'easy' | 'medium' | 'hard') => void;
  isConnecting: boolean;
  gameConnectionError: string | null;
  // NEW: Add these props for shared link support
  isFromSharedLink?: boolean;
  isProcessingSharedLink?: boolean;
}

interface GameViewRouterProps {
  gameMode: GameMode;
  isConnectingToRemote: boolean;
  isRemoteConnected: boolean;
  remoteConnectionError?: string | null;
  isWaitingForOpponent?: boolean;
  connectedGameId?: string | null;
  activeGameState: GameState | null;
  
  // Props for SelectScreen (updated type)
  selectScreenProps: SelectScreenProps;

  // Props for ActiveGameLayout (everything except gameState, which is from activeGameState prop)
  activeGameLayoutProps: Omit<React.ComponentProps<typeof ActiveGameLayout>, 'gameState'>;
  
  // Callbacks
  onGoBackToMenu: () => void;
  
  // For WaitingRoom
  clientPlayerNameForWaitingRoom: string;
}

export const GameViewRouter: React.FC<GameViewRouterProps> = ({
  gameMode,
  isConnectingToRemote,
  isRemoteConnected,
  remoteConnectionError,
  isWaitingForOpponent,
  connectedGameId,
  activeGameState,
  selectScreenProps,
  activeGameLayoutProps,
  onGoBackToMenu,
  clientPlayerNameForWaitingRoom,
}) => {
  const { t } = useTranslation();

  console.log("GameViewRouter render:", {
    gameMode,
    isConnectingToRemote,
    isRemoteConnected,
    remoteConnectionError,
    isWaitingForOpponent,
    connectedGameId,
    hasActiveGameState: !!activeGameState,
    isFromSharedLink: selectScreenProps.isFromSharedLink,
    isProcessingSharedLink: selectScreenProps.isProcessingSharedLink
  });

  // PRIORITY 1: Show select screen for initial mode or when coming from shared link
  if (gameMode === "select") {
    return <SelectScreen {...selectScreenProps} />;
  }

  // PRIORITY 2: Show select screen if remote mode but no connection and no game ID (shared link case)
  if (gameMode === "remote" && !isConnectingToRemote && !isRemoteConnected && !connectedGameId && selectScreenProps.isFromSharedLink) {
    console.log("CLIENT (Router): Shared link detected, showing SelectScreen");
    return <SelectScreen {...selectScreenProps} />;
  }

  // PRIORITY 3: Show connecting screen when trying to connect
  if (gameMode === "remote" && isConnectingToRemote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <span>{t("connectingToServer")}...</span>
      </div>
    );
  }

  // PRIORITY 4: Show error screen for connection errors
  if (gameMode === "remote" && !isRemoteConnected && !isConnectingToRemote && remoteConnectionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <span>{t("connectionFailed")}: {remoteConnectionError}</span>
        <Button onClick={onGoBackToMenu} className="mt-4" variant="outline">
          <Home className="mr-2 h-4 w-4" /> {t("backToMenu")}
        </Button>
      </div>
    );
  }

  // PRIORITY 5: Show waiting room when connected but waiting for opponent
  if (gameMode === "remote" && connectedGameId && isRemoteConnected && isWaitingForOpponent) {
    console.log("CLIENT: GameViewRouter rendering WaitingRoom component.");
    return <WaitingRoom gameId={connectedGameId} playerName={clientPlayerNameForWaitingRoom} />;
  }
  
  // PRIORITY 6: Show active game when we have game state
  if (activeGameState) {
    return <ActiveGameLayout {...activeGameLayoutProps} gameState={activeGameState} />;
  }

  // PRIORITY 7: Show loading for local/AI games that are initializing
  if (gameMode === "local" || gameMode === "ai") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <span>{t("loadingGame")}...</span>
      </div>
    );
  }

  // PRIORITY 8: For remote mode without connection, go back to select (this prevents the fallback)
  if (gameMode === "remote" && !isConnectingToRemote && !isRemoteConnected && !connectedGameId) {
    console.log("CLIENT (Router): Remote mode but no connection, returning to SelectScreen");
    return <SelectScreen {...selectScreenProps} />;
  }

  // LAST RESORT: Fallback (should rarely be reached now)
  console.warn("CLIENT (Router): Unexpected fallback render. GameMode:", gameMode);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
      <span>Something went wrong. Let's get you back to the main menu.</span>
      <Button onClick={onGoBackToMenu} className="mt-4" variant="outline">
        <Home className="mr-2 h-4 w-4" /> {t("backToMenu")}
      </Button>
    </div>
  );
};