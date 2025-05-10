
"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState } from '@/lib/gameLogic'; 
import type { Action as AIAction } from '@/lib/ai/mcts';

const workerCache = new Map<string, Worker>();

function createNewAIWorker(): Worker | null {
  if (typeof window === 'undefined') {
    // Worker can only be created on the client side
    return null;
  }
  // Web workers in the 'public' directory are served from the root.
  // The path should be relative to the public directory root.
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
        if (workerInstance) {
          workerCache.set(difficulty, workerInstance);
        } else {
          // This case should ideally not be hit if called client-side,
          // but as a fallback:
          console.error("Failed to create AI worker: not in a browser environment.");
          setError("AI worker can only be created in the browser.");
          setIsLoading(false);
          return;
        }
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
          currentMovePromiseRef.current.resolve(null); // AI might not find a move
        } else {
          console.warn('Unexpected message from AI worker:', event.data);
          currentMovePromiseRef.current.reject(new Error('Unexpected message from AI worker'));
        }
        currentMovePromiseRef.current = null;
      }
      setIsLoading(false); // AI processing finished
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
        // Simulate async loading for consistency, even if worker is cached
        // This helps manage the isLoading state more predictably.
        const timerId = setTimeout(() => setIsLoading(false), 50); 
        workerInstance.addEventListener('message', handleMessage);
        workerInstance.addEventListener('error', handleError);
        
        // Cleanup function for this effect
        return () => {
          clearTimeout(timerId);
          workerInstance?.removeEventListener('message', handleMessage);
          workerInstance?.removeEventListener('error', handleError);
          
          if (currentMovePromiseRef.current) {
            currentMovePromiseRef.current.reject(new Error("AI calculation cancelled due to component unmount or difficulty change."));
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
      // If a calculation is already in progress, reject the old one.
      // This might happen if the user triggers a new AI move quickly.
      currentMovePromiseRef.current.reject(new Error("New AI move calculation started before the previous one finished."));
      currentMovePromiseRef.current = null;
    }
    
    setIsLoading(true); 
    setError(null);

    return new Promise((resolve, reject) => {
      currentMovePromiseRef.current = { resolve, reject };
      try {
        // Ensure GameState is properly cloned before sending to worker,
        // especially if it contains complex objects like Sets or Maps.
        // The worker itself also does a structuredClone, but it's good practice here too.
        const stateToSend = structuredClone(gameState);
        aiWorker.postMessage({ gameState: stateToSend, difficulty });
      } catch (e: any) {
        const errMessage = e instanceof Error ? e.message : String(e);
        console.error("Error posting message to AI worker:", errMessage);
        setError(errMessage);
        reject(new Error(errMessage));
        currentMovePromiseRef.current = null; // Clear ref on error
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

