"use client";

import React, { useState } from "react";
import type { GameState, PlayerId, GameMode } from "@/lib/types";
import { HistoryCard } from "@/components/game/HistoryCard";
import { PlayerInfoBar } from "./PlayerInfoBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ClipboardCopy } from "lucide-react";

interface SidePanelProps {
  gameState: GameState;
  player1Name: string;
  player2Name: string;
  localPlayerId: PlayerId | null;
  gameMode: GameMode;
  connectedGameId?: string | null;
  onCopyGameLink: () => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  gameState,
  player1Name,
  player2Name,
  localPlayerId,
  gameMode,
  connectedGameId,
  onCopyGameLink,
}) => {
  const [copied, setCopied] = useState(false);
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

  const handleCopyClick = () => {
    onCopyGameLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0 p-4 lg:p-6 flex flex-col gap-6">
      <PlayerInfoBar
        playerName={opponentPlayer.name}
        playerId={opponentPlayer.id}
        isOpponent={true}
        isCurrentTurn={gameState.currentPlayerId === opponentPlayer.id}
        gameState={gameState}
      />

      <div className="flex-grow flex flex-col gap-6">
        {gameMode === 'remote' && connectedGameId && (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Remote Game</CardTitle>
                    <CardDescription>Share the link with your opponent to have them join the game.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleCopyClick} className="w-full">
                        {copied ? (
                            <>
                                <Check className="h-4 w-4 mr-2"/>
                                Copied!
                            </>
                        ) : (
                            <>
                                <ClipboardCopy className="h-4 w-4 mr-2"/>
                                Copy Game Link
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        )}
        
        <HistoryCard gameState={gameState} />
      </div>

      <PlayerInfoBar
        playerName={localPlayer.name}
        playerId={localPlayer.id}
        isOpponent={false}
        isCurrentTurn={gameState.currentPlayerId === localPlayer.id}
        gameState={gameState}
      />
    </aside>
  );
};