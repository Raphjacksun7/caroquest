"use client";

import React from "react";
import type { GameState, PlayerId, GameMode } from "@/lib/types";

interface PlayerInfoBarProps {
  playerName: string;
  playerId: PlayerId;
  isOpponent: boolean;
  isCurrentTurn: boolean;
  gameState: GameState;
  gameMode?: GameMode; // NEW: Add gameMode prop
}

export const PlayerInfoBar: React.FC<PlayerInfoBarProps> = ({
  playerName,
  playerId,
  gameState,
  isCurrentTurn,
  isOpponent,
  gameMode,
}) => {
  const pawnsPlaced = gameState.board.filter(
    (square) => square.pawn?.playerId === playerId
  ).length;

  const pawnsToPlace =
    gameState.gamePhase === "placement" ? 6 - pawnsPlaced : 0;

  const hasWinner = !!gameState.winner;
  const isAIOpponent = gameMode === "ai";

  const TinyPawn = () => {
    const playerBgColorStyle: React.CSSProperties = {
      backgroundColor: `hsl(var(${
        playerId === 1 ? "--player1-pawn-color" : "--player2-pawn-color"
      }))`,
    };

    const dynamicBorderStyle: React.CSSProperties = {
      borderColor: `hsla(var(${
        playerId === 1 ? "--player1-pawn-color" : "--player2-pawn-color"
      }), 0.75)`,
    };

    return (
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm border border-opacity-75 aspect-square"
        style={{ ...playerBgColorStyle, ...dynamicBorderStyle }}
      >
        <div
          className="w-3 h-3 rounded-full opacity-40 aspect-square"
          style={{
            backgroundColor: `hsla(var(${
              playerId === 1 ? "--player1-pawn-color" : "--player2-pawn-color"
            }), 0.5)`,
          }}
        ></div>
      </div>
    );
  };

  return (
    <div className="py-4">
      {/* Player Name with Tiny Pawn */}
      <div className="flex items-center gap-3 mb-1">
        <TinyPawn />
        <h2 className="text-xl font-semibold text-gray-900">{playerName}</h2>
      </div>

      <p className="text-sm text-gray-500 ml-8">
        {!hasWinner && isCurrentTurn && isOpponent && isAIOpponent ? (
          <span className="text-[#555758] text-sm">Thinking...</span>
        ) : (
          gameState.gamePhase === "placement" && (
            <span className="text-[#555758] text-sm">
              Left {pawnsToPlace} to place
            </span>
          )
        )}
      </p>
    </div>
  );
};