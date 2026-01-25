// FILE: src/lib/ai/adaptiveDifficulty.ts
// PURPOSE: Dynamic difficulty adjustment based on player skill

import type { GameState, PlayerId } from "../gameLogic";
import { aiLearning } from "./learning";

/**
 * Difficulty configuration
 */
export interface DifficultyConfig {
  name: "easy" | "medium" | "hard" | "expert";
  iterations: number; // MCTS iterations
  explorationWeight: number; // UCT exploration parameter
  simulationDepth: number; // Rollout depth
  thinkingTimeMs: number; // Max thinking time
  useLearning: boolean; // Use learned patterns
  randomness: number; // 0-1, amount of random moves (for easy mode)
  description: string;
}

/**
 * Predefined difficulty levels
 */
export const DIFFICULTY_LEVELS: Record<string, DifficultyConfig> = {
  easy: {
    name: "easy",
    iterations: 1000,
    explorationWeight: 1.0,
    simulationDepth: 20,
    thinkingTimeMs: 500,
    useLearning: false,
    randomness: 0.3, // 30% random moves
    description: "Beginner-friendly AI with occasional mistakes",
  },
  medium: {
    name: "medium",
    iterations: 5000,
    explorationWeight: Math.sqrt(2),
    simulationDepth: 40,
    thinkingTimeMs: 1500,
    useLearning: true,
    randomness: 0.1, // 10% random moves
    description: "Balanced AI that provides a fair challenge",
  },
  hard: {
    name: "hard",
    iterations: 15000,
    explorationWeight: Math.sqrt(2),
    simulationDepth: 60,
    thinkingTimeMs: 3000,
    useLearning: true,
    randomness: 0.0, // No random moves
    description: "Challenging AI that rarely makes mistakes",
  },
  expert: {
    name: "expert",
    iterations: 30000,
    explorationWeight: Math.sqrt(2) * 1.1,
    simulationDepth: 80,
    thinkingTimeMs: 5000,
    useLearning: true,
    randomness: 0.0,
    description: "Master-level AI that learns and adapts to your style",
  },
};

/**
 * Player skill metrics
 */
export interface PlayerSkillMetrics {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  avgMoveTime: number; // milliseconds
  avgMoveQuality: number; // 0-1 scale
  winStreak: number;
  lossStreak: number;
  estimatedElo: number;
}

/**
 * Adaptive Difficulty Manager
 */
export class AdaptiveDifficultyManager {
  private playerMetrics: PlayerSkillMetrics = {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    avgMoveTime: 0,
    avgMoveQuality: 0.5,
    winStreak: 0,
    lossStreak: 0,
    estimatedElo: 1200, // Starting ELO
  };

  private moveHistory: Array<{
    timestamp: number;
    moveTime: number;
    quality: number;
  }> = [];

  private readonly storageKey = "caroquest_player_metrics";

  constructor() {
    this.loadMetrics();
  }

  /**
   * Record game outcome
   */
  recordGameOutcome(
    playerWon: boolean,
    wasDraw: boolean,
    difficulty: string
  ): void {
    this.playerMetrics.gamesPlayed++;

    if (wasDraw) {
      this.playerMetrics.draws++;
      this.playerMetrics.winStreak = 0;
      this.playerMetrics.lossStreak = 0;
    } else if (playerWon) {
      this.playerMetrics.wins++;
      this.playerMetrics.winStreak++;
      this.playerMetrics.lossStreak = 0;

      // Increase ELO
      const eloGain = this.calculateEloChange(difficulty, true);
      this.playerMetrics.estimatedElo += eloGain;
    } else {
      this.playerMetrics.losses++;
      this.playerMetrics.lossStreak++;
      this.playerMetrics.winStreak = 0;

      // Decrease ELO
      const eloLoss = this.calculateEloChange(difficulty, false);
      this.playerMetrics.estimatedElo -= eloLoss;
    }

    // Clamp ELO
    this.playerMetrics.estimatedElo = Math.max(
      800,
      Math.min(2400, this.playerMetrics.estimatedElo)
    );

    this.saveMetrics();
  }

