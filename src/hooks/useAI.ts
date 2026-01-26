"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, PlayerId } from '@/lib/gameLogic'; 

/**
 * AI Action type
 */
export interface AIAction {
  type: "place" | "move" | "none";
  squareIndex?: number;
  fromIndex?: number;
  toIndex?: number;
}

/**
 * Serialize game state for worker (convert Set/Map to arrays)
 */
function serializeGameState(state: GameState): object {
  return {
    board: state.board,
    currentPlayerId: state.currentPlayerId,
    playerColors: state.playerColors,
    gamePhase: state.gamePhase,
    pawnsToPlace: state.pawnsToPlace,
    placedPawns: state.placedPawns,
    selectedPawnIndex: state.selectedPawnIndex,
    blockedPawnsInfo: Array.from(state.blockedPawnsInfo),
    blockingPawnsInfo: Array.from(state.blockingPawnsInfo),
    deadZoneSquares: Array.from(state.deadZoneSquares.entries()),
    deadZoneCreatorPawnsInfo: Array.from(state.deadZoneCreatorPawnsInfo),
    winner: state.winner,
    lastMove: state.lastMove,
    winningLine: state.winningLine,
    options: state.options,
  };
}

/**
 * AI Hook using Web Worker for MCTS
 * 
 * Uses a dedicated web worker to run MCTS off the main thread,
 * preventing UI freezing during AI computation.
 */
export function useAI(
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'medium', 
  aiPlayerId: PlayerId = 2
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const promiseRef = useRef<{
    resolve: (action: AIAction | null) => void;
    reject: (error: Error) => void;
  } | null>(null);

  // Initialize worker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const worker = new Worker('/workers/mcts-worker.js');
      
      worker.onmessage = (event) => {
        const { type, move, error: workerError } = event.data;
        
        if (type === 'MOVE_CALCULATED') {
          if (promiseRef.current) {
            promiseRef.current.resolve(move || null);
            promiseRef.current = null;
          }
          setIsLoading(false);
        } else if (type === 'ERROR') {
          console.error('AI Worker error:', workerError);
          if (promiseRef.current) {
            promiseRef.current.reject(new Error(workerError));
            promiseRef.current = null;
          }
          setError(workerError);
          setIsLoading(false);
        }
      };

      worker.onerror = (event) => {
        console.error('AI Worker error event:', event);
        const errorMsg = event.message || 'Worker error';
        setError(errorMsg);
        setIsLoading(false);
        if (promiseRef.current) {
          promiseRef.current.reject(new Error(errorMsg));
          promiseRef.current = null;
        }
      };

      workerRef.current = worker;
      console.log('AI Worker initialized successfully');
    } catch (e) {
      console.error('Failed to create AI worker:', e);
      setError('Failed to initialize AI worker');
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (promiseRef.current) {
        promiseRef.current.reject(new Error('Component unmounted'));
        promiseRef.current = null;
      }
    };
  }, []);

  const calculateBestMove = useCallback(async (gameState: GameState): Promise<AIAction | null> => {
    // Validate game state
    if (!gameState || !gameState.board || gameState.board.length !== 64) {
      console.error("useAI: Invalid game state");
      return null;
    }

    // Verify it's the AI's turn
    if (gameState.currentPlayerId !== aiPlayerId) {
      console.error(`useAI: Not AI's turn. Current: ${gameState.currentPlayerId}, AI: ${aiPlayerId}`);
      return null;
    }

    // Check if game is already over
    if (gameState.winner !== null) {
      console.log("useAI: Game already over");
      return null;
    }

    // Check if worker is available
    if (!workerRef.current) {
      console.error("useAI: Worker not available, using fallback");
      // Fallback to synchronous MCTS if worker unavailable
      return fallbackCalculateMove(gameState, difficulty, aiPlayerId);
    }

    setIsLoading(true);
    setError(null);

    console.log(`useAI: Requesting move from worker - difficulty: ${difficulty}, phase: ${gameState.gamePhase}`);

    return new Promise((resolve, reject) => {
      promiseRef.current = { resolve, reject };
      
      // Serialize and send to worker
      const serializedState = serializeGameState(gameState);
      
      workerRef.current!.postMessage({
        type: 'CALCULATE_MOVE',
        gameState: serializedState,
        difficulty,
        aiPlayerId,
      });

      // Timeout safety
      setTimeout(() => {
        if (promiseRef.current) {
          console.warn('useAI: Worker timeout, using fallback');
          promiseRef.current = null;
          setIsLoading(false);
          resolve(fallbackCalculateMove(gameState, difficulty, aiPlayerId));
        }
      }, 10000); // 10 second timeout
    });
  }, [difficulty, aiPlayerId]);

  // Stats functions
  const getStats = useCallback(() => ({
    type: 'MCTS with Web Worker',
    difficulty,
    aiPlayerId,
  }), [difficulty, aiPlayerId]);

  const getPlayerMetrics = useCallback(() => ({
    gamesPlayed: 0,
    winRate: 0,
    difficulty,
  }), [difficulty]);

  return {
    calculateBestMove,
    isLoading, 
    error,
    getStats,
    getPlayerMetrics,
  };
}

/**
 * Fallback synchronous move calculation if worker unavailable
 */
function fallbackCalculateMove(
  gameState: GameState,
  difficulty: string,
  aiPlayerId: PlayerId
): AIAction | null {
  // Import dynamically to avoid circular dependencies
  const { createMCTS } = require('@/lib/ai/mcts');
  const mcts = createMCTS(difficulty, aiPlayerId);
  return mcts.findBestAction(gameState);
}
