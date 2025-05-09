
"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState } from '@/lib/types'; 
import type { Action } from '@/lib/ai/mcts';

const workerCache = new Map<string, Worker>();

function createNewAIWorker(): Worker {
  // Ensure this path correctly points to your bundled worker script
  return new Worker(new URL('../lib/ai/ai.worker.ts', import.meta.url), { type: 'module' });
}

export function useAI(difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
  const [aiWorker, setAiWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const currentMovePromiseRef = useRef<{ resolve: (move: Action | null) => void, reject: (error: Error) => void } | null>(null);
  
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    let worker = workerCache.get(difficulty);
    if (!worker) {
      worker = createNewAIWorker();
      workerCache.set(difficulty, worker);
    }
    setAiWorker(worker);
    setIsLoading(false);

    const messageListener = (event: MessageEvent<{ type: string, move?: Action, error?: string }>) => {
      if (currentMovePromiseRef.current) {
        if (event.data.type === 'MOVE_CALCULATED' && event.data.move) {
          currentMovePromiseRef.current.resolve(event.data.move);
        } else if (event.data.type === 'ERROR') {
          console.error("AI Worker Error from message:", event.data.error);
          currentMovePromiseRef.current.reject(new Error(event.data.error || 'Unknown AI worker error'));
        } else { // Handle unexpected message types
          currentMovePromiseRef.current.reject(new Error('Unexpected message from AI worker'));
        }
        currentMovePromiseRef.current = null; // Clear after handling
      }
    };

    const errorListener = (err: ErrorEvent) => {
      console.error('AI Worker onerror:', err);
      setError(`AI Worker failed: ${err.message}`);
      setIsLoading(false);
      if (currentMovePromiseRef.current) {
        currentMovePromiseRef.current.reject(new Error(err.message));
        currentMovePromiseRef.current = null;
      }
    };

    worker.addEventListener('message', messageListener);
    worker.addEventListener('error', errorListener);
    
    return () => {
      // Don't terminate cached workers here. Termination could be handled
      // globally if needed, e.g. when the app unmounts or on page visibility changes.
      worker?.removeEventListener('message', messageListener);
      worker?.removeEventListener('error', errorListener);
    };
  }, [difficulty]); // Re-setup if difficulty changes to use a different (or new) worker

  const calculateBestMove = useCallback(async (gameState: GameState): Promise<Action | null> => {
    if (!aiWorker) {
      console.warn("AI worker not initialized.");
      setError("AI worker not initialized.");
      return null;
    }
    if (isLoading) {
      console.warn("AI worker is still loading.");
      setError("AI worker is still loading.");
      return null;
    }
    if (error && !aiWorker) { // If there was a setup error and worker is null
        console.error("AI worker failed to load previously.");
        return null;
    }
    
    // If there's an ongoing calculation, reject it or wait. For now, let's reject.
    if (currentMovePromiseRef.current) {
        currentMovePromiseRef.current.reject(new Error("New AI move calculation started before the previous one finished."));
        currentMovePromiseRef.current = null;
    }

    return new Promise((resolve, reject) => {
      currentMovePromiseRef.current = { resolve, reject };
      // Pass a deep clone of gameState to the worker if MCTS modifies it.
      // The MCTS constructor should handle cloning if necessary.
      aiWorker.postMessage({ gameState: structuredClone(gameState), difficulty });
    });
  }, [aiWorker, isLoading, difficulty, error]); // Add error to dependencies
  
  return {
    calculateBestMove,
    isLoading, 
    error
  };
}

