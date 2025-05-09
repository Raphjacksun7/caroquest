"use client";

import type { SquareState, GameState, PlayerId } from '@/lib/gameLogic';
import { Pawn } from './Pawn';
import { cn } from '@/lib/utils';
import React from 'react';
import { BOARD_SIZE } from '@/lib/gameLogic'; 

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

  const isDeadZoneForCurrentPlayer = deadZoneSquares.get(index) === currentPlayerId;
  const isWinningSquare = winningLine?.includes(index) ?? false;

  let squareBgClass = boardColor === 'light' 
    ? 'bg-[hsl(var(--board-light-square))]' 
    : 'bg-[hsl(var(--board-dark-square))]';
  
  let conditionalClasses = '';
  let hoverInteractionClasses = 'group-hover/board:opacity-90';

  if (isWinningSquare) { // Changed from highlight === 'winningSquare'
     squareBgClass = `bg-[hsl(var(--highlight-win-line))] ${boardColor === 'light' ? 'bg-opacity-70' : 'bg-opacity-60'}`;
  } else if (highlight === 'selectedPawn') {
    conditionalClasses = 'ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn))] z-10';
  } else if (highlight === 'validMove') {
    squareBgClass = boardColor === 'light' ? 'bg-green-200' : 'bg-green-700'; // Using Tailwind classes for valid moves
    hoverInteractionClasses = 'hover:bg-opacity-80';
     if(isDragOver) squareBgClass = boardColor === 'light' ? 'bg-green-300' : 'bg-green-800';
  } else if (lastMove?.to === index || lastMove?.from === index) {
    squareBgClass = boardColor === 'light' ? 'bg-yellow-200' : 'bg-yellow-600'; // Using Tailwind for last move
  }


  let cursorClass = 'cursor-default';
  if (!winner) {
    if (gameState.gamePhase === 'placement' && !pawn && boardColor === playerColors[currentPlayerId]) {
      cursorClass = 'cursor-pointer';
    } else if (gameState.gamePhase === 'movement') {
      if (pawn && pawn.playerId === currentPlayerId && !gameState.blockedPawnsInfo.has(index)) {
        cursorClass = 'cursor-grab'; 
      } else if (!pawn && highlight === 'validMove') {
        cursorClass = 'cursor-pointer'; 
      }
    }
  }
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (highlight === 'validMove' && !pawn) { 
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
  };
  
  return (
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
      )}
      aria-label={`Square ${String.fromCharCode(97 + col)}${BOARD_SIZE - row}, ${boardColor}, ${pawn ? `Player ${pawn.playerId} piece` : 'Empty'}${gameState.blockedPawnsInfo.has(index) ? ', Blocked' : ''}${isDeadZoneForCurrentPlayer ? ', Dead Zone for you' : ''}${highlight === 'selectedPawn' ? ', Selected' : ''}${highlight === 'validMove' ? ', Valid Move' : ''}`}
      disabled={!!winner && (!pawn || pawn.playerId !== currentPlayerId) && highlight !== 'selectedPawn'}
    >
      {isDeadZoneForCurrentPlayer && !pawn && ( 
         <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--highlight-dead-zone))] opacity-50 text-4xl font-bold pointer-events-none select-none">×</div>
      )}
      {highlight === 'validMove' && !pawn && !isDeadZoneForCurrentPlayer && (
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
      <div className="absolute bottom-0 right-1 text-[0.6rem] md:text-xs opacity-60 pointer-events-none select-none font-mono">
        {String.fromCharCode(97 + col)}{BOARD_SIZE - row}
      </div>
    </button>
  );
};

    