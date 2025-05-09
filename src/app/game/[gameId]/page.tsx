
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, PlayerId } from '@/lib/gameLogic';
import { BOARD_SIZE, PAWNS_PER_PLAYER, highlightValidMoves, clearHighlights } from '@/lib/gameLogic';

import { GameBoard } from '@/components/game/GameBoard';
import { PlayerCard } from '@/components/game/PlayerCard';
import { ControlsCard } from '@/components/game/ControlsCard';
import { HistoryCard } from '@/components/game/HistoryCard';
import { RulesDialogContent } from '@/components/game/RulesDialog'; 
import { WinnerDialog } from '@/components/game/WinnerDialog';
import { StatusDisplay } from '@/components/game/StatusDisplay';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Dialog } from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameConnection } from '@/hooks/useGameConnection';
import { WaitingRoom } from '@/components/game/WaitingRoom';
import { useParams, useRouter } // For accessing route params
from 'next/navigation';


export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameIdFromRoute = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;

  const {
    gameState,
    localPlayerId,
    players,
    isConnected,
    error: gameConnectionError,
    gameId: connectedGameId, // gameId from the hook, might differ initially from route
    // createGame, joinGame, // Not typically used directly on the game page itself
    placePawnAction,
    movePawnAction,
    clearError
  } = useGameConnection();
  
  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false);
  const { toast } = useToast();
  const { t, currentLanguage, setLanguage } = useTranslation();

  const [uiSelectedPawnIndex, setUiSelectedPawnIndex] = useState<number | null>(null);
  const [uiHighlightedBoard, setUiHighlightedBoard] = useState<GameState['board'] | null>(null);

  // Effect for game connection errors
  useEffect(() => {
    if (gameConnectionError) {
      toast({
        title: t('errorTitle'),
        description: gameConnectionError,
        variant: "destructive",
        duration: 5000,
      });
      clearError();
      // Optionally, redirect if critical error (e.g., game not found and not connecting)
      // if (gameConnectionError.includes("Game not found") && !isConnected) router.push('/');
    }
  }, [gameConnectionError, toast, t, clearError, router, isConnected]);

  // Effect for page title and meta description (localization)
  useEffect(() => {
    document.title = t('diagonalDomination');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('pageDescription'));
    }
    document.documentElement.lang = currentLanguage;
  }, [t, currentLanguage]);

  // Effect for winner announcement
  useEffect(() => {
    if (gameState?.winner) {
      const winnerName = players.find(p => p.playerId === gameState.winner)?.name || `Player ${gameState.winner}`;
      toast({
        title: t('playerDynamicWins', { playerName: winnerName }),
        description: t('congratulations'),
        duration: 8000, // Longer duration for winner toast
      });
      setUiSelectedPawnIndex(null);
      setUiHighlightedBoard(null);
    }
  }, [gameState?.winner, players, toast, t]);

  // Update UI highlighted board when gameState changes or selection changes
  useEffect(() => {
    if (gameState) {
      if (uiSelectedPawnIndex !== null && gameState.gamePhase === 'movement' && localPlayerId === gameState.currentPlayerId) {
        const highlightedState = highlightValidMoves(gameState, uiSelectedPawnIndex);
        setUiHighlightedBoard(highlightedState.board);
      } else {
        const clearedState = clearHighlights(gameState); // Always show base board state if not actively highlighting moves
        setUiHighlightedBoard(clearedState.board);
      }
    } else {
      setUiHighlightedBoard(null);
    }
  }, [gameState, uiSelectedPawnIndex, localPlayerId]);

  const handleSquareClick = useCallback((index: number) => {
    if (!gameState || !localPlayerId || gameState.winner || !connectedGameId) return;
    if (gameState.currentPlayerId !== localPlayerId) {
      toast({ title: t('notYourTurnTitle'), description: t('notYourTurnDescription'), variant: "destructive"});
      return;
    }

    const square = gameState.board[index];

    if (gameState.gamePhase === 'placement') {
      placePawnAction(index);
      setUiSelectedPawnIndex(null);
    } else { // Movement phase
      if (uiSelectedPawnIndex === null) { // No pawn selected
        if (square.pawn && square.pawn.playerId === localPlayerId && !gameState.blockedPawnsInfo.has(index)) {
          setUiSelectedPawnIndex(index); // Select pawn for UI highlighting
        } else if (square.pawn && square.pawn.playerId === localPlayerId && gameState.blockedPawnsInfo.has(index)) {
          toast({ title: t('pawnBlocked'), description: t('pawnBlockedDescription'), variant: "destructive" });
        }
      } else { // A pawn is selected
        if (uiSelectedPawnIndex === index) {
            setUiSelectedPawnIndex(null); // Deselect
        } else {
            const targetSquare = uiHighlightedBoard ? uiHighlightedBoard[index] : gameState.board[index];
            if (targetSquare.highlight === 'validMove') {
                movePawnAction(uiSelectedPawnIndex, index);
                setUiSelectedPawnIndex(null);
            } else if (square.pawn && square.pawn.playerId === localPlayerId && !gameState.blockedPawnsInfo.has(index)) {
                setUiSelectedPawnIndex(index); // Select another of own pawns
            } else {
                setUiSelectedPawnIndex(null); // Clear selection on invalid action
            }
        }
      }
    }
  }, [gameState, localPlayerId, placePawnAction, movePawnAction, toast, t, uiSelectedPawnIndex, uiHighlightedBoard, connectedGameId]);

  const resetGameHandler = useCallback(() => {
    // This would ideally trigger a "new round" or "rematch" event to the server
    // For now, it's a local concept and might not fully work in multiplayer without server support
    // Server should re-initialize game state for the room
    toast({ title: t('gameReset'), description: t('gameResetDescription')});
    setUiSelectedPawnIndex(null);
    // TODO: Emit a 'request_reset' event to the server.
    // For a client-side only demo without server reset, you might call createInitialGameState()
    // but that won't sync with other players.
  }, [toast, t]);

  const handlePawnDragStart = useCallback((pawnIndex: number) => {
    if (!gameState || !localPlayerId || gameState.winner || gameState.currentPlayerId !== localPlayerId) return;
    if (gameState.gamePhase !== 'movement' || gameState.blockedPawnsInfo.has(pawnIndex)) return;
    setUiSelectedPawnIndex(pawnIndex);
  }, [gameState, localPlayerId]);

  const handlePawnDrop = useCallback((targetIndex: number) => {
    if (!gameState || !localPlayerId || uiSelectedPawnIndex === null) {
      setUiSelectedPawnIndex(null);
      return;
    }
    const targetSquare = uiHighlightedBoard ? uiHighlightedBoard[targetIndex] : gameState.board[targetIndex];
    if (targetSquare.highlight === 'validMove') {
        movePawnAction(uiSelectedPawnIndex, targetIndex);
    } else {
        toast({ title: t('invalidDrop'), description: t('invalidDropDescription'), variant: "destructive" });
    }
    setUiSelectedPawnIndex(null);
  }, [gameState, localPlayerId, movePawnAction, toast, t, uiSelectedPawnIndex, uiHighlightedBoard]);

  if (!isConnected && !gameConnectionError) {
    return <div className="flex items-center justify-center min-h-screen">{t('connectingToServer')}</div>;
  }
  
  if (!connectedGameId && !gameConnectionError) {
    // This state might occur if the hook hasn't received gameId yet, or if trying to access /game/id directly without joining.
    // For direct access, user should be redirected or shown a message.
    return <div className="flex items-center justify-center min-h-screen">{t('loadingGameDetails')}</div>;
  }

  if (players.length < 2 && connectedGameId && !gameState?.winner) {
    const me = players.find(p => p.playerId === localPlayerId);
    return <WaitingRoom gameId={connectedGameId} playerName={me?.name || t('unknownPlayer')} />;
  }
  
  if (!gameState || !uiHighlightedBoard) {
    return <div className="flex items-center justify-center min-h-screen">{t('loadingGame')}</div>;
  }
  
  const player1Name = players.find(p => p.playerId === 1)?.name || t('player', {id: 1});
  const player2Name = players.find(p => p.playerId === 2)?.name || t('player', {id: 2});

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-2 sm:p-4 selection:bg-[hsl(var(--primary))] selection:text-[hsl(var(--primary-foreground))]">
        <div className="w-full max-w-7xl mx-auto">
          <header className="mb-4 sm:mb-6 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-[hsl(var(--primary))] tracking-tight">
              {t('diagonalDomination')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('gameRoomID')}: {connectedGameId}</p>
          </header>
          
          <StatusDisplay
            gameState={gameState}
            player1Name={player1Name}
            player2Name={player2Name}
           />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,_1fr)_auto_minmax(280px,_1fr)] gap-4 sm:gap-6 items-start mt-4">
            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
               <ControlsCard
                onReset={resetGameHandler}
                onOpenRules={() => setIsRulesDialogOpen(true)}
                pawnsPerPlayer={PAWNS_PER_PLAYER} 
                isGameActive={!gameState.winner}
              />
              <PlayerCard
                playerId={1}
                playerName={player1Name}
                isLocalPlayer={localPlayerId === 1}
                gameState={gameState}
              />
              <PlayerCard
                playerId={2}
                playerName={player2Name}
                isLocalPlayer={localPlayerId === 2}
                gameState={gameState}
              />
            </div>

            <div className="flex flex-col items-center justify-center">
              <GameBoard
                gameState={{...gameState, board: uiHighlightedBoard, selectedPawnIndex: uiSelectedPawnIndex }}
                onSquareClick={handleSquareClick}
                onPawnDragStart={handlePawnDragStart}
                onPawnDrop={handlePawnDrop}
              />
            </div>

            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
               <HistoryCard gameState={gameState} />
            </div>
          </div>
        </div>
      </main>
      <Toaster />
      
      <Dialog open={isRulesDialogOpen} onOpenChange={setIsRulesDialogOpen}>
        <RulesDialogContent pawnsPerPlayer={PAWNS_PER_PLAYER}/>
      </Dialog>

      <WinnerDialog 
        winner={gameState.winner}
        winnerName={gameState.winner === 1 ? player1Name : (gameState.winner === 2 ? player2Name : '')}
        isOpen={!!gameState.winner} 
        onOpenChange={(open) => { if (!open && gameState.winner) resetGameHandler(); }} 
        onPlayAgain={resetGameHandler}
      />
    </>
  );
}

// New translation key
// "loadingGameDetails": "Loading game details..."
