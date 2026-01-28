"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import type { GameState, PlayerId, GameMode, Locale } from "@/lib/types";
import { PlayerInfoBar } from "./PlayerInfoBar";
import { BookOpen, Bug, Home, Languages, Undo2, Redo2 } from "lucide-react";
import { InfoBoxData } from "@/lib/types";
import { useInfoSystem } from "@/hooks/useInfoSystem";
import { useGameConnection } from "@/hooks/useGameConnection";
import { InfoBox } from "./InfoBox";
import { useTranslation } from "@/hooks/useTranslation";

class SocketManager {
  private static instance: SocketManager;
  private socket: any = null;
  private lastSocketId: string | null = null;

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  setSocket(socket: any) {
    if (socket && socket.connected && socket.id !== this.lastSocketId) {
      this.socket = socket;
      this.lastSocketId = socket.id;
      console.log("SOCKET_MANAGER: Socket updated:", socket.id);
      (window as any).globalSocket = socket;
    }
  }

  getSocket(): any {
    if (this.socket?.connected) {
      return this.socket;
    }

    // Try global fallback
    const globalSocket = (window as any).globalSocket;
    if (globalSocket?.connected) {
      this.socket = globalSocket;
      this.lastSocketId = globalSocket.id;
      return globalSocket;
    }

    return null;
  }
}

interface SidePanelProps {
  gameState: GameState;
  player1Name: string;
  player2Name: string;
  localPlayerId: PlayerId | null;
  gameMode: GameMode;
  connectedGameId?: string | null;
  onCopyGameLink: () => void;
  onResetGame: () => void;
  onOpenRules: () => void;
  onGoBackToMenu: () => void;
  onSetLanguage: (lang: Locale) => void;
  currentLanguage: Locale;
  // Undo/Redo functionality
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  gameState,
  player1Name,
  player2Name,
  localPlayerId,
  gameMode,
  connectedGameId,
  onResetGame,
  onCopyGameLink,
  onOpenRules,
  onGoBackToMenu,
  onSetLanguage,
  currentLanguage,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  const gameConnection = useGameConnection();
  const {
    infos,
    addInfo,
    removeInfo,
    clearInfosByType,
    hasInfoOfType,
    replaceInfo,
    addTemporaryInfo,
  } = useInfoSystem();

  // Expose addTemporaryInfo to parent via global (for desktop)
  React.useEffect(() => {
    (window as any).__sidePanelAddInfo = (message: string, duration = 3000) => {
      addTemporaryInfo(
        {
          type: "info",
          message: message,
          priority: 6,
        },
        duration
      );
    };
    return () => {
      delete (window as any).__sidePanelAddInfo;
    };
  }, [addTemporaryInfo]);

  const { t } = useTranslation();

  const [rematchRequestId, setRematchRequestId] = useState<string | null>(null);
  const [undoRequestId, setUndoRequestId] = useState<string | null>(null);
  const [pendingUndoMovesToUndo, setPendingUndoMovesToUndo] = useState<number>(1);
  const socketManager = useMemo(() => SocketManager.getInstance(), []);
  const eventListenersSetup = useRef(false);
  const lastSocketId = useRef<string | null>(null);

  // STABLE: Memoized player objects to prevent re-renders
  const player1 = useMemo(
    () => ({ name: player1Name, id: 1 as PlayerId }),
    [player1Name]
  );
  const player2 = useMemo(
    () => ({ name: player2Name, id: 2 as PlayerId }),
    [player2Name]
  );

  const { localPlayer, opponentPlayer } = useMemo(() => {
    if (gameMode === "remote") {
      const local = localPlayerId === 1 ? player1 : player2;
      const opponent = localPlayerId === 1 ? player2 : player1;
      return { localPlayer: local, opponentPlayer: opponent };
    } else {
      return { localPlayer: player1, opponentPlayer: player2 };
    }
  }, [gameMode, localPlayerId, player1, player2]);

