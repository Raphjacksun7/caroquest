
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, PlayerId } from '@/lib/gameLogic'; // Ensure types are correctly imported
import { BOARD_SIZE, PAWNS_PER_PLAYER, highlightValidMoves, clearHighlights, updateBlockingStatus, updateDeadZones, checkWinCondition } from '@/lib/gameLogic';

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
import { useGameConnection, useGameStore } from '@/hooks/useGameConnection'; // Import Zustand store
import { useAI } from '@/hooks/useAI'; // AI Hook
import { WaitingRoom } from '@/components/game/WaitingRoom';
import { useParams, useRouter } from 'next/navigation';


export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameIdFromRoute = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;

  // Use actions from the hook
  const {
    placePawnAction,
    movePawnAction,
    clearError,
    // joinGame action might be needed if user lands here directly without prior join
    joinGame 
  } = useGameConnection();

  // Subscribe to Zustand store for reactive state
  const {
    gameState,
    localPlayerId,
    players, // Assuming players list is now in Zustand store
    isConnected,
    error: gameConnectionError,
    gameId: connectedGameId,
    opponentName,
    isWaitingForOpponent,
    setGameState // Allow direct state manipulation for AI or local predictions
  } = useGameStore();
  
  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false);
  const { toast } = useToast();
  const { t, currentLanguage, setLanguage } = useTranslation();

  // UI state for highlighting, separate from core gameState's selectedPawnIndex if needed for UI responsiveness.
  // However, the provided gameLogic.highlightValidMoves updates gameState.board directly.
  // So, we'll rely on gameState.board for highlights.
  // const [uiSelectedPawnIndex, setUiSelectedPawnIndex] = useState<number | null>(null);
  // const [uiHighlightedBoard, setUiHighlightedBoard] = useState<GameState['board'] | null>(null);

  // AI integration
  const [isSinglePlayer, setIsSinglePlayer] = useState(false); // Example: toggle for SP mode
  const { calculateBestMove, isLoading: isAILoading, error: aiError } = useAI('medium');


  // Effect to join game if gameIdFromRoute exists but not connectedGameId
  useEffect(() => {
    if (gameIdFromRoute && !connectedGameId && isConnected) {
      // Prompt for player name or use a default/stored one
      const playerName = localStorage.getItem('playerName') || `Player_${Math.random().toString(36).substring(2, 7)}`;
      if (!localStorage.getItem('playerName')) localStorage.setItem('playerName', playerName);
      
      console.log(`Attempting to join game ${gameIdFromRoute} as ${playerName}`);
      joinGame(gameIdFromRoute, playerName);
    }
  }, [gameIdFromRoute, connectedGameId, isConnected, joinGame]);

  // AI Move Logic
  useEffect(() => {
    if (isSinglePlayer && gameState && gameState.currentPlayerId === 2 && !gameState.winner && !isAILoading && !aiError) {
      const makeAIMove = async () => {
        const aiMove = await calculateBestMove(gameState);
        if (aiMove && gameState) { // Ensure gameState still exists
          let nextState: GameState | null = null;
          if (aiMove.type === 'place' && aiMove.squareIndex !== undefined) {
            nextState = placePawnAction(aiMove.squareIndex); // This now emits to server
            // For purely local AI, you'd call:
            // nextState = placePawn(gameState, aiMove.squareIndex);
          } else if (aiMove.type === 'move' && aiMove.fromIndex !== undefined && aiMove.toIndex !== undefined) {
            nextState = movePawnAction(aiMove.fromIndex, aiMove.toIndex); // Emits to server
            // For local AI:
            // nextState = movePawn(gameState, aiMove.fromIndex, aiMove.toIndex);
          }
          // If using purely local AI and not server actions:
          // if (nextState) setGameState(nextState); 
          // else console.error("AI made an invalid move:", aiMove);
        } else if(aiError) {
            toast({ title: "AI Error", description: aiError, variant: "destructive"});
        }
      };
      // Add a slight delay for AI "thinking" feel
      const timeoutId = setTimeout(makeAIMove, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isSinglePlayer, gameState, calculateBestMove, isAILoading, aiError, placePawnAction, movePawnAction, toast]);


  useEffect(() => {
    if (gameConnectionError) {
      toast({
        title: t('errorTitle'),
        description: gameConnectionError,
        variant: "destructive",
        duration: 5000,
      });
      clearError();
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
      const winnerInfo = players.find(p => p.playerId === gameState.winner);
      const winnerName = winnerInfo?.name || `Player ${gameState.winner}`;
      toast({
        title: t('playerDynamicWins', { playerName: winnerName }),
        description: t('congratulations'),
        duration: 8000,
      });
    }
  }, [gameState?.winner, players, toast, t]);


  const handleSquareClick = useCallback((index: number) => {
    if (!gameState || !localPlayerId || gameState.winner || !connectedGameId) return;
    if (gameState.currentPlayerId !== localPlayerId && !isSinglePlayer) { // Allow clicks if SP and AI turn for local testing
      toast({ title: t('notYourTurnTitle'), description: t('notYourTurnDescription'), variant: "destructive"});
      return;
    }
    if (isSinglePlayer && gameState.currentPlayerId === 2) { // AI's turn in single player
        toast({ title: "AI's Turn", description: "Please wait for the AI to move.", variant: "default"});
        return;
    }


    const square = gameState.board[index];

    if (gameState.gamePhase === 'placement') {
      placePawnAction(index);
    } else { 
      if (gameState.selectedPawnIndex === null) { 
        if (square.pawn && square.pawn.playerId === localPlayerId && !gameState.blockedPawnsInfo.has(index)) {
          // Client-side highlighting still useful for immediate feedback
          const highlightedState = highlightValidMoves(gameState, index);
          setGameState(highlightedState); // Update local state for UI
        } else if (square.pawn && square.pawn.playerId === localPlayerId && gameState.blockedPawnsInfo.has(index)) {
          toast({ title: t('pawnBlocked'), description: t('pawnBlockedDescription'), variant: "destructive" });
        }
      } else { 
        if (gameState.selectedPawnIndex === index) { // Deselect
            const clearedState = clearHighlights(gameState);
            setGameState(clearedState);
        } else {
            // Check if the target square is a valid move based on current client-side highlights
            const targetSquare = gameState.board[index]; // gameState.board already reflects highlights
            if (targetSquare.highlight === 'validMove') {
                movePawnAction(gameState.selectedPawnIndex, index);
                // Server will send back updated state, which will clear highlights naturally.
                // Or, clear highlights optimistically: setGameState(clearHighlights(gameState));
            } else if (square.pawn && square.pawn.playerId === localPlayerId && !gameState.blockedPawnsInfo.has(index)) {
                const highlightedState = highlightValidMoves(gameState, index); // Select another of own pawns
                setGameState(highlightedState);
            } else { // Invalid action or click on empty non-valid square
                const clearedState = clearHighlights(gameState);
                setGameState(clearedState);
            }
        }
      }
    }
  }, [gameState, localPlayerId, placePawnAction, movePawnAction, toast, t, connectedGameId, setGameState, isSinglePlayer]);

  const resetGameHandler = useCallback(() => {
    // For multiplayer, this should ideally be a server-side reset or rematch request.
    // For client-side (especially single player or testing):
    // setGameState(createInitialGameState()); // This would break sync in multiplayer
    
    // For now, let's assume it's primarily for client-side UX or single player.
    // In a real MP game, emit a 'request_reset' or 'request_rematch' event.
    toast({ title: t('gameReset'), description: t('gameResetDescription')});
    if (isSinglePlayer) {
        // setGameState(createInitialGameState()); // If purely client-side reset is desired for SP
    }
    // Server should handle reset for multiplayer. Client could show "Waiting for server reset..."
  }, [toast, t, isSinglePlayer, setGameState]);

  const handlePawnDragStart = useCallback((pawnIndex: number) => {
    if (!gameState || !localPlayerId || gameState.winner || gameState.currentPlayerId !== localPlayerId) return;
    if (gameState.gamePhase !== 'movement' || gameState.blockedPawnsInfo.has(pawnIndex)) return;
    
    const highlightedState = highlightValidMoves(gameState, pawnIndex);
    setGameState(highlightedState); // Select pawn and show valid moves
  }, [gameState, localPlayerId, setGameState]);

  const handlePawnDrop = useCallback((targetIndex: number) => {
    if (!gameState || !localPlayerId || gameState.selectedPawnIndex === null) {
      setGameState(clearHighlights(gameState)); // Clear highlights if drop is invalid early
      return;
    }
    const targetSquare = gameState.board[targetIndex]; // gameState.board reflects highlights
    if (targetSquare.highlight === 'validMove') {
        movePawnAction(gameState.selectedPawnIndex, targetIndex);
    } else {
        toast({ title: t('invalidDrop'), description: t('invalidDropDescription'), variant: "destructive" });
    }
    // Server update will naturally clear highlights, or optimistically:
    // setGameState(clearHighlights(gameState)); 
    // For now, rely on server update to reflect final state.
  }, [gameState, localPlayerId, movePawnAction, toast, t, setGameState]);

  if (!isConnected && !gameConnectionError && typeof window !== 'undefined') {
    return <div className="flex items-center justify-center min-h-screen">{t('connectingToServer')}</div>;
  }
  
  if (!connectedGameId && !gameConnectionError && gameIdFromRoute) {
    return <div className="flex items-center justify-center min-h-screen">{t('joiningGame')} {gameIdFromRoute}...</div>;
  }

  if (isWaitingForOpponent && connectedGameId && !isSinglePlayer) {
    const me = players.find(p => p.playerId === localPlayerId);
    return <WaitingRoom gameId={connectedGameId} playerName={me?.name || t('unknownPlayer')} />;
  }
  
  if (!gameState) {
    return <div className="flex items-center justify-center min-h-screen">{t('loadingGame')}</div>;
  }
  
  const player1 = players.find(p => p.playerId === 1);
  const player2 = players.find(p => p.playerId === 2);
  const player1Name = player1?.name || t('player', {id: 1});
  const player2Name = isSinglePlayer && !player2 ? "AI Opponent" : (player2?.name || t('player', {id: 2}));


  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-2 sm:p-4 selection:bg-[hsl(var(--primary))] selection:text-[hsl(var(--primary-foreground))]">
        <div className="w-full max-w-7xl mx-auto">
          <header className="mb-4 sm:mb-6 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-[hsl(var(--primary))] tracking-tight">
              {t('diagonalDomination')}
            </h1>
            {connectedGameId && <p className="text-sm text-muted-foreground">{t('gameRoomID')}: {connectedGameId}</p>}
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
                isSinglePlayer={isSinglePlayer}
                onToggleSinglePlayer={() => setIsSinglePlayer(prev => !prev)}
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
                gameState={gameState} // Pass the full gameState, highlights are part of its board
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

      {gameState.winner && (
        <WinnerDialog 
            winner={gameState.winner}
            winnerName={gameState.winner === 1 ? player1Name : (gameState.winner === 2 ? player2Name : '')}
            isOpen={!!gameState.winner} 
            onOpenChange={(open) => { if (!open && gameState.winner) resetGameHandler(); }} 
            onPlayAgain={resetGameHandler}
        />
      )}
    </>
  );
}

// New translation key
// "joiningGame": "Joining game"
// "AIsTurn": "AI's Turn"
// "waitForAIMove": "Please wait for the AI to move."
// "toggleSinglePlayer": "Toggle Single Player Mode" (for ControlsCard)
// "singlePlayerMode": "Single Player Mode" (for ControlsCard)
