"use client";

import type { Action } from '@/lib/ai/mcts';
import React, { useEffect, useCallback } from 'react';
import { useAI } from '@/hooks/useAI'; 
import { GameState, PlayerId } from '@/lib/types';

interface AIControllerProps {
  gameState: GameState;
  aiPlayerId: PlayerId;
  onAIMove: (action: Action | null) => void; // Allow null if AI fails or no move
  difficulty: 'easy' | 'medium' | 'hard';
  isThinking: boolean;
  setIsThinking: (isThinking: boolean) => void;
  onAIError?: (errorMsg: string) => void;
}

export function AIController({ 
  gameState, 
  aiPlayerId, 
  onAIMove, 
  difficulty,
  isThinking,
  setIsThinking,
  onAIError
}: AIControllerProps) {
  const { calculateBestMove, isLoading: isAILoading, error: aiHookError } = useAI(difficulty);

  useEffect(() => {
    if (aiHookError && onAIError) {
      onAIError(aiHookError);
    }
  }, [aiHookError, onAIError]);

  const triggerAIMove = useCallback(async () => {
    if (isAILoading || isThinking) return;

    setIsThinking(true);
    try {
      // Pass a deep clone of the game state to the AI
      const clonedGameState = structuredClone(gameState);
      const move = await calculateBestMove(clonedGameState);
      onAIMove(move);
    } catch (err) {
      console.error("Error during AI move calculation:", err);
      if (onAIError) {
        onAIError(err instanceof Error ? err.message : String(err));
      }
      onAIMove(null); // Indicate AI failed to move
    } finally {
      setIsThinking(false);
    }
  }, [gameState, calculateBestMove, isAILoading, isThinking, setIsThinking, onAIMove, onAIError]);

  useEffect(() => {
    if (
      gameState.currentPlayerId === aiPlayerId &&
      !gameState.winner &&
      !isThinking && // Ensure AI is not already processing
      !isAILoading // Ensure AI hook/WASM is loaded
    ) {
      triggerAIMove();
    }
  }, [gameState.currentPlayerId, gameState.winner, aiPlayerId, isThinking, isAILoading, triggerAIMove]);

  return null; 
}
