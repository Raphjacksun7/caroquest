import type { GameState, PlayerId } from '../../lib/gameLogic';
import { 
  placePawn, 
  movePawn, 
  isValidPlacement, 
  isValidMove, 
  getValidMoveDestinations,
  checkWinCondition,
  updateBlockingStatus,
  updateDeadZones
} from '../../lib/gameLogic';
import type { AIConfigFeatures } from './ai-config'; // For simulationDepth and other AI params

export interface Action {
  type: 'place' | 'move';
  index?: number; // For placement
  fromIndex?: number; // For movement
  toIndex?: number;   // For movement
}

interface MCTSNode {
  state: GameState;
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number; // Wins from the perspective of the player whose turn it is at this node's state
  untriedActions: Action[];
  actionThatLedToThisNode: Action | null; // Action taken by parent to reach this node
  playerWhoseTurnItIs: PlayerId; // Player to move from this state
}

export class MCTS {
  private root: MCTSNode;
  private iterations: number;
  private explorationWeight: number;
  private aiPlayerId: PlayerId; // The ID of the AI player itself
  private simulationDepth: number;

  constructor(initialState: GameState, aiPlayerId: PlayerId, config: AIConfigFeatures) {
    this.aiPlayerId = aiPlayerId;
    this.root = {
      state: structuredClone(initialState), // Ensure deep clone
      parent: null,
      children: [],
      visits: 0,
      wins: 0,
      untriedActions: this.getLegalActions(initialState),
      actionThatLedToThisNode: null,
      playerWhoseTurnItIs: initialState.currentPlayerId,
    };
    this.iterations = config.iterations;
    this.explorationWeight = config.exploration;
    this.simulationDepth = config.simulationDepth;
  }

  public findBestAction(): Action | null {
    if (this.root.untriedActions.length === 0 && this.root.children.length === 0) {
        // No possible moves from the root state
        return null;
    }

    for (let i = 0; i < this.iterations; i++) {
      let node = this.select(this.root);
      if (!node) continue; // Should not happen if root has moves/children

      if (!this.isTerminal(node.state) && node.untriedActions.length > 0) {
        node = this.expand(node);
      }
      
      const reward = this.simulate(node);
      this.backpropagate(node, reward);
    }
    
    const bestChildNode = this.bestChild(this.root, false); // false for exploitation (final move selection)
    return bestChildNode ? bestChildNode.actionThatLedToThisNode : null;
  }

  private select(node: MCTSNode): MCTSNode {
    let currentNode = node;
    while (!this.isTerminal(currentNode.state)) {
      if (currentNode.untriedActions.length > 0) {
        return currentNode; // Ready for expansion
      }
      if (currentNode.children.length === 0) {
        return currentNode; // Terminal or no children to select, simulate from here
      }
      currentNode = this.bestChild(currentNode, true); // true for exploration
    }
    return currentNode; // Terminal node
  }

  private expand(node: MCTSNode): MCTSNode {
    const actionIndex = Math.floor(Math.random() * node.untriedActions.length);
    const action = node.untriedActions.splice(actionIndex, 1)[0];
    
    const newStateAttempt = this.applyAction(structuredClone(node.state), action);
    if (!newStateAttempt) { 
        // This should ideally not happen if getLegalActions is correct,
        // but as a fallback, remove the invalid action and try to expand another.
        if(node.untriedActions.length > 0) return this.expand(node);
        return node; // No more actions to expand
    }
    const newState = newStateAttempt;

    const childNode: MCTSNode = {
      state: newState,
      parent: node,
      children: [],
      visits: 0,
      wins: 0,
      untriedActions: this.getLegalActions(newState),
      actionThatLedToThisNode: action,
      playerWhoseTurnItIs: newState.currentPlayerId,
    };
    node.children.push(childNode);
    return childNode;
  }

  private simulate(nodeToSimulateFrom: MCTSNode): number {
    let currentState = structuredClone(nodeToSimulateFrom.state);
    let depth = 0;

    while (!this.isTerminal(currentState) && depth < this.simulationDepth) {
      const actions = this.getLegalActions(currentState);
      if (actions.length === 0) break; // No moves possible
      
      const action = this.heuristicSelect(currentState, actions); // Use heuristic
      const nextStateAttempt = this.applyAction(currentState, action);
      if(!nextStateAttempt) break; // Invalid move from heuristic, should not happen ideally
      currentState = nextStateAttempt;
      depth++;
    }
    // Result from the perspective of the player whose turn it was AT THE START of the simulation from this node
    return this.getResult(currentState, nodeToSimulateFrom.playerWhoseTurnItIs);
  }
  
  private heuristicSelect(state: GameState, actions: Action[]): Action {
    if (actions.length === 0) throw new Error("No actions to select from in heuristicSelect");
    // Prioritize moves that create threats or block opponents
    const scoredActions = actions.map(action => ({
      action,
      score: this.evaluateAction(state, action)
    }));
    
    const maxScore = Math.max(...scoredActions.map(m => m.score));
    const bestActions = scoredActions.filter(m => m.score === maxScore);
    return bestActions[Math.floor(Math.random() * bestActions.length)].action;
  }

