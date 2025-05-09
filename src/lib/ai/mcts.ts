
import type { GameState, PlayerId } from '../../lib/gameLogic';
import { 
  placePawn as applyPlacePawn, 
  movePawn as applyMovePawn, 
  isValidPlacement, 
  getValidMoveDestinations,
  checkWinCondition // For isTerminal and getReward
} from '../../gameLogic';
import type { AIConfigFeatures } from './ai-config';

// Define Action interface locally if not already defined globally or in types.ts
export interface Action {
  type: 'place' | 'move' | 'none'; // 'none' for cases where no move is possible
  index?: number; // For placement
  fromIndex?: number; // For movement
  toIndex?: number;   // For movement
}

export class MCTSNode {
  state: GameState;
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number; // Wins from the perspective of the player whose turn it is at this node's state
  untriedActions: Action[];
  actionThatLedToThisNode: Action | null;
  playerWhoseTurnItIs: PlayerId; // Player to move from this state

  constructor(state: GameState, parent: MCTSNode | null = null, action: Action | null = null) {
    this.state = state; // Should be a deep clone if state is mutable
    this.parent = parent;
    this.actionThatLedToThisNode = action;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    this.playerWhoseTurnItIs = state.currentPlayerId;
    this.untriedActions = this.getValidActions(state);
  }

