
"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState } from '@/lib/gameLogic'; 
import type { Action as AIAction } from '@/lib/ai/mcts'; // Ensure AIAction type is correctly imported

const workerCache = new Map<string, Worker>();

function createNewAIWorker(): Worker {
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
        // Worker is now created on demand, so it might take a moment to be ready
        // Setting isLoading to false after a short delay or when worker confirms readiness
        // For simplicity, assume it's ready quickly for now. A more robust solution
        // might involve the worker sending a "ready" message.
        setTimeout(() => setIsLoading(false), 50); 
        workerInstance.addEventListener('message', handleMessage);
        workerInstance.addEventListener('error', handleError);
    } else {
        setError("AI worker is not available.");
        setIsLoading(false);
    }
    
    return () => {
      // Only remove event listeners from the specific workerInstance.
      // Do not terminate workers from the cache here, as they might be reused.
      workerInstance?.removeEventListener('message', handleMessage);
      workerInstance?.removeEventListener('error', handleError);
      
      // If a move calculation was in progress, reject it.
      if (currentMovePromiseRef.current) {
        currentMovePromiseRef.current.reject(new Error("AI calculation cancelled due to component unmount or difficulty change."));
        currentMovePromiseRef.current = null;
      }
    };
  }, [difficulty]); // Re-run effect if difficulty changes to get/create the correct worker

  const calculateBestMove = useCallback(async (gameState: GameState): Promise<AIAction | null> => {
    if (!aiWorker) {
      const msg = "AI worker not initialized or failed to load.";
      console.warn(msg); setError(msg); return null;
    }
    
    if (currentMovePromiseRef.current) {
      // If a calculation is already in progress, it might be better to cancel it
      // or wait, depending on desired behavior. For now, let's reject the old one.
      currentMovePromiseRef.current.reject(new Error("New AI move calculation started before the previous one finished."));
      currentMovePromiseRef.current = null;
    }
    
    setIsLoading(true); // Set loading true when calculation starts
    setError(null);

    return new Promise((resolve, reject) => {
      currentMovePromiseRef.current = { resolve, reject };
      try {
        // Pass a deep clone of the game state to the worker
        const stateToSend = structuredClone(gameState);
        aiWorker.postMessage({ gameState: stateToSend, difficulty });
      } catch (e: any) {
        const errMessage = e instanceof Error ? e.message : String(e);
        console.error("Error posting message to AI worker:", errMessage);
        setError(errMessage);
        reject(new Error(errMessage));
        currentMovePromiseRef.current = null;
        setIsLoading(false); // Reset loading on error
      }
    });
  }, [aiWorker, difficulty]); // Add difficulty to dependencies
  
  return {
    calculateBestMove,
    isLoading, 
    error
  };
}
