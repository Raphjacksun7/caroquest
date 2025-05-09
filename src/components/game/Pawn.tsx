
"use client";

import type { Pawn as PawnType, GameState } from '@/lib/gameLogic';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import React from 'react';
import { Lock, Shield } from 'lucide-react';


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
  onPawnDragStart
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
    winner
  } = gameState;

  const isBlocked = blockedPawnsInfo.has(squareIndex);
  const isBlocking = blockingPawnsInfo.has(squareIndex);
  const isCreatingDeadZone = deadZoneCreatorPawnsInfo.has(squareIndex);
  const isPartOfWinningLine = winningLine?.includes(squareIndex) ?? false;
  const isSelected = selectedPawnIndex === squareIndex;
  const isCurrentPlayerPawn = playerId === currentPlayerId;
  
  const playerColorClass = playerId === 1 
    ? 'bg-[hsl(var(--player1-pawn-color))] border-[hsl(var(--player1-pawn-color))]' 
    : 'bg-[hsl(var(--player2-pawn-color))] border-[hsl(var(--player2-pawn-color))]';
  
  let dynamicBorderClass = 'border-opacity-75'; 
  let animationClass = '';
  let cursorClass = 'cursor-default';

  if (isPartOfWinningLine) {
    dynamicBorderClass = 'border-[hsl(var(--highlight-win-line))] border-4 shadow-lg shadow-[hsl(var(--highlight-win-line))]';
    animationClass = 'animate-pulse';
  } else if (isSelected) {
    dynamicBorderClass = 'border-[hsl(var(--highlight-selected-pawn))] border-4 ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn))]';
    animationClass = 'scale-105';
  } else if (isBlocking) {
    dynamicBorderClass = 'border-[hsl(var(--highlight-blocking-pawn-border))] border-4';
  } else if (isCreatingDeadZone) {
    dynamicBorderClass = 'border-[hsl(var(--highlight-creating-dead-zone-pawn-border))] border-4';
  }

  let tooltipContent = `Player ${playerId} Pawn.`;
  if (isBlocked) {
    tooltipContent = 'This pawn is BLOCKED. Cannot move or be part of a winning line.';
  } else if (isBlocking) {
    tooltipContent = 'This pawn is BLOCKING an opponent. Cannot be used in a winning line.';
  } else if (isCreatingDeadZone) {
    tooltipContent = 'This pawn is CREATING a DEAD ZONE. It cannot be used in a winning diagonal and creates a square nearby that your opponent cannot use for winning.';
  }
  
  if (isPartOfWinningLine) {
    tooltipContent = 'Part of the WINNING line!';
  }
  
  const isDraggable = isCurrentPlayerPawn && gamePhase === 'movement' && !winner && !isBlocked;
  if (isDraggable) {
    cursorClass = 'cursor-grab active:cursor-grabbing';
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isDraggable) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ pawnIndex: squareIndex }));
    e.dataTransfer.effectAllowed = 'move';
    onPawnDragStart(squareIndex); 
    document.body.classList.add('dragging-pawn');
  };

  const handleDragEnd = () => {
    document.body.classList.remove('dragging-pawn');
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={cn(
              'w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 border-2 relative',
              playerColorClass,
              dynamicBorderClass,
              animationClass,
              cursorClass,
              isDraggable && 'hover:scale-110',
              isBlocked && 'opacity-60 cursor-not-allowed',
              !isCurrentPlayerPawn && !winner && 'opacity-80', 
              winner && !isPartOfWinningLine && 'opacity-70' 
            )}
            aria-label={tooltipContent}
            role="button" 
            tabIndex={isDraggable ? 0 : -1}
          >
            <div className={cn(
              "w-6 h-6 md:w-7 md:h-7 rounded-full opacity-30",
              playerId === 1 ? "bg-red-300" : "bg-blue-300" 
            )}></div>
            {isBlocked && <Lock className="w-4 h-4 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" />}
            {isBlocking && <Shield className="w-4 h-4 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" />}
          </div>
        </TooltipTrigger>
        {tooltipContent && (
          <TooltipContent side="top" align="center" className="bg-popover text-popover-foreground rounded-md px-3 py-1.5 text-sm shadow-md">
            <p>{tooltipContent}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};
