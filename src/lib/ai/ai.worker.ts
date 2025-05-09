import type { GameState, PlayerId } from '../../lib/gameLogic';
import { getAIMove } from './ai-config';
import type { Action } from './mcts';

// This makes sure that all functions from gameLogic are available in the worker scope
// For a real build system (like Webpack with Next.js), direct imports might work if configured correctly for workers.
// However, for simplicity and to ensure it works in various environments, explicitly including them or using a bundler is key.
// For now, we rely on the bundler to make getAIMove and its dependencies available.

self.onmessage = async (event: MessageEvent<{ gameState: GameState; difficulty: 'easy' | 'medium' | 'hard' }>) => {
  const { gameState, difficulty } = event.data;
  
  try {
    const bestMoveAction = await getAIMove(gameState, difficulty);
    self.postMessage({ type: 'MOVE_CALCULATED', move: bestMoveAction });
  } catch (error) {
    console.error('AI Worker Error:', error);
    self.postMessage({ type: 'ERROR', error: (error as Error).message });
  }
};

// Necessary to make this a module.
export {};
