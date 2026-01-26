"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { GameState, GameMode, PlayerId } from "@/lib/types";
import { InfoBox } from "./InfoBox";
import { useInfoSystem } from "@/hooks/useInfoSystem";
import { useGameConnection } from "@/hooks/useGameConnection";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface TopPanelMobileProps {
  gameState: GameState;
  gameMode: GameMode;
  player1Name: string;
  player2Name: string;
  localPlayerId: PlayerId | null;
  onResetGame: () => void;
}

export const TopPanelMobile: React.FC<TopPanelMobileProps> = ({
  gameState,
  gameMode,
  player1Name,
  player2Name,
  localPlayerId,
  onResetGame,
}) => {
  const gameConnection = useGameConnection();
  const {
    infos,
    addInfo,
    removeInfo,
    clearInfosByType,
    replaceInfo,
    addTemporaryInfo,
  } = useInfoSystem();

  const [rematchRequestId, setRematchRequestId] = useState<string | null>(null);
  const eventListenersSetup = useRef(false);

  // Memoized player objects
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

  // Rematch event handlers
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

  // Socket event listeners for rematch
  useEffect(() => {
    if (gameMode !== "remote") {
      eventListenersSetup.current = false;
      return;
    }

    const socket = (gameConnection as any)._internalSocketRef?.current;

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
    handleRematchRequested,
    handleRematchStarted,
    handleRematchDeclined,
    gameConnection,
  ]);

  // Game state effects
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
        if (isAIOpponent) {
          replaceInfo("turn", {
            type: "turn",
            message: "AI thinking...",
            persistent: true,
            priority: 8,
          });
        } else {
          replaceInfo("turn", {
            type: "turn",
            message: `${opponentPlayer.name}'s move`,
            persistent: true,
            priority: 8,
          });
        }
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

  // Connection status for remote games
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

  // Handle rematch/play again button click
  const [isRequestingRematch, setIsRequestingRematch] = useState(false);

  const handlePlayAgain = useCallback(() => {
    if (gameMode === "remote") {
      // For remote games, request rematch through socket
      setIsRequestingRematch(true);
      try {
        gameConnection.requestRematch();
        addTemporaryInfo(
          {
            type: "info",
            message: "Rematch request sent...",
          },
          3000
        );
      } catch (error) {
        console.error("CLIENT: Error requesting rematch:", error);
        addTemporaryInfo(
          {
            type: "error",
            message: "Failed to request rematch",
          },
          3000
        );
      }
      // Reset after a delay
      setTimeout(() => setIsRequestingRematch(false), 3000);
    } else {
      // For local/AI games, just reset
      onResetGame();
    }
  }, [gameMode, gameConnection, onResetGame, addTemporaryInfo]);

  // Mobile InfoBox Display - show important infos (centered)
  const MobileInfoDisplay = () => {
    const mobileInfos = infos.filter(
      (info) =>
        (info.priority ?? 0) >= 7 || // High priority messages
        info.type === "error" ||
        info.type === "success"
    );

    if (mobileInfos.length === 0 && !hasWinner) return null;

    return (
      <div className="w-full px-4 pb-2 space-y-3 flex flex-col items-center">
        {mobileInfos.map((info) => (
          <InfoBox key={info.id} data={info} />
        ))}
        
        {/* Rematch/Play Again Button - Show when game is over */}
        {hasWinner && (
          <Button
            onClick={handlePlayAgain}
            disabled={isRequestingRematch}
            className="w-full max-w-xs"
            size="lg"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {gameMode === "remote" 
              ? (isRequestingRematch ? "Requesting..." : "Request Rematch")
              : "Play Again"
            }
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="lg:hidden">
      {/* Mobile Info Display - Above game board (centered) */}
      <MobileInfoDisplay />
    </div>
  );
};
