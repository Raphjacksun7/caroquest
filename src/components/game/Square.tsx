
"use client";

import type { SquareState, GameState, PlayerId } from '@/lib/gameLogic';
import { Pawn } from './Pawn';
import { cn } from '@/lib/utils';
import React from 'react';
// BOARD_SIZE can be imported if needed, but algebraic notation was removed.
// import { BOARD_SIZE } from '@/lib/gameLogic'; 
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
  const { winner, currentPlayerId, playerColors, deadZoneSquares, lastMove, winningLine } = gameState;
  const [isDragOver, setIsDragOver] = React.useState(false);

  const deadZoneForPlayerId = deadZoneSquares.get(index); 
  const isActualDeadZone = deadZoneForPlayerId !== undefined;
  const isDeadZoneForCurrentPlayer = deadZoneForPlayerId === currentPlayerId;
  
  const isCurrentPlayerSquareColor = boardColor === playerColors[currentPlayerId];
  const isWinningSquare = winningLine?.includes(index) ?? false;
  
  let tooltipContentText = '';
  if (isActualDeadZone) {
    const affectedPlayerName = deadZoneForPlayerId === 1 ? "Player 1" : "Player 2";
    tooltipContentText = `Dead Zone: ${affectedPlayerName} cannot use this square for winning or placement.`;
  }

  let squareBgStyle: React.CSSProperties = {};
  let baseBgClass = boardColor === 'light' 
    ? 'bg-[hsl(var(--board-light-square))]' 
    : 'bg-[hsl(var(--board-dark-square))]';
  
  let conditionalClasses = '';
  let hoverInteractionClasses = 'group-hover/board:opacity-90'; // Default hover for board context

  if (isWinningSquare) {
     squareBgStyle = { backgroundColor: 'hsl(var(--highlight-win-line-bg))' };
     // bg-opacity might not work directly with HSL, so setting directly.
  } else if (highlight === 'selectedPawn') {
    // Selected pawn highlight is primarily on the Pawn itself using border/ring.
    // Square itself doesn't need strong highlight if pawn is clearly marked.
    // No specific background change for the square of a selected pawn.
  } else if (highlight === 'validMove') {
    squareBgStyle = { backgroundColor: boardColor === 'light' ? 'hsl(var(--highlight-valid-move-bg))' : 'hsl(var(--highlight-valid-move-dark-bg))' };
    hoverInteractionClasses = 'hover:brightness-95'; // Slight darken on hover for valid moves
     if(isDragOver) {
        squareBgStyle = { backgroundColor: boardColor === 'light' ? 'hsl(var(--highlight-valid-move-bg))' : 'hsl(var(--highlight-valid-move-dark-bg))', filter: 'brightness(0.9)' };
     }
  } else if (lastMove?.to === index || lastMove?.from === index) {
    squareBgStyle = { backgroundColor: boardColor === 'light' ? 'hsl(var(--highlight-last-move-light-bg))' : 'hsl(var(--highlight-last-move-dark-bg))' };
  }


  let cursorClass = 'cursor-default';
  if (!winner) {
    if (gameState.gamePhase === 'placement' && !pawn && isCurrentPlayerSquareColor && !isDeadZoneForCurrentPlayer) {
      cursorClass = 'cursor-pointer';
      hoverInteractionClasses = 'hover:brightness-90'; // General hover for placeable squares
    } else if (gameState.gamePhase === 'movement') {
      if (pawn && pawn.playerId === currentPlayerId && !gameState.blockedPawnsInfo.has(index)) {
        cursorClass = 'cursor-grab'; 
      } else if (!pawn && highlight === 'validMove' && !isDeadZoneForCurrentPlayer) {
        cursorClass = 'cursor-pointer'; 
      }
    }
    if (isDeadZoneForCurrentPlayer && !pawn) { // If it's a dead zone for current player, and empty
      cursorClass = 'cursor-not-allowed';
      hoverInteractionClasses = ''; // No hover effect for not-allowed squares
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
  
  const squareElement = (
    <button
      id={`square-${index}`}
      onClick={onClick}
      onDragOver={onDragOverSquare}
      onDrop={onDropOnSquare}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={cn(
        'w-14 h-14 md:w-[calc(3.75rem-2px)] md:h-[calc(3.75rem-2px)] flex items-center justify-center border border-[hsla(var(--foreground),0.08)] transition-all duration-150 relative overflow-hidden focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] group/square',
        baseBgClass, // Base background color class
        conditionalClasses,
        cursorClass,
        hoverInteractionClasses,
        isDragOver && highlight === 'validMove' && !pawn && 'ring-2 ring-[hsl(var(--highlight-valid-move-indicator))]',
        isDeadZoneForCurrentPlayer && 'opacity-80',
      )}
      style={squareBgStyle} // Apply dynamic HSL backgrounds
      aria-label={`Square ${String.fromCharCode(97 + col)}${BOARD_SIZE - row}, ${boardColor}, ${pawn ? `Player ${pawn.playerId} piece` : 'Empty'}${gameState.blockedPawnsInfo.has(index) ? ', Blocked' : ''}${isActualDeadZone ? `, Dead Zone for Player ${deadZoneForPlayerId}` : ''}${highlight === 'selectedPawn' ? ', Selected' : ''}${highlight === 'validMove' ? ', Valid Move' : ''}`}
      disabled={!!winner || (isDeadZoneForCurrentPlayer && !pawn)} 
    >
      {isActualDeadZone && !pawn && ( 
         <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--highlight-dead-zone-marker))] opacity-70 text-4xl font-bold pointer-events-none select-none">×</div>
      )}
      
      {highlight === 'validMove' && !pawn && !isActualDeadZone && (
        <div className={cn(
            "absolute w-3 h-3 rounded-full opacity-80 pointer-events-none select-none",
             isDragOver ? "bg-[hsl(var(--foreground))]" : "bg-[hsl(var(--highlight-valid-move-indicator))]"
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
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            {squareElement}
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="bg-popover text-popover-foreground rounded-md px-3 py-1.5 text-sm shadow-md z-50 max-w-xs">
            <p>{tooltipContentText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return squareElement;
};
    