  const isLocalPlayerTurn = gameState.currentPlayerId === localPlayer.id;
  const isOpponentTurn = gameState.currentPlayerId === opponentPlayer.id;
  const isAIOpponent = gameMode === "ai";
  const hasWinner = !!gameState.winner;

  // STABLE: Socket storage effect with proper dependencies
  useEffect(() => {
    const socket = (gameConnection as any)._internalSocketRef?.current;

    if (socket && socket.connected && socket.id !== lastSocketId.current) {
      console.log("CLIENT: Storing socket:", socket.id);
      socketManager.setSocket(socket);
      lastSocketId.current = socket.id;
      (window as any).gameConnection = gameConnection;
    }
  }, [gameConnection, socketManager]);

  // STABLE: Game state effect with memoized dependencies
  useEffect(() => {
    if (hasWinner) {
      clearInfosByType("turn");
      clearInfosByType("waiting");

      const isLocalWinner = gameState.winner === localPlayer.id;

      replaceInfo("winner", {
        type: "winner",
        message: isLocalWinner ? "You won!" : `${opponentPlayer.name} won!`,
        persistent: true,
        priority: 10,
      });
    } else {
      clearInfosByType("winner");

      if (isLocalPlayerTurn) {
        replaceInfo("turn", {
          type: "turn",
          message: "Your move",
          persistent: true,
          priority: 8,
        });
      } else if (isOpponentTurn) {
        replaceInfo("turn", {
          type: "turn",
          message: `${opponentPlayer.name}'s move`,
          persistent: true,
          priority: 8,
        });
      }
    }
  }, [
    hasWinner,
    isLocalPlayerTurn,
    isOpponentTurn,
    isAIOpponent,
    gameState.winner,
    localPlayer.id,
    opponentPlayer.name,
    clearInfosByType,
    replaceInfo,
  ]);

  // STABLE: Event handlers with useCallback to prevent re-creation
  const handleRematchRequested = useCallback(
    (data: { requestedBy: string; playerName: string }) => {
      console.log("CLIENT: Received rematch_requested event:", data);

      clearInfosByType("request");
      clearInfosByType("waiting");

      const requestId = addInfo({
        type: "request",
        message: `${data.playerName} wants to play again`,
        persistent: true,
        priority: 9,
        actions: [
          {
            label: "Accept",
            onClick: () => {
              console.log("CLIENT: Accepting rematch request");
              try {
                gameConnection.respondToRematch(true);
                removeInfo(requestId);
                setRematchRequestId(null);

                addInfo({
                  type: "waiting",
                  message: "Starting new game...",
                  persistent: true,
                  priority: 7,
                });
              } catch (error: any) {
                console.error("CLIENT: Error accepting rematch:", error);
                addTemporaryInfo(
                  {
                    type: "error",
                    message: "Failed to accept rematch",
                  },
                  3000
                );
              }
            },
            variant: "default",
          },
          {
            label: "Decline",
            onClick: () => {
              console.log("CLIENT: Declining rematch request");
              try {
                gameConnection.respondToRematch(false);
                removeInfo(requestId);
                setRematchRequestId(null);

                addTemporaryInfo(
                  {
                    type: "info",
                    message: "Rematch declined",
                  },
                  2000
                );
              } catch (error: any) {
                console.error("CLIENT: Error declining rematch:", error);
                addTemporaryInfo(
                  {
                    type: "error",
                    message: "Failed to decline rematch",
                  },
                  3000
                );
              }
            },
            variant: "outline",
          },
        ],
      });

      setRematchRequestId(requestId);
    },
    [gameConnection, addInfo, removeInfo, clearInfosByType, addTemporaryInfo]
  );

  const handleRematchStarted = useCallback(() => {
    console.log("CLIENT: Received rematch_started event");
    clearInfosByType("request");
    clearInfosByType("waiting");
    setRematchRequestId(null);

    addTemporaryInfo(
      {
        type: "success",
        message: "New game started!",
      },
      3000
    );
  }, [clearInfosByType, addTemporaryInfo]);

