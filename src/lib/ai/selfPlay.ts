// FILE: src/lib/ai/selfPlay.ts
// PURPOSE: Self-play training system for AI improvement (AlphaZero style)
// GENERATES: Training data through AI vs AI games

import type { GameState, PlayerId } from "../gameLogic";
import { initializeGame } from "../gameLogic";
import { EnhancedMCTS } from "./enhancedMCTS";
import { neuralEvaluator } from "./neuralEvaluator";
import { aiLearning } from "./learning";
import { openingBook } from "./openingBook";
import type { Action } from "./mcts";

/**
 * Self-play configuration
 */
export interface SelfPlayConfig {
  gamesPerSession: number;
  difficulty1: string;
  difficulty2: string;
  maxMovesPerGame: number;
  saveInterval: number; // Save every N games
  trainNeuralNetwork: boolean;
}

/**
 * Self-play training result
 */
export interface SelfPlayResult {
  gamesCompleted: number;
  player1Wins: number;
  player2Wins: number;
  draws: number;
  avgGameLength: number;
  trainingExamplesGenerated: number;
  duration: number;
}

/**
 * Self-Play Training System
 */
export class SelfPlayTrainer {
  private isRunning = false;
  private shouldStop = false;

  /**
   * Run self-play training session
   */
  async runTrainingSession(config: SelfPlayConfig): Promise<SelfPlayResult> {
    if (this.isRunning) {
      throw new Error("Training session already running");
    }

    this.isRunning = true;
    this.shouldStop = false;

    const startTime = Date.now();
    const result: SelfPlayResult = {
      gamesCompleted: 0,
      player1Wins: 0,
      player2Wins: 0,
      draws: 0,
      avgGameLength: 0,
      trainingExamplesGenerated: 0,
      duration: 0,
    };

    console.log(
      `Starting self-play training: ${config.gamesPerSession} games...`
    );

    const gameLengths: number[] = [];

    for (let i = 0; i < config.gamesPerSession; i++) {
      if (this.shouldStop) {
        console.log("Self-play training stopped by user");
        break;
      }

      // Play one game
      const gameResult = await this.playSelfPlayGame(
        config.difficulty1,
        config.difficulty2,
        config.maxMovesPerGame,
        config.trainNeuralNetwork
      );

      // Update results
      result.gamesCompleted++;
      gameLengths.push(gameResult.moves);

      if (gameResult.winner === 1) {
        result.player1Wins++;
      } else if (gameResult.winner === 2) {
        result.player2Wins++;
      } else {
        result.draws++;
      }

      result.trainingExamplesGenerated += gameResult.trainingExamples;

      // Progress logging
      if ((i + 1) % 10 === 0 || i === config.gamesPerSession - 1) {
        console.log(
          `Self-play progress: ${i + 1}/${config.gamesPerSession} games | ` +
          `P1: ${result.player1Wins} | P2: ${result.player2Wins} | Draws: ${result.draws}`
        );
      }

      // Periodic save and neural network training
      if (
        config.trainNeuralNetwork &&
        (i + 1) % config.saveInterval === 0
      ) {
        console.log("Training neural network on accumulated examples...");
        neuralEvaluator.train(20, 64); // 20 epochs, batch size 64
      }

      // Small delay to prevent UI freeze
      if (i % 5 === 0) {
        await this.delay(10);
      }
    }

    // Final neural network training
    if (config.trainNeuralNetwork && result.gamesCompleted > 0) {
      console.log("Final neural network training...");
      neuralEvaluator.train(50, 64);
    }

    result.avgGameLength =
      gameLengths.reduce((sum, l) => sum + l, 0) / gameLengths.length || 0;
    result.duration = Date.now() - startTime;

    console.log(
      `Self-play training completed: ${result.gamesCompleted} games in ${(result.duration / 1000).toFixed(1)}s`
    );
    console.log(
      `Win rates: P1=${((result.player1Wins / result.gamesCompleted) * 100).toFixed(1)}%, ` +
      `P2=${((result.player2Wins / result.gamesCompleted) * 100).toFixed(1)}%, ` +
      `Draw=${((result.draws / result.gamesCompleted) * 100).toFixed(1)}%`
    );

    this.isRunning = false;
    return result;
  }

