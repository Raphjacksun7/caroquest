
import type { GameState } from '../../lib/gameLogic'; // Ensure this path is correct
import { getAIMove } from './ai-config';
import type { Action } from './mcts'; // Assuming Action is exported from mcts.ts

self.onmessage = async (event: MessageEvent<{ gameState: GameState; difficulty: 'easy' | 'medium' | 'hard' }>) => {
  const { gameState, difficulty } = event.data;
  
  try {
    // gameState needs to be a deep clone if MCTS modifies it, which it does.
    // The structuredClone in the MCTS constructor should handle this.
    const bestMoveAction = await getAIMove(gameState, difficulty);
    self.postMessage({ type: 'MOVE_CALCULATED', move: bestMoveAction });
  } catch (error) {
    console.error('AI Worker Error in ai.worker.ts:', error);
    self.postMessage({ type: 'ERROR', error: (error as Error).message });
  }
};

// Necessary to make this a module.
export {};
