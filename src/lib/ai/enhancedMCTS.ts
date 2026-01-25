// FILE: src/lib/ai/enhancedMCTS.ts
// PURPOSE: Enhanced MCTS with learning, adaptive difficulty, and advanced evaluation

import { MCTSNode, MCTS, Action } from "./mcts";
import type { GameState, PlayerId } from "../gameLogic";
import { aiLearning, GameRecord } from "./learning";
import {
  adaptiveDifficulty,
  DifficultyConfig,
  DIFFICULTY_LEVELS,
} from "./adaptiveDifficulty";
import { positionEvaluator } from "./positionEvaluation";
import { neuralEvaluator } from "./neuralEvaluator";
import { openingBook } from "./openingBook";
import { opponentModeling } from "./opponentModeling";
import { transpositionTable } from "./transpositionTable";

/**
 * Enhanced MCTS Node with learning capabilities
 */
export class EnhancedMCTSNode extends MCTSNode {
  /**
   * Override evaluateState to use advanced position evaluator with multiple sources
   */
  override evaluateState(
    state: GameState,
    perspectivePlayerId: PlayerId
  ): number {
    // 1. Check transposition table (fastest)
    const cached = transpositionTable.probe(state, 0);
    if (cached.found && cached.evaluation !== undefined) {
      return cached.evaluation;
    }

    // 2. Check learned patterns
    const learnedEval = aiLearning.getLearnedEvaluation(state);
    if (learnedEval !== null) {
      transpositionTable.store(state, learnedEval, 0, "exact");
      return learnedEval;
    }

    // 3. Use neural network if trained enough
    const neuralStats = neuralEvaluator.getStats();
    let evaluation: number;
    
    if (neuralStats.trainedGames > 50) {
      // Blend neural network with heuristic evaluator
      const neuralEval = neuralEvaluator.evaluate(state, perspectivePlayerId);
      const heuristicEval = positionEvaluator.evaluate(state, perspectivePlayerId);
      
      // Weight more heavily toward neural network as it trains more
      const neuralWeight = Math.min(0.7, neuralStats.trainedGames / 500);
      evaluation = neuralEval * neuralWeight + heuristicEval * (1 - neuralWeight);
    } else {
      // Use heuristic evaluator
      evaluation = positionEvaluator.evaluate(state, perspectivePlayerId);
    }

    // Cache evaluation
    transpositionTable.store(state, evaluation, 0, "exact");
    
    return evaluation;
  }

  /**
   * Override getValidActions to consider learned moves
   */
  override getValidActions(currentState: GameState): Action[] {
    // Get base valid actions from parent class
    const baseActions = super.getValidActions(currentState);

    // Check if we have a learned best move for this position
    const learnedMove = aiLearning.getBestLearnedMove(currentState);

    if (learnedMove) {
      // Boost the quality of the learned move
      const learnedMoveIndex = baseActions.findIndex(
        (a) =>
          a.type === learnedMove.type &&
          a.squareIndex === learnedMove.squareIndex &&
          a.fromIndex === learnedMove.fromIndex &&
          a.toIndex === learnedMove.toIndex
      );

      if (learnedMoveIndex >= 0) {
        // Boost learned move's quality
        const move = baseActions[learnedMoveIndex];
        move.quality = (move.quality || 0) + 50; // Significant boost

        // Re-sort actions by quality
        baseActions.sort((a, b) => (b.quality || 0) - (a.quality || 0));
      }
    }

    return baseActions;
  }
}

/**
 * Enhanced MCTS with learning and adaptive difficulty
 */
export class EnhancedMCTS extends MCTS {
  private config: DifficultyConfig;
  private gameStartTime: number;
  private moveHistory: Array<{
    state: GameState;
    action: Action;
    playerId: PlayerId;
    evaluation: number;
  }> = [];
  private aiPlayerId: PlayerId;
  private opponentId: string | null = null;

