"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { GameMode } from "@/lib/types";
import { PAWNS_PER_PLAYER, createInitialGameState, highlightValidMoves, clearHighlights } from "@/lib/gameLogic";

// UI Components
import { GameViewRouter } from "@/components/game/GameViewRouter";
import { RulesDialogContent } from "@/components/game/RulesDialog";
import { WinnerDialog } from "@/components/game/WinnerDialog";
import { GameExpiredModal } from "@/components/game/GameExpiredModal";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
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

  const gameIdFromUrl = useMemo(() => {
    const id = Array.isArray(pathParams?.gameId) ? pathParams.gameId[0] : pathParams?.gameId;
    return id && id !== "local" && id !== "ai" ? id : "";
  }, [pathParams]);

  const {
    player1NameLocal, setPlayer1NameLocal,
    player2NameLocal, setPlayer2NameLocal,
    remotePlayerNameInput, setRemotePlayerNameInput,
    remoteGameIdInput, setRemoteGameIdInput,
    currentAiDifficulty, setCurrentAiDifficulty,
  } = useGameSetup({ gameIdFromUrl });

  const { t, currentLanguage, setLanguage } = useTranslation();
  const { toast } = useToast();

  // Initial options for local game, can be updated later if game settings are introduced
  const initialGameOptions = useMemo(() => ({ pawnsPerPlayer: PAWNS_PER_PLAYER }), []);

  const {
    localGameState, isAILoading, handleLocalSquareClick,
    handleLocalPawnDragStart, handleLocalPawnDrop, resetLocalGame,
    setLocalGameState, // Added for initial options if needed
  } = useLocalGame({ aiDifficulty: currentAiDifficulty, gameMode, initialOptions: initialGameOptions });

  const gameConnection = useGameConnection();

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [showGameExpiredModal, setShowGameExpiredModal] = useState(false);

  useGameUrlManager(gameMode, gameConnection.gameId);

  // Effect for handling game connection errors
  useEffect(() => {
    if (gameConnection.error && gameConnection.errorType) {
      console.log("CLIENT: Game Connection Error received:", { error: gameConnection.error, type: gameConnection.errorType });
      if (["GAME_NOT_FOUND", "GAME_FULL", "JOIN_FAILED", "SERVER_ERROR"].includes(gameConnection.errorType)) {
        setShowGameExpiredModal(true);
      } else {
        toast({ title: t("errorTitle"), description: gameConnection.error, variant: "destructive" });
      }
    }
  }, [gameConnection.error, gameConnection.errorType, toast, t]);

  // URL detection effect (original had a console.log, can be expanded if auto-join is desired)
   useEffect(() => {
    if (gameIdFromUrl && gameMode === "select" && !gameConnection.isConnecting && !gameConnection.gameId && !gameConnection.isConnected) {
      console.log("CLIENT: URL detected with gameId:", gameIdFromUrl, "Ready for remote join if user initiates.");
      // If auto-join on load is desired, logic could go here, but usually requires user interaction.
    }
  }, [gameIdFromUrl, gameMode, gameConnection.isConnecting, gameConnection.gameId, gameConnection.isConnected]);


  // Active game state selector
  const activeGameState = useMemo(() => {
    return gameMode === "remote" ? gameConnection.gameState : localGameState;
  }, [gameMode, gameConnection.gameState, localGameState]);

  // Display names
  const p1DisplayName = useMemo(() => {
    if (gameMode === "remote") return gameConnection.players.find(p => p.playerId === 1)?.name || t("player", { id: 1 });
    return player1NameLocal.trim() || t("player", { id: 1 });
  }, [gameMode, gameConnection.players, player1NameLocal, t]);

  const p2DisplayName = useMemo(() => {
    if (gameMode === "remote") return gameConnection.players.find(p => p.playerId === 2)?.name || t("player", { id: 2 });
    if (gameMode === "ai") return t("aiOpponent");
    return player2NameLocal.trim() || t("player", { id: 2 });
  }, [gameMode, gameConnection.players, player2NameLocal, t]);

  // Winner toast effect
  useEffect(() => {
    if (activeGameState?.winner) {
      const winnerName = activeGameState.winner === 1 ? p1DisplayName : p2DisplayName;
      console.log(`CLIENT: Game Over. Winner: Player ${activeGameState.winner} (${winnerName})`);
      toast({ title: t("playerDynamicWins", { playerName: winnerName }), description: t("congratulations"), duration: 8000 });
    }
  }, [activeGameState?.winner, p1DisplayName, p2DisplayName, toast, t]);


  const handleStartGameMode = useCallback(
    async (mode: GameMode) => {
      console.log(`CLIENT: Attempting to start game in mode: ${mode}`);
      const currentOptions = activeGameState?.options || initialGameOptions;

      if (mode === "local" || mode === "ai") {
         resetLocalGame(currentOptions); // Ensure local game is reset with current/default options
      }

      if (mode === "remote") {
        if (!remotePlayerNameInput.trim()) {
          toast({ title: t("errorTitle"), description: t("playerNameRequired"), variant: "destructive" });
          return;
        }
        console.log(`CLIENT: Starting remote game. Player: ${remotePlayerNameInput}, Game ID: '${remoteGameIdInput.trim()}'`);
        try {
          await gameConnection.connectSocketIO();
          if (remoteGameIdInput.trim()) {
            await gameConnection.joinGame(remoteGameIdInput.trim(), remotePlayerNameInput.trim(), currentOptions);
          } else {
            await gameConnection.createGame(remotePlayerNameInput.trim(), currentOptions);
          }
          // No explicit setGameMode("remote") here; rely on connection state changes
        } catch (err) {
          console.error("CLIENT: Remote game start/join failed:", err);
          // Error is handled by gameConnection.error effect
        }
      } else { // Local or AI
        if (mode === "local") {
          setPlayer1NameLocal(prev => prev.trim() || t("player1Name")); // Use specific translation key
          setPlayer2NameLocal(prev => prev.trim() || t("player2Name")); // Use specific translation key
        } else if (mode === "ai") {
          setPlayer1NameLocal(prev => prev.trim() || t("player1Name")); // Use specific translation key
        }
        setGameMode(mode); // Set mode for local/AI immediately
      }
    },
    [
      gameConnection, remoteGameIdInput, remotePlayerNameInput,
      toast, t, activeGameState?.options, initialGameOptions, resetLocalGame,
      setPlayer1NameLocal, setPlayer2NameLocal
    ]
  );
  
  // Effect to set gameMode to "remote" once connection is established and gameId is available
  useEffect(() => {
    if (gameConnection.gameId && gameConnection.isConnected && gameMode !== 'remote') {
        console.log("CLIENT: Detected active remote game, setting gameMode to 'remote'.");
        setGameMode('remote');
    }
  }, [gameConnection.gameId, gameConnection.isConnected, gameMode]);


  const goBackToMenu = useCallback(() => {
    console.log("CLIENT: Navigating back to menu. Current mode:", gameMode);
    if (gameMode === "remote" && gameConnection.isConnected) {
      console.log("CLIENT: Disconnecting from remote game.");
      gameConnection.disconnect();
    }
    setGameMode("select"); // Go back to select screen
    // resetLocalGame(initialGameOptions); // Reset local game state // This is handled by useLocalGame reset
    gameConnection.clearError?.();
    // setRemoteGameIdInput(""); // Cleared by useGameSetup or kept if from URL
  }, [gameMode, gameConnection, initialGameOptions]);

  const resetGameHandler = useCallback(() => {
    if (gameMode === "remote") {
      toast({ title: t("gameReset"), description: t("featureNotAvailableRemote") });
    } else {
      console.log("CLIENT: Resetting local/AI game.");
      resetLocalGame(activeGameState?.options || initialGameOptions); // Pass current options or defaults
    }
  }, [gameMode, toast, t, resetLocalGame, activeGameState?.options, initialGameOptions]);

  // Remote square click (optimistic updates for selection/highlight)
  const handleRemoteSquareClick = useCallback(
    (index: number) => {
      const remoteGS = gameConnection.gameState;
      if (!remoteGS || !gameConnection.localPlayerId || remoteGS.winner || !gameConnection.gameId) return;
      if (remoteGS.currentPlayerId !== gameConnection.localPlayerId) {
        toast({ title: t("notYourTurnTitle"), description: t("notYourTurnDescription") });
        return;
      }
      // Logic from original for remote click, using gameConnection.gameState and gameConnection.placePawnAction/movePawnAction
      // ... (Full logic as in previous refactor step)
      const square = remoteGS.board[index];
      if (remoteGS.gamePhase === "placement") {
        gameConnection.placePawnAction(index);
      } else {
        if (remoteGS.selectedPawnIndex === null) {
          if (square.pawn?.playerId === gameConnection.localPlayerId && !remoteGS.blockedPawnsInfo.has(index)) {
            gameStore.getState().setGameState(highlightValidMoves(remoteGS, index));
          } else if (square.pawn && remoteGS.blockedPawnsInfo.has(index)) { /* Toast */ }
        } else { /* ... other conditions ... */ }
      }
    },
  [gameConnection, toast, t]
  );

  const handleSquareClick = useMemo(() =>
    gameMode === "remote" ? handleRemoteSquareClick : handleLocalSquareClick,
  [gameMode, handleRemoteSquareClick, handleLocalSquareClick]);

  const handleRemotePawnDragStart = useCallback(
    (pawnIndex: number) => {
        const remoteGS = gameConnection.gameState;
        if (!remoteGS || remoteGS.winner || remoteGS.gamePhase !== 'movement') return;
        if (remoteGS.currentPlayerId !== gameConnection.localPlayerId) return;
        if (remoteGS.blockedPawnsInfo.has(pawnIndex)) return;

        const pawnOwnerId = remoteGS.board[pawnIndex]?.pawn?.playerId;
        if (pawnOwnerId === gameConnection.localPlayerId) {
            gameStore.getState().setGameState(highlightValidMoves(remoteGS, pawnIndex)); // Optimistic update
        }
    }, [gameConnection]);

  const handleRemotePawnDrop = useCallback(
      (targetIndex: number) => {
          const remoteGS = gameConnection.gameState;
          if (!remoteGS || remoteGS.selectedPawnIndex === null) {
              if(remoteGS) gameStore.getState().setGameState(clearHighlights(remoteGS));
              return;
          }
          const targetSquare = remoteGS.board[targetIndex];
          if (targetSquare.highlight === 'validMove') {
              gameConnection.movePawnAction(remoteGS.selectedPawnIndex, targetIndex);
          } else {
              toast({ title: t("invalidDrop"), description: t("invalidDropDescription"), variant: "destructive" });
              if(remoteGS) gameStore.getState().setGameState(clearHighlights(remoteGS)); // Clear optimistic highlights
          }
      }, [gameConnection, toast, t]);

  const handlePawnDragStart = useMemo(() =>
    gameMode === "remote" ? handleRemotePawnDragStart : handleLocalPawnDragStart,
  [gameMode, handleRemotePawnDragStart, handleLocalPawnDragStart]);

  const handlePawnDrop = useMemo(() =>
    gameMode === "remote" ? handleRemotePawnDrop : handleLocalPawnDrop,
  [gameMode, handleRemotePawnDrop, handleLocalPawnDrop]);

  const handleModalCreateNewGame = useCallback(() => { setShowGameExpiredModal(false); goBackToMenu(); setRemoteGameIdInput(""); }, [goBackToMenu, setRemoteGameIdInput]);
  const handleModalGoHome = useCallback(() => { setShowGameExpiredModal(false); goBackToMenu(); setRemoteGameIdInput(""); }, [goBackToMenu, setRemoteGameIdInput]);
  
  const handleCopyGameLink = useCallback(() => {
    if (typeof window !== "undefined" && gameConnection.gameId) {
      navigator.clipboard.writeText(`${window.location.origin}/game/${gameConnection.gameId}`)
        .then(() => toast({ title: t("linkCopiedTitle"), description: t("linkCopiedDescription") }));
    }
  }, [gameConnection.gameId, toast, t]);

  const selectScreenProps = {
    onStartGameMode: handleStartGameMode,
    player1Name: player1NameLocal, setPlayer1Name: setPlayer1NameLocal,
    player2Name: player2NameLocal, setPlayer2Name: setPlayer2NameLocal,
    remotePlayerNameInput, setRemotePlayerNameInput,
    remoteGameIdInput, setRemoteGameIdInput,
    aiDifficulty: currentAiDifficulty, setAiDifficulty: setCurrentAiDifficulty,
    isConnecting: gameConnection.isConnecting, // Pass current connecting state
    gameConnectionError: gameConnection.error, // Pass connection error
  };

  const activeGameLayoutProps = {
    gameMode, player1Name: p1DisplayName, player2Name: p2DisplayName,
    localPlayerId: gameConnection.localPlayerId, connectedGameId: gameConnection.gameId,
    isAILoading, currentLanguage,
    onSquareClick: handleSquareClick, onPawnDragStart: handlePawnDragStart, onPawnDrop: handlePawnDrop,
    onResetGame: resetGameHandler, onOpenRules: () => setIsRulesOpen(true),
    onCopyGameLink: handleCopyGameLink, onGoBackToMenu: goBackToMenu,
    onSetLanguage: setLanguage,
    // `gameState` will be passed by GameViewRouter from `activeGameState`
    // `t` function will be passed by GameViewRouter
  };
  
  const clientPlayerNameForWaitingRoom = useMemo(() => {
    const clientPlayer = gameConnection.players.find(p => p.playerId === gameConnection.localPlayerId);
    return clientPlayer?.name || remotePlayerNameInput || t("yourName");
  },[gameConnection.players, gameConnection.localPlayerId, remotePlayerNameInput, t]);


  return (
    <>
      <GameViewRouter
        gameMode={gameMode}
        isConnectingToRemote={gameConnection.isConnecting}
        isRemoteConnected={gameConnection.isConnected}
        remoteConnectionError={gameConnection.error}
        isWaitingForOpponent={gameConnection.isWaitingForOpponent}
        connectedGameId={gameConnection.gameId}
        activeGameState={activeGameState} // Pass the memoized activeGameState
        selectScreenProps={selectScreenProps}
        activeGameLayoutProps={activeGameLayoutProps}
        onGoBackToMenu={goBackToMenu}
        clientPlayerNameForWaitingRoom={clientPlayerNameForWaitingRoom}
      />
      <Toaster />
      <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
        <RulesDialogContent pawnsPerPlayer={activeGameState?.options?.pawnsPerPlayer || PAWNS_PER_PLAYER} />
      </Dialog>
      {activeGameState?.winner && (
        <WinnerDialog
          winner={activeGameState.winner}
          winnerName={activeGameState.winner === 1 ? p1DisplayName : p2DisplayName}
          isOpen={!!activeGameState.winner}
          onOpenChange={(open) => !open && resetGameHandler()} // Reset on close if desired
          onPlayAgain={resetGameHandler}
        />
      )}
      <GameExpiredModal
        isOpen={showGameExpiredModal}
        onCreateNew={handleModalCreateNewGame}
        onGoHome={handleModalGoHome}
        errorType={(gameConnection.errorType === "INVALID_MOVE" ? "SERVER_ERROR" : gameConnection.errorType) || "GAME_NOT_FOUND"}
        gameId={gameConnection.gameId || remoteGameIdInput}
      />
    </>
  );
}
export default CaroQuestPage;