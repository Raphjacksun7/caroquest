
"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, PlayerId } from '@/lib/gameLogic'; 
import type { Action as AIAction } from '@/lib/ai/mcts';
import { createAI, getAIStats } from '@/lib/ai/enhancedMCTS';
import { adaptiveDifficulty } from '@/lib/ai/adaptiveDifficulty';

const workerCache = new Map<string, Worker>();

function createNewAIWorker(): Worker | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  // Updated path as per user suggestion
  return new Worker(new URL('../../public/workers/mcts-worker.js', import.meta.url), { type: 'module' });
}

export function useAI(difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'medium', aiPlayerId: PlayerId = 2) {
  const [aiWorker, setAiWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const currentMovePromiseRef = useRef<{ resolve: (move: AIAction | null) => void, reject: (error: Error) => void } | null>(null);
  
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // Attempt to get from cache or create new
    let workerInstance = workerCache.get(difficulty);
    if (!workerInstance) {
      try {
        workerInstance = createNewAIWorker();
        if (workerInstance) {
          workerCache.set(difficulty, workerInstance);
        } else {
          console.error("Failed to create AI worker: not in a browser environment or worker path incorrect.");
          setError("AI worker is not available or path is incorrect.");
          setIsLoading(false);
          return;
        }
      } catch (e: any) {
        console.error("Failed to create AI worker (exception):", e);
        setError(`Failed to initialize AI worker: ${e.message}. Check worker path and server logs.`);
        setIsLoading(false);
        return;
      }
    }
    setAiWorker(workerInstance);
    
    const handleMessage = (event: MessageEvent<{ type: string, move?: AIAction, error?: string }>) => {
      if (currentMovePromiseRef.current) {
        if (event.data.type === 'MOVE_CALCULATED' && event.data.move !== undefined) {
          currentMovePromiseRef.current.resolve(event.data.move);
        } else if (event.data.type === 'ERROR' && event.data.error) {
          console.error("AI Worker Error from message:", event.data.error);
          currentMovePromiseRef.current.reject(new Error(event.data.error));
        } else if (event.data.type === 'MOVE_CALCULATED' && event.data.move === undefined) { 
          currentMovePromiseRef.current.resolve(null); 
        } else {
          console.warn('Unexpected message from AI worker:', event.data);
          currentMovePromiseRef.current.reject(new Error('Unexpected message from AI worker'));
        }
        currentMovePromiseRef.current = null;
      }
      setIsLoading(false);
    };

    const handleError = (err: ErrorEvent) => {
      console.error('AI Worker onerror:', err);
      const errorMessage = `AI Worker failed: ${err.message || 'Unknown error'}. Ensure worker file exists at the correct public path.`;
      setError(errorMessage);
      setIsLoading(false);
      if (currentMovePromiseRef.current) {
        currentMovePromiseRef.current.reject(new Error(errorMessage));
        currentMovePromiseRef.current = null;
      }
    };

    if (workerInstance) {
        const timerId = setTimeout(() => setIsLoading(false), 50); 
        workerInstance.addEventListener('message', handleMessage);
        workerInstance.addEventListener('error', handleError);
        
        return () => {
          clearTimeout(timerId);
          // Do not terminate cached workers here, or manage lifecycle differently
          // For simplicity, let's assume workers are reused and not terminated per-hook instance
          workerInstance?.removeEventListener('message', handleMessage);
          workerInstance?.removeEventListener('error', handleError);
          
          if (currentMovePromiseRef.current) {
            currentMovePromiseRef.current.reject(new Error("AI calculation cancelled."));
            currentMovePromiseRef.current = null;
          }
        };
    } else {
        setError("AI worker is not available.");
        setIsLoading(false);
    }
    
  }, [difficulty]);

  const calculateBestMove = useCallback(async (gameState: GameState): Promise<AIAction | null> => {
    // Use enhanced AI directly instead of worker for better learning integration
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate game state first
      if (!gameState || !gameState.board || gameState.board.length !== 64) {
        console.error("Invalid game state passed to AI:", gameState);
        setError("Invalid game state");
        setIsLoading(false);
        return null;
      }

      const ai = createAI(gameState, difficulty, aiPlayerId);
      const move = ai.findBestAction();
      
      // Validate move
      if (!move || move.type === 'none') {
        console.warn("AI returned no valid move");
        setIsLoading(false);
        return null;
      }
      
      // Record game outcome when game ends
      if (gameState.winner !== null) {
        ai.recordGameOutcome(gameState.winner);
      }
      
      setIsLoading(false);
      return move;
    } catch (e: any) {
      const errMessage = e instanceof Error ? e.message : String(e);
      console.error("Error calculating AI move:", errMessage, e);
      setError(errMessage);
      setIsLoading(false);
      return null;
    }
  }, [difficulty, aiPlayerId]);
  
  return {
    calculateBestMove,
    isLoading, 
    error,
    getStats: getAIStats, // Export stats function
    getPlayerMetrics: () => adaptiveDifficulty.getPlayerMetrics(),
  };
}
