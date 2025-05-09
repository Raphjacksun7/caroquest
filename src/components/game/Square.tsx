"use client";

import type { SquareState, GameState } from '@/lib/gameLogic'; // PlayerId removed as not directly used
import { Pawn } from './Pawn';
import { cn } from '@/lib/utils';
import React from 'react';
import { BOARD_SIZE } from '@/lib/gameLogic';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SquareProps {
  squareState: SquareState;
  gameState: GameState;
  onClick: () => void;
  onPawnDragStart: (pawnIndex: number) => void;
  onDragOverSquare: (e: React.DragEvent<HTMLDivElement>) => void;
  onDropOnSquare: (e: React.DragEvent<HTMLDivElement>) => void;
}

export const Square = ({
  squareState,
  gameState,
  onClick,
  onPawnDragStart,
  onDragOverSquare,
  onDropOnSquare,
}: SquareProps) => {
  const { index, row, col, boardColor, pawn, highlight } = squareState;
  const { winner, currentPlayerId, playerColors, deadZoneSquares, lastMove, selectedPawnIndex, winningLine } = gameState;
  const [isDragOver, setIsDragOver] = React.useState(false);

  const deadZoneForPlayerId = deadZoneSquares.get(index);
  const isDeadZone = deadZoneForPlayerId !== undefined;
  const isDeadZoneForCurrentPlayer = deadZoneForPlayerId === currentPlayerId;
  
  const isCurrentPlayerSquare = boardColor === playerColors[currentPlayerId];
  const isWinningSquare = winningLine?.includes(index) ?? false;
  
  let tooltipContentText = '';
  if (isDeadZone) {
    tooltipContentText = `Dead Zone: Player ${deadZoneForPlayerId} cannot use this square in a winning diagonal or place/move pawns here.`;
  }

  let squareBgClass = boardColor === 'light' 
    ? 'bg-[hsl(var(--board-light-square))]' 
    : 'bg-[hsl(var(--board-dark-square))]';
  
  let conditionalClasses = '';
  let hoverInteractionClasses = 'group-hover/board:opacity-90';

  if (isWinningSquare) {
     squareBgClass = `bg-[hsl(var(--highlight-win-line))] ${boardColor === 'light' ? 'bg-opacity-70' : 'bg-opacity-60'}`;
  } else if (highlight === 'selectedPawn') {
    conditionalClasses = 'ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn))] z-10';
  } else if (highlight === 'validMove') {
    squareBgClass = boardColor === 'light' ? 'bg-green-200' : 'bg-green-700';
    hoverInteractionClasses = 'hover:bg-opacity-80';
    if(isDragOver) squareBgClass = boardColor === 'light' ? 'bg-green-300' : 'bg-green-800';
  } else if (lastMove?.to === index || lastMove?.from === index) {
    squareBgClass = boardColor === 'light' ? 'bg-yellow-200' : 'bg-yellow-600';
  }

  let cursorClass = 'cursor-default';
  if (!winner) {
    if (gameState.gamePhase === 'placement' && 
        !pawn && 
        isCurrentPlayerSquare && 
        !isDeadZoneForCurrentPlayer) {
      cursorClass = 'cursor-pointer';
    } else if (gameState.gamePhase === 'movement') {
      if (pawn && pawn.playerId === currentPlayerId && !gameState.blockedPawnsInfo.has(index)) {
        cursorClass = 'cursor-grab'; 
      } else if (!pawn && highlight === 'validMove' && !isDeadZoneForCurrentPlayer) { // Ensure not moving to a dead zone
        cursorClass = 'cursor-pointer'; 
      }
    }
    
    if (isDeadZoneForCurrentPlayer) {
      cursorClass = 'cursor-not-allowed';
    }
  }
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (highlight === 'validMove' && !pawn && !isDeadZoneForCurrentPlayer) { 
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
  };
  
  const squareButton = (
    <button
      id={`square-${index}`}
      onClick={onClick}
      onDragOver={onDragOverSquare}
      onDrop={onDropOnSquare}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={cn(
        'w-14 h-14 md:w-[calc(3.75rem-2px)] md:h-[calc(3.75rem-2px)] flex items-center justify-center border border-[hsla(var(--foreground),0.1)] transition-all duration-150 relative overflow-hidden focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] group/square',
        squareBgClass,
        conditionalClasses,
        cursorClass,
        hoverInteractionClasses,
        isDragOver && highlight === 'validMove' && !pawn && 'ring-2 ring-[hsl(var(--highlight-valid-move))]',
        isDeadZoneForCurrentPlayer && 'opacity-70', // Reduced opacity for current player's dead zones
      )}
      aria-label={`Square ${String.fromCharCode(97 + col)}${BOARD_SIZE - row}, ${boardColor}, ${pawn ? `Player ${pawn.playerId} piece` : 'Empty'}${gameState.blockedPawnsInfo.has(index) ? ', Blocked' : ''}${isDeadZone ? `, Dead Zone for Player ${deadZoneForPlayerId}` : ''}${highlight === 'selectedPawn' ? ', Selected' : ''}${highlight === 'validMove' ? ', Valid Move' : ''}`}
      disabled={!!winner || isDeadZoneForCurrentPlayer} // Disable if it's a dead zone for current player
    >
      {isDeadZone && !pawn && ( 
        <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--highlight-dead-zone))] opacity-60 text-4xl font-bold pointer-events-none select-none">×</div>
      )}
      
      {highlight === 'validMove' && !pawn && !isDeadZone && ( // Don't show valid move dot if it's a dead zone
        <div className={cn(
            "absolute w-3 h-3 rounded-full opacity-70 pointer-events-none select-none",
            isDragOver ? "bg-[hsl(var(--foreground))]" : "bg-[hsl(var(--highlight-valid-move))]"
            )} 
        />
      )}
      
      {pawn && (
        <Pawn
          pawn={pawn}
          squareIndex={index}
          gameState={gameState}
          onPawnDragStart={onPawnDragStart}
        />
      )}
    </button>
  );

  if (tooltipContentText) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            {squareButton}
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="bg-popover text-popover-foreground rounded-md px-3 py-1.5 text-sm shadow-md z-50">
            <p>{tooltipContentText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return squareButton;
};