
import type { Player, SquareColorType, PawnPosition, BoardSquareData, GamePhase, WinningLine, DeadZone } from '@/types/game';
import { Pawn } from './Pawn';
import { cn } from '@/lib/utils';
import React from 'react';

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
}: SquareProps) => {
  const { player, isBlocked, isBlocking, isCreatingDeadZone, isPartOfWinningLine } = squareData;
  
  const squareBgColor = squareColorType === 'light' 
    ? 'bg-[hsl(var(--board-light-square))]' 
    : 'bg-[hsl(var(--board-dark-square))]';

  let conditionalClasses = '';
  let hoverClasses = 'hover:bg-opacity-80';

  if (isPartOfWinningLine) {
    conditionalClasses = `bg-[hsl(var(--highlight-win-line))] ${squareColorType === 'light' ? 'bg-opacity-70' : 'bg-opacity-60'}`;
  } else if (isSelectedPawn && player === currentPlayer) { // Highlight the selected pawn's square itself
    conditionalClasses = 'ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn))]';
  } else if (isValidMove && player === null) { // Highlight valid move target squares
    conditionalClasses = 'bg-[hsl(var(--highlight-valid-move))] bg-opacity-40';
    hoverClasses = 'hover:bg-opacity-60';
  }
  
  const canInteract = !winner && !(gamePhase === 'MOVEMENT' && player !== null && player !== currentPlayer && !isSelectedPawn);


  return (
    <button
      id={`square-${row}-${col}`}
      onClick={() => onClick(row, col)}
      className={cn(
        'w-14 h-14 flex items-center justify-center border border-[hsla(var(--foreground),0.1)] transition-colors duration-150 relative overflow-hidden',
        squareBgColor,
        conditionalClasses,
        canInteract ? `cursor-pointer ${hoverClasses}` : 'cursor-default',
        // (player && player !== currentPlayer) && 'cursor-not-allowed',
      )}
      aria-label={`Square ${row}, ${col}, ${squareColorType}, ${player ? `Player ${player} piece` : 'Empty'}${isBlocked ? ', Blocked' : ''}${isBlocking ? ', Blocking' : ''}${isCreatingDeadZone ? ', Creates Dead Zone' : ''}${isDeadZoneForCurrentPlayer ? ', Dead Zone for current player' : ''}${isSelectedPawn && player === currentPlayer ? ', Selected' : ''}${isValidMove ? ', Valid Move' : ''}`}
      disabled={!!winner}
    >
      {isDeadZoneForCurrentPlayer && player === null && ( 
         <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--highlight-dead-zone))] opacity-50 text-4xl font-bold pointer-events-none">×</div>
      )}
      {/* Valid move dot for empty squares */}
      {isValidMove && player === null && !isDeadZoneForCurrentPlayer && (
        <div className="absolute w-3 h-3 bg-[hsl(var(--highlight-valid-move))] rounded-full opacity-70 pointer-events-none" />
      )}
      {player && (
        <Pawn
          player={player}
          squareData={squareData}
          isSelected={isSelectedPawn && squareData.player === currentPlayer}
          isCurrentPlayerPawn={player === currentPlayer}
          gamePhase={gamePhase}
          hasWinner={!!winner}
        />
      )}
      {/* Coordinates for accessibility/debugging, can be styled to be less obtrusive */}
      <div className="absolute bottom-0 right-1 text-xs opacity-30 pointer-events-none select-none">
        {String.fromCharCode(97 + col)}{BOARD_SIZE - row}
      </div>
    </button>
  );
};
