
// workers/mcts-worker.js
// This is a placeholder for a more complex MCTS implementation.
// The game logic (applyAction, getValidActions, isTerminal, getResult) would need to be
// fully implemented here or passed/imported if possible in a worker context.

class MCTSNode {
  constructor(state, parent = null, action = null) {
    this.state = state; // Should be a deep copy or immutable
    this.parent = parent;
    this.action = action;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    // getValidActions needs to be a complete implementation based on your gameLogic
    this.untriedActions = this.getValidActions(state); 
  }

  // Placeholder - this needs full game logic
  getValidActions(state) {
    const actions = [];
    const playerId = state.currentPlayerId;
    const BOARD_SIZE = 8; // Assuming board size is fixed

    if (state.gamePhase === 'placement') {
      for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        const square = state.board[i];
        // Simplified validation - real validation is more complex
        if (square.boardColor === state.playerColors[playerId] && !square.pawn) {
          actions.push({ type: 'place', squareIndex: i });
        }
      }
    } else { // Movement phase
      for (let fromIdx = 0; fromIdx < BOARD_SIZE * BOARD_SIZE; fromIdx++) {
        const fromSquare = state.board[fromIdx];
        if (fromSquare.pawn?.playerId === playerId && !state.blockedPawnsInfo.has(fromIdx)) {
          for (let toIdx = 0; toIdx < BOARD_SIZE * BOARD_SIZE; toIdx++) {
            const toSquare = state.board[toIdx];
            // Simplified validation
            if (!toSquare.pawn && toSquare.boardColor === state.playerColors[playerId] && 
                !(state.deadZoneSquares.get(toIdx) === playerId)) {
              actions.push({ type: 'move', fromIndex: fromIdx, toIndex: toIdx });
            }
          }
        }
      }
    }
    return actions.filter(a => a !== null); // Filter out any nulls if logic is complex
  }

  selectChild() {
    // UCB1 formula
    const C = 1.414; 
    let bestChild = null;
    let bestUcb1 = -Infinity;

    for (const child of this.children) {
      if (child.visits === 0) return child; // Prefer unvisited children
      const ucb1 = (child.wins / child.visits) + C * Math.sqrt(Math.log(this.visits) / child.visits);
      if (ucb1 > bestUcb1) {
        bestUcb1 = ucb1;
        bestChild = child;
      }
    }
    return bestChild;
  }

  expand() {
    if (this.untriedActions.length === 0) return null; // Should not happen if selected correctly

    const actionIndex = Math.floor(Math.random() * this.untriedActions.length);
    const action = this.untriedActions.splice(actionIndex, 1)[0];
    
    // applyAction needs to be a complete implementation
    const newState = this.applyAction(JSON.parse(JSON.stringify(this.state)), action); 
    
    const childNode = new MCTSNode(newState, this, action);
    this.children.push(childNode);
    return childNode;
  }

  // Placeholder - this needs full game logic from gameLogic.ts, adapted for this context
  applyAction(state, action) {
    // This is a critical part and needs to mirror your main gameLogic's
    // placePawn and movePawn functions, including all updates to derived state
    // (blockedPawnsInfo, deadZoneSquares, deadZoneCreatorPawnsInfo, winner, etc.)
    // For this placeholder, we'll just simulate a change for structure.
    
    // Deep clone state to avoid modifying the original node's state directly
    const newState = JSON.parse(JSON.stringify(state));

    if (action.type === 'place') {
        if(newState.board[action.squareIndex]) {
            newState.board[action.squareIndex].pawn = { playerId: newState.currentPlayerId, id: 'ai_pawn', color: newState.playerColors[newState.currentPlayerId]};
            newState.pawnsToPlace[newState.currentPlayerId]--;
            newState.placedPawns[newState.currentPlayerId]++;
        }
    } else if (action.type === 'move') {
        if(newState.board[action.fromIndex] && newState.board[action.toIndex]) {
            newState.board[action.toIndex].pawn = newState.board[action.fromIndex].pawn;
            newState.board[action.fromIndex].pawn = null;
        }
    }
    
    // Simulate turn change
    newState.currentPlayerId = newState.currentPlayerId === 1 ? 2 : 1;
    
    // TODO: Recalculate winner, blocked status, dead zones, etc.
    // This is non-trivial and essential for MCTS to work correctly.
    // For now, it's a very simplified version.
    
    return newState;
  }

  rollout() {
    let currentState = JSON.parse(JSON.stringify(this.state));
    let depth = 0;
    const MAX_ROLLOUT_DEPTH = 50; // Prevent infinite loops

    while (!this.isTerminal(currentState) && depth < MAX_ROLLOUT_DEPTH) {
      const actions = this.getValidActions(currentState);
      if (actions.length === 0) break; // No valid moves, could be a draw or blocked state
      
      const action = actions[Math.floor(Math.random() * actions.length)];
      currentState = this.applyAction(currentState, action); // Apply action to a deep copy
      depth++;
    }
    return this.getResult(currentState, this.state.currentPlayerId); // Pass original player perspective
  }

  isTerminal(state) {
    // Placeholder: check for win, draw, or max depth
    return state.winner !== null; // A more robust check would include draw conditions
  }

  getResult(terminalState, perspectivePlayerId) {
    if (terminalState.winner === perspectivePlayerId) return 1; // Win for perspective player
    if (terminalState.winner !== null) return 0; // Loss for perspective player (opponent won)
    return 0.5; // Draw or undecided
  }

  backpropagate(result) {
    let node = this;
    while(node) {
        node.visits++;
        // If it's the opponent's turn in the parent node, a win for current node is a loss for parent.
        if (node.parent && node.parent.state.currentPlayerId !== node.state.currentPlayerId) {
            node.wins += (1 - result);
        } else {
            node.wins += result;
        }
        node = node.parent;
    }
  }
}

