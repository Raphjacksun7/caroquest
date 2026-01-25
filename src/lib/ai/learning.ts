// FILE: src/lib/ai/learning.ts
// PURPOSE: AI Learning System - Stores game history, learns patterns, adapts strategy

import type { GameState, PlayerId } from "../gameLogic";
import type { Action } from "./mcts";

/**
 * Game outcome record for learning
 */
export interface GameRecord {
  id: string;
  timestamp: number;
  difficulty: string;
  aiPlayerId: PlayerId;
  winner: PlayerId | null;
  moves: Array<{
    state: string; // Serialized board state
    action: Action;
    playerId: PlayerId;
    evaluation: number; // Position evaluation
  }>;
  duration: number;
  outcome: "win" | "loss" | "draw";
}

/**
 * Position pattern for recognition
 */
export interface PositionPattern {
  hash: string;
  occurrences: number;
  wins: number;
  losses: number;
  draws: number;
  avgEvaluation: number;
  bestMoves: Map<string, number>; // Move signature -> success count
}

/**
 * AI Learning Engine
 */
export class AILearningEngine {
  private gameHistory: GameRecord[] = [];
  private patterns: Map<string, PositionPattern> = new Map();
  private readonly maxHistorySize = 1000;
  private readonly storageKey = "caroquest_ai_learning";

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Hash a game state for pattern recognition
   * Uses Zobrist-like hashing for efficient position comparison
   */
  hashGameState(state: GameState): string {
    const board = state.board;
    const parts: string[] = [];

    // Encode board configuration
    for (let i = 0; i < board.length; i++) {
      const square = board[i];
      if (square.pawn) {
        parts.push(`${i}:${square.pawn.playerId}`);
      }
    }

    // Include game phase
    parts.push(`phase:${state.gamePhase}`);

    // Include current player
    parts.push(`turn:${state.currentPlayerId}`);

    return parts.join("|");
  }

  /**
   * Record a complete game for learning
   */
  recordGame(record: GameRecord): void {
    this.gameHistory.push(record);

    // Limit history size
    if (this.gameHistory.length > this.maxHistorySize) {
      this.gameHistory.shift();
    }

    // Update patterns from this game
    this.updatePatternsFromGame(record);

    // Save to storage
    this.saveToStorage();
  }

  /**
   * Update pattern database from a game record
   */
  private updatePatternsFromGame(record: GameRecord): void {
    for (const move of record.moves) {
      const hash = move.state;
      let pattern = this.patterns.get(hash);

      if (!pattern) {
        pattern = {
          hash,
          occurrences: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          avgEvaluation: 0,
          bestMoves: new Map(),
        };
        this.patterns.set(hash, pattern);
      }

      // Update pattern statistics
      pattern.occurrences++;

      if (record.outcome === "win") {
        pattern.wins++;
      } else if (record.outcome === "loss") {
        pattern.losses++;
      } else {
        pattern.draws++;
      }

      // Update evaluation (running average)
      pattern.avgEvaluation =
        (pattern.avgEvaluation * (pattern.occurrences - 1) + move.evaluation) /
        pattern.occurrences;

      // Track successful moves
      if (record.outcome === "win" && move.playerId === record.aiPlayerId) {
        const moveSignature = this.getActionSignature(move.action);
        const currentCount = pattern.bestMoves.get(moveSignature) || 0;
        pattern.bestMoves.set(moveSignature, currentCount + 1);
      }
    }
  }

  /**
   * Get learned evaluation for a position
   */
  getLearnedEvaluation(state: GameState): number | null {
    const hash = this.hashGameState(state);
    const pattern = this.patterns.get(hash);

    if (!pattern || pattern.occurrences < 5) {
      return null; // Not enough data
    }

    // Calculate win rate as evaluation
    const total = pattern.wins + pattern.losses + pattern.draws;
    if (total === 0) return null;

    const winRate = (pattern.wins + pattern.draws * 0.5) / total;

    // Blend with average evaluation
    return winRate * 0.6 + pattern.avgEvaluation * 0.4;
  }

  /**
   * Get best learned move for a position
   */
  getBestLearnedMove(state: GameState): Action | null {
    const hash = this.hashGameState(state);
    const pattern = this.patterns.get(hash);

    if (!pattern || pattern.bestMoves.size === 0) {
      return null;
    }

    // Find most successful move
    let bestMoveSignature: string | null = null;
    let bestCount = 0;

    for (const [signature, count] of pattern.bestMoves.entries()) {
      if (count > bestCount) {
        bestCount = count;
        bestMoveSignature = signature;
      }
    }

    if (!bestMoveSignature) return null;

    // Reconstruct action from signature
    return this.reconstructAction(bestMoveSignature);
  }

