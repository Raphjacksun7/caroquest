"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import React from "react";
import { Lock, Shield, Zap } from "lucide-react";
import { GameState, Pawn as PawnType } from "@/lib/types";

interface PawnProps {
  pawn: PawnType;
  squareIndex: number;
  gameState: GameState;
  onPawnDragStart: (pawnIndex: number) => void;
}

export const Pawn = ({
  pawn,
  squareIndex,
  gameState,
  onPawnDragStart,
}: PawnProps) => {
  const { playerId } = pawn;
  const {
    blockedPawnsInfo,
    blockingPawnsInfo,
    deadZoneCreatorPawnsInfo,
    winningLine,
    selectedPawnIndex,
    currentPlayerId,
    gamePhase,
    winner,
  } = gameState;

  const isBlocked = blockedPawnsInfo.has(squareIndex);
  const isBlocking = blockingPawnsInfo.has(squareIndex);
  const isCreatingDeadZone = deadZoneCreatorPawnsInfo.has(squareIndex);
  const isPartOfWinningLine = winningLine?.includes(squareIndex) ?? false;
  const isSelected = selectedPawnIndex === squareIndex;
  const isCurrentPlayerPawn = playerId === currentPlayerId;

  const playerBgColorStyle: React.CSSProperties = {
    backgroundColor: `hsl(var(${
      playerId === 1 ? "--player1-pawn-color" : "--player2-pawn-color"
    }))`,
  };

  let dynamicBorderStyle: React.CSSProperties = {
    borderColor: `hsla(var(${
      playerId === 1 ? "--player1-pawn-color" : "--player2-pawn-color"
    }), 0.75)`,
  };
  let ringClass = "";
  let animationClass = "";
  let cursorClass = "cursor-default";

  if (isPartOfWinningLine) {
    dynamicBorderStyle = {
      borderColor: "hsl(var(--highlight-win-line-pawn-border))",
      borderWidth: "3px",
    }; 
    playerBgColorStyle.boxShadow =
      "0 0 10px hsl(var(--highlight-win-line-pawn-border))"; 
    animationClass = "animate-pulse";
  } else if (isSelected) {
    dynamicBorderStyle = {
      borderColor: "hsl(var(--highlight-selected-pawn-border))",
      borderWidth: "3px",
    };
    ringClass =
      "ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn-border))]";
    animationClass = "scale-105";
  } else if (isBlocking) {
    // This should appear if not creating dead zone but is blocking
    dynamicBorderStyle = {
      borderColor: "hsl(var(--highlight-blocking-pawn-border))",
      borderWidth: "3px",
    };
  } else if (isCreatingDeadZone) {
    // This takes precedence over just blocking if both are true
    dynamicBorderStyle = {
      borderColor: "hsl(var(--highlight-creating-dead-zone-pawn-border))",
      borderWidth: "3px",
    };
  }

  let tooltipContent = `Player ${playerId} Pawn.`;
  if (isBlocked)
    tooltipContent =
      "This pawn is BLOCKED. It cannot move or be part of a winning diagonal.";
  else if (isCreatingDeadZone)
    tooltipContent =
      "This pawn is CREATING a DEAD ZONE (marked with × on an adjacent square). It cannot be used in a winning diagonal.";
  else if (isBlocking)
    tooltipContent =
      "This pawn is BLOCKING an opponent. It cannot be used in a winning diagonal because it is actively blocking.";

  if (isPartOfWinningLine) tooltipContent = "Part of the WINNING line!";

  const isDraggable =
    isCurrentPlayerPawn && gamePhase === "movement" && !winner && !isBlocked;
  if (isDraggable) {
    cursorClass = "cursor-grab active:cursor-grabbing";
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isDraggable) return;
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ pawnIndex: squareIndex })
    );
    e.dataTransfer.effectAllowed = "move";
    onPawnDragStart(squareIndex);
    document.body.classList.add("dragging-pawn");
  };

  const handleDragEnd = () => {
    document.body.classList.remove("dragging-pawn");
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={cn(
              "w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 border-2 relative",
              ringClass,
              animationClass,
              cursorClass,
              isDraggable && "hover:scale-110",
              isBlocked && "opacity-60 cursor-not-allowed",
              !isCurrentPlayerPawn && !winner && "opacity-80",
              winner && !isPartOfWinningLine && "opacity-70"
            )}
            style={{ ...playerBgColorStyle, ...dynamicBorderStyle }}
            aria-label={tooltipContent}
            role="button"
            tabIndex={isDraggable ? 0 : -1}
          >
            {/* Inner circle for visual depth, color derived from pawn color but lighter */}
            <div
              className="w-6 h-6 md:w-7 md:h-7 rounded-full opacity-40"
              style={{
                backgroundColor: `hsla(var(${
                  playerId === 1
                    ? "--player1-pawn-color"
                    : "--player2-pawn-color"
                }), 0.5)`,
              }}
            ></div>

            {isBlocked && (
              <Lock
                size={16}
                className="w-4 h-4 text-[hsl(var(--highlight-blocked-pawn-icon))] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              />
            )}
            {isCreatingDeadZone && !isBlocked && (
              <Zap
                size={16}
                className="w-4 h-4 text-[hsl(var(--highlight-blocked-pawn-icon))] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              />
            )}
            {isBlocking && !isCreatingDeadZone && !isBlocked && (
              <Shield
                size={16}
                className="w-4 h-4 text-[hsl(var(--highlight-blocked-pawn-icon))] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              />
            )}
          </div>
        </TooltipTrigger>
        {tooltipContent && (
          <TooltipContent
            side="top"
            align="center"
            className="bg-popover text-popover-foreground rounded-md px-3 py-1.5 text-sm shadow-md z-50 max-w-xs"
          >
            <p>{tooltipContent}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};
