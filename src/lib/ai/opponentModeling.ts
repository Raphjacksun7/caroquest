// FILE: src/lib/ai/opponentModeling.ts
// PURPOSE: Model opponent playing style and adapt strategy
// LEARNS: Opponent tendencies, move patterns, and weaknesses

import type { GameState, PlayerId } from "../gameLogic";
import type { Action } from "./mcts";

/**
 * Opponent profile
 */
export interface OpponentProfile {
  playerId: string; // Session ID or identifier
  gamesPlayed: number;
  
  // Playing style metrics
  avgMoveTime: number; // milliseconds
  aggression: number; // 0-1, tendency to attack vs defend
  patience: number; // 0-1, tendency to build vs rush
  edgePreference: number; // 0-1, preference for edge vs center play
  
  // Pattern recognition
  favoriteOpenings: Map<string, number>; // Opening pattern -> frequency
  commonMistakes: Map<string, number>; // Position hash -> times made mistake
  strongPositions: Map<string, number>; // Positions where opponent plays well
  
  // Adaptation metrics
  learningRate: number; // How fast opponent adapts (0-1)
  predictability: number; // How predictable opponent is (0-1)
  
  // Win/loss record
  wins: number;
  losses: number;
  draws: number;
}

/**
 * Opponent Modeling System
 */
export class OpponentModelingSystem {
  private profiles: Map<string, OpponentProfile> = new Map();
  private currentOpponent: string | null = null;
  private currentGameMoves: Array<{
    position: string;
    moveTime: number;
    quality: number;
  }> = [];
  
  private readonly storageKey = "caroquest_opponent_profiles";
  private readonly maxProfiles = 50; // Limit memory usage

  constructor() {
    this.loadProfiles();
  }

  /**
   * Start tracking new opponent
   */
  startTracking(opponentId: string): void {
    this.currentOpponent = opponentId;
    this.currentGameMoves = [];

    if (!this.profiles.has(opponentId)) {
      this.profiles.set(opponentId, this.createNewProfile(opponentId));
    }
  }

  /**
   * Create new opponent profile
   */
  private createNewProfile(playerId: string): OpponentProfile {
    return {
      playerId,
      gamesPlayed: 0,
      avgMoveTime: 5000,
      aggression: 0.5,
      patience: 0.5,
      edgePreference: 0.5,
      favoriteOpenings: new Map(),
      commonMistakes: new Map(),
      strongPositions: new Map(),
      learningRate: 0.5,
      predictability: 0.5,
      wins: 0,
      losses: 0,
      draws: 0,
    };
  }

  /**
   * Record opponent move
   */
  recordOpponentMove(
    state: GameState,
    action: Action,
    moveTime: number,
    evaluation: number // How good was this move (0-1)
  ): void {
    if (!this.currentOpponent) return;

    const positionHash = this.hashPosition(state);
    this.currentGameMoves.push({
      position: positionHash,
      moveTime,
      quality: evaluation,
    });

    const profile = this.profiles.get(this.currentOpponent);
    if (!profile) return;

    // Update avg move time (exponential moving average)
    const alpha = 0.2;
    profile.avgMoveTime = profile.avgMoveTime * (1 - alpha) + moveTime * alpha;

    // Analyze move characteristics
    if (state.gamePhase === "placement") {
      const squareIdx = action.squareIndex ?? action.toIndex;
      if (squareIdx !== undefined) {
        const row = Math.floor(squareIdx / 8);
        const col = squareIdx % 8;
        const isEdge =
          row === 0 || row === 7 || col === 0 || col === 7;

        // Update edge preference
        const edgeSignal = isEdge ? 1 : 0;
        profile.edgePreference =
          profile.edgePreference * (1 - alpha) + edgeSignal * alpha;
      }
    }

    // Track if this was a mistake (low quality move)
    if (evaluation < 0.4) {
      const count = profile.commonMistakes.get(positionHash) || 0;
      profile.commonMistakes.set(positionHash, count + 1);
    } else if (evaluation > 0.7) {
      const count = profile.strongPositions.get(positionHash) || 0;
      profile.strongPositions.set(positionHash, count + 1);
    }
  }

  /**
   * Finish game and update opponent profile
   */
  finishGame(
    state: GameState,
    winner: PlayerId | null,
    opponentId: PlayerId
  ): void {
    if (!this.currentOpponent) return;

    const profile = this.profiles.get(this.currentOpponent);
    if (!profile) return;

    profile.gamesPlayed++;

    // Update win/loss record
    if (winner === null) {
      profile.draws++;
    } else if (winner === opponentId) {
      profile.wins++;
    } else {
      profile.losses++;
    }

    // Analyze aggression from move quality variance
    if (this.currentGameMoves.length > 5) {
      const qualities = this.currentGameMoves.map((m) => m.quality);
      const variance = this.calculateVariance(qualities);
      
      // High variance = more aggressive (risky moves)
      const aggressionSignal = Math.min(1, variance * 5);
      const alpha = 0.15;
      profile.aggression =
        profile.aggression * (1 - alpha) + aggressionSignal * alpha;
    }

    // Update patience based on game length
    const gameMoves = state.placedPawns[1] + state.placedPawns[2];
    const patienceSignal = Math.min(1, gameMoves / 20); // Longer games = more patient
    profile.patience = profile.patience * 0.85 + patienceSignal * 0.15;

    // Track opening pattern
    const opening = this.extractOpening(state);
    if (opening) {
      const count = profile.favoriteOpenings.get(opening) || 0;
      profile.favoriteOpenings.set(opening, count + 1);
    }

    // Calculate predictability (consistency of move times)
    if (this.currentGameMoves.length > 0) {
      const moveTimes = this.currentGameMoves.map((m) => m.moveTime);
      const consistency = 1 - Math.min(1, this.calculateVariance(moveTimes) / 10000);
      profile.predictability = profile.predictability * 0.9 + consistency * 0.1;
    }

    // Estimate learning rate (improvement over games)
    if (profile.gamesPlayed > 5) {
      const recentQuality =
        this.currentGameMoves
          .slice(-10)
          .reduce((sum, m) => sum + m.quality, 0) / Math.min(10, this.currentGameMoves.length);
      
      profile.learningRate = Math.min(1, recentQuality / 0.7);
    }

    // Cleanup old data
    this.cleanupProfile(profile);

    this.saveProfiles();
    this.currentGameMoves = [];
  }

