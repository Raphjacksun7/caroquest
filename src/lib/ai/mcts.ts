/**
 * Monte Carlo Tree Search (MCTS) for CaroQuest
 * 
 * FIXED VERSION with correct perspective handling and tactical play
 * 
 * Key game rules:
 * - Player 1 plays on LIGHT squares, Player 2 plays on DARK squares
 * - Win by forming 4 pawns in a DIAGONAL on your assigned color
 * - Blocked pawns (sandwiched) don't count for winning
 */

import type { GameState, PlayerId } from "../gameLogic";
import {
  isValidPlacement,
  getValidMoveDestinations,
  placePawn,
  movePawn,
  cloneGameState,
  BOARD_SIZE,
} from "../gameLogic";

// ============================================================================
// Types
// ============================================================================

export interface Action {
  type: "place" | "move" | "none";
  squareIndex?: number;
  fromIndex?: number;
  toIndex?: number;
}

interface MCTSConfig {
  iterations: number;
  explorationConstant: number;
  simulationDepth: number;
  timeLimit: number;
}

const DIFFICULTY_CONFIGS: Record<string, MCTSConfig> = {
  easy: { iterations: 200, explorationConstant: 2.0, simulationDepth: 15, timeLimit: 300 },
  medium: { iterations: 1000, explorationConstant: 1.414, simulationDepth: 30, timeLimit: 800 },
  hard: { iterations: 3000, explorationConstant: 1.414, simulationDepth: 50, timeLimit: 1500 },
  expert: { iterations: 8000, explorationConstant: 1.2, simulationDepth: 80, timeLimit: 3000 },
};

// ============================================================================
// Tactical Analysis (Priority 1: Check immediate wins/blocks)
// ============================================================================

class TacticalAnalyzer {
  /**
   * Find immediate winning move for player
   */
  static findWinningMove(state: GameState, playerId: PlayerId): Action | null {
    const actions = this.getAllActions(state, playerId);
    
    for (const action of actions) {
      const newState = this.applyAction(state, action, playerId);
      if (newState && newState.winner === playerId) {
        return action;
      }
    }
    return null;
  }

  /**
   * Find blocking move (opponent would win if we don't block)
   */
  static findBlockingMove(state: GameState, playerId: PlayerId): Action | null {
    const opponentId = playerId === 1 ? 2 : 1;
    
    // Simulate opponent's turn and check if they can win
    const opponentActions = this.getAllActions(state, opponentId);
    const threateningMoves: number[] = [];
    
    for (const action of opponentActions) {
      // Temporarily give opponent a turn
      const simState = cloneGameState(state);
      simState.currentPlayerId = opponentId;
      const newState = this.applyAction(simState, action, opponentId);
      
      if (newState && newState.winner === opponentId) {
        // This is a threatening position - we need to block or disrupt
        if (action.type === "place" && action.squareIndex !== undefined) {
          threateningMoves.push(action.squareIndex);
        }
        if (action.type === "move" && action.toIndex !== undefined) {
          threateningMoves.push(action.toIndex);
        }
      }
    }
    
    if (threateningMoves.length === 0) return null;
    
    // Find actions that disrupt the threat
    const myActions = this.getAllActions(state, playerId);
    
    // First, try moves that directly occupy threatening squares (on our color)
    for (const action of myActions) {
      const targetSquare = action.type === "place" ? action.squareIndex : action.toIndex;
      if (targetSquare === undefined) continue;
      
      // Check if this move blocks or disrupts opponent's win
      const newState = this.applyAction(state, action, playerId);
      if (!newState) continue;
      
      // After our move, can opponent still win immediately?
      const oppActionsAfter = this.getAllActions(newState, opponentId);
      let canOppWin = false;
      
      for (const oppAction of oppActionsAfter) {
        const simState = cloneGameState(newState);
        simState.currentPlayerId = opponentId;
        const afterOpp = this.applyAction(simState, oppAction, opponentId);
        if (afterOpp && afterOpp.winner === opponentId) {
          canOppWin = true;
          break;
        }
      }
      
      if (!canOppWin) {
        return action; // This move blocks the threat
      }
    }
    
    return null;
  }