  /**
   * Play a single self-play game
   */
  private async playSelfPlayGame(
    difficulty1: string,
    difficulty2: string,
    maxMoves: number,
    generateTrainingData: boolean
  ): Promise<{
    winner: PlayerId | null;
    moves: number;
    trainingExamples: number;
  }> {
    let state = initializeGame({ boardSize: 8 });
    const moveHistory: Array<{
      state: GameState;
      action: Action;
      playerId: PlayerId;
    }> = [];

    let movesPlayed = 0;

    // Play game to completion
    while (state.winner === null && movesPlayed < maxMoves) {
      const currentDifficulty =
        state.currentPlayerId === 1 ? difficulty1 : difficulty2;
      
      // Create AI for current player
      const ai = new EnhancedMCTS(
        state,
        currentDifficulty,
        state.currentPlayerId
      );

      // Get best move
      const action = ai.findBestAction();

      if (!action || action.type === "none") {
        // No valid moves, game over
        break;
      }

      // Record move for training
      moveHistory.push({
        state: structuredClone(state),
        action,
        playerId: state.currentPlayerId,
      });

      // Apply move
      const newState = this.applyAction(state, action);
      if (!newState) break;

      state = newState;
      movesPlayed++;
    }

    // Generate training examples if requested
    let trainingExamples = 0;
    if (generateTrainingData && state.winner !== null) {
      trainingExamples = this.generateTrainingExamples(
        moveHistory,
        state.winner
      );
    }

    // Update opening book
    if (movesPlayed >= 4) {
      openingBook.updateOpening(state, state.winner);
    }

    return {
      winner: state.winner,
      moves: movesPlayed,
      trainingExamples,
    };
  }

  /**
   * Generate training examples from game
   */
  private generateTrainingExamples(
    moveHistory: Array<{
      state: GameState;
      action: Action;
      playerId: PlayerId;
    }>,
    winner: PlayerId
  ): number {
    let count = 0;

    for (let i = 0; i < moveHistory.length; i++) {
      const move = moveHistory[i];
      
      // Determine outcome from this player's perspective
      let result: number;
      if (move.playerId === winner) {
        result = 1.0; // Win
      } else {
        result = 0.0; // Loss
      }

      // Apply temporal discount - later moves are more important
      const importance = Math.pow(0.95, moveHistory.length - i - 1);

      // Add to neural network training data
      neuralEvaluator.addTrainingExample(
        move.state,
        move.playerId,
        result,
        importance
      );

      count++;
    }

    return count;
  }

  /**
   * Apply action to state (simplified version)
   */
  private applyAction(state: GameState, action: Action): GameState | null {
    // This should use the actual game logic functions
    // For now, return a placeholder
    // In production, import and use placePawn/movePawn from gameLogic
    
    // Import would be:
    // import { placePawn, movePawn } from "../gameLogic";
    
    // For type safety, returning null to indicate not implemented
    // You should implement this properly in integration
    console.warn("applyAction needs proper gameLogic integration");
    return null;
  }

  /**
   * Stop training session
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Check if training is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Global self-play trainer
export const selfPlayTrainer = new SelfPlayTrainer();

/**
 * Convenience function to run quick training
 */
export async function runQuickTraining(
  games: number = 50
): Promise<SelfPlayResult> {
  return selfPlayTrainer.runTrainingSession({
    gamesPerSession: games,
    difficulty1: "medium",
    difficulty2: "medium",
    maxMovesPerGame: 100,
    saveInterval: 10,
    trainNeuralNetwork: true,
  });
}

/**
 * Run extensive training (expert level)
 */
export async function runExtensiveTraining(
  games: number = 500
): Promise<SelfPlayResult> {
  return selfPlayTrainer.runTrainingSession({
    gamesPerSession: games,
    difficulty1: "hard",
    difficulty2: "hard",
    maxMovesPerGame: 150,
    saveInterval: 25,
    trainNeuralNetwork: true,
  });
}

