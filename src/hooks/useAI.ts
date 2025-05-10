
"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState } from '@/lib/gameLogic'; 
import type { AIAction } from '@/lib/ai/mcts'; // Ensure AIAction is correctly typed if it comes from mcts

const workerCache = new Map<string, Worker>();

function createNewAIWorker(): Worker {
  // Workers in the public directory should be referenced by their public path.
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
        if (event.data.type === 'MOVE_CALCULATED' && event.data.move !== undefined) { // Check move is not undefined
          currentMovePromiseRef.current.resolve(event.data.move);
        } else if (event.data.type === 'ERROR' && event.data.error) {
          console.error("AI Worker Error from message:", event.data.error);
          currentMovePromiseRef.current.reject(new Error(event.data.error));
        } else if (event.data.type === 'MOVE_CALCULATED' && event.data.move === undefined) { 
          // Explicitly handle if move can be undefined from worker
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
        // Simulate a brief loading period if needed, or remove if worker setup is instant
        setTimeout(() => setIsLoading(false), 50); 

        workerInstance.addEventListener('message', handleMessage);
        workerInstance.addEventListener('error', handleError);
    } else {
        // Handle case where workerInstance couldn't be set (e.g., initial creation failed)
        setError("AI worker is not available.");
        setIsLoading(false);
    }
    
    return () => {
      // Note: We are caching workers, so we might not want to terminate them here
      // unless the component using the hook is unmounted permanently.
      // If terminating, ensure to remove from cache or handle re-creation.
      // For now, let's assume workers are long-lived.
      // workerInstance?.removeEventListener('message', handleMessage);
      // workerInstance?.removeEventListener('error', handleError);
      
      if (currentMovePromiseRef.current) {
        currentMovePromiseRef.current.reject(new Error("AI calculation cancelled."));
        currentMovePromiseRef.current = null;
      }
    };
  }, [difficulty]); // Removed aiWorker from dependencies to avoid re-subscribing on worker change if cached

  const calculateBestMove = useCallback(async (gameState: GameState): Promise<AIAction | null> => {
    if (!aiWorker) {
      const msg = "AI worker not initialized or failed to load.";
      console.warn(msg); setError(msg); return null;
    }
    // isLoading here refers to the worker initialization, not calculation.
    // A separate loading state for calculation might be better if needed.
    
    if (currentMovePromiseRef.current) {
      // Optionally, you could wait for the current promise or cancel it.
      // For now, let's reject the old one and start a new one.
      currentMovePromiseRef.current.reject(new Error("New AI move calculation started before the previous one finished."));
      currentMovePromiseRef.current = null;
    }
    
    // Consider a specific loading state for calculation if it's a long process
    // setIsLoading(true); 
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
        // setIsLoading(false); // Reset calculation-specific loading state if used
        reject(new Error(errMessage));
        currentMovePromiseRef.current = null;
      }
    });
  }, [aiWorker, difficulty]); // Removed isLoading and error from deps as they are managed internally or for init
  
  return {
    calculateBestMove,
    isLoading, // This now primarily reflects worker initialization state
    error
  };
}