  private evaluateAction(state: GameState, action: Action): number {
    let score = Math.random() * 0.1; // Small random factor to break ties
    const tempState = this.applyAction(structuredClone(state), action);
    if (!tempState) return -Infinity; // Invalid action

    // 1. Check if action creates a winning condition
    if (tempState.winner === state.currentPlayerId) return Infinity;
    if (tempState.winner && tempState.winner !== state.currentPlayerId) score -= 1000; // Opponent wins
    
    // Evaluate based on board control, threats, etc.
    // This is a placeholder; more sophisticated evaluation needed for stronger AI
    score += (tempState.deadZoneSquares.size - state.deadZoneSquares.size) * 10;
    score += (tempState.blockedPawnsInfo.size - state.blockedPawnsInfo.size) * 5;
    
    if (action.type === 'move' && action.toIndex !== undefined) {
        const [row, col] = [Math.floor(action.toIndex / 8), action.toIndex % 8];
        const centrality = (3.5 - Math.abs(3.5 - row)) + (3.5 - Math.abs(3.5 - col));
        score += centrality;
    } else if (action.type === 'place' && action.index !== undefined) {
        const [row, col] = [Math.floor(action.index / 8), action.index % 8];
        const centrality = (3.5 - Math.abs(3.5 - row)) + (3.5 - Math.abs(3.5 - col));
        score += centrality;
    }

    return score;
  }


  private backpropagate(node: MCTSNode, rewardForNodePlayer: number): void {
    let currentNode: MCTSNode | null = node;
    let reward = rewardForNodePlayer;

    while (currentNode) {
      currentNode.visits++;
      currentNode.wins += reward;
      reward = 1 - reward; // Invert reward for the parent (opponent's turn)
      currentNode = currentNode.parent;
    }
  }

  private bestChild(node: MCTSNode, isExploration: boolean): MCTSNode | null {
    if (node.children.length === 0) return null;

    return node.children.reduce((bestNode, child) => {
      if (!bestNode) return child; // First child is best so far

      let childScore;
      if (isExploration) {
        if (child.visits === 0) return child; // Prioritize unvisited children for exploration
        childScore = (child.wins / child.visits) + 
                       this.explorationWeight * Math.sqrt(Math.log(node.visits) / child.visits);
      } else {
        // For final selection, pick child with highest win rate (or visits if win rates are similar)
        childScore = child.visits > 0 ? child.wins / child.visits : -Infinity;
      }

      let bestNodeScore;
       if (isExploration) {
        if (bestNode.visits === 0 && child.visits > 0) return child; // If best was unvisited, but child is visited, keep best
        if (bestNode.visits === 0 && child.visits === 0) return Math.random() < 0.5 ? bestNode : child; // Both unvisited, pick randomly for exploration
        
        bestNodeScore = (bestNode.wins / bestNode.visits) + 
                        this.explorationWeight * Math.sqrt(Math.log(node.visits) / bestNode.visits);
      } else {
        bestNodeScore = bestNode.visits > 0 ? bestNode.wins / bestNode.visits : -Infinity;
      }

      return childScore > bestNodeScore ? child : bestNode;
    }, node.children[0]);
  }

  private getLegalActions(state: GameState): Action[] {
    const actions: Action[] = [];
    const playerId = state.currentPlayerId;

    if (state.gamePhase === 'placement') {
      for (let i = 0; i < state.board.length; i++) {
        if (isValidPlacement(i, playerId, state)) {
          actions.push({ type: 'place', index: i });
        }
      }
    } else { // Movement phase
      for (let fromIdx = 0; fromIdx < state.board.length; fromIdx++) {
        const square = state.board[fromIdx];
        if (square.pawn?.playerId === playerId && !state.blockedPawnsInfo.has(fromIdx)) {
          const validMoves = getValidMoveDestinations(fromIdx, playerId, state);
          for (const toIdx of validMoves) {
            actions.push({ type: 'move', fromIndex: fromIdx, toIndex: toIdx });
          }
        }
      }
    }
    return actions;
  }

  private applyAction(state: GameState, action: Action): GameState | null {
    if (action.type === 'place' && action.index !== undefined) {
      return placePawn(state, action.index);
    } else if (action.type === 'move' && action.fromIndex !== undefined && action.toIndex !== undefined) {
      return movePawn(state, action.fromIndex, action.toIndex);
    }
    return null; // Should not happen if actions are generated correctly
  }

  private isTerminal(state: GameState): boolean {
    const winInfo = checkWinCondition(state);
    if (winInfo.winner) return true;
    
    // Check if no more moves are possible (e.g., all pawns placed and no valid moves)
    if (state.gamePhase === 'placement' && state.pawnsToPlace[1] === 0 && state.pawnsToPlace[2] === 0) {
       // If just switched to movement and no moves, it's terminal (stalemate or win should be caught by checkWinCondition)
       // This check is more about if placement is done for both.
    }
    if (state.gamePhase === 'movement' && this.getLegalActions(state).length === 0) return true;

    return false;
  }

  private getResult(state: GameState, perspectivePlayer: PlayerId): number {
    const winInfo = checkWinCondition(state); // Recalculate based on final simulated state
    if (winInfo.winner) {
      return winInfo.winner === perspectivePlayer ? 1.0 : 0.0; // Win or Loss
    }
    return 0.5; // Draw or ongoing (but simulation depth might limit this)
  }
}
