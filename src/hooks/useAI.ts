
"use client";
import { useState, useEffect, useCallback } from 'react';
import type { GameState } from '@/lib/types'; // Ensure this path is correct

export function useAI(difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
  const [aiWorker, setAiWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true); // For WASM loading if implemented
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    setIsLoading(true);
    // For now, directly use the JS worker. WASM integration would be more complex.
    const worker = new Worker('/workers/mcts-worker.js'); // Path to the worker
    setAiWorker(worker);
    setIsLoading(false); // Assume JS worker loads instantly

    worker.onerror = (err) => {
      console.error('AI Worker Error:', err);
      setError('AI Worker failed to load or encountered an error.');
      setIsLoading(false);
    };
    
    return () => {
      worker.terminate();
      setAiWorker(null);
    };
  }, []); // Removed difficulty from deps to avoid re-creating worker on difficulty change for JS version

  const calculateBestMove = useCallback(async (gameState: GameState): Promise<any | null> => {
    if (!aiWorker || isLoading) {
      console.warn("AI worker not ready or loading.");
      return null;
    }
    if (error) {
      console.error("AI worker previously encountered an error:", error);
      return null;
    }

    return new Promise((resolve, reject) => {
      const messageListener = (e: MessageEvent) => {
        if (e.data.type === 'MOVE_RESULT') {
          resolve(e.data.move);
        } else if (e.data.type === 'ERROR') {
          console.error('AI calculation error from worker:', e.data.error);
          setError(`AI calculation failed: ${e.data.error}`);
          reject(new Error(e.data.error));
        }
        aiWorker.removeEventListener('message', messageListener); // Clean up listener
      };
      
      aiWorker.addEventListener('message', messageListener);
      
      // Serialize Sets and Maps before sending to worker, as they don't transfer well.
      const serializableGameState = {
        ...gameState,
        blockedPawnsInfo: Array.from(gameState.blockedPawnsInfo),
        blockingPawnsInfo: Array.from(gameState.blockingPawnsInfo),
        deadZoneSquares: Object.fromEntries(gameState.deadZoneSquares),
        deadZoneCreatorPawnsInfo: Array.from(gameState.deadZoneCreatorPawnsInfo),
      };

      aiWorker.postMessage({ state: serializableGameState, difficulty });
    });
  }, [aiWorker, isLoading, difficulty, error]);
  
  return {
    calculateBestMove,
    isLoading, // Primarily for WASM loading state if that's added
    error
  };
}
