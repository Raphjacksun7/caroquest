
import type { Player, SquareColorType, PawnPosition, BoardSquareData, GamePhase, WinningLine } from '@/types/game';
import { Pawn } from './Pawn';
import { cn } from '@/lib/utils';
import React from 'react'; // Import React for drag event types

interface SquareProps {
  row: number;
  col: number;
  squareData: BoardSquareData;
  squareColorType: SquareColorType;
  currentPlayer: Player;
  gamePhase: GamePhase;
  selectedPawn: PawnPosition | null;
  winningLine: WinningLine | null; 
  isActualDeadZoneForCurrentPlayer: boolean; 
  isValidMoveTargetForSelectedPawn: boolean;
  onClick: (row: number, col: number) => void;
  onPawnDragStart: (row: number, col: number, player: Player, event: React.DragEvent<HTMLButtonElement>) => void;
  onPawnDrop: (targetRow: number, targetCol: number, draggedPawnInfo: { sourceRow: number, sourceCol: number, player: Player }) => void;
}

export const Square = ({
  row,
  col,
  squareData,
  squareColorType,
  currentPlayer,
  gamePhase,
  selectedPawn,
  winningLine,
  isActualDeadZoneForCurrentPlayer,
  isValidMoveTargetForSelectedPawn,
  onClick,
  onPawnDragStart,
  onPawnDrop,
}: SquareProps) => {
  const { player, isBlocked, isBlocking, isCreatingDeadZone } = squareData;
  
  const isSelectedSquare = selectedPawn?.row === row && selectedPawn?.col === col;
  
  const isDraggablePawn = gamePhase === 'MOVEMENT' && player === currentPlayer && !isBlocked;

  const squareBgColor = squareColorType === 'light' 
    ? 'bg-[hsl(var(--board-light-square))]' 
    : 'bg-[hsl(var(--board-dark-square))]';

  let conditionalClasses = '';
  if (isSelectedSquare) {
    conditionalClasses = 'ring-2 ring-offset-1 ring-[hsl(var(--highlight-selected-pawn))]';
  }
  
  const isWinningSquare = winningLine?.positions.some(p => p.row === row && p.col === col) ?? false;
  if (isWinningSquare) {
    conditionalClasses = `${conditionalClasses} bg-[hsl(var(--highlight-win-line))] bg-opacity-80 animate-pulse`;
  }

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>) => {
    if (isDraggablePawn && player) {
      onPawnDragStart(row, col, player, event);
      // Data is set by the hook before calling this, or Square can set it if hook doesn't
      event.dataTransfer.setData('application/json', JSON.stringify({ sourceRow: row, sourceCol: col, player }));
      event.dataTransfer.effectAllowed = "move";
      // Optional: style the source square during drag
      // event.currentTarget.classList.add('opacity-50'); 
    } else {
      event.preventDefault(); // Prevent drag if not draggable
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault(); // Necessary to allow dropping
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const draggedPawnInfoString = event.dataTransfer.getData('application/json');
    if (draggedPawnInfoString) {
      try {
        const draggedPawnInfo = JSON.parse(draggedPawnInfoString);
        onPawnDrop(row, col, draggedPawnInfo);
      } catch (e) {
        console.error("Failed to parse dragged pawn info:", e);
      }
    }
  };
  
  const winner = winningLine !== null;

  return (
    <button
      id={`square-${row}-${col}`}
      onClick={() => onClick(row, col)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      draggable={isDraggablePawn}
      className={cn(
        'w-12 h-12 md:w-16 md:h-16 flex items-center justify-center border border-black/10 transition-colors duration-150 relative overflow-hidden',
        squareBgColor,
        conditionalClasses,
        isDraggablePawn && 'cursor-grab',
        gamePhase === 'MOVEMENT' && isValidMoveTargetForSelectedPawn && !player && 'bg-green-500/30 hover:bg-green-500/50', // Valid move target highlight
      )}
      aria-label={`Square ${row}, ${col}, ${squareColorType}, ${player ? `Player ${player} piece` : 'Empty'}${isBlocked ? ', Blocked' : ''}${isBlocking ? ', Blocking' : ''}${isCreatingDeadZone ? ', Creates Dead Zone' : ''}${isActualDeadZoneForCurrentPlayer ? ', Dead Zone for current player' : ''}${isSelectedSquare ? ', Selected' : ''}${isValidMoveTargetForSelectedPawn ? ', Valid Move' : ''}`}
      disabled={gamePhase === 'GAME_OVER' || (gamePhase === 'MOVEMENT' && !!winner && !winningLine)} // Disable if game over or if winner declared
    >
      {isActualDeadZoneForCurrentPlayer && player === null && ( 
         <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--highlight-dead-zone))] opacity-50 text-3xl font-bold pointer-events-none">X</div>
      )}
      {isValidMoveTargetForSelectedPawn && player === null && !isActualDeadZoneForCurrentPlayer && (
        <div className="absolute w-3 h-3 bg-green-500 rounded-full opacity-70 pointer-events-none" />
      )}
      {player && <Pawn player={player} isBlocked={isBlocked} isBlocking={isBlocking} isCreatingDeadZone={isCreatingDeadZone} />}
    </button>
  );
};
