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
import { BookOpen, Bug, Home, Languages } from "lucide-react";
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

  const { t } = useTranslation();

  const [rematchRequestId, setRematchRequestId] = useState<string | null>(null);
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

  // OPTIMIZED: Event listeners setup only once per socket
  useEffect(() => {
    if (gameMode !== "remote") {
      eventListenersSetup.current = false;
      return;
    }

    const socket = socketManager.getSocket();

    if (socket && socket.connected && !eventListenersSetup.current) {
      console.log(
        "CLIENT: Setting up rematch event listeners on socket:",
        socket.id
      );

      socket.on("rematch_requested", handleRematchRequested);
      socket.on("rematch_started", handleRematchStarted);
      socket.on("rematch_declined", handleRematchDeclined);

      eventListenersSetup.current = true;

      return () => {
        console.log("CLIENT: Cleaning up rematch event listeners");
        if (socket) {
          socket.off("rematch_requested", handleRematchRequested);
          socket.off("rematch_started", handleRematchStarted);
          socket.off("rematch_declined", handleRematchDeclined);
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

  const showFlipBoardInfo = useCallback(() => {
    addTemporaryInfo(
      {
        type: "info",
        message: "Board flipping feature coming soon!",
      },
      3000
    );
  }, [addTemporaryInfo]);

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
                  onClick={showFlipBoardInfo}
                  className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-950 transition-colors"
                >
                  <div className="w-8 h-8 flex items-center justify-center">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-700">Flip board</span>
                </button>

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

                <button className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-950 transition-colors">
                  <div className="w-8 h-8 flex items-center justify-center">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-700">Chat (soon)</span>
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
      onGoBackToMenu,
      showFlipBoardInfo,
      handleLanguageSwitch,
      showBugReport,
      handleRematchClick,
      infos,
      localPlayer,
    ]
  );

  return DesktopSidePanel;
};