  /**
   * Get statistics for a difficulty level
   */
  getDifficultyStats(difficulty: string): {
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
  } {
    const games = this.gameHistory.filter((g) => g.difficulty === difficulty);

    const wins = games.filter((g) => g.outcome === "win").length;
    const losses = games.filter((g) => g.outcome === "loss").length;
    const draws = games.filter((g) => g.outcome === "draw").length;

    return {
      gamesPlayed: games.length,
      wins,
      losses,
      draws,
      winRate: games.length > 0 ? wins / games.length : 0,
    };
  }

  /**
   * Calculate recommended difficulty adjustment
   * Returns: -1 (easier), 0 (same), +1 (harder)
   */
  getRecommendedDifficultyAdjustment(
    currentDifficulty: string,
    recentGames: number = 10
  ): number {
    const recent = this.gameHistory
      .filter((g) => g.difficulty === currentDifficulty)
      .slice(-recentGames);

    if (recent.length < 5) return 0; // Not enough data

    const aiWins = recent.filter((g) => g.outcome === "loss").length; // AI wins = player losses
    const playerWins = recent.filter((g) => g.outcome === "win").length;

    const aiWinRate = aiWins / recent.length;

    // Adaptive difficulty: aim for 45-55% AI win rate (balanced)
    if (aiWinRate < 0.3) {
      return -1; // AI losing too much, make it easier (for testing) or harder (for challenge)
    } else if (aiWinRate > 0.7) {
      return 1; // AI winning too much, make it easier for player
    }

    return 0; // Balanced
  }

  /**
   * Get total learning statistics
   */
  getTotalStats(): {
    gamesRecorded: number;
    patternsLearned: number;
    totalMoves: number;
    oldestGame: number | null;
    newestGame: number | null;
  } {
    const totalMoves = this.gameHistory.reduce(
      (sum, g) => sum + g.moves.length,
      0
    );

    return {
      gamesRecorded: this.gameHistory.length,
      patternsLearned: this.patterns.size,
      totalMoves,
      oldestGame:
        this.gameHistory.length > 0 ? this.gameHistory[0].timestamp : null,
      newestGame:
        this.gameHistory.length > 0
          ? this.gameHistory[this.gameHistory.length - 1].timestamp
          : null,
    };
  }

  /**
   * Clear all learned data
   */
  clearLearning(): void {
    this.gameHistory = [];
    this.patterns.clear();
    this.saveToStorage();
  }

  /**
   * Export learning data
   */
  exportLearningData(): string {
    return JSON.stringify({
      gameHistory: this.gameHistory,
      patterns: Array.from(this.patterns.entries()).map(([hash, pattern]) => ({
        hash,
        ...pattern,
        bestMoves: Array.from(pattern.bestMoves.entries()),
      })),
    });
  }

  /**
   * Import learning data
   */
  importLearningData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);

      this.gameHistory = parsed.gameHistory || [];
      this.patterns.clear();

      if (parsed.patterns) {
        for (const p of parsed.patterns) {
          this.patterns.set(p.hash, {
            hash: p.hash,
            occurrences: p.occurrences,
            wins: p.wins,
            losses: p.losses,
            draws: p.draws,
            avgEvaluation: p.avgEvaluation,
            bestMoves: new Map(p.bestMoves),
          });
        }
      }

      this.saveToStorage();
      return true;
    } catch (error) {
      console.error("Failed to import learning data:", error);
      return false;
    }
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === "undefined") return;

    try {
      const data = this.exportLearningData();
      localStorage.setItem(this.storageKey, data);
    } catch (error) {
      console.warn("Failed to save AI learning data:", error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === "undefined") return;

    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.importLearningData(data);
      }
    } catch (error) {
      console.warn("Failed to load AI learning data:", error);
    }
  }

  /**
   * Helper: Get action signature for tracking
   */
  private getActionSignature(action: Action): string {
    if (action.type === "place") {
      return `place:${action.squareIndex || action.toIndex}`;
    } else if (action.type === "move") {
      return `move:${action.fromIndex}:${action.toIndex}`;
    }
    return "none";
  }

  /**
   * Helper: Reconstruct action from signature
   */
  private reconstructAction(signature: string): Action | null {
    const parts = signature.split(":");

    if (parts[0] === "place") {
      return {
        type: "place",
        squareIndex: parseInt(parts[1]),
      };
    } else if (parts[0] === "move") {
      return {
        type: "move",
        fromIndex: parseInt(parts[1]),
        toIndex: parseInt(parts[2]),
      };
    }

    return null;
  }
}

// Global learning engine instance
export const aiLearning = new AILearningEngine();