  const handleRematchDeclined = useCallback(
    (data: { declinedBy: string; playerName: string }) => {
      console.log("CLIENT: Received rematch_declined event:", data);
      clearInfosByType("request");
      clearInfosByType("waiting");
      setRematchRequestId(null);

      addTemporaryInfo(
        {
          type: "info",
          message: `${data.playerName} declined the rematch`,
        },
        4000
      );
    },
    [clearInfosByType, addTemporaryInfo]
  );

  // UNDO Event Handlers
  const handleUndoRequested = useCallback(
    (data: { requestedBy: string; playerName: string; movesToUndo: number; requesterId: number }) => {
      console.log("CLIENT: Received undo_requested event:", data);

      clearInfosByType("request");
      
      // Store the movesToUndo for when we respond
      const movesToUndo = data.movesToUndo || 1;
      setPendingUndoMovesToUndo(movesToUndo);

      // Create a descriptive message based on how many moves will be undone
      const undoMessage = movesToUndo === 1
        ? `${data.playerName} wants to undo their move`
        : `${data.playerName} wants to undo ${movesToUndo} moves`;

      const requestId = addInfo({
        type: "request",
        message: undoMessage,
        persistent: true,
        priority: 9,
        actions: [
          {
            label: t("accept") || "Accept",
            onClick: () => {
              console.log(`CLIENT: Accepting undo request (${movesToUndo} moves)`);
              try {
                gameConnection.respondToUndo(true, movesToUndo);
                removeInfo(requestId);
                setUndoRequestId(null);
                setPendingUndoMovesToUndo(1);

                addTemporaryInfo(
                  {
                    type: "success",
                    message: t("undoAccepted") || "Undo accepted",
                  },
                  2000
                );
              } catch (error: any) {
                console.error("CLIENT: Error accepting undo:", error);
                addTemporaryInfo(
                  {
                    type: "error",
                    message: "Failed to accept undo",
                  },
                  3000
                );
              }
            },
            variant: "default",
          },
          {
            label: t("decline") || "Decline",
            onClick: () => {
              console.log("CLIENT: Declining undo request");
              try {
                gameConnection.respondToUndo(false, movesToUndo);
                removeInfo(requestId);
                setUndoRequestId(null);
                setPendingUndoMovesToUndo(1);

                addTemporaryInfo(
                  {
                    type: "info",
                    message: t("undoDeclined") || "Undo declined",
                  },
                  2000
                );
              } catch (error: any) {
                console.error("CLIENT: Error declining undo:", error);
                addTemporaryInfo(
                  {
                    type: "error",
                    message: "Failed to decline undo",
                  },
                  3000
                );
              }
            },
            variant: "outline",
          },
        ],
      });

      setUndoRequestId(requestId);
    },
    [gameConnection, addInfo, removeInfo, clearInfosByType, addTemporaryInfo, t]
  );

  const handleUndoApplied = useCallback(() => {
    console.log("CLIENT: Received undo_applied event");
    clearInfosByType("request");
    setUndoRequestId(null);

    addTemporaryInfo(
      {
        type: "success",
        message: t("moveUndone") || "Move undone",
      },
      3000
    );
  }, [clearInfosByType, addTemporaryInfo, t]);

  const handleUndoDeclined = useCallback(
    (data: { declinedBy: string; playerName: string }) => {
      console.log("CLIENT: Received undo_declined event:", data);
      clearInfosByType("request");
      clearInfosByType("request");
      setUndoRequestId(null);

      addTemporaryInfo(
        {
          type: "info",
          message: `${data.playerName} ${t("declinedUndo") || "declined your undo request"}`,
        },
        4000
      );
    },
    [clearInfosByType, addTemporaryInfo, t]
  );

