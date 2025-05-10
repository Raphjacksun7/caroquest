"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState } from '@/lib/gameLogic'; 
import type { Action as AIAction } from '@/lib/ai/mcts';

const workerCache = new Map<string, Worker>();

function createNewAIWorker(): Worker {
  return new Worker(new URL('/workers/mcts-worker.js', import.meta.url), { type: 'module' });
}

export function useAI(difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
  const [aiWorker, setAiWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const currentMovePromiseRef = useRef<{ resolve: (move: AIAction | null) => void, reject: (error: Error) => void } | null>(null);
  
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    let workerInstance = workerCache.get(difficulty);
    if (!workerInstance) {
      workerInstance = createNewAIWorker();
      workerCache.set(difficulty, workerInstance);
    }
    setAiWorker(workerInstance);
    
    const handleMessage = (event: MessageEvent<{ type: string, move?: AIAction, error?: string }>) => {
      if (currentMovePromiseRef.current) {
        if (event.data.type === 'MOVE_CALCULATED' && event.data.move) {
          currentMovePromiseRef.current.resolve(event.data.move);
        } else if (event.data.type === 'ERROR' && event.data.error) {
          console.error("AI Worker Error from message:", event.data.error);
          currentMovePromiseRef.current.reject(new Error(event.data.error));
        } else if (event.data.type === 'MOVE_CALCULATED' && !event.data.move) {
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
      const errorMessage = `AI Worker failed: ${err.message}`;
      setError(errorMessage);
      setIsLoading(false);
      if (currentMovePromiseRef.current) {
        currentMovePromiseRef.current.reject(new Error(errorMessage));
        currentMovePromiseRef.current = null;
      }
    };

    if (workerInstance) {
        setTimeout(() => setIsLoading(false), 100); 

        workerInstance.addEventListener('message', handleMessage);
        workerInstance.addEventListener('error', handleError);
    }
    
    return () => {
      workerInstance?.removeEventListener('message', handleMessage);
      workerInstance?.removeEventListener('error', handleError);
      if (currentMovePromiseRef.current) {
        currentMovePromiseRef.current.reject(new Error("AI calculation cancelled."));
        currentMovePromiseRef.current = null;
      }
    };
  }, [difficulty]);

  const calculateBestMove = useCallback(async (gameState: GameState): Promise<AIAction | null> => {
    if (!aiWorker) {
      const msg = "AI worker not initialized.";
      console.warn(msg); setError(msg); return null;
    }
    if (isLoading && !aiWorker) { // Check aiWorker here specifically
      const msg = "AI worker is still loading/initializing.";
      console.warn(msg); setError(msg); return null;
    }
    if (error && !aiWorker) {
      console.error("AI worker failed to load previously."); return null;
    }
    
    if (currentMovePromiseRef.current) {
      currentMovePromiseRef.current.reject(new Error("New AI move calculation started before the previous one finished."));
      currentMovePromiseRef.current = null;
    }
    
    setIsLoading(true); 
    setError(null);

    return new Promise((resolve, reject) => {
      currentMovePromiseRef.current = { resolve, reject };
      try {
        // Send a structured clone of the game state
        const stateToSend = structuredClone(gameState);
        aiWorker.postMessage({ gameState: stateToSend, difficulty });
      } catch (e) {
        const errMessage = e instanceof Error ? e.message : String(e);
        console.error("Error posting message to AI worker:", errMessage);
        setError(errMessage);
        setIsLoading(false);
        reject(new Error(errMessage));
        currentMovePromiseRef.current = null;
      }
    });
  }, [aiWorker, isLoading, difficulty, error ]); 
  
  return {
    calculateBestMove,
    isLoading, 
    error
  };
}