"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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

// Hooks
import { useTranslation } from "@/hooks/useTranslation";
import { useGameConnection, gameStore } from "@/hooks/useGameConnection";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useGameSetup } from "@/hooks/useGameSetup";
import { usePersistence } from "@/hooks/usePersistence";

// Valid game ID pattern: alphanumeric, 4-12 characters
const GAME_ID_REGEX = /^[A-Z0-9]{4,12}$/;

export default function RemoteGamePage() {
  const params = useParams();
  const router = useRouter();
  const [currentGameMode, setCurrentGameMode] = useState<GameMode>("select");
  
  const [isValidating, setIsValidating] = useState(true);
  const [gameId, setGameId] = useState<string>("");
  const [isRematchInProgress, setIsRematchInProgress] = useState(false);
  const [showGameExpiredModal, setShowGameExpiredModal] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isAutoRejoining, setIsAutoRejoining] = useState(false);
  const { save, loadSafe, remove, isHydrated } = usePersistence();

  // Validate game ID from URL
  useEffect(() => {
    const extractedGameId = Array.isArray(params?.gameId) 
      ? params.gameId[0] 
      : params?.gameId;

    console.log("REMOTE GAME: Validating gameId:", extractedGameId);

    if (!extractedGameId || !GAME_ID_REGEX.test(extractedGameId)) {
      console.log("REMOTE GAME: Invalid gameId, redirecting home");
      router.replace("/");
      return;
    }

    console.log("REMOTE GAME: Valid gameId detected:", extractedGameId);
    setGameId(extractedGameId);
    setIsValidating(false);
  }, [params, router]);

  const {
    remotePlayerNameInput,
    setRemotePlayerNameInput,
    remoteGameIdInput,
    setRemoteGameIdInput,
    currentAiDifficulty,
  } = useGameSetup({ gameIdFromUrl: gameId });

  const { t, currentLanguage, setLanguage } = useTranslation();

  // Initial options
  const initialGameOptions = useMemo(
    () => ({ pawnsPerPlayer: PAWNS_PER_PLAYER }),
    []
  );

  const {
    localGameState,
    isAILoading,
  } = useLocalGame({
    aiDifficulty: currentAiDifficulty,
    gameMode: currentGameMode,
    initialOptions: initialGameOptions,
  });

  const gameConnection = useGameConnection();

  // Set up for shared link when gameId is available
  useEffect(() => {
    if (gameId && !remoteGameIdInput && isHydrated) {
      console.log("REMOTE GAME: Setting up for gameId:", gameId);
      setRemoteGameIdInput(gameId);
      
      // Check if this is a returning player
      const savedPlayerName = loadSafe(`player_${gameId}`, '');
      const isGameCreator = loadSafe(`creator_${gameId}`, false);
      
      console.log("REMOTE GAME: Saved player name:", savedPlayerName);
      console.log("REMOTE GAME: Is game creator:", isGameCreator);
      
      if (savedPlayerName) {
        // Either creator or returning joiner - auto-rejoin
        console.log("REMOTE GAME: Returning player detected, auto-rejoining");
        setRemotePlayerNameInput(savedPlayerName);
        setIsAutoRejoining(true);
        setCurrentGameMode("remote");
        
        setTimeout(() => {
          handleStartGameMode("remote");
        }, 300);
      } else {
        // New joiner
        console.log("REMOTE GAME: New joiner - showing select screen");
        setRemotePlayerNameInput("");
        setCurrentGameMode("select");
      }
    }
  }, [gameId, remoteGameIdInput, setRemoteGameIdInput, setRemotePlayerNameInput, isHydrated, loadSafe]);

  // Handle successful connection - switch to remote mode
  useEffect(() => {
    if (gameConnection.isConnected && currentGameMode === "select") {
      console.log("REMOTE GAME: Successfully connected, switching to remote mode");
      setCurrentGameMode("remote");
    }
  }, [gameConnection.isConnected, currentGameMode]);

  // Handle connection state changes to clear auto-rejoining
  useEffect(() => {
    if (gameConnection.isConnected || gameConnection.error) {
      setIsAutoRejoining(false);
    }
  }, [gameConnection.isConnected, gameConnection.error]);

  // Handle connection errors
  useEffect(() => {
    if (
      gameConnection.error &&
      gameConnection.errorType &&
      !isRematchInProgress
    ) {
      console.log("REMOTE GAME: Connection error received:", {
        error: gameConnection.error,
        type: gameConnection.errorType,
      });

      if (
        ["GAME_NOT_FOUND", "GAME_FULL", "JOIN_FAILED"].includes(
          gameConnection.errorType
        )
      ) {
        setShowGameExpiredModal(true);
      }
    }
  }, [gameConnection.error, gameConnection.errorType, isRematchInProgress]);

  // Handle rematch events
  useEffect(() => {
    if (currentGameMode === "remote") {
      const socket = (gameConnection as any)._internalSocketRef?.current;

      if (socket) {
        const handleRematchStarted = () => {
          console.log("REMOTE GAME: Rematch started");
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
  }, [currentGameMode, gameConnection]);

  // Active game state selector
  const activeGameState = useMemo(() => {
    return gameConnection.gameState || localGameState;
  }, [gameConnection.gameState, localGameState]);

  // Display names
  const p1DisplayName = useMemo(() => {
    return (
      gameConnection.players.find((p) => p.playerId === 1)?.name ||
      t("player", { id: 1 })
    );
  }, [gameConnection.players, t]);

  const p2DisplayName = useMemo(() => {
    return (
      gameConnection.players.find((p) => p.playerId === 2)?.name ||
      t("player", { id: 2 })
    );
  }, [gameConnection.players, t]);

  const handleStartGameMode = useCallback(
    async (mode: GameMode) => {
      if (mode !== "remote") return;
      
      console.log("REMOTE GAME: Starting remote game mode");
      
      if (!remotePlayerNameInput.trim()) {
        console.error("REMOTE GAME: Player name required");
        return;
      }
      
      // Save player name for refresh scenarios
      save(`player_${gameId}`, remotePlayerNameInput.trim());
      
      try {
        await gameConnection.connectSocketIO();
        await gameConnection.joinGame(
          gameId,
          remotePlayerNameInput.trim(),
          initialGameOptions
        );
      } catch (err) {
        console.error("REMOTE GAME: Failed to join:", err);
      }
    },
    [gameConnection, gameId, remotePlayerNameInput, initialGameOptions, save]
  );

  const goBackToMenu = useCallback(() => {
    console.log("REMOTE GAME: Going back to menu");
    
    if (gameConnection.isConnected) {
      gameConnection.disconnect();
    }
    
    // Clean up saved data when leaving
    remove(`player_${gameId}`);
    remove(`creator_${gameId}`);
    
    gameConnection.clearError?.();
    router.push("/");
  }, [gameConnection, router, gameId, remove]);

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

  const handleCopyGameLink = useCallback(() => {
    if (typeof window !== "undefined" && gameId) {
      const shareableLink = `${window.location.origin}/game/${gameId}`;
  
      navigator.clipboard
        .writeText(shareableLink)
        .then(() => {
          console.log("REMOTE GAME: Link copied:", shareableLink);
        })
        .catch((err) => {
          console.error("REMOTE GAME: Failed to copy link:", err);
        });
    }
  }, [gameId]);

  // Modal handlers
  const handleModalCreateNewGame = useCallback(() => {
    setShowGameExpiredModal(false);
    goBackToMenu();
  }, [goBackToMenu]);

  const handleModalGoHome = useCallback(() => {
    setShowGameExpiredModal(false);
    goBackToMenu();
  }, [goBackToMenu]);

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

  // Show loading while validating or auto-rejoining
  if (isValidating || isAutoRejoining) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {isAutoRejoining ? "Reconnecting..." : "Loading Game..."}
            </h2>
            {gameId && (
              <p className="text-sm text-gray-600 font-mono">
                Game ID: {gameId}
              </p>
            )}
            <p className="text-sm text-gray-500">
              Please wait...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Component props
  const selectScreenProps = {
    onStartGameMode: handleStartGameMode,
    player1Name: "",
    setPlayer1Name: () => {},
    player2Name: "",
    setPlayer2Name: () => {},
    remotePlayerNameInput,
    setRemotePlayerNameInput,
    remoteGameIdInput,
    setRemoteGameIdInput,
    aiDifficulty: currentAiDifficulty,
    setAiDifficulty: () => {},
    isConnecting: gameConnection.isConnecting,
    gameConnectionError: gameConnection.error,
    isFromSharedLink: true,
    isProcessingSharedLink: false,
  };

  const activeGameLayoutProps = {
    gameMode: currentGameMode,
    player1Name: p1DisplayName,
    player2Name: p2DisplayName,
    localPlayerId: gameConnection.localPlayerId,
    connectedGameId: gameConnection.gameId,
    isAILoading,
    currentLanguage,
    onSquareClick: handleRemoteSquareClick,
    onPawnDragStart: handleRemotePawnDragStart,
    onPawnDrop: handleRemotePawnDrop,
    onResetGame: () => {},
    onOpenRules: () => setIsRulesOpen(true),
    onCopyGameLink: handleCopyGameLink,
    onGoBackToMenu: goBackToMenu,
    onSetLanguage: setLanguage,
  };

  return (
    <>
      <GameViewRouter
        gameMode={isRematchInProgress ? "remote" : currentGameMode}
        isConnectingToRemote={
          (gameConnection.isConnecting && !isRematchInProgress) || isAutoRejoining
        }
        isRemoteConnected={gameConnection.isConnected && !isAutoRejoining}
        remoteConnectionError={
          isRematchInProgress || isAutoRejoining ? null : gameConnection.error
        }
        isWaitingForOpponent={
          gameConnection.isWaitingForOpponent && !isRematchInProgress && !isAutoRejoining
        }
        connectedGameId={gameConnection.gameId}
        activeGameState={activeGameState}
        selectScreenProps={selectScreenProps}
        activeGameLayoutProps={activeGameLayoutProps}
        onGoBackToMenu={goBackToMenu}
        clientPlayerNameForWaitingRoom={clientPlayerNameForWaitingRoom}
      />

      <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
        <RulesDialogContent pawnsPerPlayer={PAWNS_PER_PLAYER} />
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
        gameId={gameConnection.gameId || gameId}
      />
    </>
  );
}