/**
 * MCTS AI Module - Fallback for when Web Worker is unavailable
 * 
 * This provides a synchronous fallback implementation that matches
 * the web worker interface for strategy-based AI.
 */

import type { GameState, PlayerId, AIStrategy } from "@/lib/types";
import {
  isValidPlacement,
  getValidMoveDestinations,
  placePawn,
  movePawn,
  cloneGameState,
} from "../gameLogic";

export interface Action {
  type: "place" | "move" | "none";
  squareIndex?: number;
  fromIndex?: number;
  toIndex?: number;
}

const STRATEGY_CONFIGS = {
  normal: {
    iterations: 500, // Reduced for synchronous fallback
    explorationConstant: 1.414,
    simulationDepth: 20,
    myThreatWeight: 0.10,
    oppThreatWeight: 0.12,
  },
  aggressive: {
    iterations: 600,
    explorationConstant: 1.2,
    simulationDepth: 25,
    myThreatWeight: 0.05,
    oppThreatWeight: 0.22,
  }
};

/**
 * Get all valid actions for a player
 */
function getAllActions(state: GameState, playerId: PlayerId): Action[] {
  const actions: Action[] = [];
  
  if (state.winner !== null) return actions;
  
  if (state.gamePhase === "placement") {
    for (let i = 0; i < 64; i++) {
      if (isValidPlacement(state, i, playerId)) {
        actions.push({ type: "place", squareIndex: i, toIndex: i });
      }
    }
  } else {
    for (let fromIdx = 0; fromIdx < 64; fromIdx++) {
      const square = state.board[fromIdx];
      if (square.pawn?.playerId === playerId && !state.blockedPawnsInfo.has(fromIdx)) {
        const destinations = getValidMoveDestinations(state, fromIdx, playerId);
        for (const toIdx of destinations) {
          actions.push({ type: "move", fromIndex: fromIdx, toIndex: toIdx });
        }
      }
    }
  }
  
  return actions;
}

/**
 * Apply an action to the game state
 */
function applyAction(state: GameState, action: Action, playerId: PlayerId): GameState | null {
  const cloned = cloneGameState(state);
  
  if (action.type === "place" && action.squareIndex !== undefined) {
    return placePawn(cloned, action.squareIndex, playerId);
  }
  if (action.type === "move" && action.fromIndex !== undefined && action.toIndex !== undefined) {
    return movePawn(cloned, action.fromIndex, action.toIndex, playerId);
  }
  return null;
}

/**
 * Find an immediate winning move
 */
function findWinningMove(state: GameState, playerId: PlayerId): Action | null {
  const actions = getAllActions(state, playerId);
  
  for (const action of actions) {
    const newState = applyAction(state, action, playerId);
    if (newState && newState.winner === playerId) {
      return action;
    }
  }
  return null;
}

/**
 * Find a move that blocks opponent's immediate win
 */
function findBlockingMove(state: GameState, playerId: PlayerId): Action | null {
  const opponentId = playerId === 1 ? 2 : 1;
  const opponentActions = getAllActions(state, opponentId);
  
  // Check if opponent can win
  for (const oppAction of opponentActions) {
    const simState = cloneGameState(state);
    simState.currentPlayerId = opponentId;
    const newState = applyAction(simState, oppAction, opponentId);
    if (newState && newState.winner === opponentId) {
      // Opponent can win - find our blocking move
      const myActions = getAllActions(state, playerId);
      for (const action of myActions) {
        const afterMyMove = applyAction(state, action, playerId);
        if (!afterMyMove) continue;
        
        // Check if opponent can still win after our move
        let canOppWin = false;
        const oppActionsAfter = getAllActions(afterMyMove, opponentId);
        for (const oppA of oppActionsAfter) {
          const simState2 = cloneGameState(afterMyMove);
          simState2.currentPlayerId = opponentId;
          const afterOpp = applyAction(simState2, oppA, opponentId);
          if (afterOpp && afterOpp.winner === opponentId) {
            canOppWin = true;
            break;
          }
        }
        
        if (!canOppWin) {
          return action;
        }
      }
    }
  }
  return null;
}

/**
 * Simple scoring for moves based on strategy
 */
function scoreMove(state: GameState, action: Action, playerId: PlayerId, config: typeof STRATEGY_CONFIGS.normal): number {
  const newState = applyAction(state, action, playerId);
  if (!newState) return -1000;
  
  if (newState.winner === playerId) return 1000;
  
  let score = 0;
  const opponentId = playerId === 1 ? 2 : 1;
  
  // Count blocked opponent pawns (good for us)
  const oppBlocked = Array.from(newState.blockedPawnsInfo).filter(
    idx => newState.board[idx].pawn?.playerId === opponentId
  ).length;
  score += oppBlocked * 10 * config.oppThreatWeight;
  
  // Penalize our blocked pawns
  const myBlocked = Array.from(newState.blockedPawnsInfo).filter(
    idx => newState.board[idx].pawn?.playerId === playerId
  ).length;
  score -= myBlocked * 10 * config.myThreatWeight;
  
  // Add some randomness for variety
  score += Math.random() * 2;
  
  return score;
}

/**
 * MCTS class for synchronous fallback
 */
export class MCTS {
  private strategy: AIStrategy;
  private playerId: PlayerId;
  private config: typeof STRATEGY_CONFIGS.normal;
  
  constructor(strategy: AIStrategy, playerId: PlayerId) {
    this.strategy = strategy;
    this.playerId = playerId;
    this.config = STRATEGY_CONFIGS[strategy] || STRATEGY_CONFIGS.normal;
  }
  
  findBestAction(state: GameState): Action | null {
    if (state.currentPlayerId !== this.playerId) {
      return null;
    }
    
    if (state.winner !== null) {
      return null;
    }
    
    // Priority 1: Immediate win
    const winningMove = findWinningMove(state, this.playerId);
    if (winningMove) {
      console.log("MCTS Fallback: Found winning move");
      return winningMove;
    }
    
    // Priority 2: Block opponent win
    const blockingMove = findBlockingMove(state, this.playerId);
    if (blockingMove) {
      console.log("MCTS Fallback: Found blocking move");
      return blockingMove;
    }
    
    // Priority 3: Score-based selection
    const actions = getAllActions(state, this.playerId);
    if (actions.length === 0) return null;
    if (actions.length === 1) return actions[0];
    
    // Score all moves
    const scoredActions = actions.map(action => ({
      action,
      score: scoreMove(state, action, this.playerId, this.config)
    }));
    
    scoredActions.sort((a, b) => b.score - a.score);
    
    console.log(`MCTS Fallback [${this.strategy}]: Selected move with score ${scoredActions[0].score.toFixed(2)}`);
    return scoredActions[0].action;
  }
}

/**
 * Factory function for creating MCTS instance
 */
export function createMCTS(strategy: AIStrategy | string, playerId: PlayerId): MCTS {
  // Handle legacy difficulty values by mapping to strategies
  const strategyMap: Record<string, AIStrategy> = {
    'easy': 'normal',
    'medium': 'normal',
    'hard': 'aggressive',
    'expert': 'aggressive',
    'normal': 'normal',
    'aggressive': 'aggressive',
  };
  
  const mappedStrategy = strategyMap[strategy] || 'normal';
  return new MCTS(mappedStrategy, playerId);
}