  // OPTIMIZED: Event listeners setup only once per socket
  useEffect(() => {
    if (gameMode !== "remote") {
      eventListenersSetup.current = false;
      return;
    }

    const socket = socketManager.getSocket();

    if (socket && socket.connected && !eventListenersSetup.current) {
      console.log(
        "CLIENT: Setting up rematch and undo event listeners on socket:",
        socket.id
      );

      // Rematch events
      socket.on("rematch_requested", handleRematchRequested);
      socket.on("rematch_started", handleRematchStarted);
      socket.on("rematch_declined", handleRematchDeclined);
      
      // Undo events
      socket.on("undo_requested", handleUndoRequested);
      socket.on("undo_applied", handleUndoApplied);
      socket.on("undo_declined", handleUndoDeclined);

      eventListenersSetup.current = true;

      return () => {
        console.log("CLIENT: Cleaning up rematch and undo event listeners");
        if (socket) {
          socket.off("rematch_requested", handleRematchRequested);
          socket.off("rematch_started", handleRematchStarted);
          socket.off("rematch_declined", handleRematchDeclined);
          socket.off("undo_requested", handleUndoRequested);
          socket.off("undo_applied", handleUndoApplied);
          socket.off("undo_declined", handleUndoDeclined);
        }
        eventListenersSetup.current = false;
      };
    }
  }, [
    gameMode,
    socketManager,
    handleRematchRequested,
    handleRematchStarted,
    handleRematchDeclined,
    handleUndoRequested,
    handleUndoApplied,
    handleUndoDeclined,
  ]);

  // STABLE: Connection status with optimized dependencies
  useEffect(() => {
    if (gameMode !== "remote") return;

    if (gameConnection.isConnecting) {
      replaceInfo("connection", {
        type: "connection",
        message: "Connecting...",
        persistent: true,
        priority: 6,
      });
    } else if (!gameConnection.isConnected) {
      replaceInfo("connection", {
        type: "connection",
        message: "Connection lost",
        persistent: true,
        priority: 6,
      });
    } else if (gameConnection.isWaitingForOpponent) {
      replaceInfo("waiting", {
        type: "waiting",
        message: "Waiting for opponent...",
        persistent: true,
        priority: 7,
      });
    } else {
      clearInfosByType("connection");
      clearInfosByType("waiting");
    }
  }, [
    gameMode,
    gameConnection.isConnecting,
    gameConnection.isConnected,
    gameConnection.isWaitingForOpponent,
    replaceInfo,
    clearInfosByType,
  ]);

  // STABLE: Error handling with debounced updates
  const lastError = useRef<string | null>(null);
  useEffect(() => {
    if (gameConnection.error && gameConnection.error !== lastError.current) {
      lastError.current = gameConnection.error;

      console.log(
        "CLIENT: Handling error through info system:",
        gameConnection.error
      );

      if (gameConnection.errorType === "INVALID_MOVE") {
        addTemporaryInfo(
          {
            type: "error",
            message: gameConnection.error,
          },
          4000
        );
        gameConnection.clearError();
      } else if (gameConnection.errorType === "SERVER_ERROR") {
        addTemporaryInfo(
          {
            type: "error",
            message: `Server error: ${gameConnection.error}`,
          },
          6000
        );
        gameConnection.clearError();
      }
    } else if (!gameConnection.error) {
      lastError.current = null;
    }
  }, [
    gameConnection.error,
    gameConnection.errorType,
    addTemporaryInfo,
    gameConnection,
  ]);