  /**
   * Record a player move for quality tracking
   */
  recordPlayerMove(moveTime: number, quality: number): void {
    this.moveHistory.push({
      timestamp: Date.now(),
      moveTime,
      quality,
    });

    // Keep last 100 moves
    if (this.moveHistory.length > 100) {
      this.moveHistory.shift();
    }

    // Update averages
    const recentMoves = this.moveHistory.slice(-20);
    this.playerMetrics.avgMoveTime =
      recentMoves.reduce((sum, m) => sum + m.moveTime, 0) / recentMoves.length;
    this.playerMetrics.avgMoveQuality =
      recentMoves.reduce((sum, m) => sum + m.quality, 0) / recentMoves.length;

    this.saveMetrics();
  }

  /**
   * Get recommended difficulty based on player skill
   */
  getRecommendedDifficulty(): DifficultyConfig {
    const elo = this.playerMetrics.estimatedElo;

    if (elo < 1000) {
      return DIFFICULTY_LEVELS.easy;
    } else if (elo < 1400) {
      return DIFFICULTY_LEVELS.medium;
    } else if (elo < 1800) {
      return DIFFICULTY_LEVELS.hard;
    } else {
      return DIFFICULTY_LEVELS.expert;
    }
  }

  /**
   * Get dynamically adjusted config for current game state
   */
  getAdjustedConfig(
    baseDifficulty: string,
    currentGameState?: GameState
  ): DifficultyConfig {
    let config = { ...DIFFICULTY_LEVELS[baseDifficulty] };

    if (!config) {
      config = DIFFICULTY_LEVELS.medium;
    }

    // Adjust based on win/loss streak
    if (this.playerMetrics.lossStreak >= 3) {
      // Player losing consistently, make it a bit easier
      config.iterations = Math.floor(config.iterations * 0.8);
      config.randomness = Math.min(1.0, config.randomness + 0.1);
      console.log(
        "AI: Adjusting difficulty down due to player loss streak"
      );
    } else if (this.playerMetrics.winStreak >= 3) {
      // Player winning consistently, make it harder
      config.iterations = Math.floor(config.iterations * 1.2);
      config.randomness = Math.max(0, config.randomness - 0.1);
      console.log(
        "AI: Adjusting difficulty up due to player win streak"
      );
    }

    // Adjust based on game phase (be more forgiving early game)
    if (currentGameState && currentGameState.gamePhase === "placement") {
      const totalPlaced =
        currentGameState.placedPawns[1] + currentGameState.placedPawns[2];
      if (totalPlaced < 4) {
        // Early game, reduce iterations slightly
        config.iterations = Math.floor(config.iterations * 0.9);
      }
    }

    return config;
  }

  /**
   * Get player metrics
   */
  getPlayerMetrics(): PlayerSkillMetrics {
    return { ...this.playerMetrics };
  }

  /**
   * Reset player metrics
   */
  resetMetrics(): void {
    this.playerMetrics = {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      avgMoveTime: 0,
      avgMoveQuality: 0.5,
      winStreak: 0,
      lossStreak: 0,
      estimatedElo: 1200,
    };
    this.moveHistory = [];
    this.saveMetrics();
  }

  /**
   * Calculate ELO change from a game
   */
  private calculateEloChange(difficulty: string, won: boolean): number {
    const K = 32; // K-factor
    const difficultyElo: Record<string, number> = {
      easy: 1000,
      medium: 1400,
      hard: 1800,
      expert: 2200,
    };

    const opponentElo = difficultyElo[difficulty] || 1400;
    const expected =
      1 / (1 + Math.pow(10, (opponentElo - this.playerMetrics.estimatedElo) / 400));

    const actual = won ? 1 : 0;
    return Math.floor(K * (actual - expected));
  }

  /**
   * Save metrics to localStorage
   */
  private saveMetrics(): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          playerMetrics: this.playerMetrics,
          moveHistory: this.moveHistory.slice(-50), // Save last 50 moves only
        })
      );
    } catch (error) {
      console.warn("Failed to save player metrics:", error);
    }
  }

  /**
   * Load metrics from localStorage
   */
  private loadMetrics(): void {
    if (typeof window === "undefined") return;

    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.playerMetrics = parsed.playerMetrics || this.playerMetrics;
        this.moveHistory = parsed.moveHistory || [];
      }
    } catch (error) {
      console.warn("Failed to load player metrics:", error);
    }
  }
}

// Global adaptive difficulty manager
export const adaptiveDifficulty = new AdaptiveDifficultyManager();

