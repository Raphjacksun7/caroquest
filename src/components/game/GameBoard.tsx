"use client";

import type { GameBoardArray, Player, PawnPosition, GamePhase, WinningLine, DeadZone } from '@/types/game';
import { Square } from './Square';
import { BOARD_SIZE } from '@/config/game';
import { getSquareColorType as getBoardSquareColor } from '@/lib/gameUtils';
import React from 'react';

interface GameBoardProps {
  board: GameBoardArray;
  currentPlayer: Player;
  gamePhase: GamePhase;
  selectedPawn: PawnPosition | null;
  winningLine: WinningLine | null;
  deadZones: DeadZone[];
  validMoves: PawnPosition[];
  onSquareClick: (row: number, col: number) => void;
  winner: Player | null;
  onPawnDragStart: (row: number, col: number) => void;
  onPawnDrop: (targetRow: number, targetCol: number) => void;
}

export const GameBoard = ({
  board,
  currentPlayer,
  gamePhase,
  selectedPawn,
  winningLine,
  deadZones,
  validMoves,
  onSquareClick,
  winner,
  onPawnDragStart,
  onPawnDrop,
}: GameBoardProps) => {

  const isSquareDeadZoneForPlayer = (row: number, col: number, player: Player): boolean => {
    return deadZones.some(dz => dz.row === row && dz.col === col && dz.player === player);
  };

  const handleDragOverSquare = (e: React.DragEvent<HTMLDivElement>, row: number, col: number) => {
    e.preventDefault(); // Necessary to allow dropping
    // Optionally add visual feedback for droppable area
    if (validMoves.some(m => m.row === row && m.col === col)) {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDropOnSquare = (e: React.DragEvent<HTMLDivElement>, row: number, col: number) => {
    e.preventDefault();
    onPawnDrop(row, col);
  };

  return (
    <div
      className="grid grid-cols-8 gap-0 border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl rounded-lg overflow-hidden"
      style={{ width: `${BOARD_SIZE * 3.75}rem`, height: `${BOARD_SIZE * 3.75}rem` }} // Adjusted for w-14 (3.5rem) + potential small gaps/border adjustments
    >
      {board.map((rowSquares, rowIndex) =>
        rowSquares.map((squareData, colIndex) => {
          const squareColorType = getBoardSquareColor(rowIndex, colIndex);
          const isCurrentSelectedPawn = selectedPawn?.row === rowIndex && selectedPawn?.col === colIndex;
          const isValidMoveTarget = validMoves.some(p => p.row === rowIndex && p.col === colIndex);
          // Show dead zones relevant to the *current* player's attempt to win
          const isActualDeadZoneForCurrentPlayer = isSquareDeadZoneForPlayer(rowIndex, colIndex, currentPlayer); 
          
          return (
            <Square
              key={`${rowIndex}-${colIndex}`}
              row={rowIndex}
              col={colIndex}
              squareData={squareData}
              squareColorType={squareColorType}
              isSelectedPawn={isCurrentSelectedPawn}
              isValidMove={isValidMoveTarget}
              isDeadZoneForCurrentPlayer={isActualDeadZoneForCurrentPlayer}
              currentPlayer={currentPlayer}
              gamePhase={gamePhase}
              winner={winner}
              onClick={onSquareClick}
              onPawnDragStart={onPawnDragStart}
              onDragOverSquare={(e) => handleDragOverSquare(e, rowIndex, colIndex)}
              onDropOnSquare={(e) => handleDropOnSquare(e, rowIndex, colIndex)}
            />
          );
        })
      )}
    </div>
  );
};