  // STABLE: Memoized handlers to prevent re-creation
  const handleRematchClick = useCallback(() => {
    console.log("CLIENT: handleRematchClick called");

    if (gameMode === "local" || gameMode === "ai") {
      onResetGame();
      addTemporaryInfo({ type: "success", message: "New game started!" }, 2000);
    } else if (gameMode === "remote") {
      const socket = socketManager.getSocket();
      const gameId = gameConnection.gameId;

      if (!socket || !socket.connected || !gameId) {
        addTemporaryInfo(
          {
            type: "error",
            message: "Connection error. Please refresh the page.",
          },
          5000
        );
        return;
      }

      try {
        clearInfosByType("request");
        clearInfosByType("waiting");
        clearInfosByType("error");

        gameConnection.requestRematch();

        addInfo({
          type: "waiting",
          message: `Rematch request sent to ${opponentPlayer.name}...`,
          persistent: true,
          priority: 7,
          dismissible: true,
          onDismiss: () => {
            clearInfosByType("waiting");
            addTemporaryInfo(
              { type: "info", message: "Request cancelled" },
              2000
            );
          },
        });

        console.log("CLIENT: Rematch request sent successfully");
      } catch (error: any) {
        console.error("CLIENT: Error in rematch request:", error);
        addTemporaryInfo(
          {
            type: "error",
            message: `Failed to send rematch request: ${error.message}`,
          },
          5000
        );
      }
    }
  }, [
    gameMode,
    onResetGame,
    addTemporaryInfo,
    socketManager,
    gameConnection,
    opponentPlayer.name,
    clearInfosByType,
    addInfo,
  ]);

  const handleLanguageSwitch = () => {
    const nextLanguage = currentLanguage === "en" ? "fr" : "en";
    onSetLanguage(nextLanguage);
  };

  const showBugReport = useCallback(() => {
    addTemporaryInfo(
      {
        type: "info",
        message: "Found a bug? Help us improve!",
        actions: [
          {
            label: "Report",
            onClick: () => {
              addTemporaryInfo(
                {
                  type: "success",
                  message: "Thanks! Bug reporting coming soon.",
                },
                3000
              );
            },
            variant: "outline",
          },
        ],
      },
      8000
    );
  }, [addTemporaryInfo]);

  // Handle undo button click
  const handleUndoClick = useCallback(() => {
    // For remote mode, send undo request to server
    if (gameMode === "remote") {
      const socket = socketManager.getSocket();
      const gameId = gameConnection.gameId;

      if (!socket || !socket.connected || !gameId) {
        addTemporaryInfo(
          {
            type: "error",
            message: "Connection error. Please refresh the page.",
          },
          5000
        );
        return;
      }

      console.log("CLIENT: Requesting undo for remote game");
      gameConnection.requestUndo();
      addTemporaryInfo(
        {
          type: "info",
          message: t("undoRequestSent") || "Undo request sent to opponent",
        },
        3000
      );
    } else if (onUndo && canUndo) {
      // For local/AI mode, call the local undo handler
      onUndo();
    } else if (!canUndo) {
      addTemporaryInfo(
        {
          type: "info",
          message: t("noMovesToUndo") || "No moves to undo",
        },
        2000
      );
    }
  }, [gameMode, socketManager, gameConnection, onUndo, canUndo, addTemporaryInfo, t]);

  // Handle redo button click (only available for local/AI modes - button hidden in online)
  const handleRedoClick = useCallback(() => {
    if (onRedo && canRedo) {
      onRedo();
    } else if (!canRedo) {
      addTemporaryInfo(
        {
          type: "info",
          message: t("noMovesToRedo") || "No moves to redo",
        },
        2000
      );
    }
  }, [onRedo, canRedo, addTemporaryInfo, t]);

