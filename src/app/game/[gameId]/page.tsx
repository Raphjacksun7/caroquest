"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, PlayerId } from '@/lib/gameLogic';
import { 
  createInitialGameState,
  placePawn,
  movePawn,
  highlightValidMoves,
  clearHighlights,
  PAWNS_PER_PLAYER
} from '@/lib/gameLogic';

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
import { useGameConnection, PlayerInfo, useGameStore } from '@/hooks/useGameConnection'; // Added useGameStore
import { useAI } from '@/hooks/useAI';
import { WaitingRoom } from '@/components/game/WaitingRoom';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

type GameMode = 'ai' | 'local' | 'remote';
type AIDifficulty = 'easy' | 'medium' | 'hard';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdFromRoute = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;

  const [localGameState, setLocalGameState] = useState<GameState | null>(null);
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [player1NameLocal, setPlayer1NameLocal] = useState('Player 1');
  const [player2NameLocal, setPlayer2NameLocal] = useState('Player 2');
  
  const {
    gameState: remoteGameState,
    localPlayerId: remoteLocalPlayerId,
    players: remotePlayers,
    isConnected,
    error: gameConnectionError,
    gameId: connectedGameId,
    opponentName: remoteOpponentName,
    isWaitingForOpponent,
    placePawnAction,
    movePawnAction,
    clearError,
    joinGame 
  } = useGameConnection();

  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const { calculateBestMove, isLoading: isAILoading, error: aiError } = useAI(aiDifficulty);


  useEffect(() => {
    const mode = gameIdFromRoute === 'ai' ? 'ai' : gameIdFromRoute === 'local' ? 'local' : 'remote';
    setGameMode(mode);

    if (mode === 'ai') {
      const p1Name = searchParams.get('playerName') || 'Player';
      const difficulty = searchParams.get('difficulty') as AIDifficulty || 'medium';
      setPlayer1NameLocal(p1Name);
      setPlayer2NameLocal(t('aiOpponent'));
      setAiDifficulty(difficulty);
      setLocalGameState(createInitialGameState());
    } else if (mode === 'local') {
      const p1Name = searchParams.get('player1') || 'Player 1';
      const p2Name = searchParams.get('player2') || 'Player 2';
      setPlayer1NameLocal(p1Name);
      setPlayer2NameLocal(p2Name);
      setLocalGameState(createInitialGameState());
    } else { 
      const playerName = localStorage.getItem('playerName') || `Player_${Math.random().toString(36).substring(2, 7)}`;
      if (!connectedGameId && gameIdFromRoute && isConnected) { // isConnected check ensures socket is ready
         joinGame(gameIdFromRoute, playerName);
      }
    }
  }, [gameIdFromRoute, searchParams, joinGame, connectedGameId, t, isConnected]);


  const activeGameState = gameMode === 'remote' ? remoteGameState : localGameState;
  const activeLocalPlayerId = gameMode === 'remote' ? remoteLocalPlayerId : (activeGameState?.currentPlayerId || null);
  const activePlayers = gameMode === 'remote' ? remotePlayers : (localGameState ? [
      { id: 'local1', name: player1NameLocal, playerId: 1 as PlayerId},
      { id: 'local2', name: player2NameLocal, playerId: 2 as PlayerId}
    ] : []);

  useEffect(() => {
    if (gameMode === 'ai' && localGameState && localGameState.currentPlayerId === 2 && !localGameState.winner && !isAILoading && !aiError) {
      const makeAIMove = async () => {
        const aiMove = await calculateBestMove(localGameState);
        if (aiMove && localGameState) {
          let nextState: GameState | null = null;
          if (aiMove.type === 'place' && aiMove.squareIndex !== undefined) {
            nextState = placePawn(localGameState, aiMove.squareIndex);
          } else if (aiMove.type === 'move' && aiMove.fromIndex !== undefined && aiMove.toIndex !== undefined) {
            nextState = movePawn(localGameState, aiMove.fromIndex, aiMove.toIndex);
          }
          if (nextState) setLocalGameState(nextState);
          else console.error("AI made an invalid move:", aiMove);
        } else if (aiError) {
            toast({ title: t('aiErrorTitle'), description: aiError, variant: "destructive"});
        }
      };
      const timeoutId = setTimeout(makeAIMove, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [gameMode, localGameState, calculateBestMove, isAILoading, aiError, toast, t]);

  useEffect(() => {
    if (gameConnectionError) {
      toast({ title: t('errorTitle'), description: gameConnectionError, variant: "destructive", duration: 5000 });
      clearError(); // Make sure clearError is called
    }
  }, [gameConnectionError, toast, t, clearError]);

  useEffect(() => {
    document.title = t('diagonalDomination');
  }, [t]);

  useEffect(() => {
    if (activeGameState?.winner) {
      const winnerInfo = activePlayers.find(p => p.playerId === activeGameState.winner);
      const winnerName = winnerInfo?.name || `Player ${activeGameState.winner}`;
      toast({ title: t('playerDynamicWins', { playerName: winnerName }), description: t('congratulations'), duration: 8000 });
    }
  }, [activeGameState?.winner, activePlayers, toast, t]);

  const handleLocalSquareClick = useCallback((index: number) => {
    if (!localGameState || localGameState.winner) return;

    if (gameMode === 'ai' && localGameState.currentPlayerId === 2) {
      toast({ title: t('AIsTurn'), description: t('waitForAIMove')});
      return;
    }

    const square = localGameState.board[index];

    if (localGameState.gamePhase === 'placement') {
      const newState = placePawn(localGameState, index);
      if (newState) setLocalGameState(newState);
      else toast({ title: t('invalidPlacement'), description: t('invalidPlacementDescription'), variant: "destructive" });
    } else { 
      if (localGameState.selectedPawnIndex === null) {
        if (square.pawn && square.pawn.playerId === localGameState.currentPlayerId && !localGameState.blockedPawnsInfo.has(index)) {
          setLocalGameState(highlightValidMoves(localGameState, index));
        } else if (square.pawn && square.pawn.playerId === localGameState.currentPlayerId && localGameState.blockedPawnsInfo.has(index)) {
          toast({ title: t('pawnBlocked'), description: t('pawnBlockedDescription'), variant: "destructive" });
        }
      } else {
        if (localGameState.selectedPawnIndex === index) { 
          setLocalGameState(clearHighlights(localGameState));
        } else {
          const targetSquare = localGameState.board[index];
          if (targetSquare.highlight === 'validMove') {
            const newState = movePawn(localGameState, localGameState.selectedPawnIndex, index);
            if (newState) setLocalGameState(newState);
          } else if (square.pawn && square.pawn.playerId === localGameState.currentPlayerId && !localGameState.blockedPawnsInfo.has(index)) {
             setLocalGameState(highlightValidMoves(localGameState, index));
          } else {
             setLocalGameState(clearHighlights(localGameState));
          }
        }
      }
    }
  }, [localGameState, gameMode, toast, t]);


  const handleRemoteSquareClick = useCallback((index: number) => {
    if (!remoteGameState || !remoteLocalPlayerId || remoteGameState.winner || !connectedGameId) return;
    if (remoteGameState.currentPlayerId !== remoteLocalPlayerId) {
      toast({ title: t('notYourTurnTitle'), description: t('notYourTurnDescription'), variant: "destructive"});
      return;
    }
    
    const square = remoteGameState.board[index];

    if (remoteGameState.gamePhase === 'placement') {
      placePawnAction(index);
    } else { 
      if (remoteGameState.selectedPawnIndex === null) { 
        if (square.pawn && square.pawn.playerId === remoteLocalPlayerId && !remoteGameState.blockedPawnsInfo.has(index)) {
          const tempState = highlightValidMoves(remoteGameState, index);
          useGameStore.getState().setGameState(tempState); 
        } else if (square.pawn && square.pawn.playerId === remoteLocalPlayerId && remoteGameState.blockedPawnsInfo.has(index)) {
          toast({ title: t('pawnBlocked'), description: t('pawnBlockedDescription'), variant: "destructive" });
        }
      } else { 
        if (remoteGameState.selectedPawnIndex === index) { 
            const tempState = clearHighlights(remoteGameState);
            useGameStore.getState().setGameState(tempState);
        } else {
            const targetSquare = remoteGameState.board[index];
            if (targetSquare.highlight === 'validMove') {
                movePawnAction(remoteGameState.selectedPawnIndex, index);
            } else if (square.pawn && square.pawn.playerId === remoteLocalPlayerId && !remoteGameState.blockedPawnsInfo.has(index)) {
                const tempState = highlightValidMoves(remoteGameState, index);
                useGameStore.getState().setGameState(tempState);
            } else {
                const tempState = clearHighlights(remoteGameState);
                useGameStore.getState().setGameState(tempState);
            }
        }
      }
    }
  }, [remoteGameState, remoteLocalPlayerId, placePawnAction, movePawnAction, toast, t, connectedGameId]);

  const handleSquareClick = gameMode === 'remote' ? handleRemoteSquareClick : handleLocalSquareClick;


  const resetGameHandler = useCallback(() => {
    if (gameMode === 'remote') {
      toast({ title: t('gameReset'), description: t('featureNotAvailableRemote')});
    } else { 
      setLocalGameState(createInitialGameState());
      toast({ title: t('gameReset'), description: t('gameResetDescription')});
    }
  }, [gameMode, toast, t]);

  const handlePawnDragStart = useCallback((pawnIndex: number) => {
    if (!activeGameState || !activeLocalPlayerId || activeGameState.winner) return;
    if (gameMode === 'remote' && activeGameState.currentPlayerId !== remoteLocalPlayerId) return;
    if ((gameMode === 'local' || gameMode === 'ai') && activeGameState.currentPlayerId !== activeLocalPlayerId) return;

    if (activeGameState.gamePhase !== 'movement' || activeGameState.blockedPawnsInfo.has(pawnIndex)) return;
    
    const highlightedState = highlightValidMoves(activeGameState, pawnIndex);
    if (gameMode === 'remote') useGameStore.getState().setGameState(highlightedState);
    else setLocalGameState(highlightedState);
  }, [activeGameState, activeLocalPlayerId, remoteLocalPlayerId, gameMode]);

  const handlePawnDrop = useCallback((targetIndex: number) => {
    if (!activeGameState || !activeLocalPlayerId || activeGameState.selectedPawnIndex === null) {
      if(activeGameState) { // Check if activeGameState is not null
        const clearedState = clearHighlights(activeGameState);
        if (gameMode === 'remote') useGameStore.getState().setGameState(clearedState);
        else setLocalGameState(clearedState);
      }
      return;
    }

    const targetSquare = activeGameState.board[targetIndex];
    if (targetSquare.highlight === 'validMove') {
        if (gameMode === 'remote') {
            movePawnAction(activeGameState.selectedPawnIndex, targetIndex);
        } else {
            const newState = movePawn(activeGameState, activeGameState.selectedPawnIndex, targetIndex);
            if (newState) setLocalGameState(newState);
        }
    } else {
        toast({ title: t('invalidDrop'), description: t('invalidDropDescription'), variant: "destructive" });
        const clearedState = clearHighlights(activeGameState); 
        if (gameMode === 'remote') useGameStore.getState().setGameState(clearedState);
        else setLocalGameState(clearedState);
    }
  }, [activeGameState, activeLocalPlayerId, gameMode, movePawnAction, toast, t]);

  if (gameMode === 'remote' && !isConnected && !gameConnectionError && typeof window !== 'undefined') {
    return <div className="flex items-center justify-center min-h-screen">{t('connectingToServer')}</div>;
  }
  
  if (gameMode === 'remote' && !connectedGameId && !gameConnectionError && gameIdFromRoute !== 'ai' && gameIdFromRoute !== 'local') {
    return <div className="flex items-center justify-center min-h-screen">{t('joiningGame')} {gameIdFromRoute}...</div>;
  }

  if (gameMode === 'remote' && isWaitingForOpponent && connectedGameId) {
    const me = remotePlayers.find(p => p.playerId === remoteLocalPlayerId);
    return <WaitingRoom gameId={connectedGameId} playerName={me?.name || t('unknownPlayer')} />;
  }
  
  if (!activeGameState) {
    return <div className="flex items-center justify-center min-h-screen">{t('loadingGame')}</div>;
  }
  
  const player1 = activePlayers.find(p => p.playerId === 1);
  const player2 = activePlayers.find(p => p.playerId === 2);
  
  const player1DisplayName = gameMode === 'remote' ? (player1?.name || t('player', {id: 1})) : player1NameLocal;
  const player2DisplayName = gameMode === 'remote' ? (player2?.name || t('player', {id: 2})) : player2NameLocal;


  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-2 sm:p-4 selection:bg-[hsl(var(--primary))] selection:text-[hsl(var(--primary-foreground))]">
        <div className="w-full max-w-7xl mx-auto">
          <header className="mb-4 sm:mb-6 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-[hsl(var(--primary))] tracking-tight">
              {t('diagonalDomination')}
            </h1>
            {gameMode === 'remote' && connectedGameId && <p className="text-sm text-muted-foreground">{t('gameRoomID')}: {connectedGameId}</p>}
          </header>
          
          <StatusDisplay
            gameState={activeGameState}
            player1Name={player1DisplayName}
            player2Name={player2DisplayName}
           />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,_1fr)_auto_minmax(280px,_1fr)] gap-4 sm:gap-6 items-start mt-4">
            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
               <ControlsCard
                onReset={resetGameHandler}
                onOpenRules={() => setIsRulesDialogOpen(true)}
                pawnsPerPlayer={PAWNS_PER_PLAYER} 
                isGameActive={!activeGameState.winner}
              />
              <PlayerCard
                playerId={1}
                playerName={player1DisplayName}
                isLocalPlayer={gameMode === 'remote' ? remoteLocalPlayerId === 1 : true}
                gameState={activeGameState}
              />
              <PlayerCard
                playerId={2}
                playerName={player2DisplayName}
                isLocalPlayer={gameMode === 'remote' ? remoteLocalPlayerId === 2 : false}
                gameState={activeGameState}
              />
            </div>

            <div className="flex flex-col items-center justify-center">
              <GameBoard
                gameState={activeGameState}
                onSquareClick={handleSquareClick}
                onPawnDragStart={handlePawnDragStart}
                onPawnDrop={handlePawnDrop}
              />
            </div>

            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
               <HistoryCard gameState={activeGameState} />
            </div>
          </div>
        </div>
      </main>
      <Toaster />
      
      <Dialog open={isRulesDialogOpen} onOpenChange={setIsRulesDialogOpen}>
        <RulesDialogContent pawnsPerPlayer={PAWNS_PER_PLAYER}/>
      </Dialog>

      {activeGameState.winner && (
        <WinnerDialog 
            winner={activeGameState.winner}
            winnerName={activeGameState.winner === 1 ? player1DisplayName : (activeGameState.winner === 2 ? player2DisplayName : '')}
            isOpen={!!activeGameState.winner} 
            onOpenChange={(open) => { if (!open && activeGameState.winner) resetGameHandler(); }} 
            onPlayAgain={resetGameHandler}
        />
      )}
    </>
  );
}