// FILE: src/lib/ai/index.ts
// PURPOSE: Main export file for AI system

// MCTS - Monte Carlo Tree Search (production-grade)
export { MCTS, createMCTS, type Action } from "./mcts";

// Simple AI (kept as backup/alternative)
export {
  SimpleAI,
  createSimpleAI,
  findBestAction as findBestActionSimple,
  type SimpleAction,
} from "./simpleAI";