  const DesktopSidePanel = useMemo(
    () => (
      <aside className="hidden lg:flex w-80 xl:w-96 flex-shrink-0 p-6 flex-col gap-6 h-full">
        {/* Opponent Section */}
        <div className="relative">
          <PlayerInfoBar
            playerName={opponentPlayer.name}
            playerId={opponentPlayer.id}
            isOpponent={true}
            isCurrentTurn={gameState.currentPlayerId === opponentPlayer.id}
            gameState={gameState}
            gameMode={gameMode}
          />
        </div>

        <div className="flex-grow flex flex-col gap-6 min-h-0">
          <div className="flex-grow flex flex-col gap-6 min-h-0">
            {/* Icon Toolbar Section */}
            <div className="p-6 border border-gray-200 rounded-sm">
              <div className="grid grid-cols-2 gap-6">
                <button
                  onClick={onGoBackToMenu}
                  className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-950 transition-colors"
                >
                  <Home className="h-6 w-6 items-center justify-center" />
                  <span className="text-sm text-gray-700">{t("home")}</span>
                </button>

                <button
                  onClick={onOpenRules}
                  className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-950 transition-colors"
                >
                  <BookOpen className="h-6 w-6 items-center justify-center" />
                  <span className="text-sm text-gray-700">{t("rules")}</span>
                </button>

                <button
                  onClick={handleUndoClick}
                  disabled={(gameMode !== "remote" && !canUndo) || hasWinner}
                  className={`flex flex-col items-center gap-2 transition-colors ${
                    (gameMode === "remote" || canUndo) && !hasWinner
                      ? "text-gray-600 hover:text-gray-950"
                      : "text-gray-300 cursor-not-allowed"
                  }`}
                  title={
                    gameMode === "remote"
                      ? (t("requestUndo") || "Request Undo")
                      : canUndo
                        ? (t("undo") || "Undo")
                        : (t("noMovesToUndo") || "No moves to undo")
                  }
                >
                  <Undo2 className="h-6 w-6" />
                  <span className="text-sm">
                    {gameMode === "remote" ? (t("requestUndo") || "Request Undo") : (t("undo") || "Undo")}
                  </span>
                </button>

                                {/* Redo button - only shown for local/AI modes, hidden for online */}
                                {gameMode !== "remote" && (
                  <button
                    onClick={handleRedoClick}
                    disabled={!canRedo || hasWinner}
                    className={`flex flex-col items-center gap-2 transition-colors ${
                      canRedo && !hasWinner
                        ? "text-gray-600 hover:text-gray-950"
                        : "text-gray-300 cursor-not-allowed"
                    }`}
                    title={canRedo ? (t("redo") || "Redo") : (t("noMovesToRedo") || "No moves to redo")}
                  >
                    <Redo2 className="h-6 w-6" />
                    <span className="text-sm">{t("redo") || "Redo"}</span>
                  </button>
                )}

                <button
                  onClick={handleLanguageSwitch}
                  className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-950 transition-colors"
                >
                  <Languages className="h-6 w-6 items-center justify-center" />
                  <span className="text-sm text-gray-700">{t("language")}</span>
                </button>

                <button
                  onClick={showBugReport}
                  className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-950 transition-colors"
                >
                  <Bug className="w-6 h-6 flex items-center justify-center" />
                  <span className="text-sm text-gray-700">Report a bug</span>
                </button>


              </div>
            </div>

            {/* Conditional Rematch Button */}
            {hasWinner && (
              <button
                onClick={handleRematchClick}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-4 px-6 rounded-lg transition-colors text-lg"
              >
                Rematch
              </button>
            )}
          </div>
        </div>

        {/* Dynamic InfoBox system */}
        {infos.map((info: InfoBoxData) => (
          <InfoBox key={info.id} data={info} />
        ))}

        {/* Local Player Section */}
        <div className="relative">
          <PlayerInfoBar
            playerName={localPlayer.name}
            playerId={localPlayer.id}
            isOpponent={false}
            isCurrentTurn={gameState.currentPlayerId === localPlayer.id}
            gameState={gameState}
            gameMode={gameMode}
          />
        </div>
      </aside>
    ),
    [
      opponentPlayer,
      gameState,
      hasWinner,
      isOpponentTurn,
      isAIOpponent,
      onResetGame,
      onOpenRules,
      onGoBackToMenu,
      handleUndoClick,
      handleRedoClick,
      canUndo,
      canRedo,
      handleLanguageSwitch,
      showBugReport,
      handleRematchClick,
      infos,
      localPlayer,
      gameMode,
      t,
    ]
  );

  return DesktopSidePanel;
};
