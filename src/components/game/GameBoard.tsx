"use client";

import type { GameState, SquareState } from '@/lib/gameLogic';
import { Square } from './Square';
import { BOARD_SIZE } from '@/lib/gameLogic';
import React from 'react'; // Removed useState, useEffect as they weren't used here

interface GameBoardProps {
  gameState: GameState;
  onSquareClick: (index: number) => void;
  onPawnDragStart: (pawnIndex: number) => void;
  onPawnDrop: (targetIndex: number) => void;
}

export const GameBoard = ({
  gameState,
  onSquareClick,
  onPawnDragStart,
  onPawnDrop,
}: GameBoardProps) => {
  const { board } = gameState;

  const handleDragOverSquare = (e: React.DragEvent<HTMLDivElement>, squareIndex: number) => {
    e.preventDefault(); 
    const targetSquare = board[squareIndex];
    if (targetSquare.highlight === 'validMove') {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDropOnSquare = (e: React.DragEvent<HTMLDivElement>, squareIndex: number) => {
    e.preventDefault();
    onPawnDrop(squareIndex);
  };

  return (
    <div
      className="grid grid-cols-8 gap-0 border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl rounded-lg overflow-hidden"
      style={{ width: `${BOARD_SIZE * 3.75}rem`, height: `${BOARD_SIZE * 3.75}rem` }}
    >
      {board.map((squareState: SquareState) => ( // Removed index from map as squareState.index is used
        <Square
          key={squareState.index}
          squareState={squareState}
          gameState={gameState}
          onClick={() => onSquareClick(squareState.index)}
          onPawnDragStart={onPawnDragStart}
          onDragOverSquare={(e) => handleDragOverSquare(e, squareState.index)}
          onDropOnSquare={(e) => handleDropOnSquare(e, squareState.index)}
        />
      ))}
    </div>
  );
};