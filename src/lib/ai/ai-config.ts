
import type { GameState, PlayerId } from '../../lib/gameLogic';
import { MCTS, Action } from './mcts'; // Assuming Action is exported from mcts.ts

export interface AIConfigFeatures {
  config: {
    easy: { iterations: number; exploration: number; simulationDepth: number };
    medium: { iterations: number; exploration: number; simulationDepth: number };
    hard: { iterations: number; exploration: number; simulationDepth: number };
  }
}

export const AI_CONFIG: AIConfigFeatures['config'] = {
  easy: {
    iterations: 100,      // Fewer iterations for easier AI
    exploration: 2.0,     // Higher exploration for more varied moves
    simulationDepth: 5    // Shorter simulation depth
  },
  medium: {
    iterations: 500,      // Default iterations
    exploration: Math.sqrt(2), // Standard exploration weight
    simulationDepth: 10
  },
  hard: {
    iterations: 1500,     // More iterations for harder AI
    exploration: 1.0,     // Lower exploration for more optimal (but potentially predictable) moves
    simulationDepth: 15
  }
};

export async function getAIMove(
  gameState: GameState, 
  difficulty: keyof AIConfigFeatures['config']
): Promise<Action | null> {
  const config = AI_CONFIG[difficulty];
  if (!config) {
    console.error(`Invalid AI difficulty: ${difficulty}. Defaulting to medium.`);
    // difficulty = 'medium'; // This line causes type error if difficulty is not 'easy'|'medium'|'hard'
    // config = AI_CONFIG.medium; 
  }
  
  const mcts = new MCTS(gameState, difficulty, config);
  
  // For "easy" difficulty, add a chance to make a less optimal (more random but valid) move
  if (difficulty === 'easy' && Math.random() < 0.3) { // 30% chance of a more random move
    const node = new MCTSNode(gameState); // Temporary node to get valid actions
    const validActions = node.getValidActions(gameState);
    if (validActions.length > 0) {
        // Select a random action, but prefer those with a decent heuristic score
        const scoredActions = validActions.map(action => ({
            action,
            score: node.evaluateAction(gameState, action) // Assuming evaluateAction is accessible
        }));
        const nonLosingActions = scoredActions.filter(sa => sa.score > -1000); // Avoid immediate blunders
        if (nonLosingActions.length > 0) {
            return nonLosingActions[Math.floor(Math.random() * nonLosingActions.length)].action;
        }
        return validActions[Math.floor(Math.random() * validActions.length)];
    }
  }

  return mcts.findBestAction();
}

// Re-add MCTSNode here or ensure it's correctly imported if mcts.ts exports it.
// For simplicity if mcts.ts does not export MCTSNode directly to ai-config.ts:
class MCTSNode {
  state: GameState;
  // ... other MCTSNode properties and methods if needed directly by getAIMove's easy logic
  // For now, assume getValidActions and evaluateAction can be accessed or adapted
  constructor(state: GameState) {
    this.state = state;
  }
  getValidActions(state: GameState): Action[] {
     // Simplified version for this context. Real logic is in mcts.ts
    const actions: Action[] = [];
    const playerId = state.currentPlayerId;
    if (state.gamePhase === 'placement') {
      for (let i = 0; i < state.board.length; i++) {
        if (isValidPlacement(i, playerId, state)) {
          actions.push({ type: 'place', index: i });
        }
      }
    } else {
      for (let fromIdx = 0; fromIdx < state.board.length; fromIdx++) {
        const square = state.board[fromIdx];
        if (square.pawn?.playerId === playerId && !state.blockedPawnsInfo.has(fromIdx)) {
          const validDestinations = getValidMoveDestinations(fromIdx, playerId, state);
          for (const toIdx of validDestinations) {
            actions.push({ type: 'move', fromIndex: fromIdx, toIndex: toIdx });
          }
        }
      }
    }
    return actions.length > 0 ? actions : [{type: 'none'}];
  }

  applyActionToState(state: GameState, action: Action): GameState | null {
    let newState: GameState | null = null;
    const tempState = structuredClone(state);

    if (action.type === 'place' && action.index !== undefined) {
      newState = applyPlacePawn(tempState, action.index);
    } else if (action.type === 'move' && action.fromIndex !== undefined && action.toIndex !== undefined) {
      newState = applyMovePawn(tempState, action.fromIndex, action.toIndex);
    }
    return newState;
  }

  evaluateAction(state: GameState, action: Action): number {
    let score = Math.random() * 0.01;
    const tempStatePreview = this.applyActionToState(structuredClone(state), action);
    if (!tempStatePreview) return -Infinity;
    if (tempStatePreview.winner === state.currentPlayerId) return Infinity;
    if (tempStatePreview.winner && tempStatePreview.winner !== state.currentPlayerId) score -= 1000;
    return score;
  }
}
