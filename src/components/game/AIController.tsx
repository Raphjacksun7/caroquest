"use client";

import type { GameState, PlayerId } from '@/lib/gameLogic';
import type { Action } from '@/lib/ai/mcts'; // Assuming Action is exported from mcts.ts
import React, { useEffect, useRef } from 'react';

interface AIControllerProps {
  gameState: GameState;
  aiPlayerId: PlayerId; // Which player ID is the AI
  onAIMove: (action: Action) => void;
  difficulty: 'easy' | 'medium' | 'hard';
  isThinking: boolean; // To prevent multiple calls while AI is processing
  setIsThinking: (isThinking: boolean) => void;
}

export function AIController({ 
  gameState, 
  aiPlayerId, 
  onAIMove, 
  difficulty,
  isThinking,
  setIsThinking
}: AIControllerProps) {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize the worker
    // The path assumes ai.worker.ts is processed by the bundler and placed in a suitable public path.
    // For Next.js, this often means placing the worker file in the `public` directory
    // and referencing it as `/ai.worker.js` after it's built.
    // Or, using `new URL('./relative/path/to/ai.worker.ts', import.meta.url)` if your bundler supports it.
    workerRef.current = new Worker(new URL('../../lib/ai/ai.worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (event: MessageEvent<{ type: string, move?: Action, error?: string }>) => {
      setIsThinking(false);
      if (event.data.type === 'MOVE_CALCULATED' && event.data.move) {
        onAIMove(event.data.move);
      } else if (event.data.type === 'ERROR') {
        console.error("AI Worker Error:", event.data.error);
        // Potentially handle AI error, e.g., make a random move or notify user
      }
    };

    workerRef.current.onerror = (error) => {
      console.error("AI Worker onerror:", error);
      setIsThinking(false);
      // Handle worker loading errors
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [onAIMove, setIsThinking]); // Dependencies for worker setup

  useEffect(() => {
    // Trigger AI move if it's AI's turn, game is ongoing, and AI is not already thinking
    if (
      gameState.currentPlayerId === aiPlayerId &&
      !gameState.winner &&
      workerRef.current &&
      !isThinking
    ) {
      setIsThinking(true);
      // Send a structured-cloned game state to avoid issues with transferring complex objects
      workerRef.current.postMessage({
        gameState: structuredClone(gameState),
        difficulty,
      });
    }
  }, [gameState, aiPlayerId, difficulty, workerRef, isThinking, setIsThinking]); // Dependencies for triggering AI

  return null; // This component does not render anything
}
