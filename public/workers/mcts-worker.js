
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
        // Needs to check square.boardColor === state.playerColors[playerId]
        // and if square is not a dead zone for playerId, etc.
        if (square && square.boardColor === state.playerColors[playerId] && !square.pawn && !(state.deadZoneSquares.get(i) === playerId)) {
             // Add more checks from isValidPlacement from gameLogic.ts
            actions.push({ type: 'place', squareIndex: i });
        }
      }
    } else { // Movement phase
      for (let fromIdx = 0; fromIdx < BOARD_SIZE * BOARD_SIZE; fromIdx++) {
        const fromSquare = state.board[fromIdx];
        // Ensure pawn exists, belongs to current player, and is not blocked
        if (fromSquare && fromSquare.pawn?.playerId === playerId && !state.blockedPawnsInfo.has(fromIdx)) {
          for (let toIdx = 0; toIdx < BOARD_SIZE * BOARD_SIZE; toIdx++) {
            const toSquare = state.board[toIdx];
            // Simplified validation: ensure target is empty, correct color, and not a dead zone
            if (toSquare && !toSquare.pawn && toSquare.boardColor === state.playerColors[playerId] && 
                !(state.deadZoneSquares.get(toIdx) === playerId)) {
              // Add more checks from isValidMove from gameLogic.ts
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
    if (this.untriedActions.length === 0) return null;

    const actionIndex = Math.floor(Math.random() * this.untriedActions.length);
    const action = this.untriedActions.splice(actionIndex, 1)[0];
    
    const newState = this.applyAction(JSON.parse(JSON.stringify(this.state)), action); 
    
    const childNode = new MCTSNode(newState, this, action);
    this.children.push(childNode);
    return childNode;
  }

  // This applyAction needs to MIRROR your main gameLogic's placePawn and movePawn
  // including all derived state updates (blockedPawns, deadZones, winner, etc.)
  applyAction(state, action) {
    const newState = JSON.parse(JSON.stringify(state)); // Deep clone

    if (action.type === 'place') {
        if(newState.board[action.squareIndex]) {
            newState.board[action.squareIndex].pawn = { 
                id: `p${newState.currentPlayerId}_ai`, // Simplified ID for AI
                playerId: newState.currentPlayerId, 
                color: newState.playerColors[newState.currentPlayerId]
            };
            newState.pawnsToPlace[newState.currentPlayerId]--;
            newState.placedPawns[newState.currentPlayerId]++;
            if (newState.pawnsToPlace[1] === 0 && newState.pawnsToPlace[2] === 0) {
                newState.gamePhase = 'movement';
            }
        }
    } else if (action.type === 'move') {
        if(newState.board[action.fromIndex] && newState.board[action.toIndex]) {
            newState.board[action.toIndex].pawn = newState.board[action.fromIndex].pawn;
            newState.board[action.fromIndex].pawn = null;
        }
    }
    
    // Switch player
    newState.currentPlayerId = newState.currentPlayerId === 1 ? 2 : 1;

    // CRITICAL: Recalculate blockedPawns, deadZones, and winner.
    // This requires importing or re-implementing updateBlockingStatus, updateDeadZones, checkWinCondition.
    // For simplicity, this is omitted here but is ESSENTIAL for a working MCTS.
    // Example (conceptual - these functions are not defined in this worker context):
    // const { blockedPawns, blockingPawns } = updateBlockingStatus(newState.board);
    // newState.blockedPawnsInfo = blockedPawns;
    // newState.blockingPawnsInfo = blockingPawns;
    // const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newState.board, newState.playerColors);
    // newState.deadZoneSquares = deadZones;
    // newState.deadZoneCreatorPawnsInfo = deadZoneCreatorPawns;
    // const winCheck = checkWinCondition(newState);
    // newState.winner = winCheck.winner;
    // newState.winningLine = winCheck.winningLine;

    return newState;
  }

  rollout() {
    let currentState = JSON.parse(JSON.stringify(this.state));
    let depth = 0;
    const MAX_ROLLOUT_DEPTH = 50; 

    while (!this.isTerminal(currentState) && depth < MAX_ROLLOUT_DEPTH) {
      const actions = this.getValidActions(currentState);
      if (actions.length === 0) break; 
      
      const action = actions[Math.floor(Math.random() * actions.length)];
      currentState = this.applyAction(currentState, action); 
      depth++;
    }
    return this.getResult(currentState, this.state.currentPlayerId); 
  }

  isTerminal(state) {
    return state.winner !== null; 
  }

  getResult(terminalState, perspectivePlayerId) {
    if (terminalState.winner === perspectivePlayerId) return 1; 
    if (terminalState.winner !== null && terminalState.winner !== perspectivePlayerId) return 0; // Loss for perspective (opponent won)
    return 0.5; // Draw or undecided
  }

  backpropagate(result) {
    let node = this;
    while(node) {
        node.visits++;
        // Result is from the perspective of the player whose turn it was AT THE NODE BEING UPDATED.
        // If the current node's state represents a turn for the player who is perspectivePlayerId in rollout,
        // then a win (result=1) is a win.
        // If it's the opponent's turn in this node, then a win for perspectivePlayerId is a loss for this node's player.
        if (node.state.currentPlayerId === this.state.currentPlayerId) { // `this.state.currentPlayerId` is perspectivePlayerId
             node.wins += result;
        } else {
             node.wins += (1 - result);
        }
        node = node.parent;
    }
  }
}

class MCTS {
  constructor(options = {}) {
    this.iterations = options.iterations || 100; 
    this.timeLimit = options.timeLimit || 500;  
  }
  
  findBestMove(initialState) {
    const rootNode = new MCTSNode(JSON.parse(JSON.stringify(initialState))); 
    const startTime = Date.now();
    
    if (rootNode.untriedActions.length === 0) {
        return null; 
    }
    if (rootNode.untriedActions.length === 1) {
        return rootNode.untriedActions[0]; 
    }

    for (let i = 0; i < this.iterations; i++) {
      if (Date.now() - startTime > this.timeLimit && i > 0) break; 
      
      let node = rootNode;
      // Selection
      while (node.untriedActions.length === 0 && node.children.length > 0) {
        const selected = node.selectChild();
        if (!selected) { 
            node = node.children[Math.floor(Math.random() * node.children.length)]; 
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
    
    if (rootNode.children.length === 0) return null; 

    let bestChild = rootNode.children[0];
    let maxScore = -Infinity;

    for(const child of rootNode.children) {
        const score = child.visits > 0 ? (child.wins / child.visits) : -Infinity; // Win rate
        if (score > maxScore) {
            maxScore = score;
            bestChild = child;
        } else if (score === maxScore && child.visits > (bestChild.visits || 0)) {
            bestChild = child;
        }
    }
    return bestChild.action;
  }
}

self.onmessage = function(e) {
  const { state, difficulty } = e.data;
  
  // MCTS needs mutable copies of complex objects like Set and Map to be actual Set/Map instances
  // The state coming from postMessage will have these as plain objects.
  // This is a simplified conversion; a robust solution would deeply reconstruct these.
  const reconstructedState = JSON.parse(JSON.stringify(state)); // Basic deep clone
  reconstructedState.blockedPawnsInfo = new Set(Array.from(state.blockedPawnsInfo || []));
  reconstructedState.blockingPawnsInfo = new Set(Array.from(state.blockingPawnsInfo || []));
  reconstructedState.deadZoneSquares = new Map(Object.entries(state.deadZoneSquares || {}));
  reconstructedState.deadZoneCreatorPawnsInfo = new Set(Array.from(state.deadZoneCreatorPawnsInfo || []));
  
  const options = {
    easy: { iterations: 50, timeLimit: 200 },
    medium: { iterations: 200, timeLimit: 500 },
    hard: { iterations: 500, timeLimit: 1000 }
  };
  
  const mcts = new MCTS(options[difficulty] || options.medium);
  try {
    const bestMove = mcts.findBestMove(reconstructedState);
    self.postMessage({ type: 'MOVE_RESULT', move: bestMove }); // Add type for clarity
  } catch (error) {
    console.error("MCTS Worker Error:", error);
    self.postMessage({ type: 'ERROR', error: error.message });
  }
};