  getValidActions(state: GameState): Action[] {
    const actions: Action[] = [];
    const playerId = state.currentPlayerId;

    if (state.gamePhase === 'placement') {
      for (let i = 0; i < state.board.length; i++) {
        if (isValidPlacement(i, playerId, state)) {
          actions.push({ type: 'place', index: i });
        }
      }
    } else { // 'movement'
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
    if (actions.length === 0 && !this.isTerminal(state)) {
        // If no actions but not terminal, could be a pass turn scenario (though not in this game)
        // For now, consider it as no valid moves.
    }
    return actions;
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
  
  isTerminal(state: GameState): boolean {
    return state.winner !== null || 
           (state.gamePhase === 'movement' && this.getValidActions(state).length === 0); // No moves left
  }

  getReward(state: GameState): number { // Reward from perspective of playerWhoseTurnItIs for THIS node
    if (state.winner === this.playerWhoseTurnItIs) return 1.0; // Current node's player won
    if (state.winner !== null && state.winner !== this.playerWhoseTurnItIs) return 0.0; // Current node's player lost
    return 0.5; // Draw or game still ongoing at max depth
  }

  // Enhanced Rollout with Heuristics
  enhancedRollout(maxDepth: number): number {
    let currentState = structuredClone(this.state);
    let depth = 0;
    
    while (!this.isTerminal(currentState) && depth < maxDepth) {
      const actions = this.getValidActions(currentState);
      if (actions.length === 0) break;

      const scoredActions = actions.map(action => ({
        action,
        score: this.evaluateAction(currentState, action)
      }));
      
      let chosenAction: Action;
      if (Math.random() < 0.7 && scoredActions.some(sa => sa.score > -Infinity)) { // 70% chance to pick heuristically best
        const bestScore = Math.max(...scoredActions.map(a => a.score));
        const bestActions = scoredActions.filter(a => a.score === bestScore);
        chosenAction = bestActions[Math.floor(Math.random() * bestActions.length)].action;
      } else { // 30% chance for random exploration
        chosenAction = actions[Math.floor(Math.random() * actions.length)];
      }
      
      const nextState = this.applyActionToState(currentState, chosenAction);
      if (!nextState) break; // Should not happen if getValidActions is correct
      currentState = nextState;
      depth++;
    }
    return this.getReward(currentState);
  }

  async parallelRollout(parallelCount = 4, maxDepth: number): Promise<number> {
    const results = await Promise.all(
      Array(parallelCount).fill(null).map(() => this.enhancedRollout(maxDepth))
    );
    return results.reduce((sum, val) => sum + val, 0) / results.length;
  }

  evaluateAction(state: GameState, action: Action): number {
    let score = Math.random() * 0.01; // Small random factor for tie-breaking
    const tempStatePreview = this.applyActionToState(structuredClone(state), action);
    if (!tempStatePreview) return -Infinity; // Invalid action

    // 1. Winning moves get max score
    if (tempStatePreview.winner === state.currentPlayerId) return Infinity;
    if (tempStatePreview.winner && tempStatePreview.winner !== state.currentPlayerId) score -= 1000;


    // 2. Prefer moves that create dead zones for the opponent
    const opponentId = state.currentPlayerId === 1 ? 2 : 1;
    let createdDeadZonesForOpponent = 0;
    tempStatePreview.deadZoneSquares.forEach((playerBlocking, dzIndex) => {
        if (playerBlocking === opponentId && !state.deadZoneSquares.has(dzIndex)) {
            createdDeadZonesForOpponent++;
        }
    });
    score += createdDeadZonesForOpponent * 20;

    // 3. Block opponent pawns (increase in opponent's blocked pawns)
    let newBlockedOpponentPawns = 0;
    tempStatePreview.blockedPawnsInfo.forEach(blockedPawnIdx => {
        if (tempStatePreview.board[blockedPawnIdx].pawn?.playerId === opponentId && !state.blockedPawnsInfo.has(blockedPawnIdx)) {
            newBlockedOpponentPawns++;
        }
    });
    score += newBlockedOpponentPawns * 10;
    
    // 4. Central positioning bonus
    const targetIndex = action.type === 'place' ? action.index : action.toIndex;
    if (targetIndex !== undefined) {
        const row = Math.floor(targetIndex / 8);
        const col = targetIndex % 8;
        const centrality = (3.5 - Math.abs(3.5 - row)) + (3.5 - Math.abs(3.5 - col));
        score += centrality; // Max centrality is 7
    }
    return score;
  }
}

export class MCTS {
  root: MCTSNode;
  iterations: number;
  explorationWeight: number;
  simulationDepth: number;
  difficulty: keyof AIConfigFeatures['config'];


  constructor(initialState: GameState, difficulty: keyof AIConfigFeatures['config'], config: AIConfigFeatures['config'][keyof AIConfigFeatures['config']]) {
    this.root = new MCTSNode(structuredClone(initialState));
    this.iterations = config.iterations;
    this.explorationWeight = config.exploration;
    this.simulationDepth = config.simulationDepth;
    this.difficulty = difficulty;
  }

  private getDynamicIterations(state: GameState): number {
    const base = this.iterations;
    const phaseMultiplier = state.gamePhase === 'placement' ? 1.2 : 1; // Slightly more for placement
    const complexityFactor = 1 + (state.board.filter(s => s.pawn).length / (2 * PAWNS_PER_PLAYER)); // Max 2
    return Math.round(base * phaseMultiplier * Math.min(complexityFactor, 1.5)); // Cap complexity factor
  }

  async findBestAction(): Promise<Action | null> {
    const dynamicIterations = this.getDynamicIterations(this.root.state);

    for (let i = 0; i < dynamicIterations; i++) {
      let node = this.select(this.root);
      if (!node) continue;

      if (!node.isTerminal(node.state) && node.untriedActions.length > 0) {
        const expandedNode = this.expand(node);
        if (expandedNode) node = expandedNode;
      }
      
      const reward = await node.parallelRollout(4, this.simulationDepth); // Use parallel rollout
      this.backpropagate(node, reward);
    }
    
    this.pruneTree(this.root);

    if (this.root.children.length === 0) {
        // If no children after iterations (e.g. only one move possible or terminal state)
        if (this.root.untriedActions.length > 0) return this.root.untriedActions[0]; // Should have been expanded
        const fallbackActions = this.root.getValidActions(this.root.state);
        return fallbackActions.length > 0 ? fallbackActions[0] : { type: 'none' };
    }

    return this.bestChild(this.root, false)?.actionThatLedToThisNode || null;
  }

  private select(node: MCTSNode): MCTSNode {
    let currentNode = node;
    while (!currentNode.isTerminal(currentNode.state)) {
      if (currentNode.untriedActions.length > 0) {
        return currentNode;
      }
      if (currentNode.children.length === 0) {
        return currentNode; // Should simulate from here if no children and not terminal (e.g. max depth for expansion)
      }
      currentNode = this.bestChild(currentNode, true)!; // Add ! as bestChild should not return null if children exist
      if (!currentNode) return node; // Fallback, should not happen
    }
    return currentNode;
  }

  private expand(node: MCTSNode): MCTSNode | null {
    if (node.untriedActions.length === 0) return null;

    const actionIndex = Math.floor(Math.random() * node.untriedActions.length);
    const action = node.untriedActions.splice(actionIndex, 1)[0];
    
    const newState = node.applyActionToState(node.state, action);
    if (!newState) { // If action is somehow invalid (should be caught by getValidActions)
        if(node.untriedActions.length > 0) return this.expand(node); // Try another
        return null; // No valid actions left to expand
    }

    const childNode = new MCTSNode(newState, node, action);
    node.children.push(childNode);
    return childNode;
  }

  private backpropagate(node: MCTSNode | null, rewardForNodePlayer: number): void {
    let tempNode = node;
    while (tempNode) {
      tempNode.visits++;
      // Reward is from perspective of player whose turn it is at tempNode.state
      // If the simulation reward (for tempNode.playerWhoseTurnItIs) is 1, it's a win for tempNode's player
      if (tempNode.playerWhoseTurnItIs === this.root.playerWhoseTurnItIs) { // If it's AI's turn at this node
          tempNode.wins += rewardForNodePlayer;
      } else { // If it's opponent's turn at this node
          tempNode.wins += (1 - rewardForNodePlayer); // AI wants opponent to get low reward
      }
      tempNode = tempNode.parent;
    }
  }
  
  private bestChild(node: MCTSNode, isExploration: boolean): MCTSNode | null {
    if (node.children.length === 0) return null;

    let bestNode: MCTSNode | null = null;
    let bestScore = -Infinity;
    
    // Prefer unvisited children during exploration phase of selection
    if (isExploration) {
        const unvisitedChild = node.children.find(child => child.visits === 0);
        if (unvisitedChild) return unvisitedChild;
    }

    for (const child of node.children) {
      let score;
      if (child.visits === 0) {
        // Assign a very high score to unvisited nodes if exploring, or handle if not exploring
        score = isExploration ? Infinity : -Infinity; 
      } else {
        const exploitation = child.wins / child.visits;
        if (isExploration) {
          // UCB1 with Progressive Widening
          const progressiveWideningTerm = Math.log(node.visits + 1); // Log of parent's visits
          score = exploitation + this.explorationWeight * Math.sqrt(progressiveWideningTerm / child.visits);
        } else {
          // Exploitation only for final move selection
          score = exploitation;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestNode = child;
      }
    }
    return bestNode || node.children[0]; // Fallback to first child if all scores are -Infinity
  }

  pruneTree(node: MCTSNode, keepRatio = 0.7, minChildren = 1): void {
    if (node.children.length <= minChildren) return;

    const sortedChildren = [...node.children].sort((a, b) => b.visits - a.visits);
    const keepCount = Math.max(minChildren, Math.ceil(sortedChildren.length * keepRatio));
    node.children = sortedChildren.slice(0, keepCount);
    
    // Recursively prune children
    node.children.forEach(child => this.pruneTree(child, Math.max(0.1, keepRatio * 0.9), minChildren)); // Ensure keepRatio doesn't go too low
  }
}

