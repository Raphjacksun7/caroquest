
"use client";

import type { PlayerId, GamePhase, GameState } from '@/lib/gameLogic';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Swords, Hourglass, Flag, Zap } from 'lucide-react';
import { BOARD_SIZE } from '@/lib/gameLogic';
import { useTranslation } from '@/hooks/useTranslation';

interface StatusDisplayProps {
  gameState: GameState;
  player1Name: string;
  player2Name: string;
}

export const StatusDisplay = ({ gameState, player1Name, player2Name }: StatusDisplayProps) => {
  const { t } = useTranslation();
  const { gamePhase, currentPlayerId, winner, selectedPawnIndex, board, playerColors } = gameState;

  let statusText = '';
  let statusDescription = '';
  let IconComponent = Hourglass;

  const getPlayerDisplayName = (id: PlayerId) => {
    return id === 1 ? player1Name : player2Name;
  };

  if (winner) {
    statusText = t('statusPlayerWins', { winner: getPlayerDisplayName(winner) });
    statusDescription = t('statusCongratulations');
    IconComponent = Flag;
  } else {
    const currentPlayerName = getPlayerDisplayName(currentPlayerId);
    const playerColorEnum = playerColors[currentPlayerId];
    // Removed playerColorName logic for pawn color as it's implicit by player
    statusText = t('statusPlayerTurnSimple', { playerName: currentPlayerName });
    IconComponent = Swords;

    switch (gamePhase) {
      case 'placement':
        statusDescription = t('statusPlacementPhase');
        break;
      case 'movement':
        if (selectedPawnIndex !== null && board[selectedPawnIndex]) { // Check if board[selectedPawnIndex] exists
          const selectedSquare = board[selectedPawnIndex];
          const coord = `${String.fromCharCode(97 + selectedSquare.col)}${BOARD_SIZE - selectedSquare.row}`;
          statusDescription = t('statusMovementPhaseSelected', { coord });
          IconComponent = Zap; 
        } else {
          statusDescription = t('statusMovementPhaseSelect');
        }
        break;
      default:
        statusDescription = t('statusLoading');
    }
  }

  return (
    <div className={cn(
      "text-center mb-4 p-3 rounded-lg shadow-md border transition-all duration-300",
      winner ? "bg-[hsl(var(--highlight-win-line))] text-foreground" : "bg-card text-card-foreground",
      !winner && currentPlayerId === 1 ? "border-[hsl(var(--player1-pawn-color))]" : "",
      !winner && currentPlayerId === 2 ? "border-[hsl(var(--player2-pawn-color))]" : ""
    )}>
      <div className="flex items-center justify-center gap-2">
        <IconComponent size={22} className={cn(winner ? "text-foreground" : "text-[hsl(var(--primary))]")} />
        <h2 className="text-xl sm:text-2xl font-semibold">{statusText}</h2>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{statusDescription}</p>
    </div>
  );
};

