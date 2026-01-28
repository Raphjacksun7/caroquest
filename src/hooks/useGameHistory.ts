"use client";

import { useState, useCallback, useMemo } from "react";
import type { GameState, HistoryEntry, GameAction, PlayerId } from "@/lib/types";
import { cloneGameState } from "@/lib/gameLogic";

interface UseGameHistoryOptions {
  /** Maximum number of states to keep in history (default: 50) */
  maxHistorySize?: number;
  /** Whether to persist history to localStorage (default: false) */
  persistToStorage?: boolean;
  /** Storage key for localStorage persistence */
  storageKey?: string;
}

interface UseGameHistoryReturn {
  /** Current history entries */
  history: HistoryEntry[];
  /** Current position in history (index) */
  currentIndex: number;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of moves that can be undone */
  undoCount: number;
  /** Number of moves that can be redone */
  redoCount: number;
  /** Push a new state to history (call after each valid move) */
  pushState: (gameState: GameState, action: GameAction, playerId: PlayerId) => void;
  /** Initialize history with the starting state */
  initHistory: (initialState: GameState) => void;
  /** Undo the last move(s), returns the restored state or null if can't undo */
  undo: (steps?: number) => GameState | null;
  /** Redo previously undone move(s), returns the restored state or null if can't redo */
  redo: (steps?: number) => GameState | null;
  /** Get the state at a specific history index */
  getStateAt: (index: number) => GameState | null;
  /** Clear all history */
  clearHistory: () => void;
  /** Get the last action performed */
  getLastAction: () => { action: GameAction; playerId: PlayerId } | null;
}

/**
 * Hook for managing game state history with undo/redo functionality.
 * 
 * @example
 * ```tsx
 * const { pushState, undo, redo, canUndo, canRedo } = useGameHistory();
 * 
 * // After each move:
 * pushState(newGameState, { type: 'place', squareIndex: 5 }, 1);
 * 
 * // To undo:
 * const previousState = undo();
 * if (previousState) setGameState(previousState);
 * ```
 */
export function useGameHistory(options: UseGameHistoryOptions = {}): UseGameHistoryReturn {
  const {
    maxHistorySize = 50,
    persistToStorage = false,
    storageKey = 'caroquest_history',
  } = options;

  // History array and current position
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Computed values
  const canUndo = useMemo(() => currentIndex > 0, [currentIndex]);
  const canRedo = useMemo(() => currentIndex < history.length - 1, [currentIndex, history.length]);
  const undoCount = useMemo(() => currentIndex, [currentIndex]);
  const redoCount = useMemo(() => history.length - 1 - currentIndex, [currentIndex, history.length]);

  // Initialize history with the starting game state
  const initHistory = useCallback((initialState: GameState) => {
    const entry: HistoryEntry = {
      gameState: cloneGameState(initialState),
      action: null,
      playerId: null,
      timestamp: Date.now(),
      moveNumber: 0,
    };
    setHistory([entry]);
    setCurrentIndex(0);

    if (persistToStorage && typeof window !== 'undefined') {
      try {
        // For localStorage, we need to serialize Sets and Maps
        const serializable = {
          history: [serializeHistoryEntry(entry)],
          currentIndex: 0,
        };
        localStorage.setItem(storageKey, JSON.stringify(serializable));
      } catch (e) {
        console.warn('Failed to persist history to localStorage:', e);
      }
    }
  }, [persistToStorage, storageKey]);

  // Push a new state to history
  const pushState = useCallback((
    gameState: GameState,
    action: GameAction,
    playerId: PlayerId
  ) => {
    setHistory(prev => {
      // If we're not at the end of history (user undid and then made a new move),
      // discard all states after current position
      const newHistory = prev.slice(0, currentIndex + 1);
      
      const entry: HistoryEntry = {
        gameState: cloneGameState(gameState),
        action,
        playerId,
        timestamp: Date.now(),
        moveNumber: newHistory.length,
      };
      
      newHistory.push(entry);
      
      // Trim history if it exceeds max size (keep most recent)
      if (newHistory.length > maxHistorySize) {
        return newHistory.slice(newHistory.length - maxHistorySize);
      }
      
      return newHistory;
    });
    
    setCurrentIndex(prev => {
      const newIndex = Math.min(prev + 1, maxHistorySize - 1);
      return newIndex;
    });
  }, [currentIndex, maxHistorySize]);

  // Undo move(s)
  const undo = useCallback((steps: number = 1): GameState | null => {
    if (!canUndo || steps < 1) return null;
    
    const targetIndex = Math.max(0, currentIndex - steps);
    const targetEntry = history[targetIndex];
    
    if (!targetEntry) return null;
    
    setCurrentIndex(targetIndex);
    return cloneGameState(targetEntry.gameState);
  }, [canUndo, currentIndex, history]);

  // Redo move(s)
  const redo = useCallback((steps: number = 1): GameState | null => {
    if (!canRedo || steps < 1) return null;
    
    const targetIndex = Math.min(history.length - 1, currentIndex + steps);
    const targetEntry = history[targetIndex];
    
    if (!targetEntry) return null;
    
    setCurrentIndex(targetIndex);
    return cloneGameState(targetEntry.gameState);
  }, [canRedo, currentIndex, history]);

  // Get state at specific index
  const getStateAt = useCallback((index: number): GameState | null => {
    if (index < 0 || index >= history.length) return null;
    return cloneGameState(history[index].gameState);
  }, [history]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    
    if (persistToStorage && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn('Failed to clear history from localStorage:', e);
      }
    }
  }, [persistToStorage, storageKey]);

  // Get the last action performed
  const getLastAction = useCallback((): { action: GameAction; playerId: PlayerId } | null => {
    if (currentIndex < 1) return null;
    const entry = history[currentIndex];
    if (!entry || !entry.action || !entry.playerId) return null;
    return { action: entry.action, playerId: entry.playerId };
  }, [currentIndex, history]);

  return {
    history,
    currentIndex,
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    pushState,
    initHistory,
    undo,
    redo,
    getStateAt,
    clearHistory,
    getLastAction,
  };
}

// Helper function to serialize a history entry for localStorage
function serializeHistoryEntry(entry: HistoryEntry): object {
  return {
    ...entry,
    gameState: {
      ...entry.gameState,
      blockedPawnsInfo: Array.from(entry.gameState.blockedPawnsInfo),
      blockingPawnsInfo: Array.from(entry.gameState.blockingPawnsInfo),
      deadZoneSquares: Array.from(entry.gameState.deadZoneSquares.entries()),
      deadZoneCreatorPawnsInfo: Array.from(entry.gameState.deadZoneCreatorPawnsInfo),
    },
  };
}

