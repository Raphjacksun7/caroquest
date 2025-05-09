"use client";

import type { Player, SquareColorType, BoardSquareData, GamePhase } from '@/types/game';
import { Pawn } from './Pawn';
import { cn } from '@/lib/utils';
import React from 'react';
import { BOARD_SIZE } from '@/config/game';

interface SquareProps {
  row: number;
  col: number;
  squareData: BoardSquareData;
  squareColorType: SquareColorType;
  isSelectedPawn: boolean;
  isValidMove: boolean;
  isDeadZoneForCurrentPlayer: boolean;
  currentPlayer: Player;
  gamePhase: GamePhase;
  winner: Player | null;
  onClick: (row: number, col: number) => void;
  onPawnDragStart: (row: number, col: number) => void;
  onDragOverSquare: (e: React.DragEvent<HTMLDivElement>) => void;
  onDropOnSquare: (e: React.DragEvent<HTMLDivElement>) => void;
}

export const Square = ({
  row,
  col,
  squareData,
  squareColorType,
  isSelectedPawn,
  isValidMove,
  isDeadZoneForCurrentPlayer,
  currentPlayer,
  gamePhase,
  winner,
  onClick,
  onPawnDragStart,
  onDragOverSquare,
  onDropOnSquare,
}: SquareProps) => {
  const { player, isBlocked, isPartOfWinningLine } = squareData;
  const [isDragOver, setIsDragOver] = React.useState(false);
  
  const squareBgColor = squareColorType === 'light' 
    ? 'bg-[hsl(var(--board-light-square))]' 
    : 'bg-[hsl(var(--board-dark-square))]';

  let conditionalClasses = '';
  let hoverInteractionClasses = 'group-hover/board:opacity-90'; // Default hover for board context

  if (isPartOfWinningLine) {
    conditionalClasses = `bg-[hsl(var(--highlight-win-line))] ${squareColorType === 'light' ? 'bg-opacity-70' : 'bg-opacity-60'}`;
  } else if (isSelectedPawn && player === currentPlayer) { // Pawn on this square is selected
    conditionalClasses = 'ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn))] z-10';
  } else if (isValidMove && player === null) { // Empty square that is a valid move target
    conditionalClasses = 'bg-opacity-70'; // Valid move dot will provide main visual
    hoverInteractionClasses = 'hover:bg-opacity-80'; // Hover on valid move target
    if(isDragOver) conditionalClasses += ' bg-[hsl(var(--highlight-valid-move))] opacity-90'; // Highlight when dragging over valid target
  }
  
  // Cursor logic
  let cursorClass = 'cursor-default';
  if (!winner) {
    if (gamePhase === 'PLACEMENT' && player === null && getBoardSquareColorType(row, col) === (currentPlayer === 1 ? 'light' : 'dark')) {
      cursorClass = 'cursor-pointer';
    } else if (gamePhase === 'MOVEMENT') {
      if (player === currentPlayer && !isBlocked) {
        cursorClass = 'cursor-grab'; // For draggable pawns
      } else if (player === null && isValidMove) {
        cursorClass = 'cursor-pointer'; // For empty valid move squares
      }
    }
  }


  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (isValidMove && player === null) { // Only set for valid drop targets
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
  };

  return (
    <button
      id={`square-${row}-${col}`}
      onClick={() => onClick(row, col)}
      onDragOver={onDragOverSquare}
      onDrop={onDropOnSquare}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={cn(
        'w-14 h-14 md:w-[calc(3.75rem-2px)] md:h-[calc(3.75rem-2px)] flex items-center justify-center border border-[hsla(var(--foreground),0.1)] transition-all duration-150 relative overflow-hidden focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] group/square',
        squareBgColor,
        conditionalClasses,
        cursorClass,
        hoverInteractionClasses,
        isDragOver && isValidMove && player === null && 'ring-2 ring-[hsl(var(--highlight-valid-move))]', // Visual cue for drag over valid target
      )}
      aria-label={`Square ${String.fromCharCode(97 + col)}${BOARD_SIZE - row}, ${squareColorType}, ${player ? `Player ${player} piece` : 'Empty'}${isBlocked ? ', Blocked' : ''}${isDeadZoneForCurrentPlayer ? ', Dead Zone for you' : ''}${isSelectedPawn && player === currentPlayer ? ', Selected' : ''}${isValidMove ? ', Valid Move' : ''}`}
      disabled={!!winner && player !== null && player !== currentPlayer && !isSelectedPawn} // More nuanced disabling
    >
      {isDeadZoneForCurrentPlayer && player === null && ( 
         <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--highlight-dead-zone))] opacity-50 text-4xl font-bold pointer-events-none select-none">×</div>
      )}
      {isValidMove && player === null && !isDeadZoneForCurrentPlayer && (
        <div className={cn(
            "absolute w-3 h-3 rounded-full opacity-70 pointer-events-none select-none",
            isDragOver ? "bg-[hsl(var(--foreground))]" : "bg-[hsl(var(--highlight-valid-move))]" // Change dot color on drag over
            )} 
        />
      )}
      {player && (
        <Pawn
          player={player}
          row={row}
          col={col}
          squareData={squareData}
          isSelected={isSelectedPawn && squareData.player === currentPlayer}
          isCurrentPlayerPawn={player === currentPlayer}
          gamePhase={gamePhase}
          hasWinner={!!winner}
          onDragStartPawn={onPawnDragStart}
        />
      )}
      <div className="absolute bottom-0 right-1 text-[0.6rem] md:text-xs opacity-60 pointer-events-none select-none font-mono">
        {String.fromCharCode(97 + col)}{BOARD_SIZE - row}
      </div>
    </button>
  );
};
