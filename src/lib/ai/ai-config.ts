import type { GameState, PlayerId } from '../../lib/gameLogic';
import { MCTS, Action } from './mcts';

export interface AIConfigFeatures {
  iterations: number;
  exploration: number;
  simulationDepth: number;
}

export const AI_CONFIG: Record<'easy' | 'medium' | 'hard', AIConfigFeatures> = {
  easy: {
    iterations: 200,      // Fewer iterations for easier AI
    exploration: 2.0,     // Higher exploration for more varied moves
    simulationDepth: 3    // Shorter simulation depth
  },
  medium: {
    iterations: 500,   // Default iterations
    exploration: Math.sqrt(2), // Standard exploration weight
    simulationDepth: 5
  },
  hard: {
    iterations: 1000,   // More iterations for harder AI
    exploration: 1.0,     // Lower exploration for more optimal (but potentially predictable) moves
    simulationDepth: 7
  }
};

export const getAIMove = async (
  gameState: GameState, 
  difficulty: keyof typeof AI_CONFIG
): Promise<Action | null> => {
  const config = AI_CONFIG[difficulty];
  const aiPlayerId = gameState.currentPlayerId; // AI always plays as the current player
  
  // Create a deep clone of the game state to pass to MCTS
  // This is important as MCTS modifies the state during its search
  const stateClone = structuredClone(gameState);

  const mcts = new MCTS(stateClone, aiPlayerId, config);
  
  // MCTS findBestAction will handle placement or movement phase internally
  // based on the state's gamePhase.
  return mcts.findBestAction();
};
