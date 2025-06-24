"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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

export default function LocalGamePage() {
  const router = useRouter();
  const gameMode: GameMode = "local";
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const { save, loadSafe, remove, isHydrated } = usePersistence();

  const {
    player1NameLocal,
    setPlayer1NameLocal,
    player2NameLocal,
    setPlayer2NameLocal,
    currentAiDifficulty,
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
  } = useLocalGame({
    aiDifficulty: currentAiDifficulty,
    gameMode,
    initialOptions: initialGameOptions,
  });

  const gameConnection = useGameConnection();

  // Restore saved data after hydration
  useEffect(() => {
    if (!isHydrated) return;
    
    const savedName1 = loadSafe('local_player1_name', '');
    const savedName2 = loadSafe('local_player2_name', '');
    
    if (savedName1 && savedName1 !== player1NameLocal) {
      setPlayer1NameLocal(savedName1);
    }
    if (savedName2 && savedName2 !== player2NameLocal) {
      setPlayer2NameLocal(savedName2);
    }
  }, [isHydrated, loadSafe, player1NameLocal, player2NameLocal, setPlayer1NameLocal, setPlayer2NameLocal]);

  // Save when changed
  useEffect(() => {
    if (player1NameLocal && player1NameLocal.trim() && player1NameLocal !== t("player1Name")) {
      save('local_player1_name', player1NameLocal.trim());
    }
  }, [player1NameLocal, save, t]);

  useEffect(() => {
    if (player2NameLocal && player2NameLocal.trim() && player2NameLocal !== t("player2Name")) {
      save('local_player2_name', player2NameLocal.trim());
    }
  }, [player2NameLocal, save, t]);

  const goBackToMenu = useCallback(() => {
    remove('local_player1_name');
    remove('local_player2_name');
    router.push("/");
  }, [router, remove]);

  const resetGameHandler = useCallback(() => {
    resetLocalGame(initialGameOptions);
  }, [resetLocalGame, initialGameOptions]);

  const p1DisplayName = player1NameLocal?.trim() || t("player", { id: 1 });
  const p2DisplayName = player2NameLocal?.trim() || t("player", { id: 2 });

  const selectScreenProps = {
    onStartGameMode: () => Promise.resolve(),
    player1Name: p1DisplayName,
    setPlayer1Name: setPlayer1NameLocal,
    player2Name: p2DisplayName,
    setPlayer2Name: setPlayer2NameLocal,
    remotePlayerNameInput: "",
    setRemotePlayerNameInput: () => {},
    remoteGameIdInput: "",
    setRemoteGameIdInput: () => {},
    aiDifficulty: currentAiDifficulty,
    setAiDifficulty: () => {},
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