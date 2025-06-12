"use client";

import React from "react";
import type { GameState, GameMode } from "@/lib/types";
import { SelectGameModeScreen, type SelectGameModeScreenProps } from "./SelectGameModeScreen"; 
import { ActiveGameLayout } from "./ActiveGameLayout";
import { WaitingRoom } from "./WaitingRoom";
import { Loader2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation"; 


interface GameViewRouterProps {
  gameMode: GameMode;
  isConnectingToRemote: boolean;
  isRemoteConnected: boolean;
  remoteConnectionError?: string | null;
  isWaitingForOpponent?: boolean;
  connectedGameId?: string | null;
  activeGameState: GameState | null;
  
  // Props for SelectGameModeScreen
  selectScreenProps: SelectGameModeScreenProps;

  // Props for ActiveGameLayout (everything except gameState, which is from activeGameState prop)
  activeGameLayoutProps: Omit<React.ComponentProps<typeof ActiveGameLayout>, 'gameState'>;
  
  // Callbacks
  onGoBackToMenu: () => void;
  
  // For WaitingRoom
  clientPlayerNameForWaitingRoom: string;
  // t: (key: string, options?: any) => string; // Or use useTranslation internally
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
  const { t } = useTranslation(); // Using hook internally

  if (gameMode === "select") {
    return <SelectGameModeScreen {...selectScreenProps} />;
  }

  if (gameMode === "remote" && isConnectingToRemote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" /><span>{t("connectingToServer")}...</span>
      </div>
    );
  }

  if (gameMode === "remote" && !isRemoteConnected && !isConnectingToRemote && remoteConnectionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <span>{t("connectionFailed")}: {remoteConnectionError}</span>
        <Button onClick={onGoBackToMenu} className="mt-4" variant="outline"><Home className="mr-2 h-4 w-4" /> {t("backToMenu")}</Button>
      </div>
    );
  }

  if (gameMode === "remote" && connectedGameId && isRemoteConnected && isWaitingForOpponent) {
    console.log("CLIENT: GameViewRouter rendering WaitingRoom component.");
    return <WaitingRoom gameId={connectedGameId} playerName={clientPlayerNameForWaitingRoom} />;
  }
  
  // This condition handles when game is supposed to be active but gameState is not ready
  if (!activeGameState && (gameMode === "local" || gameMode === "ai" || (gameMode === "remote" && isRemoteConnected && !isWaitingForOpponent))) {
    console.warn("CLIENT (Router): Active game mode but no activeGameState. GameMode:", gameMode);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" /><span>{t("loadingGame")}...</span>
      </div>
    );
  }
  
  if (activeGameState) { // Covers local, AI, and fully connected remote game
     return <ActiveGameLayout {...activeGameLayoutProps} gameState={activeGameState} />;
  }

  // Fallback: Should ideally not be reached if logic is sound
  console.warn("CLIENT (Router): Fallback render. GameMode:", gameMode);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" /><span>{t("initializing")}...</span>
    </div>
  );
};