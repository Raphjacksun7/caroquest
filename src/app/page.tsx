"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { GameMode } from "@/lib/types";
import {
  PAWNS_PER_PLAYER,
  highlightValidMoves,
  clearHighlights,
} from "@/lib/gameLogic";

// UI Components
import { GameViewRouter } from "@/components/game/GameViewRouter";
import { RulesDialogContent } from "@/components/game/RulesDialog";
import { GameExpiredModal } from "@/components/game/GameExpiredModal";
import { Dialog } from "@/components/ui/dialog";
import { useParams } from "next/navigation";

// Hooks
import { useTranslation } from "@/hooks/useTranslation";
import { useGameConnection, gameStore } from "@/hooks/useGameConnection";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useGameUrlManager } from "@/hooks/useGameUrlManager";
import { useGameSetup } from "@/hooks/useGameSetup";

function CaroQuestPage() {
  const pathParams = useParams();
  const [gameMode, setGameMode] = useState<GameMode>("select");
  const [isRematchInProgress, setIsRematchInProgress] = useState(false);
  const [isProcessingSharedLink, setIsProcessingSharedLink] = useState(false);

  const gameIdFromUrl = useMemo(() => {
    const id = Array.isArray(pathParams?.gameId)
      ? pathParams.gameId[0]
      : pathParams?.gameId;
    return id && id !== "local" && id !== "ai" ? id : "";
  }, [pathParams]);

  const {
    player1NameLocal,
    setPlayer1NameLocal,
    player2NameLocal,
    setPlayer2NameLocal,
    remotePlayerNameInput,
    setRemotePlayerNameInput,
    remoteGameIdInput,
    setRemoteGameIdInput,
    currentAiDifficulty,
    setCurrentAiDifficulty,
  } = useGameSetup({ gameIdFromUrl });

  const { t, currentLanguage, setLanguage } = useTranslation();
  const [showGameExpiredModal, setShowGameExpiredModal] = useState(false);

  // Initial options for local game
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
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  useGameUrlManager(gameMode, gameConnection.gameId);

  // Handle errors
  useEffect(() => {
    if (
      gameConnection.error &&
      gameConnection.errorType &&
      !isRematchInProgress
    ) {
      console.log("CLIENT: Game Connection Error received:", {
        error: gameConnection.error,
        type: gameConnection.errorType,
        isRematchInProgress,
      });

      // Only show modals for critical errors when not in rematch
      if (
        ["GAME_NOT_FOUND", "GAME_FULL", "JOIN_FAILED"].includes(
          gameConnection.errorType
        ) &&
        !isRematchInProgress
      ) {
        setShowGameExpiredModal(true);
      }
    }
  }, [gameConnection.error, gameConnection.errorType, isRematchInProgress]);

  // Handle game mode changes
  useEffect(() => {
    if (isRematchInProgress) {
      console.log(
        "CLIENT: Rematch in progress - maintaining current game mode"
      );
      return;
    }

    if (
      gameConnection.gameId &&
      gameConnection.isConnected &&
      gameMode !== "remote"
    ) {
      console.log(
        "CLIENT: Detected active remote game, setting gameMode to 'remote'."
      );
      setGameMode("remote");
    }
  }, [
    gameConnection.gameId,
    gameConnection.isConnected,
    gameMode,
    isRematchInProgress,
  ]);

  // Handle rematch events
  useEffect(() => {
    if (gameMode === "remote") {
      const socket = (gameConnection as any)._internalSocketRef?.current;

      if (socket) {
        const handleRematchStarted = () => {
          console.log(
            "CLIENT: MAIN PAGE - Rematch started, preventing mode changes"
          );
          setIsRematchInProgress(true);

          setTimeout(() => {
            setIsRematchInProgress(false);
            console.log("CLIENT: MAIN PAGE - Rematch transition complete");
          }, 2000);
        };

        const handleRematchRequested = () => {
          console.log(
            "CLIENT: MAIN PAGE - Rematch requested, preparing for transition"
          );
          setIsRematchInProgress(true);
        };

        const handleRematchDeclined = () => {
          console.log(
            "CLIENT: MAIN PAGE - Rematch declined, clearing transition state"
          );
          setIsRematchInProgress(false);
        };

        socket.on("rematch_started", handleRematchStarted);
        socket.on("rematch_requested", handleRematchRequested);
        socket.on("rematch_declined", handleRematchDeclined);

        return () => {
          socket.off("rematch_started", handleRematchStarted);
          socket.off("rematch_requested", handleRematchRequested);
          socket.off("rematch_declined", handleRematchDeclined);
        };
      }
    }
  }, [gameMode, gameConnection]);

useEffect(() => {
  if (typeof window !== "undefined") {
    const storedGameId = sessionStorage.getItem("sharedGameId");
    const fromSharedLink = sessionStorage.getItem("fromSharedLink");

    if (storedGameId && fromSharedLink === "true" && !isProcessingSharedLink) {
      console.log("SHARED LINK: Processing shared game link:", storedGameId);
      
      setIsProcessingSharedLink(true);
      
      // Clear browser autocomplete and force fresh state
      setRemotePlayerNameInput("");
      setRemoteGameIdInput(storedGameId);
      
      // Clear sessionStorage immediately to prevent re-processing
      sessionStorage.removeItem("sharedGameId");
      sessionStorage.removeItem("fromSharedLink");
      
      // IMPORTANT: Stay in select mode instead of switching to remote
      // This will show the SelectScreen with the shared link banner
      setGameMode("select");
      
      // Clear processing flag after UI is ready
      setTimeout(() => {
        setIsProcessingSharedLink(false);
      }, 100);
    }
  }
}, [isProcessingSharedLink, setRemotePlayerNameInput, setRemoteGameIdInput]);


  // Active game state selector
  const activeGameState = useMemo(() => {
    return gameMode === "remote" ? gameConnection.gameState : localGameState;
  }, [gameMode, gameConnection.gameState, localGameState]);

  // Display names
  const p1DisplayName = useMemo(() => {
    if (gameMode === "remote")
      return (
        gameConnection.players.find((p) => p.playerId === 1)?.name ||
        t("player", { id: 1 })
      );
    return player1NameLocal.trim() || t("player", { id: 1 });
  }, [gameMode, gameConnection.players, player1NameLocal, t]);

  const p2DisplayName = useMemo(() => {
    if (gameMode === "remote")
      return (
        gameConnection.players.find((p) => p.playerId === 2)?.name ||
        t("player", { id: 2 })
      );
    if (gameMode === "ai") return t("aiOpponent");
    return player2NameLocal.trim() || t("player", { id: 2 });
  }, [gameMode, gameConnection.players, player2NameLocal, t]);

  const handleStartGameMode = useCallback(
    async (mode: GameMode) => {
      console.log(`CLIENT: Attempting to start game in mode: ${mode}`);
      const currentOptions = activeGameState?.options || initialGameOptions;

      if (mode === "local" || mode === "ai") {
        resetLocalGame(currentOptions);
      }

      if (mode === "remote") {
        if (!remotePlayerNameInput.trim()) {
          console.error("CLIENT: Player name required for remote game");
          return;
        }
        console.log(
          `CLIENT: Starting remote game. Player: ${remotePlayerNameInput}, Game ID: '${remoteGameIdInput.trim()}'`
        );
        try {
          await gameConnection.connectSocketIO();
          if (remoteGameIdInput.trim()) {
            await gameConnection.joinGame(
              remoteGameIdInput.trim(),
              remotePlayerNameInput.trim(),
              currentOptions
            );
          } else {
            await gameConnection.createGame(
              remotePlayerNameInput.trim(),
              currentOptions
            );
          }
        } catch (err) {
          console.error("CLIENT: Remote game start/join failed:", err);
        }
      } else {
        if (mode === "local") {
          setPlayer1NameLocal((prev) => prev.trim() || t("player1Name"));
          setPlayer2NameLocal((prev) => prev.trim() || t("player2Name"));
        } else if (mode === "ai") {
          setPlayer1NameLocal((prev) => prev.trim() || t("player1Name"));
        }
        setGameMode(mode);
      }
    },
    [
      gameConnection,
      remoteGameIdInput,
      remotePlayerNameInput,
      t,
      activeGameState?.options,
      initialGameOptions,
      resetLocalGame,
      setPlayer1NameLocal,
      setPlayer2NameLocal,
    ]
  );

  const goBackToMenu = useCallback(() => {
    console.log("CLIENT: Navigating back to menu. Current mode:", gameMode);
    setIsRematchInProgress(false);
    setIsProcessingSharedLink(false);

    if (gameMode === "remote" && gameConnection.isConnected) {
      console.log("CLIENT: Disconnecting from remote game.");
      gameConnection.disconnect();
    }
    setGameMode("select");
    gameConnection.clearError?.();
  }, [gameMode, gameConnection]);

  const resetGameHandler = useCallback(() => {
    console.log(`CLIENT: Resetting ${gameMode} game.`);

    if (gameMode !== "remote") {
      resetLocalGame(activeGameState?.options || initialGameOptions);
    }
  }, [gameMode, resetLocalGame, activeGameState?.options, initialGameOptions]);

  // Remote game handlers
  const handleRemoteSquareClick = useCallback(
    (index: number) => {
      const remoteGS = gameConnection.gameState;
      if (
        !remoteGS ||
        !gameConnection.localPlayerId ||
        remoteGS.winner ||
        !gameConnection.gameId
      )
        return;

      if (remoteGS.currentPlayerId !== gameConnection.localPlayerId) {
        console.log("CLIENT: Not player's turn, ignoring click");
        return;
      }

      const square = remoteGS.board[index];
      if (remoteGS.gamePhase === "placement") {
        if (!square.pawn) {
          gameConnection.placePawnAction(index);
        }
      } else {
        if (remoteGS.selectedPawnIndex === null) {
          if (
            square.pawn?.playerId === gameConnection.localPlayerId &&
            !remoteGS.blockedPawnsInfo.has(index)
          ) {
            gameStore
              .getState()
              .setGameState(highlightValidMoves(remoteGS, index));
          }
        } else {
          if (square.highlight === "validMove") {
            gameConnection.movePawnAction(remoteGS.selectedPawnIndex, index);
          } else {
            gameStore.getState().setGameState(clearHighlights(remoteGS));
          }
        }
      }
    },
    [gameConnection]
  );

  const handleSquareClick = useMemo(
    () =>
      gameMode === "remote" ? handleRemoteSquareClick : handleLocalSquareClick,
    [gameMode, handleRemoteSquareClick, handleLocalSquareClick]
  );

  const handleRemotePawnDragStart = useCallback(
    (pawnIndex: number) => {
      const remoteGS = gameConnection.gameState;
      if (!remoteGS || remoteGS.winner || remoteGS.gamePhase !== "movement")
        return;
      if (remoteGS.currentPlayerId !== gameConnection.localPlayerId) return;
      if (remoteGS.blockedPawnsInfo.has(pawnIndex)) return;

      const pawnOwnerId = remoteGS.board[pawnIndex]?.pawn?.playerId;
      if (pawnOwnerId === gameConnection.localPlayerId) {
        gameStore
          .getState()
          .setGameState(highlightValidMoves(remoteGS, pawnIndex));
      }
    },
    [gameConnection]
  );

  const handleRemotePawnDrop = useCallback(
    (targetIndex: number) => {
      const remoteGS = gameConnection.gameState;
      if (!remoteGS || remoteGS.selectedPawnIndex === null) {
        if (remoteGS)
          gameStore.getState().setGameState(clearHighlights(remoteGS));
        return;
      }
      const targetSquare = remoteGS.board[targetIndex];
      if (targetSquare.highlight === "validMove") {
        gameConnection.movePawnAction(remoteGS.selectedPawnIndex, targetIndex);
      } else {
        if (remoteGS)
          gameStore.getState().setGameState(clearHighlights(remoteGS));
      }
    },
    [gameConnection]
  );

  const handlePawnDragStart = useMemo(
    () =>
      gameMode === "remote"
        ? handleRemotePawnDragStart
        : handleLocalPawnDragStart,
    [gameMode, handleRemotePawnDragStart, handleLocalPawnDragStart]
  );

  const handlePawnDrop = useMemo(
    () => (gameMode === "remote" ? handleRemotePawnDrop : handleLocalPawnDrop),
    [gameMode, handleRemotePawnDrop, handleLocalPawnDrop]
  );

  const handleModalCreateNewGame = useCallback(() => {
    setShowGameExpiredModal(false);
    goBackToMenu();
    setRemoteGameIdInput("");
  }, [goBackToMenu, setRemoteGameIdInput]);

  const handleModalGoHome = useCallback(() => {
    setShowGameExpiredModal(false);
    goBackToMenu();
    setRemoteGameIdInput("");
  }, [goBackToMenu, setRemoteGameIdInput]);

  const handleCopyGameLink = useCallback(() => {
    if (typeof window !== "undefined" && gameConnection.gameId) {
      // FIXED: Use /{gameId} instead of /game/{gameId} to match your route structure
      const shareableLink = `${window.location.origin}/${gameConnection.gameId}`;
  
      navigator.clipboard
        .writeText(shareableLink)
        .then(() => {
          console.log("CLIENT: Game link copied to clipboard:", shareableLink);
        })
        .catch((err) => {
          console.error("CLIENT: Failed to copy game link:", err);
        });
    }
  }, [gameConnection.gameId]);

  const selectScreenProps = {
    onStartGameMode: handleStartGameMode,
    player1Name: player1NameLocal,
    setPlayer1Name: setPlayer1NameLocal,
    player2Name: player2NameLocal,
    setPlayer2Name: setPlayer2NameLocal,
    remotePlayerNameInput,
    setRemotePlayerNameInput,
    remoteGameIdInput,
    setRemoteGameIdInput,
    aiDifficulty: currentAiDifficulty,
    setAiDifficulty: setCurrentAiDifficulty,
    isConnecting: gameConnection.isConnecting,
    gameConnectionError: gameConnection.error,
    isFromSharedLink: !!remoteGameIdInput && !gameConnection.isConnected,
    isProcessingSharedLink,
  };

  const activeGameLayoutProps = {
    gameMode,
    player1Name: p1DisplayName,
    player2Name: p2DisplayName,
    localPlayerId: gameConnection.localPlayerId,
    connectedGameId: gameConnection.gameId,
    isAILoading,
    currentLanguage,
    onSquareClick: handleSquareClick,
    onPawnDragStart: handlePawnDragStart,
    onPawnDrop: handlePawnDrop,
    onResetGame: resetGameHandler,
    onOpenRules: () => setIsRulesOpen(true),
    onCopyGameLink: handleCopyGameLink,
    onGoBackToMenu: goBackToMenu,
    onSetLanguage: setLanguage,
  };

  const clientPlayerNameForWaitingRoom = useMemo(() => {
    const clientPlayer = gameConnection.players.find(
      (p) => p.playerId === gameConnection.localPlayerId
    );
    return clientPlayer?.name || remotePlayerNameInput || t("yourName");
  }, [
    gameConnection.players,
    gameConnection.localPlayerId,
    remotePlayerNameInput,
    t,
  ]);

  return (
    <>
      <GameViewRouter
        gameMode={isRematchInProgress ? "remote" : gameMode}
        isConnectingToRemote={
          gameConnection.isConnecting && !isRematchInProgress
        }
        isRemoteConnected={gameConnection.isConnected}
        remoteConnectionError={
          isRematchInProgress ? null : gameConnection.error
        }
        isWaitingForOpponent={
          gameConnection.isWaitingForOpponent && !isRematchInProgress
        }
        connectedGameId={gameConnection.gameId}
        activeGameState={activeGameState}
        selectScreenProps={selectScreenProps}
        activeGameLayoutProps={activeGameLayoutProps}
        onGoBackToMenu={goBackToMenu}
        clientPlayerNameForWaitingRoom={clientPlayerNameForWaitingRoom}
      />

      <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
        <RulesDialogContent
          pawnsPerPlayer={
            activeGameState?.options?.pawnsPerPlayer || PAWNS_PER_PLAYER
          }
        />
      </Dialog>

      {/* Only keep this modal for critical errors that require page-level action */}
      <GameExpiredModal
        isOpen={showGameExpiredModal && !isRematchInProgress}
        onCreateNew={handleModalCreateNewGame}
        onGoHome={handleModalGoHome}
        errorType={
          gameConnection.errorType === "INVALID_MOVE"
            ? "SERVER_ERROR"
            : gameConnection.errorType || "GAME_NOT_FOUND"
        }
        gameId={gameConnection.gameId || remoteGameIdInput}
      />
    </>
  );
}

export default CaroQuestPage;