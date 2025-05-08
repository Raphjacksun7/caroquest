
import type { Player, SquareColorType, BoardSquareData, GamePhase } from '@/types/game';
import { Pawn } from './Pawn';
import { cn } from '@/lib/utils';
import React from 'react';
import { BOARD_SIZE } from '@/config/game'; // Added import

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
  onDragStartPawn?: (e: React.DragEvent<HTMLDivElement>, row: number, col: number) => void;
  onDragOverSquare?: (e: React.DragEvent<HTMLDivElement>, row: number, col: number) => void;
  onDropOnSquare?: (e: React.DragEvent<HTMLDivElement>, row: number, col: number) => void;
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
  onDragStartPawn,
  onDragOverSquare,
  onDropOnSquare,
}: SquareProps) => {
  const { player, isBlocked, isPartOfWinningLine } = squareData;
  
  const squareBgColor = squareColorType === 'light' 
    ? 'bg-[hsl(var(--board-light-square))]' 
    : 'bg-[hsl(var(--board-dark-square))]';

  let conditionalClasses = '';
  let hoverClasses = 'hover:bg-opacity-80';

  if (isPartOfWinningLine) {
    conditionalClasses = `bg-[hsl(var(--highlight-win-line))] ${squareColorType === 'light' ? 'bg-opacity-70' : 'bg-opacity-60'}`;
  } else if (isSelectedPawn && player === currentPlayer) {
    conditionalClasses = 'ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn))]';
  } else if (isValidMove && player === null) {
    conditionalClasses = 'bg-[hsl(var(--highlight-valid-move))] bg-opacity-40';
    hoverClasses = 'hover:bg-opacity-60';
  }
  
  const canInteract = !winner && !(gamePhase === 'MOVEMENT' && player !== null && player !== currentPlayer && !isSelectedPawn);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (onDragOverSquare) {
      onDragOverSquare(e, row, col);
    } else {
      e.preventDefault(); // Default behavior if no specific handler
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (onDropOnSquare) {
      onDropOnSquare(e, row, col);
    }
  };

  return (
    <button
      id={`square-${row}-${col}`}
      onClick={() => onClick(row, col)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'w-14 h-14 md:w-[70px] md:h-[70px] flex items-center justify-center border border-[hsla(var(--foreground),0.1)] transition-colors duration-150 relative overflow-hidden focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]',
        squareBgColor,
        conditionalClasses,
        canInteract ? `cursor-pointer ${hoverClasses}` : 'cursor-default',
      )}
      aria-label={`Square ${String.fromCharCode(97 + col)}${BOARD_SIZE - row}, ${squareColorType}, ${player ? `Player ${player} piece` : 'Empty'}${isBlocked ? ', Blocked' : ''}${isDeadZoneForCurrentPlayer ? ', Dead Zone' : ''}${isSelectedPawn && player === currentPlayer ? ', Selected' : ''}${isValidMove ? ', Valid Move' : ''}`}
      disabled={!!winner}
    >
      {isDeadZoneForCurrentPlayer && player === null && ( 
         <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--highlight-dead-zone))] opacity-50 text-4xl font-bold pointer-events-none select-none">×</div>
      )}
      {isValidMove && player === null && !isDeadZoneForCurrentPlayer && (
        <div className="absolute w-3 h-3 bg-[hsl(var(--highlight-valid-move))] rounded-full opacity-70 pointer-events-none select-none" />
      )}
      {player && (
        <Pawn
          player={player}
          squareData={squareData}
          isSelected={isSelectedPawn && squareData.player === currentPlayer}
          isCurrentPlayerPawn={player === currentPlayer}
          gamePhase={gamePhase}
          hasWinner={!!winner}
          draggable={gamePhase === 'MOVEMENT' && player === currentPlayer && !isBlocked && !winner}
          onDragStart={(e) => onDragStartPawn && onDragStartPawn(e, row, col)}
          row={row}
          col={col}
        />
      )}
      <div className="absolute bottom-0 right-1 text-[0.6rem] md:text-xs opacity-50 pointer-events-none select-none font-mono">
        {String.fromCharCode(97 + col)}{BOARD_SIZE - row}
      </div>
    </button>
  );
};