  /**
   * Get strategic adjustment based on opponent profile
   */
  getAdaptiveStrategy(opponentId: string): {
    focusOnDefense: boolean;
    playMoreAggressive: boolean;
    targetWeakPositions: string[];
    avoidStrongPositions: string[];
  } {
    const profile = this.profiles.get(opponentId);
    
    if (!profile || profile.gamesPlayed < 2) {
      // Not enough data, use balanced strategy
      return {
        focusOnDefense: false,
        playMoreAggressive: false,
        targetWeakPositions: [],
        avoidStrongPositions: [],
      };
    }

    // If opponent is aggressive, focus more on defense
    const focusOnDefense = profile.aggression > 0.65;

    // If opponent is predictable and patient, we can be more aggressive
    const playMoreAggressive = profile.predictability > 0.6 && profile.patience > 0.6;

    // Extract positions to target or avoid
    const targetWeakPositions = Array.from(profile.commonMistakes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pos]) => pos);

    const avoidStrongPositions = Array.from(profile.strongPositions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pos]) => pos);

    console.log(
      `Opponent Modeling: Aggression=${profile.aggression.toFixed(2)}, ` +
      `Patience=${profile.patience.toFixed(2)}, ` +
      `Predictability=${profile.predictability.toFixed(2)} -> ` +
      `Defense=${focusOnDefense}, Aggressive=${playMoreAggressive}`
    );

    return {
      focusOnDefense,
      playMoreAggressive,
      targetWeakPositions,
      avoidStrongPositions,
    };
  }

  /**
   * Get opponent profile
   */
  getProfile(opponentId: string): OpponentProfile | null {
    return this.profiles.get(opponentId) || null;
  }

  /**
   * Hash game position
   */
  private hashPosition(state: GameState): string {
    const positions: string[] = [];
    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i].pawn) {
        positions.push(`${i}:${state.board[i].pawn!.playerId}`);
      }
    }
    return positions.join("|");
  }

  /**
   * Extract opening pattern (first 3 moves)
   */
  private extractOpening(state: GameState): string | null {
    const positions: number[] = [];
    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i].pawn) {
        positions.push(i);
      }
    }
    
    if (positions.length >= 3) {
      return positions.slice(0, 3).sort((a, b) => a - b).join("-");
    }
    
    return null;
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Cleanup old profile data
   */
  private cleanupProfile(profile: OpponentProfile): void {
    // Keep only top 20 entries in each map
    const keepTop = (map: Map<string, number>, limit: number) => {
      const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
      map.clear();
      sorted.slice(0, limit).forEach(([key, value]) => map.set(key, value));
    };

    keepTop(profile.favoriteOpenings, 10);
    keepTop(profile.commonMistakes, 20);
    keepTop(profile.strongPositions, 20);
  }

  /**
   * Save profiles to localStorage
   */
  private saveProfiles(): void {
    if (typeof window === "undefined") return;

    try {
      // Convert profiles to serializable format
      const data = Array.from(this.profiles.entries()).map(([id, profile]) => [
        id,
        {
          ...profile,
          favoriteOpenings: Array.from(profile.favoriteOpenings.entries()),
          commonMistakes: Array.from(profile.commonMistakes.entries()),
          strongPositions: Array.from(profile.strongPositions.entries()),
        },
      ]);

      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to save opponent profiles:", error);
    }
  }

  /**
   * Load profiles from localStorage
   */
  private loadProfiles(): void {
    if (typeof window === "undefined") return;

    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        
        for (const [id, profile] of parsed) {
          this.profiles.set(id, {
            ...profile,
            favoriteOpenings: new Map(profile.favoriteOpenings),
            commonMistakes: new Map(profile.commonMistakes),
            strongPositions: new Map(profile.strongPositions),
          });
        }

        console.log(`Loaded ${this.profiles.size} opponent profiles`);
      }
    } catch (error) {
      console.warn("Failed to load opponent profiles:", error);
    }
  }

  /**
   * Reset all profiles
   */
  reset(): void {
    this.profiles.clear();
    this.currentOpponent = null;
    this.currentGameMoves = [];
    this.saveProfiles();
  }
}

// Global opponent modeling system
export const opponentModeling = new OpponentModelingSystem();

