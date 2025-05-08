
import type { GameBoardArray, Player, PawnPosition, GamePhase, WinningLine, DeadZone, SquareColorType } from '@/types/game';
import { Square } from './Square';
import { BOARD_SIZE } from '@/config/game';
import React, { useState, useEffect } from 'react'; // Import React, useState, useEffect

interface GameBoardProps {
  board: GameBoardArray;
  currentPlayer: Player;
  gamePhase: GamePhase;
  selectedPawn: PawnPosition | null;
  winningLine: WinningLine | null;
  deadZones: DeadZone[];
  getPlayerSquareColor: (player: Player) => SquareColorType;
  getValidMoveTargets: (player: Player, pawnPosition: PawnPosition | null) => PawnPosition[];
  onSquareClick: (row: number, col: number) => void;
  onPawnDragStart: (row: number, col: number, player: Player, event: React.DragEvent<HTMLButtonElement>) => void;
  onPawnDrop: (targetRow: number, targetCol: number, draggedPawnInfo: { sourceRow: number, sourceCol: number, player: Player }) => void;
}

export const GameBoard = ({
  board,
  currentPlayer,
  gamePhase,
  selectedPawn,
  winningLine,
  deadZones,
  getPlayerSquareColor,
  getValidMoveTargets,
  onSquareClick,
  onPawnDragStart,
  onPawnDrop,
}: GameBoardProps) => {
  const [boardPixelSize, setBoardPixelSize] = useState(BOARD_SIZE * 4 * 16); // Default to larger size (4rem squares)

  useEffect(() => {
    const updateSize = () => {
      const squareSizeRem = window.innerWidth < 768 ? 3 : 4;
      // Assuming 1rem = 16px for initial calculation, adjust if needed or use a more robust way to get rem in pixels
      setBoardPixelSize(BOARD_SIZE * squareSizeRem * 16); 
    };

    updateSize(); // Set initial size
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);


  const validMoveTargets = selectedPawn ? getValidMoveTargets(currentPlayer, selectedPawn) : [];

  const isSquareDeadZoneForPlayer = (row: number, col: number, player: Player): boolean => {
    return deadZones.some(dz => dz.row === row && dz.col === col && dz.player === player);
  };

  return (
    <div
      className="grid grid-cols-8 gap-0 border-2 border-foreground bg-background shadow-2xl rounded overflow-hidden relative"
      style={{ width: `${boardPixelSize}px`, height: `${boardPixelSize}px` }}
    >
      {board.map((rowSquares, rowIndex) =>
        rowSquares.map((squareData, colIndex) => {
          const squareColorType = (rowIndex + colIndex) % 2 === 0 ? 'light' : 'dark';
          const isActualDeadZoneForCurrentPlayer = isSquareDeadZoneForPlayer(rowIndex, colIndex, currentPlayer);
          const isValidMoveTargetForSelectedPawn = validMoveTargets.some(p => p.row === rowIndex && p.col === colIndex);
          
          return (
            <Square
              key={`${rowIndex}-${colIndex}`}
              row={rowIndex}
              col={colIndex}
              squareData={squareData}
              squareColorType={squareColorType}
              currentPlayer={currentPlayer}
              gamePhase={gamePhase}
              selectedPawn={selectedPawn}
              winningLine={winningLine}
              isActualDeadZoneForCurrentPlayer={isActualDeadZoneForCurrentPlayer}
              isValidMoveTargetForSelectedPawn={isValidMoveTargetForSelectedPawn}
              onClick={onSquareClick}
              onPawnDragStart={onPawnDragStart}
              onPawnDrop={onPawnDrop}
            />
          );
        })
      )}
    </div>
  );
};
