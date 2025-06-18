"use client";

import React, { useState } from "react";
import type { GameState, PlayerId, GameMode } from "@/lib/types";
import { PlayerInfoBar } from "./PlayerInfoBar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bug, Check, ClipboardCopy } from "lucide-react";

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
}

export const SidePanel: React.FC<SidePanelProps> = ({
  gameState,
  player1Name,
  player2Name,
  localPlayerId,
  gameMode,
  onOpenRules,
  connectedGameId,
  onResetGame,
  onCopyGameLink,
}) => {
  const player1 = { name: player1Name, id: 1 as PlayerId };
  const player2 = { name: player2Name, id: 2 as PlayerId };

  let localPlayer, opponentPlayer;
  if (gameMode === "remote") {
    localPlayer = localPlayerId === 1 ? player1 : player2;
    opponentPlayer = localPlayerId === 1 ? player2 : player1;
  } else {
    localPlayer = player1;
    opponentPlayer = player2;
  }

  const isLocalPlayerTurn = gameState.currentPlayerId === localPlayer.id;
  const isOpponentTurn = gameState.currentPlayerId === opponentPlayer.id;
  const isAIOpponent = gameMode === "ai";

  const DesktopSidePanel = () => (
    <aside className="hidden lg:flex w-80 xl:w-96 flex-shrink-0 p-6 flex-col gap-6 h-full">
      {/* Opponent Section */}
      <div className="relative">
        <PlayerInfoBar
          playerName={opponentPlayer.name}
          playerId={opponentPlayer.id}
          isOpponent={true}
          isCurrentTurn={gameState.currentPlayerId === opponentPlayer.id}
          gameState={gameState}
        />
        {/* Opponent Turn Indicator */}
        {isOpponentTurn && (
          <div className="mt-2 text-center">
            {isAIOpponent && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Thinking...
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-grow flex flex-col gap-6 min-h-0">
        <div className="flex-grow flex flex-col gap-6 min-h-0">
          {/* Icon Toolbar Section - Integrated like in chess apps */}
          <div className="p-6 border border-gray-200 rounded-sm">
            <div className="grid grid-cols-2 gap-6">
              {/* First Row */}
              <button
                onClick={onResetGame}
                className="flex flex-col items-center gap-2 text-gray-600 hover:text-white transition-colors"
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
                      d="M12 4v4m0 0V4m0 4l-3-3m3 3l3-3"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 20v-4m0 0v4m0-4l-3 3m3-3l3 3"
                    />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">New game</span>
              </button>

              <button
                onClick={onOpenRules}
                className="flex flex-col items-center gap-2 text-gray-600 hover:text-white transition-colors"
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Settings</span>
              </button>

              {/* Second Row */}
              <button className="flex flex-col items-center gap-2 text-gray-600 hover:text-white transition-colors">
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
                onClick={onCopyGameLink}
                className="flex flex-col items-center gap-2 text-gray-600 hover:text-white transition-colors"
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
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                    />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Share game</span>
              </button>

              {/* Third Row */}
              <button className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-950 transition-colors">
                <Bug className="w-6 h-6 flex items-center justify-center" />
                <span className="text-sm text-gray-700">Report a bug</span>
              </button>

              <button className="flex flex-col items-center gap-2 text-gray-600 hover:text-white transition-colors">
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

          {/* Rematch Button */}
          <button
            onClick={onResetGame}
            className="mt-6 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-3 px-4 rounded-sm transition-colors"
          >
            Rematch
          </button>
        </div>
      </div>

      {/* Player Turn Indicator */}
      <div className="mt-2">
        <div className="inline-flex items-center text-lg font-medium text-gray-500">
          {isLocalPlayerTurn && " Your move"}
          {isOpponentTurn && `${opponentPlayer.name}'s move`}
        </div>
      </div>

      {/* Local Player Section */}
      <div className="relative">
        <PlayerInfoBar
          playerName={localPlayer.name}
          playerId={localPlayer.id}
          isOpponent={false}
          isCurrentTurn={gameState.currentPlayerId === localPlayer.id}
          gameState={gameState}
        />
      </div>
    </aside>
  );

  return (
    <>
      <DesktopSidePanel />
    </>
  );
};