class MCTS {
  constructor(options = {}) {
    this.iterations = options.iterations || 100; // Reduced for web worker speed
    this.timeLimit = options.timeLimit || 500;  // Reduced time limit
  }
  
  findBestMove(initialState) {
    const rootNode = new MCTSNode(JSON.parse(JSON.stringify(initialState))); // Work with a copy
    const startTime = Date.now();
    
    if (rootNode.untriedActions.length === 0) {
        return null; // No possible moves
    }
    if (rootNode.untriedActions.length === 1) {
        return rootNode.untriedActions[0]; // Only one move, take it
    }

    for (let i = 0; i < this.iterations; i++) {
      if (Date.now() - startTime > this.timeLimit && i > 0) break; // Ensure at least one iteration if possible
      
      let node = rootNode;
      // Selection
      while (node.untriedActions.length === 0 && node.children.length > 0) {
        const selected = node.selectChild();
        if (!selected) { // This can happen if all children have 0 visits initially
            node = node.children[Math.floor(Math.random() * node.children.length)]; // Fallback to random
            break;
        }
        node = selected;
      }
      
      // Expansion
      if (node.untriedActions.length > 0) {
        const expandedNode = node.expand();
        if(expandedNode) node = expandedNode;
      }
      
      // Simulation
      const result = node.rollout();
      
      // Backpropagation
      node.backpropagate(result);
    }
    
    if (rootNode.children.length === 0) return null; // No moves explored

    // Select the child with the highest win rate (or most visits as fallback)
    let bestChild = rootNode.children[0];
    let maxScore = -Infinity;

    for(const child of rootNode.children) {
        const score = child.visits > 0 ? (child.wins / child.visits) : -Infinity;
        if (score > maxScore) {
            maxScore = score;
            bestChild = child;
        } else if (score === maxScore && child.visits > (bestChild.visits || 0)) {
            // Tie-breaking with visits
            bestChild = child;
        }
    }
    return bestChild.action;
  }
}

self.onmessage = function(e) {
  const { state, difficulty } = e.data;
  
  const options = {
    easy: { iterations: 50, timeLimit: 200 },
    medium: { iterations: 200, timeLimit: 500 },
    hard: { iterations: 500, timeLimit: 1000 }
  };
  
  const mcts = new MCTS(options[difficulty] || options.medium);
  try {
    const bestMove = mcts.findBestMove(state);
    self.postMessage({ move: bestMove });
  } catch (error) {
    console.error("MCTS Worker Error:", error);
    self.postMessage({ error: error.message });
  }
};
