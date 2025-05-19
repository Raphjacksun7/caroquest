import type { GameState, PlayerId } from '../../lib/gameLogic';
import { MCTS, MCTSNode, type Action } from './mcts'; // Add MCTSNode to imports

export interface AIConfigFeatures {
  config: {
    easy: { iterations: number; exploration: number; simulationDepth: number };
    medium: { iterations: number; exploration: number; simulationDepth: number };
    hard: { iterations: number; exploration: number; simulationDepth: number };
  }
}

export const AI_CONFIG: AIConfigFeatures['config'] = {
  easy: {
    iterations: 5000,      // Fewer iterations for easier AI
    exploration: Math.sqrt(8),     // Higher exploration for more varied moves
    simulationDepth: 20    // Shorter simulation depth
  },
  medium: {
    iterations: 10000,      // Default iterations
    exploration: Math.sqrt(4), // Standard exploration weight (reduced from Math.sqrt(16))
    simulationDepth: 25
  },
  hard: {
    iterations: 15000,     // More iterations for harder AI
    exploration: Math.sqrt(2),     // Lower exploration for more optimal moves (reduced from Math.sqrt(16))
    simulationDepth: 30
  }
};


export async function getAIMove(
  gameState: GameState, 
  difficulty: keyof AIConfigFeatures['config']
): Promise<Action | null> {
  // Use a default config if the specified difficulty doesn't exist
  const config = AI_CONFIG[difficulty] || AI_CONFIG.medium;
  
  // For "easy" difficulty, add a chance to make a less optimal (more random but valid) move
  if (difficulty === 'easy' && Math.random() < 0.3) { // 30% chance of a more random move
    const node = new MCTSNode(gameState); 
    const validActions = node.getValidActions(gameState);
    if (validActions.length > 0) {
        // Select a random action, but prefer those with a decent heuristic score
        const scoredActions = validActions.map(action => {
            let score;
            if (action.type === 'move' && action.fromIndex !== undefined && action.toIndex !== undefined) {
                // For movement actions, use evaluateMove
                score = node.evaluateMove(gameState, action.fromIndex, action.toIndex);
            } else if (action.type === 'place') {
                // For placement actions, use a simpler evaluation
                const index = action.squareIndex !== undefined ? action.squareIndex : action.toIndex;
                if (index !== undefined) {
                    // Calculate a basic placement quality score
                    const row = Math.floor(index / 8);
                    const col = index % 8;
                    
                    // Prefer central squares
                    const distanceFromCenter = Math.abs(row - 3.5) + Math.abs(col - 3.5);
                    score = 7 - distanceFromCenter; // Higher score for central squares
                }
            } else {
                score = 0; // Default score for 'none' actions
            }
            
            return { action, score: score || 0 };
        });
        
        const nonLosingActions = scoredActions.filter(sa => sa.score > -1000); // Avoid immediate blunders
        if (nonLosingActions.length > 0) {
            return nonLosingActions[Math.floor(Math.random() * nonLosingActions.length)].action;
        }
        return validActions[Math.floor(Math.random() * validActions.length)];
    }
  }

  // Use the full MCTS algorithm
  const mcts = new MCTS(gameState, difficulty, config);
  return mcts.findBestAction();
}