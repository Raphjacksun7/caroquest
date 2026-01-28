// app/page.tsx - Clean main page without prop dependencies
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { useRouter } from "next/navigation";

// Hooks
import { useTranslation } from "@/hooks/useTranslation";
import { useGameConnection, gameStore } from "@/hooks/useGameConnection";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useGameSetup } from "@/hooks/useGameSetup";
import { usePersistence } from "@/hooks/usePersistence";

function CaroQuestPage() {
  const router = useRouter();
  const [gameMode, setGameMode] = useState<GameMode>("select");
  const [isRematchInProgress, setIsRematchInProgress] = useState(false);
  const [isProcessingSharedLink, setIsProcessingSharedLink] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const { save, loadSafe, remove, isHydrated } = usePersistence();

  // Handle game mode restoration from sessionStorage
  useEffect(() => {
    if (hasInitialized) return;

    if (typeof window !== "undefined") {
      const storedMode = sessionStorage.getItem("gameMode");
      const fromDirectURL = sessionStorage.getItem("fromDirectURL");
      
      if (storedMode && fromDirectURL === "true") {
        console.log("MAIN: Restoring game mode from direct URL:", storedMode);
        setGameMode(storedMode as GameMode);
        
        // Clear the direct URL flag after restoration
        sessionStorage.removeItem("fromDirectURL");
      }
    }

    setHasInitialized(true);
  }, [hasInitialized]);

  const {
    player1NameLocal,
    setPlayer1NameLocal,
    player2NameLocal,
    setPlayer2NameLocal,
    remotePlayerNameInput,
    setRemotePlayerNameInput,
    remoteGameIdInput,
    setRemoteGameIdInput,
    currentAiStrategy,
    setCurrentAiStrategy,
  } = useGameSetup({ gameIdFromUrl: "" });

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
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const hasRestoredStrategyRef = useRef(false);

  // Restore saved AI strategy after hydration (only once on mount)
  useEffect(() => {
    if (!isHydrated || hasRestoredStrategyRef.current) return;
    
    const savedStrategy = loadSafe('ai_strategy', 'normal');
    if (savedStrategy !== currentAiStrategy) {
      setCurrentAiStrategy(savedStrategy);
    }
    
    hasRestoredStrategyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  // Save AI strategy when changed
  useEffect(() => {
    if (gameMode === "ai") {
      save('ai_strategy', currentAiStrategy);
    }
  }, [currentAiStrategy, gameMode, save]);

  // Update URL based on game mode
  useEffect(() => {
    if (!hasInitialized) return;

    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      
      // Update URL to match game mode
      if (gameMode === "ai" && currentPath !== "/game/wizard") {
        console.log("MAIN: Updating URL for AI game");
        window.history.replaceState(null, "", "/game/wizard");
      } else if (gameMode === "local" && currentPath !== "/game/local") {
        console.log("MAIN: Updating URL for local game");
        window.history.replaceState(null, "", "/game/local");
      } else if (gameMode === "remote" && gameConnection.gameId) {
        const expectedPath = `/game/${gameConnection.gameId}`;
        if (currentPath !== expectedPath) {
          console.log("MAIN: Updating URL for remote game:", expectedPath);
          window.history.replaceState(null, "", expectedPath);
        }
      } else if (gameMode === "select" && currentPath !== "/") {
        console.log("MAIN: Updating URL for select screen");
        window.history.replaceState(null, "", "/");
      }

      // Persist game mode
      if (gameMode !== "select") {
        sessionStorage.setItem("gameMode", gameMode);
      } else {
        sessionStorage.removeItem("gameMode");
      }
    }
  }, [gameMode, gameConnection.gameId, hasInitialized]);

  // Handle shared link processing
  useEffect(() => {
    if (!hasInitialized || !isHydrated) return;

    if (typeof window !== "undefined") {
      const storedGameId = sessionStorage.getItem("sharedGameId");
      const fromSharedLink = sessionStorage.getItem("fromSharedLink");

      if (storedGameId && fromSharedLink === "true" && !isProcessingSharedLink) {
        console.log("MAIN: Processing shared game link:", storedGameId);
        
        // Check if this is the creator or a new joiner
        const isGameCreator = loadSafe(`creator_${storedGameId}`, false);
        console.log("MAIN: Is game creator:", isGameCreator);
        
        setIsProcessingSharedLink(true);
        
        // Clear browser autocomplete and set up for joining
        setRemotePlayerNameInput("");
        setRemoteGameIdInput(storedGameId);
        
        // Clear the shared link flag
        sessionStorage.removeItem("fromSharedLink");
        
        if (isGameCreator) {
          // Creator is returning, don't show select screen
          console.log("MAIN: Creator returning via shared link, redirecting to game page");
          router.push(`/game/${storedGameId}`);
        } else {
          // Show select screen with shared link banner for new joiners
          console.log("MAIN: New joiner via shared link, showing select screen");
          setGameMode("select");
        }
        
        setTimeout(() => {
          setIsProcessingSharedLink(false);
        }, 100);
      }
    }
  }, [hasInitialized, isHydrated, isProcessingSharedLink, setRemotePlayerNameInput, setRemoteGameIdInput, router, loadSafe]);

  // Handle game creation success to mark creator status
  useEffect(() => {
    if (gameConnection.gameId && gameMode === "remote" && !remoteGameIdInput.trim()) {
      // This means we just created a new game (no existing gameId was provided)
      console.log("MAIN: Marking as game creator for gameId:", gameConnection.gameId);
      save(`creator_${gameConnection.gameId}`, true);
      save(`player_${gameConnection.gameId}`, remotePlayerNameInput.trim());
    }
  }, [gameConnection.gameId, gameMode, remoteGameIdInput, remotePlayerNameInput, save]);

  // Handle connection errors
  useEffect(() => {
    if (
      gameConnection.error &&
      gameConnection.errorType &&
      !isRematchInProgress
    ) {
      console.log("MAIN: Game Connection Error received:", {
        error: gameConnection.error,
        type: gameConnection.errorType,
      });

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

  // Handle game mode changes from connection
  useEffect(() => {
    if (isRematchInProgress) return;

    if (
      gameConnection.gameId &&
      gameConnection.isConnected &&
      gameMode !== "remote"
    ) {
      console.log("MAIN: Active remote connection detected, switching to remote mode");
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
          console.log("MAIN: Rematch started");
          setIsRematchInProgress(true);
          setTimeout(() => setIsRematchInProgress(false), 2000);
        };

        const handleRematchRequested = () => {
          setIsRematchInProgress(true);
        };

        const handleRematchDeclined = () => {
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
      console.log(`MAIN: Starting game mode: ${mode}`);
      const currentOptions = activeGameState?.options || initialGameOptions;

      if (mode === "local" || mode === "ai") {
        resetLocalGame(currentOptions);
      }

      if (mode === "remote") {
        if (!remotePlayerNameInput.trim()) {
          console.error("MAIN: Player name required for remote game");
          return;
        }
        
        try {
          await gameConnection.connectSocketIO();
          if (remoteGameIdInput.trim()) {
            // Joining an existing game
            console.log("MAIN: Joining existing game:", remoteGameIdInput);
            await gameConnection.joinGame(
              remoteGameIdInput.trim(),
              remotePlayerNameInput.trim(),
              currentOptions
            );
          } else {
            // Creating a new game
            console.log("MAIN: Creating new game");
            await gameConnection.createGame(
              remotePlayerNameInput.trim(),
              currentOptions
            );
            // Creator status will be set in the useEffect above
          }
        } catch (err) {
          console.error("MAIN: Remote game failed:", err);
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
    console.log("MAIN: Going back to menu from:", gameMode);
    
    setIsRematchInProgress(false);
    setIsProcessingSharedLink(false);

    if (gameMode === "remote" && gameConnection.isConnected) {
      gameConnection.disconnect();
    }
    
    // Clear remote game data if going back from remote mode
    if (gameMode === "remote" && gameConnection.gameId) {
      remove(`creator_${gameConnection.gameId}`);
      remove(`player_${gameConnection.gameId}`);
    }
    
    setGameMode("select");
    gameConnection.clearError?.();
    router.push("/");
  }, [gameMode, gameConnection, router, remove]);

  const resetGameHandler = useCallback(() => {
    console.log(`MAIN: Resetting ${gameMode} game`);
    if (gameMode !== "remote") {
      resetLocalGame(activeGameState?.options || initialGameOptions);
    }
  }, [gameMode, resetLocalGame, activeGameState?.options, initialGameOptions]);

  // Remote game interaction handlers
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

      if (remoteGS.currentPlayerId !== gameConnection.localPlayerId) return;

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

  const handleCopyGameLink = useCallback(() => {
    if (typeof window !== "undefined" && gameConnection.gameId) {
      const shareableLink = `${window.location.origin}/game/${gameConnection.gameId}`;
  
      navigator.clipboard
        .writeText(shareableLink)
        .then(() => {
          console.log("MAIN: Game link copied:", shareableLink);
        })
        .catch((err) => {
          console.error("MAIN: Failed to copy game link:", err);
        });
    }
  }, [gameConnection.gameId]);

  // Modal handlers
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

  // Component props
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
    aiStrategy: currentAiStrategy,
    setAiStrategy: setCurrentAiStrategy,
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
    // Undo/Redo for local and AI games
    onUndo: gameMode !== "remote" ? handleUndo : undefined,
    onRedo: gameMode !== "remote" ? handleRedo : undefined,
    canUndo: gameMode !== "remote" ? canUndo : false,
    canRedo: gameMode !== "remote" ? canRedo : false,
    // AI Strategy toggle (only for AI mode)
    currentAiStrategy: gameMode === "ai" ? currentAiStrategy : undefined,
    onAiStrategyChange: gameMode === "ai" ? setCurrentAiStrategy : undefined,
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