  /**
   * Get all valid actions for a player
   */
  static getAllActions(state: GameState, playerId: PlayerId): Action[] {
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
        if (square.pawn?.playerId === playerId) {
          const destinations = getValidMoveDestinations(state, fromIdx);
          for (const toIdx of destinations) {
            actions.push({ type: "move", fromIndex: fromIdx, toIndex: toIdx });
          }
        }
      }
    }
    
    return actions;
  }

  /**
   * Apply action to state
   */
  static applyAction(state: GameState, action: Action, playerId: PlayerId): GameState | null {
    const cloned = cloneGameState(state);
    cloned.currentPlayerId = playerId;
    
    if (action.type === "place" && action.squareIndex !== undefined) {
      return placePawn(cloned, action.squareIndex, playerId);
    }
    if (action.type === "move" && action.fromIndex !== undefined && action.toIndex !== undefined) {
      return movePawn(cloned, action.fromIndex, action.toIndex, playerId);
    }
    return null;
  }
}

// ============================================================================
// MCTS Node - Fixed perspective tracking
// ============================================================================

class MCTSNode {
  state: GameState;
  parent: MCTSNode | null;
  action: Action | null;
  children: MCTSNode[] = [];
  visits: number = 0;
  totalValue: number = 0; // Sum of values from ROOT player's perspective
  untriedActions: Action[];
  playerWhoMadeMove: PlayerId | null; // The player who took the action to reach this node

  constructor(
    state: GameState, 
    parent: MCTSNode | null = null, 
    action: Action | null = null,
    playerWhoMadeMove: PlayerId | null = null
  ) {
    this.state = state;
    this.parent = parent;
    this.action = action;
    this.playerWhoMadeMove = playerWhoMadeMove;
    this.untriedActions = this.getValidActions();
  }

  /**
   * Get all valid actions with simple heuristic ordering
   */
  private getValidActions(): Action[] {
    const playerId = this.state.currentPlayerId;
    
    if (this.state.winner !== null) return [];
    
    const actions = TacticalAnalyzer.getAllActions(this.state, playerId);
    
    // Simple heuristic ordering: center/diagonal squares first
    if (this.state.gamePhase === "placement") {
      actions.sort((a, b) => {
        const scoreA = this.quickScore(a.squareIndex!);
        const scoreB = this.quickScore(b.squareIndex!);
        return scoreB - scoreA;
      });
    }
    
    return actions;
  }

  /**
   * Quick positional score for ordering
   */
  private quickScore(idx: number): number {
    const row = Math.floor(idx / 8);
    const col = idx % 8;
    
    // Prefer center and diagonal positions
    const centerDist = Math.abs(row - 3.5) + Math.abs(col - 3.5);
    const onDiagonal = row === col || row === 7 - col;
    
    return (onDiagonal ? 3 : 0) - centerDist * 0.5;
  }

  /**
   * UCB1 value - ALWAYS from root player's perspective
   */
  ucb1(explorationConstant: number): number {
    if (this.visits === 0) return Infinity;
    
    const exploitation = this.totalValue / this.visits;
    const exploration = explorationConstant * Math.sqrt(Math.log(this.parent!.visits) / this.visits);
    
    return exploitation + exploration;
  }

  /**
   * Select best child using UCB1
   */
  selectChild(explorationConstant: number): MCTSNode | null {
    let bestChild: MCTSNode | null = null;
    let bestScore = -Infinity;
    
    for (const child of this.children) {
      const score = child.ucb1(explorationConstant);
      if (score > bestScore) {
        bestScore = score;
        bestChild = child;
      }
    }
    
    return bestChild;
  }

