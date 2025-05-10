
"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState } from '@/lib/gameLogic'; 
import type { AIAction } from '@/lib/ai/mcts';

const workerCache = new Map<string, Worker>();

function createNewAIWorker(): Worker {
  // Web workers in the 'public' directory are served from the root.
  // Prepending import.meta.url can cause issues if not handled carefully by the bundler/server.
  // Direct path from public root is more reliable.
  return new Worker('/workers/mcts-worker.js', { type: 'module' });
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
      try {
        workerInstance = createNewAIWorker();
        workerCache.set(difficulty, workerInstance);
      } catch (e: any) {
        console.error("Failed to create AI worker:", e);
        setError(`Failed to initialize AI worker: ${e.message}`);
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
      const errorMessage = `AI Worker failed: ${err.message || 'Unknown error'}`;
      setError(errorMessage);
      setIsLoading(false);
      if (currentMovePromiseRef.current) {
        currentMovePromiseRef.current.reject(new Error(errorMessage));
        currentMovePromiseRef.current = null;
      }
    };

    if (workerInstance) {
        setTimeout(() => setIsLoading(false), 50); 
        workerInstance.addEventListener('message', handleMessage);
        workerInstance.addEventListener('error', handleError);
    } else {
        setError("AI worker is not available.");
        setIsLoading(false);
    }
    
    return () => {
      // Worker lifecycle management:
      // workerInstance?.removeEventListener('message', handleMessage);
      // workerInstance?.removeEventListener('error', handleError);
      // If terminating, ensure proper cleanup:
      // if (workerInstance && workerCache.get(difficulty) === workerInstance) {
      //   workerInstance.terminate();
      //   workerCache.delete(difficulty);
      // }
      
      if (currentMovePromiseRef.current) {
        currentMovePromiseRef.current.reject(new Error("AI calculation cancelled."));
        currentMovePromiseRef.current = null;
      }
    };
  }, [difficulty]);

  const calculateBestMove = useCallback(async (gameState: GameState): Promise<AIAction | null> => {
    if (!aiWorker) {
      const msg = "AI worker not initialized or failed to load.";
      console.warn(msg); setError(msg); return null;
    }
    
    if (currentMovePromiseRef.current) {
      currentMovePromiseRef.current.reject(new Error("New AI move calculation started before the previous one finished."));
      currentMovePromiseRef.current = null;
    }
    
    setError(null);

    return new Promise((resolve, reject) => {
      currentMovePromiseRef.current = { resolve, reject };
      try {
        const stateToSend = structuredClone(gameState);
        aiWorker.postMessage({ gameState: stateToSend, difficulty });
      } catch (e: any) {
        const errMessage = e instanceof Error ? e.message : String(e);
        console.error("Error posting message to AI worker:", errMessage);
        setError(errMessage);
        reject(new Error(errMessage));
        currentMovePromiseRef.current = null;
      }
    });
  }, [aiWorker, difficulty]);
  
  return {
    calculateBestMove,
    isLoading, 
    error
  };
}
