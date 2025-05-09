"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { GameBoard } from '@/components/game/GameBoard';
import { 
  createInitialGameState, 
  placePawn, 
  movePawn, 
  selectPawn as selectPawnLogic, // Renamed to avoid conflict
  clearHighlights,
  GameState,
  PlayerId,
  SquareState, // Added SquareState
  PAWNS_PER_PLAYER
} from '@/lib/gameLogic';
import type { Action } from '@/lib/ai/mcts';
import { PlayerInfo } from '@/components/game/PlayerInfo';
import { GameControls } from '@/components/game/GameControls';
import { GameStatus } from '@/components/game/GameStatus';
import { WinnerAnnouncement } from '@/components/game/WinnerAnnouncement';
import { RulesDialog } from '@/components/game/RulesDialog';
import { AIController } from '@/components/game/AIController';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Bot, Users, Wifi } from 'lucide-react'; // Assuming Wifi for remote play

type GameMode = 'ai' | 'local' | 'remote';
type AIDifficulty = 'easy' | 'medium' | 'hard';


export default function DiagonalDominationPage() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState(PAWNS_PER_PLAYER));
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const { toast } = useToast();
  const { t, currentLanguage, setLanguage } = useTranslation();

  // Reset game to initial state
  const resetGame = useCallback(() => {
    setGameState(createInitialGameState(PAWNS_PER_PLAYER));
    setIsAIThinking(false);
  }, []);

  // Handle AI's move
  const handleAIMove = useCallback((action: Action | null) => {
    setIsAIThinking(false); // AI has finished thinking
    if (!action) {
      toast({ title: t('aiErrorTitle'), description: "AI couldn't find a move.", variant: "destructive" });
      return;
    }

    let newState: GameState | null = null;
    if (action.type === 'place' && action.index !== undefined) {
      newState = placePawn(gameState, action.index);
    } else if (action.type === 'move' && action.fromIndex !== undefined && action.toIndex !== undefined) {
      newState = movePawn(gameState, action.fromIndex, action.toIndex);
    }

    if (newState) {
      setGameState(newState);
    } else {
      // This case should be rare if AI generates valid moves
      toast({ title: t('aiErrorTitle'), description: "AI made an invalid move.", variant: "destructive" });
    }
  }, [gameState, toast, t]);


  // Handle player's click on a square
  const handleSquareClick = useCallback((index: number) => {
    if (gameState.winner || (gameMode === 'ai' && gameState.currentPlayerId === 2 && isAIThinking)) {
      return; // Game over or AI's turn and thinking
    }

    const { gamePhase, selectedPawnIndex } = gameState;

    let newState: GameState | null = null;

    if (gamePhase === 'placement') {
      newState = placePawn(gameState, index);
      if (!newState) {
        toast({ title: t('invalidPlacement'), description: t('invalidPlacementDescription'), variant: "destructive" });
      }
    } else { // Movement phase
      if (selectedPawnIndex === null) {
        // Try to select a pawn
        const square = gameState.board[index];
        if (square.pawn && square.pawn.playerId === gameState.currentPlayerId && !gameState.blockedPawnsInfo.has(index)) {
          newState = selectPawnLogic(gameState, index);
        } else if (square.pawn && gameState.blockedPawnsInfo.has(index)){
            toast({ title: t('pawnBlocked'), description: t('pawnBlockedDescription'), variant: "destructive" });
        }
      } else {
        // Pawn selected, try to move or deselect
        if (index === selectedPawnIndex) { // Clicked on selected pawn again
          newState = clearHighlights(gameState);
        } else {
            const targetSquare = gameState.board[index];
            if (targetSquare.highlight === 'validMove') {
                newState = movePawn(gameState, selectedPawnIndex, index);
            } else {
                 // If clicked on another of player's pawns, select it
                if (targetSquare.pawn && targetSquare.pawn.playerId === gameState.currentPlayerId && !gameState.blockedPawnsInfo.has(index)) {
                    newState = selectPawnLogic(gameState, index);
                } else {
                    newState = clearHighlights(gameState); // Clicked on invalid square, clear selection
                    toast({ title: t('invalidMove'), description: t('invalidMoveDescription'), variant: "destructive" });
                }
            }
        }
      }
    }

    if (newState) {
      setGameState(newState);
    }
  }, [gameState, gameMode, isAIThinking, toast, t]);
  
  // Handle pawn drag start
  const handlePawnDragStart = useCallback((pawnIndex: number) => {
    if (gameState.gamePhase === 'movement' && !gameState.winner && 
        (!gameState.blockedPawnsInfo.has(pawnIndex)) &&
        (gameMode !== 'ai' || gameState.currentPlayerId !== 2) // Player can only drag their own pawns, not AI's
    ) {
        const pawnOwner = gameState.board[pawnIndex]?.pawn?.playerId;
        if(pawnOwner === gameState.currentPlayerId){
            setGameState(selectPawnLogic(gameState, pawnIndex));
        }
    }
  }, [gameState, gameMode]);

  // Handle pawn drop
  const handlePawnDrop = useCallback((targetIndex: number) => {
    if (gameState.selectedPawnIndex !== null && gameState.board[targetIndex].highlight === 'validMove') {
      const newState = movePawn(gameState, gameState.selectedPawnIndex, targetIndex);
      if (newState) {
        setGameState(newState);
      }
    } else {
      // Invalid drop, clear highlights
      setGameState(clearHighlights(gameState));
      if(gameState.selectedPawnIndex !== null && gameState.board[targetIndex].highlight !== 'validMove'){
          toast({ title: t('invalidDrop'), description: t('invalidDropDescription'), variant: "destructive" });
      }
    }
  }, [gameState, toast, t]);


  useEffect(() => {
    document.title = t('diagonalDomination');
  }, [t, currentLanguage]);

  // Show winner toast
  useEffect(() => {
    if (gameState.winner) {
      const winnerName = gameState.winner === 1 ? t('player', {id: 1}) : (gameMode === 'ai' ? t('aiOpponent') : t('player', {id: 2}));
      toast({
        title: t('playerDynamicWins', { playerName: winnerName }),
        description: t('congratulations'),
        duration: 8000,
      });
    }
  }, [gameState.winner, gameMode, toast, t]);


  return (
    <>
      <div className="flex flex-col items-center justify-center p-4 min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] selection:bg-[hsl(var(--primary))] selection:text-[hsl(var(--primary-foreground))]">
        <header className="mb-6 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-[hsl(var(--primary))] tracking-tight">
              {t('diagonalDomination')}
            </h1>
        </header>

        {/* Game Mode & Difficulty Selection */}
        {!gameState.winner && (gameState.placedPawns[1] === 0 && gameState.placedPawns[2] === 0) && (
          <Card className="mb-6 p-4 w-full max-w-md shadow-lg">
            <CardHeader className="p-2 pb-3">
              <CardTitle className="text-xl">{t('gameSetup')}</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div>
                <Label className="text-base mb-2 block">{t('selectGameMode')}</Label>
                <RadioGroup value={gameMode} onValueChange={(value: string) => setGameMode(value as GameMode)} className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ai" id="mode-ai" />
                    <Label htmlFor="mode-ai" className="flex items-center gap-1 cursor-pointer"><Bot size={18}/> {t('playVsAI')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="local" id="mode-local" />
                    <Label htmlFor="mode-local" className="flex items-center gap-1 cursor-pointer"><Users size={18}/> {t('localTwoPlayer')}</Label>
                  </div>
                  {/* Remote mode can be added here if implemented */}
                </RadioGroup>
              </div>

              {gameMode === 'ai' && (
                <div>
                  <Label className="text-base mb-2 block">{t('aiDifficulty')}</Label>
                  <RadioGroup value={aiDifficulty} onValueChange={(value: string) => setAiDifficulty(value as AIDifficulty)} className="flex space-x-4">
                    {(['easy', 'medium', 'hard'] as AIDifficulty[]).map(diff => (
                       <div className="flex items-center space-x-2" key={diff}>
                         <RadioGroupItem value={diff} id={`diff-${diff}`} />
                         <Label htmlFor={`diff-${diff}`} className="capitalize cursor-pointer">{t(diff)}</Label>
                       </div>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        <GameStatus gameState={gameState} gameMode={gameMode} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,_1fr)_auto_minmax(280px,_1fr)] gap-6 w-full max-w-7xl items-start mt-4">
          <div className="space-y-4 lg:sticky lg:top-6">
            <GameControls 
                onReset={resetGame} 
                onOpenRules={() => setIsRulesOpen(true)}
                pawnsPerPlayer={PAWNS_PER_PLAYER}
                isGameActive={!gameState.winner}
            />
            <PlayerInfo playerId={1} name={t('player', {id: 1})} gameState={gameState} />
             <PlayerInfo playerId={2} name={gameMode === 'ai' ? t('aiOpponent') : t('player', {id: 2})} gameState={gameState} />
          </div>
          
          <div className="flex flex-col items-center justify-center">
            <GameBoard 
              gameState={gameState} 
              onSquareClick={handleSquareClick}
              onPawnDragStart={handlePawnDragStart}
              onPawnDrop={handlePawnDrop}
            />
             {isAIThinking && gameMode === 'ai' && gameState.currentPlayerId === 2 && (
                <div className="mt-4 text-sm text-muted-foreground animate-pulse">{t('AIsTurn')}</div>
            )}
          </div>
          
          <div className="hidden lg:block lg:sticky lg:top-6">
            {/* Placeholder for potential future elements like detailed history or chat */}
          </div>
        </div>
      </div>
      
      {/* AI Controller - non-visual component */}
      {gameMode === 'ai' && gameState.currentPlayerId === 2 && !gameState.winner && (
        <AIController 
          gameState={gameState}
          aiPlayerId={2}
          onAIMove={handleAIMove}
          difficulty={aiDifficulty}
          isThinking={isAIThinking}
          setIsThinking={setIsAIThinking}
        />
      )}
      
      <Toaster />
      <RulesDialog 
        isOpen={isRulesOpen} 
        onClose={() => setIsRulesOpen(false)} 
        pawnsPerPlayer={PAWNS_PER_PLAYER} 
      />
      {gameState.winner && (
        <WinnerAnnouncement 
            winner={gameState.winner}
            winnerName={gameState.winner === 1 ? t('player', {id:1}) : (gameMode === 'ai' ? t('aiOpponent') : t('player', {id:2}))}
            isOpen={!!gameState.winner} 
            onOpenChange={(open) => { if (!open && gameState.winner) resetGame(); }} 
            onPlayAgain={resetGame}
        />
      )}
    </>
  );
}