  /**
   * Expand node by adding a child for an untried action
   */
  expand(): MCTSNode | null {
    if (this.untriedActions.length === 0) return null;
    
    const action = this.untriedActions.shift()!;
    const currentPlayer = this.state.currentPlayerId;
    const newState = TacticalAnalyzer.applyAction(this.state, action, currentPlayer);
    
    if (!newState) {
      return this.untriedActions.length > 0 ? this.expand() : null;
    }
    
    const child = new MCTSNode(newState, this, action, currentPlayer);
    this.children.push(child);
    return child;
  }

  /**
   * Simulate random playout - returns value from specified player's perspective
   */
  simulate(maxDepth: number, rootPlayerId: PlayerId): number {
    let state = cloneGameState(this.state);
    let depth = 0;
    
    while (state.winner === null && depth < maxDepth) {
      const actions = TacticalAnalyzer.getAllActions(state, state.currentPlayerId);
      if (actions.length === 0) break;
      
      // PURE RANDOM for exploration (this is key for MCTS!)
      const chosenAction = actions[Math.floor(Math.random() * actions.length)];
      const newState = TacticalAnalyzer.applyAction(state, chosenAction, state.currentPlayerId);
      
      if (!newState) break;
      state = newState;
      depth++;
    }
    
    // Return result from ROOT player's perspective (CRITICAL FIX!)
    if (state.winner === rootPlayerId) return 1.0;
    if (state.winner !== null) return 0.0;
    
    // Heuristic for non-terminal: evaluate from root player's perspective
    return this.evaluateForPlayer(state, rootPlayerId);
  }

  /**
   * Evaluate position for specific player
   */
  private evaluateForPlayer(state: GameState, playerId: PlayerId): number {
    const opponentId = playerId === 1 ? 2 : 1;
    
    // Count diagonal threats
    const myThreats = this.countThreats(state, playerId);
    const oppThreats = this.countThreats(state, opponentId);
    
    // Count active (non-blocked) pawns
    let myActive = 0, oppActive = 0;
    for (let i = 0; i < 64; i++) {
      const pawn = state.board[i].pawn;
      if (pawn && !state.blockedPawnsInfo.has(i)) {
        if (pawn.playerId === playerId) myActive++;
        else oppActive++;
      }
    }
    
    // Scoring
    let score = 0.5;
    score += myThreats * 0.1;
    score -= oppThreats * 0.15; // Opponent threats more dangerous
    score += (myActive - oppActive) * 0.02;
    
    return Math.max(0.1, Math.min(0.9, score));
  }

  /**
   * Count potential winning diagonals (threats)
   */
  private countThreats(state: GameState, playerId: PlayerId): number {
    let threats = 0;
    const myColor = state.playerColors[playerId];
    
    const directions = [{ dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
    
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const startIdx = row * BOARD_SIZE + col;
        if (state.board[startIdx].boardColor !== myColor) continue;
        
        for (const dir of directions) {
          let myPawns = 0;
          let empty = 0;
          let valid = true;
          
          for (let step = 0; step < 4; step++) {
            const r = row + dir.dr * step;
            const c = col + dir.dc * step;
            
            if (r < 0 || r >= 8 || c < 0 || c >= 8) { valid = false; break; }
            
            const idx = r * BOARD_SIZE + c;
            const sq = state.board[idx];
            
            if (sq.boardColor !== myColor) { valid = false; break; }
            
            const pawn = sq.pawn;
            if (pawn?.playerId === playerId && !state.blockedPawnsInfo.has(idx)) {
              myPawns++;
            } else if (!pawn) {
              empty++;
            } else {
              valid = false; break;
            }
          }
          
          // 2+ pawns with room to complete = threat
          if (valid && myPawns >= 2 && myPawns + empty === 4) {
            threats += myPawns - 1; // 3 pawns = stronger threat
          }
        }
      }
    }
    
    return threats;
  }

  /**
   * Backpropagate - values are ALREADY from root player's perspective
   */
  backpropagate(value: number): void {
    let node: MCTSNode | null = this;
    
    while (node) {
      node.visits++;
      node.totalValue += value;
      node = node.parent;
    }
  }

