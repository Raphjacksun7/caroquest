"use client";
import { Square } from './Square';
import { BOARD_SIZE } from '@/lib/gameLogic';
import { GameState, SquareState } from '@/lib/types';
import React from 'react'; 

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

  const handleDragOverSquare = (e: React.DragEvent<HTMLButtonElement>, squareIndex: number) => {
    e.preventDefault(); 
    const targetSquare = board[squareIndex];
    if (targetSquare.highlight === 'validMove') {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDropOnSquare = (e: React.DragEvent<HTMLButtonElement>, squareIndex: number) => {
    e.preventDefault();
    onPawnDrop(squareIndex);
  };

  return (
    <div
      className="grid grid-cols-8 gap-0 bg-[hsl(var(--background))] shadow-2xl overflow-hidden w-full h-full aspect-square"
      style={{ 
        border: '0.15rem solid #212b49',
        borderRadius: '0.5rem'
      }}
    >
      {board.map((squareState: SquareState) => ( 
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