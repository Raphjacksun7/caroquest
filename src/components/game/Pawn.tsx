"use client";

import type { Player, BoardSquareData, GamePhase, PawnPosition } from '@/types/game'; // Added PawnPosition
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import React from 'react';

interface PawnProps {
  player: Player;
  row: number; // Added row
  col: number; // Added col
  squareData: BoardSquareData;
  isSelected: boolean;
  isCurrentPlayerPawn: boolean;
  gamePhase: GamePhase;
  hasWinner: boolean;
  onDragStartPawn?: (row: number, col: number) => void; // For initiating drag
}

export const Pawn = ({ 
  player, 
  row, 
  col, 
  squareData, 
  isSelected, 
  isCurrentPlayerPawn, 
  gamePhase, 
  hasWinner,
  onDragStartPawn
}: PawnProps) => {
  const { isBlocked, isBlocking, isCreatingDeadZone, isPartOfWinningLine } = squareData;

  const playerColorClass = player === 1 
    ? 'bg-[hsl(var(--player1-pawn-color))] border-[hsl(var(--player1-pawn-color))]' 
    : 'bg-[hsl(var(--player2-pawn-color))] border-[hsl(var(--player2-pawn-color))]';
  
  let dynamicBorderClass = 'border-opacity-75'; 
  let animationClass = '';
  let cursorClass = 'cursor-default';

  if (isPartOfWinningLine) {
    dynamicBorderClass = 'border-[hsl(var(--highlight-win-line))] border-4 shadow-lg shadow-[hsl(var(--highlight-win-line))]';
    animationClass = 'animate-pulse';
  } else if (isSelected) {
    // Selected pawns get a more prominent border and slight scale
    dynamicBorderClass = 'border-[hsl(var(--highlight-selected-pawn))] border-4 ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn))]';
    animationClass = 'scale-105';
  } else if (isBlocking) {
    dynamicBorderClass = 'border-[hsl(var(--highlight-blocking-pawn-border))] border-4';
  } else if (isCreatingDeadZone) {
    dynamicBorderClass = 'border-[hsl(var(--highlight-creating-dead-zone-pawn-border))] border-4';
  }


  let tooltipContent = `Player ${player} Pawn.`;
  if (isBlocked) tooltipContent = 'This pawn is BLOCKED. Cannot move or be part of a winning line.';
  else if (isBlocking) tooltipContent = 'This pawn is BLOCKING an opponent. Cannot be used in a winning line.';
  else if (isCreatingDeadZone) tooltipContent = 'This pawn is CREATING a DEAD ZONE. Cannot be used in a winning line.';
  
  if (isPartOfWinningLine) tooltipContent = 'Part of the WINNING line!';
  
  const isDraggable = isCurrentPlayerPawn && gamePhase === 'MOVEMENT' && !hasWinner && !isBlocked;
  if (isDraggable) {
    cursorClass = 'cursor-grab active:cursor-grabbing';
  }


  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isDraggable || !onDragStartPawn) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ player, row, col }));
    e.dataTransfer.effectAllowed = 'move';
    onDragStartPawn(row, col); 
    // Add a class to the body to indicate dragging, for global cursor changes if desired
    document.body.classList.add('dragging-pawn');
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
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
              'w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 border-2',
              playerColorClass,
              dynamicBorderClass,
              animationClass,
              cursorClass,
              isDraggable && 'hover:scale-110',
              isBlocked && 'opacity-60 cursor-not-allowed',
              !isCurrentPlayerPawn && !hasWinner && 'opacity-80', // Slightly dim opponent pawns
              hasWinner && !isPartOfWinningLine && 'opacity-70' // Dim non-winning pawns if game over
            )}
            aria-label={tooltipContent}
            role="button"
            tabIndex={isCurrentPlayerPawn && !hasWinner ? 0 : -1}
          >
            {/* Inner circle for depth, could be conditional */}
            <div className={cn(
              "w-6 h-6 md:w-7 md:h-7 rounded-full opacity-30",
              player === 1 ? "bg-red-300" : "bg-blue-300" 
            )}></div>
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
