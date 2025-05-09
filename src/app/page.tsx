
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
import { useGameConnection, UseGameConnectionReturn } from '@/hooks/useGameConnection';
import { JoinGameForm } from '@/components/game/JoinGameForm';
import { WaitingRoom } from '@/components/game/WaitingRoom';
import type { PlayerInfo as SocketPlayerInfo } from '@/types/socket';


export default function DiagonalDominationPage() {
  const {
    gameState,
    localPlayerId,
    players,
    isConnected,
    error: gameConnectionError,
    gameId,
    createGame,
    joinGame,
    placePawnAction,
    movePawnAction,
    clearError
  } = useGameConnection();
  
  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false);
  const { toast } = useToast();
  const { t, currentLanguage } = useTranslation();

  // Local UI state for selected pawn, distinct from server's gameState.selectedPawnIndex
  // which might be used for turn validation or other server-side logic.
  // For UI responsiveness, manage selection highlighting client-side.
  const [uiSelectedPawnIndex, setUiSelectedPawnIndex] = useState<number | null>(null);
  const [uiHighlightedBoard, setUiHighlightedBoard] = useState<GameState['board'] | null>(null);


  useEffect(() => {
    if (gameConnectionError) {
      toast({
        title: t('errorTitle'),
        description: gameConnectionError,
        variant: "destructive",
        duration: 5000,
      });
      clearError(); // Clear error after showing toast
    }
  }, [gameConnectionError, toast, t, clearError]);

  useEffect(() => {
    document.title = t('diagonalDomination');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('pageDescription'));
    }
    document.documentElement.lang = currentLanguage;
  }, [t, currentLanguage]);

  useEffect(() => {
    if (gameState?.winner) {
      toast({
        title: t('playerWins', { winner: gameState.winner }),
        description: t('congratulations'),
        duration: 5000,
      });
      setUiSelectedPawnIndex(null); // Clear selection on game over
      setUiHighlightedBoard(null);
    }
  }, [gameState?.winner, toast, t]);

  // Update UI highlighted board when gameState changes from server or selection changes
  useEffect(() => {
    if (gameState) {
      if (uiSelectedPawnIndex !== null && gameState.gamePhase === 'movement' && localPlayerId === gameState.currentPlayerId) {
        const highlightedState = highlightValidMoves(gameState, uiSelectedPawnIndex);
        setUiHighlightedBoard(highlightedState.board);
      } else {
        // If no selection or not current player's turn for movement, or placement phase, use server board directly
        const clearedState = clearHighlights(gameState);
        setUiHighlightedBoard(clearedState.board);
      }
    } else {
      setUiHighlightedBoard(null);
    }
  }, [gameState, uiSelectedPawnIndex, localPlayerId]);


  const handleSquareClick = useCallback((index: number) => {
    if (!gameState || !localPlayerId || gameState.winner) return;
    if (gameState.currentPlayerId !== localPlayerId) {
      toast({ title: t('notYourTurnTitle'), description: t('notYourTurnDescription'), variant: "destructive"});
      return;
    }

    const square = gameState.board[index];

    if (gameState.gamePhase === 'placement') {
      placePawnAction(index);
      setUiSelectedPawnIndex(null); // Clear any UI selection
    } else { // Movement phase
      if (uiSelectedPawnIndex === null) { // No pawn selected, try to select one
        if (square.pawn && square.pawn.playerId === localPlayerId && !gameState.blockedPawnsInfo.has(index)) {
          setUiSelectedPawnIndex(index); // Select pawn for UI highlighting
        } else if (square.pawn && square.pawn.playerId === localPlayerId && gameState.blockedPawnsInfo.has(index)) {
          toast({ title: t('pawnBlocked'), description: t('pawnBlockedDescription'), variant: "destructive" });
        }
      } else { // A pawn is selected (uiSelectedPawnIndex is not null)
        if (uiSelectedPawnIndex === index) { // Clicked on already selected pawn
            setUiSelectedPawnIndex(null); // Deselect
        } else { // Attempting to move to a new square or select another pawn
            const targetSquare = uiHighlightedBoard ? uiHighlightedBoard[index] : gameState.board[index]; // Use highlighted board for valid move check
            if (targetSquare.highlight === 'validMove') { // If clicked on a valid move square
                movePawnAction(uiSelectedPawnIndex, index);
                setUiSelectedPawnIndex(null); // Clear selection after move
            } else if (square.pawn && square.pawn.playerId === localPlayerId && !gameState.blockedPawnsInfo.has(index)) {
                setUiSelectedPawnIndex(index); // Select another pawn
            } else {
                // toast({ title: t('invalidAction'), description: t('invalidActionDescription'), variant: "destructive" });
                setUiSelectedPawnIndex(null); // Clear selection on invalid action
            }
        }
      }
    }
  }, [gameState, localPlayerId, placePawnAction, movePawnAction, toast, t, uiSelectedPawnIndex, uiHighlightedBoard]);

  const resetGameHandler = useCallback(() => {
    // For multiplayer, reset might mean leaving the game or starting a new round,
    // which should be handled via server commands. For now, this is a local concept.
    // This function would likely need to emit a 'reset_game' or 'new_game' event to the server.
    // setGameState(createInitialGameState()); // This would be local reset, not for multiplayer
    toast({ title: t('gameReset'), description: t('gameResetDescription')});
    setUiSelectedPawnIndex(null);
    // TODO: Emit reset request to server if applicable for multiplayer.
  }, [toast, t]);

  const handlePawnDragStart = useCallback((pawnIndex: number) => {
    if (!gameState || !localPlayerId || gameState.winner || gameState.currentPlayerId !== localPlayerId) return;
    if (gameState.gamePhase !== 'movement' || gameState.blockedPawnsInfo.has(pawnIndex)) return;
    setUiSelectedPawnIndex(pawnIndex); // Select pawn for UI highlighting
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
    setUiSelectedPawnIndex(null); // Always clear selection after drop attempt
  }, [gameState, localPlayerId, movePawnAction, toast, t, uiSelectedPawnIndex, uiHighlightedBoard]);

  if (!isConnected) {
    return <div className="flex items-center justify-center min-h-screen">{t('connectingToServer')}</div>;
  }

  if (!gameId) {
    return <JoinGameForm onCreateGame={createGame} onJoinGame={joinGame} />;
  }

  if (players.length < 2 && gameId) {
     // Find my player info to pass my name
    const me = players.find(p => p.playerId === localPlayerId);
    return <WaitingRoom gameId={gameId} playerName={me?.name || t('unknownPlayer')} />;
  }
  
  if (!gameState || !uiHighlightedBoard) {
    return <div className="flex items-center justify-center min-h-screen">{t('loadingGame')}</div>;
  }
  
  // Find player names
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
            <p className="text-sm text-muted-foreground">{t('gameRoomID')}: {gameId}</p>
          </header>
          
          <StatusDisplay
            gameState={gameState}
            player1Name={player1Name}
            player2Name={player2Name}
           />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,_1fr)_auto_minmax(280px,_1fr)] gap-4 sm:gap-6 items-start mt-4">
            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
               <ControlsCard
                onReset={resetGameHandler} // This needs server-side implementation for multiplayer
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
                // Pass the uiHighlightedBoard for rendering highlights
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
        winnerName={gameState.winner === 1 ? player1Name : player2Name}
        isOpen={!!gameState.winner} 
        onOpenChange={(open) => { if (!open && gameState.winner) resetGameHandler(); }} 
        onPlayAgain={resetGameHandler} // This also needs server-side implementation
      />
    </>
  );
}
