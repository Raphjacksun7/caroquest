// FILE: src/lib/ai/index.ts
// PURPOSE: Main export file for AI system - Complete AI learning system

// Core MCTS
export { MCTS, MCTSNode, type Action } from "./mcts";

// Enhanced MCTS with all learning systems
export {
  EnhancedMCTS,
  EnhancedMCTSNode,
  createAI,
  getAIStats,
} from "./enhancedMCTS";

// Learning System
export {
  AILearningEngine,
  aiLearning,
  type GameRecord,
  type PositionPattern,
} from "./learning";

// Adaptive Difficulty
export {
  AdaptiveDifficultyManager,
  adaptiveDifficulty,
  DIFFICULTY_LEVELS,
  type DifficultyConfig,
  type PlayerSkillMetrics,
} from "./adaptiveDifficulty";

// Position Evaluation
export {
  PositionEvaluator,
  positionEvaluator,
  type PositionFeatures,
} from "./positionEvaluation";

// Neural Network Evaluator (AlphaZero-style)
export { neuralEvaluator, NeuralNetworkEvaluator } from "./neuralEvaluator";

// Opening Book
export { openingBook, OpeningBook, type OpeningEntry } from "./openingBook";

// Opponent Modeling
export {
  opponentModeling,
  OpponentModelingSystem,
  type OpponentProfile,
} from "./opponentModeling";

// Self-Play Training
export {
  selfPlayTrainer,
  SelfPlayTrainer,
  runQuickTraining,
  runExtensiveTraining,
  type SelfPlayConfig,
  type SelfPlayResult,
} from "./selfPlay";

// Transposition Table (Caching)
export {
  transpositionTable,
  TranspositionTable,
  type TranspositionEntry,
} from "./transpositionTable";

// Endgame Solver
export {
  endgameSolver,
  EndgameSolver,
  type EndgameEntry,
} from "./endgameSolver";

// Redis Integration
export {
  redisAdapter,
  RedisAdapter,
  type RedisConfig,
  type RedisLearningData,
} from "./redisAdapter";