  constructor(
    initialState: GameState,
    difficulty: string = "medium",
    aiPlayerId: PlayerId = 2,
    opponentId: string | null = null
  ) {
    // Get adaptive config
    const baseConfig =
      DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.medium;
    const adaptedConfig = adaptiveDifficulty.getAdjustedConfig(
      difficulty,
      initialState
    );

    // Call parent with adapted config
    super(initialState, difficulty, {
      iterations: adaptedConfig.iterations,
      exploration: adaptedConfig.explorationWeight,
      simulationDepth: adaptedConfig.simulationDepth,
    });

    this.config = adaptedConfig;
    this.gameStartTime = Date.now();
    this.aiPlayerId = aiPlayerId;
    this.opponentId = opponentId;
    this.timeLimit = adaptedConfig.thinkingTimeMs;

    // Start tracking opponent if provided
    if (opponentId) {
      opponentModeling.startTracking(opponentId);
    }
  }

  /**
   * Override findBestAction with enhanced logic
   */
  override findBestAction(): Action | null {
    // 1. Check opening book (highest priority in early game)
    if (this.initialState.gamePhase === "placement") {
      const placedCount =
        this.initialState.placedPawns[1] + this.initialState.placedPawns[2];
      
      if (placedCount < 6) {
        // Use opening book for first few moves
        const openingMove = openingBook.getOpeningMove(
          this.initialState,
          this.aiPlayerId
        );
        
        if (openingMove) {
          this.recordMove(this.initialState, openingMove, 0.75);
          return openingMove;
        }
      }
    }

    // 2. Apply randomness for easier difficulties
    if (this.config.randomness > 0 && Math.random() < this.config.randomness) {
      console.log("AI: Making intentional random move for difficulty balance");
      return this.getRandomMove();
    }

    // 3. Get opponent adaptive strategy if available
    let strategyAdjustment = null;
    if (this.opponentId) {
      strategyAdjustment = opponentModeling.getAdaptiveStrategy(this.opponentId);
    }

    // Use parent MCTS logic with enhanced nodes
    const rootNode = new EnhancedMCTSNode(this.initialState);

    if (rootNode.untriedActions.length === 0) return null;
    if (rootNode.untriedActions.length === 1) return rootNode.untriedActions[0];

    const startTime = Date.now();
    let iterations = 0;

    // Run MCTS iterations
    while (
      iterations < this.iterations &&
      Date.now() - startTime < this.timeLimit
    ) {
      // Selection
      let node = rootNode;
      while (node.untriedActions.length === 0 && node.children.length > 0) {
        const selectedChild = node.selectChild(this.explorationWeight);
        if (!selectedChild) break;
        node = selectedChild as EnhancedMCTSNode;
      }

      // Expansion
      if (node.untriedActions.length > 0 && !node.isTerminal(node.state)) {
        const expandedNode = node.expand();
        if (!expandedNode) continue;
        node = expandedNode as EnhancedMCTSNode;
      }

      // Simulation
      const result = node.rollout(this.maxRolloutDepth);

      // Backpropagation
      node.backpropagate(result);

      iterations++;
    }

    // Find best child
    let bestChild: EnhancedMCTSNode | null = null;
    let bestScore = -Infinity;

    for (const child of rootNode.children) {
      const enhancedChild = child as EnhancedMCTSNode;
      const score =
        enhancedChild.visits > 0 ? enhancedChild.wins / enhancedChild.visits : 0;

      if (score > bestScore) {
        bestScore = score;
        bestChild = enhancedChild;
      }
    }

    if (bestChild && bestChild.action) {
      const winRate = ((bestChild.wins / bestChild.visits) * 100).toFixed(1);
      console.log(
        `AI [${this.config.name}]: Selected move with ${winRate}% win rate after ${iterations} iterations (${Date.now() - startTime}ms)`
      );

      // Record move for learning
      this.recordMove(
        this.initialState,
        bestChild.action,
        bestChild.wins / bestChild.visits
      );

      return bestChild.action;
    }

    return rootNode.untriedActions.length > 0
      ? rootNode.untriedActions[0]
      : null;
  }