  isTerminal(): boolean {
    return this.state.winner !== null;
  }

  isFullyExpanded(): boolean {
    return this.untriedActions.length === 0;
  }
}

// ============================================================================
// MCTS Main Class
// ============================================================================

export class MCTS {
  private config: MCTSConfig;
  private aiPlayerId: PlayerId;

  constructor(difficulty: string = "medium", aiPlayerId: PlayerId = 2) {
    this.config = DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS.medium;
    this.aiPlayerId = aiPlayerId;
  }

  /**
   * Find the best action using tactical analysis + MCTS
   */
  findBestAction(state: GameState): Action | null {
    // Validate it's AI's turn
    if (state.currentPlayerId !== this.aiPlayerId) {
      console.error(`MCTS: Not AI's turn. Current: ${state.currentPlayerId}, AI: ${this.aiPlayerId}`);
      return null;
    }

    if (state.winner !== null) {
      return null;
    }

    // ========================================
    // PRIORITY 1: Immediate tactical moves
    // ========================================
    
    // Check for winning move
    const winningMove = TacticalAnalyzer.findWinningMove(state, this.aiPlayerId);
    if (winningMove) {
      console.log("MCTS: Found immediate winning move!");
      return winningMove;
    }
    
    // Check for blocking move
    const blockingMove = TacticalAnalyzer.findBlockingMove(state, this.aiPlayerId);
    if (blockingMove) {
      console.log("MCTS: Found blocking move!");
      return blockingMove;
    }

    // ========================================
    // PRIORITY 2: MCTS for positional play
    // ========================================
    
    const rootNode = new MCTSNode(cloneGameState(state));
    
    if (rootNode.untriedActions.length === 0) {
      return null;
    }
    
    if (rootNode.untriedActions.length === 1) {
      return rootNode.untriedActions[0];
    }

    const startTime = Date.now();
    let iterations = 0;

    // Main MCTS loop
    while (iterations < this.config.iterations && 
           (Date.now() - startTime) < this.config.timeLimit) {
      
      // 1. Selection
      let node = rootNode;
      while (node.isFullyExpanded() && node.children.length > 0 && !node.isTerminal()) {
        const selected = node.selectChild(this.config.explorationConstant);
        if (!selected) break;
        node = selected;
      }

      // 2. Expansion
      if (!node.isTerminal() && !node.isFullyExpanded()) {
        const expanded = node.expand();
        if (expanded) node = expanded;
      }

      // 3. Simulation - ALWAYS from AI's perspective
      const result = node.simulate(this.config.simulationDepth, this.aiPlayerId);

      // 4. Backpropagation
      node.backpropagate(result);

      iterations++;
    }

    // Select best action: highest visit count (most robust choice)
    let bestChild: MCTSNode | null = null;
    let bestVisits = -1;

    for (const child of rootNode.children) {
      if (child.visits > bestVisits) {
        bestVisits = child.visits;
        bestChild = child;
      }
    }

    if (bestChild?.action && bestChild.action.type !== "none") {
      const winRate = bestChild.visits > 0 
        ? (bestChild.totalValue / bestChild.visits * 100).toFixed(1) 
        : "0";
      console.log(`MCTS: Action with ${winRate}% win rate, ${bestChild.visits} visits, ${iterations} iters, ${Date.now() - startTime}ms`);
      return bestChild.action;
    }

    // Fallback
    if (rootNode.untriedActions.length > 0) {
      return rootNode.untriedActions[0];
    }

    return null;
  }
}

/**
 * Create MCTS instance - exported for worker
 */
export function createMCTS(difficulty: string = "medium", aiPlayerId: PlayerId = 2): MCTS {
  return new MCTS(difficulty, aiPlayerId);
}

/**
 * Wrapper function for backward compatibility
 */
export function createAI(difficulty: string = "medium", aiPlayerId: PlayerId = 2) {
  const mcts = new MCTS(difficulty, aiPlayerId);
  return {
    findBestAction: (state: GameState) => mcts.findBestAction(state),
  };
}
