
"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState } from '@/lib/gameLogic'; 
import type { Action as AIAction } from '@/lib/ai/mcts';

const workerCache = new Map<string, Worker>();

function createNewAIWorker(): Worker | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  // Updated path as per user suggestion
  return new Worker(new URL('../../public/workers/mcts-worker.js', import.meta.url), { type: 'module' });
}

export function useAI(difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
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
    if (!aiWorker) {
      const msg = "AI worker not initialized or failed to load.";
      console.warn(msg); setError(msg); return null;
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
        const stateToSend = structuredClone(gameState);
        aiWorker.postMessage({ gameState: stateToSend, difficulty });
      } catch (e: any) {
        const errMessage = e instanceof Error ? e.message : String(e);
        console.error("Error posting message to AI worker:", errMessage);
        setError(errMessage);
        reject(new Error(errMessage));
        currentMovePromiseRef.current = null; 
        setIsLoading(false); 
      }
    });
  }, [aiWorker, difficulty]);
  
  return {
    calculateBestMove,
    isLoading, 
    error
  };
}