  /**
   * Get a random valid move (for easy mode)
   */
  private getRandomMove(): Action | null {
    const node = new EnhancedMCTSNode(this.initialState);
    const actions = node.getValidActions(this.initialState);

    if (actions.length === 0 || actions[0].type === "none") {
      return null;
    }

    // Weighted random - still prefer higher quality moves
    const totalQuality = actions.reduce((sum, a) => sum + (a.quality || 1), 0);
    let random = Math.random() * totalQuality;

    for (const action of actions) {
      random -= action.quality || 1;
      if (random <= 0) {
        return action;
      }
    }

    return actions[0];
  }

  /**
   * Record a move for learning
   */
  private recordMove(
    state: GameState,
    action: Action,
    evaluation: number
  ): void {
    const stateHash = aiLearning.hashGameState(state);

    this.moveHistory.push({
      state: structuredClone(state),
      action,
      playerId: state.currentPlayerId,
      evaluation,
    });
  }

  /**
   * Record game outcome for learning
   */
  recordGameOutcome(winner: PlayerId | null): void {
    const outcome: "win" | "loss" | "draw" =
      winner === null ? "draw" : winner === this.aiPlayerId ? "win" : "loss";

    const gameRecord: GameRecord = {
      id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      difficulty: this.config.name,
      aiPlayerId: this.aiPlayerId,
      winner,
      moves: this.moveHistory.map((m) => ({
        state: aiLearning.hashGameState(m.state),
        action: m.action,
        playerId: m.playerId,
        evaluation: m.evaluation,
      })),
      duration: Date.now() - this.gameStartTime,
      outcome,
    };

    // Record in learning engine
    aiLearning.recordGame(gameRecord);

    // Update player metrics
    adaptiveDifficulty.recordGameOutcome(
      outcome === "loss", // Player won if AI lost
      outcome === "draw",
      this.config.name
    );

    // Update opening book
    openingBook.updateOpening(this.initialState, winner);

    // Finish opponent tracking
    if (this.opponentId) {
      const opponentPlayerId = this.aiPlayerId === 1 ? 2 : 1;
      opponentModeling.finishGame(
        this.initialState,
        winner,
        opponentPlayerId as PlayerId
      );
    }

    // Add to neural network training data
    const result = winner === this.aiPlayerId ? 1.0 : winner === null ? 0.5 : 0.0;
    for (const move of this.moveHistory) {
      neuralEvaluator.addTrainingExample(
        move.state,
        move.playerId,
        result,
        1.0
      );
    }

    // Periodically train neural network
    if (Math.random() < 0.1) {
      // 10% chance to train after each game
      neuralEvaluator.train(10, 32);
    }

    console.log(
      `AI Learning: Recorded game (${outcome}) with ${gameRecord.moves.length} moves`
    );
  }

  /**
   * Record opponent move for learning
   */
  recordOpponentMove(
    state: GameState,
    action: Action,
    moveTime: number
  ): void {
    if (!this.opponentId) return;

    // Estimate move quality (would need proper evaluation)
    const evaluation = 0.5; // Placeholder - should use actual position evaluation
    
    opponentModeling.recordOpponentMove(state, action, moveTime, evaluation);
  }
}

/**
 * Factory function to create AI with appropriate difficulty
 */
export function createAI(
  gameState: GameState,
  difficulty: "easy" | "medium" | "hard" | "expert" = "medium",
  aiPlayerId: PlayerId = 2,
  opponentId: string | null = null
): EnhancedMCTS {
  return new EnhancedMCTS(gameState, difficulty, aiPlayerId, opponentId);
}

/**
 * Get AI statistics for display
 */
export function getAIStats() {
  return {
    learning: aiLearning.getTotalStats(),
    player: adaptiveDifficulty.getPlayerMetrics(),
    neuralNetwork: neuralEvaluator.getStats(),
    openingBook: openingBook.getStats(),
    transpositionTable: transpositionTable.getStats(),
    difficulties: Object.entries(DIFFICULTY_LEVELS).map(([key, config]) => ({
      name: key,
      config,
      stats: aiLearning.getDifficultyStats(key),
    })),
  };
}

