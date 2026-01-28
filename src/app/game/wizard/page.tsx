"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { GameMode } from "@/lib/types";
import { PAWNS_PER_PLAYER } from "@/lib/gameLogic";

// UI Components
import { GameViewRouter } from "@/components/game/GameViewRouter";
import { RulesDialogContent } from "@/components/game/RulesDialog";
import { Dialog } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

// Hooks
import { useTranslation } from "@/hooks/useTranslation";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useGameSetup } from "@/hooks/useGameSetup";
import { usePersistence } from "@/hooks/usePersistence";

export default function WizardGamePage() {
  const router = useRouter();
  const gameMode: GameMode = "ai";
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const { save, loadSafe, remove, isHydrated } = usePersistence();

  const {
    player1NameLocal,
    setPlayer1NameLocal,
    currentAiStrategy,
    setCurrentAiStrategy,
  } = useGameSetup({ gameIdFromUrl: "" });

  const { t, currentLanguage, setLanguage } = useTranslation();

  const initialGameOptions = useMemo(
    () => ({ pawnsPerPlayer: PAWNS_PER_PLAYER }),
    []
  );

  const {
    localGameState,
    isAILoading,
    handleLocalSquareClick,
    handleLocalPawnDragStart,
    handleLocalPawnDrop,
    resetLocalGame,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  } = useLocalGame({
    aiStrategy: currentAiStrategy,
    gameMode,
    initialOptions: initialGameOptions,
  });

  const gameConnection = useGameConnection();
  const hasRestoredRef = useRef(false);

  // Restore saved data after hydration (only once on mount)
  useEffect(() => {
    if (!isHydrated || hasRestoredRef.current) return;
    
    const savedName = loadSafe('ai_player_name', '');
    const savedStrategy = loadSafe('ai_strategy', 'normal');
    
    if (savedName && savedName !== player1NameLocal) {
      setPlayer1NameLocal(savedName);
    }
    if (savedStrategy !== currentAiStrategy) {
      setCurrentAiStrategy(savedStrategy);
    }
    
    hasRestoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]); // Only run once when hydrated

  // Save when changed
  useEffect(() => {
    if (player1NameLocal && player1NameLocal.trim() && player1NameLocal !== t("player1Name")) {
      save('ai_player_name', player1NameLocal.trim());
    }
  }, [player1NameLocal, save, t]);

  useEffect(() => {
    save('ai_strategy', currentAiStrategy);
  }, [currentAiStrategy, save]);

  const goBackToMenu = useCallback(() => {
    remove('ai_player_name');
    remove('ai_strategy');
    router.push("/");
  }, [router, remove]);

  const resetGameHandler = useCallback(() => {
    resetLocalGame(initialGameOptions);
  }, [resetLocalGame, initialGameOptions]);

  const p1DisplayName = player1NameLocal?.trim() || t("player", { id: 1 });
  const p2DisplayName = t("aiOpponent");

  const selectScreenProps = {
    onStartGameMode: () => Promise.resolve(),
    player1Name: p1DisplayName,
    setPlayer1Name: setPlayer1NameLocal,
    player2Name: "",
    setPlayer2Name: () => {},
    remotePlayerNameInput: "",
    setRemotePlayerNameInput: () => {},
    remoteGameIdInput: "",
    setRemoteGameIdInput: () => {},
    aiStrategy: currentAiStrategy,
    setAiStrategy: setCurrentAiStrategy,
    isConnecting: false,
    gameConnectionError: null,
    isFromSharedLink: false,
    isProcessingSharedLink: false,
  };

  const activeGameLayoutProps = {
    gameMode,
    player1Name: p1DisplayName,
    player2Name: p2DisplayName,
    localPlayerId: null,
    connectedGameId: null,
    isAILoading,
    currentLanguage,
    onSquareClick: handleLocalSquareClick,
    onPawnDragStart: handleLocalPawnDragStart,
    onPawnDrop: handleLocalPawnDrop,
    onResetGame: resetGameHandler,
    onOpenRules: () => setIsRulesOpen(true),
    onCopyGameLink: () => {},
    onGoBackToMenu: goBackToMenu,
    onSetLanguage: setLanguage,
    // Undo/Redo for AI game
    onUndo: handleUndo,
    onRedo: handleRedo,
    canUndo,
    canRedo,
    // AI Strategy toggle (AI mode only)
    currentAiStrategy: currentAiStrategy,
    onAiStrategyChange: setCurrentAiStrategy,
  };

  return (
    <>
      <GameViewRouter
        gameMode={gameMode}
        isConnectingToRemote={false}
        isRemoteConnected={false}
        remoteConnectionError={null}
        isWaitingForOpponent={false}
        connectedGameId={null}
        activeGameState={localGameState}
        selectScreenProps={selectScreenProps}
        activeGameLayoutProps={activeGameLayoutProps}
        onGoBackToMenu={goBackToMenu}
        clientPlayerNameForWaitingRoom=""
      />

      <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
        <RulesDialogContent pawnsPerPlayer={PAWNS_PER_PLAYER} />
      </Dialog>
    </>
  );
}