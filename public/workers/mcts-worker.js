// workers/mcts-worker.js

// --- Simplified Game Logic for Worker ---
const BOARD_SIZE = 8;
// PAWNS_PER_PLAYER is part of initial state, not directly needed for action simulation by worker

function createPawn(playerId, placedCount, playerColors) {
    return {
        id: `p${playerId}_${placedCount + 1}`,
        playerId,
        color: playerColors[playerId],
    };
}

function applyActionToState(state, action) {
    const newState = JSON.parse(JSON.stringify(state)); // Deep clone
    newState.board = newState.board.map(sq => ({...sq})); // Ensure board squares are new objects

    // Re-initialize Sets and Maps if they became plain objects
    newState.blockedPawnsInfo = new Set(Array.from(newState.blockedPawnsInfo || []));
    newState.blockingPawnsInfo = new Set(Array.from(newState.blockingPawnsInfo || []));
    const deadZoneEntries = Array.isArray(newState.deadZoneSquares) 
        ? newState.deadZoneSquares 
        : Object.entries(newState.deadZoneSquares || {});
    newState.deadZoneSquares = new Map(deadZoneEntries.map(([k,v]) => [parseInt(k), v]));
    newState.deadZoneCreatorPawnsInfo = new Set(Array.from(newState.deadZoneCreatorPawnsInfo || []));


    let playerToUpdatePawns = newState.currentPlayerId;

    if (action.type === 'place') {
        if(newState.board[action.squareIndex] && !newState.board[action.squareIndex].pawn) {
            newState.board[action.squareIndex].pawn = createPawn(
                newState.currentPlayerId, 
                newState.placedPawns[newState.currentPlayerId],
                newState.playerColors
            );
            newState.pawnsToPlace[newState.currentPlayerId]--;
            newState.placedPawns[newState.currentPlayerId]++;
            newState.lastMove = { from: null, to: action.squareIndex };
            if (newState.pawnsToPlace[1] === 0 && newState.pawnsToPlace[2] === 0) {
                newState.gamePhase = 'movement';
            }
        } else { return null; /* Invalid placement */ }
    } else if (action.type === 'move') {
        if(newState.board[action.fromIndex]?.pawn && newState.board[action.toIndex] && !newState.board[action.toIndex].pawn) {
            newState.board[action.toIndex].pawn = newState.board[action.fromIndex].pawn;
            newState.board[action.fromIndex].pawn = null;
            newState.lastMove = { from: action.fromIndex, to: action.toIndex };
        } else { return null; /* Invalid move */ }
    }
    
    // Switch player
    newState.currentPlayerId = newState.currentPlayerId === 1 ? 2 : 1;

    // Recalculate derived state (simplified versions for worker)
    const { blockedPawns, blockingPawns } = workerUpdateBlockingStatus(newState.board);
    newState.blockedPawnsInfo = blockedPawns;
    newState.blockingPawnsInfo = blockingPawns;

    const { deadZones, deadZoneCreatorPawnsInfo } = workerUpdateDeadZones(newState.board, newState.playerColors);
    newState.deadZoneSquares = deadZones;
    newState.deadZoneCreatorPawnsInfo = deadZoneCreatorPawnsInfo;
    
    const winCheck = workerCheckWinCondition(newState); // Pass full state for context
    newState.winner = winCheck.winner;
    newState.winningLine = winCheck.winningLine;

    return newState;
}

function workerUpdateBlockingStatus(board) {
    const blockedPawns = new Set();
    const blockingPawns = new Set();
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const centerIdx = r * BOARD_SIZE + c;
            const centerSq = board[centerIdx];
            if (!centerSq?.pawn) continue;

            if (c > 0 && c < BOARD_SIZE - 1) { // Horizontal
                const leftSq = board[r * BOARD_SIZE + (c - 1)];
                const rightSq = board[r * BOARD_SIZE + (c + 1)];
                if (leftSq?.pawn && rightSq?.pawn && leftSq.pawn.playerId === rightSq.pawn.playerId && leftSq.pawn.playerId !== centerSq.pawn.playerId) {
                    blockedPawns.add(centerIdx); blockingPawns.add(leftSq.index); blockingPawns.add(rightSq.index);
                }
            }
            if (r > 0 && r < BOARD_SIZE - 1) { // Vertical
                const topSq = board[(r - 1) * BOARD_SIZE + c];
                const bottomSq = board[(r + 1) * BOARD_SIZE + c];
                if (topSq?.pawn && bottomSq?.pawn && topSq.pawn.playerId === bottomSq.pawn.playerId && topSq.pawn.playerId !== centerSq.pawn.playerId) {
                    blockedPawns.add(centerIdx); blockingPawns.add(topSq.index); blockingPawns.add(bottomSq.index);
                }
            }
        }
    }
    return { blockedPawns, blockingPawns };
}

function workerUpdateDeadZones(board, playerColors) {
    const deadZones = new Map();
    const deadZoneCreatorPawnsInfo = new Set();
     for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (c < BOARD_SIZE - 2) { // Horizontal P-E-P
                const p1 = board[r * BOARD_SIZE + c]; const empty = board[r * BOARD_SIZE + (c + 1)]; const p2 = board[r * BOARD_SIZE + (c + 2)];
                if (p1?.pawn && p2?.pawn && !empty?.pawn && p1.pawn.playerId === p2.pawn.playerId && empty.boardColor === playerColors[p1.pawn.playerId]) {
                    deadZones.set(empty.index, p1.pawn.playerId === 1 ? 2 : 1); deadZoneCreatorPawnsInfo.add(p1.index); deadZoneCreatorPawnsInfo.add(p2.index);
                }
            }
            if (r < BOARD_SIZE - 2) { // Vertical P/E/P
                const p1 = board[r * BOARD_SIZE + c]; const empty = board[(r + 1) * BOARD_SIZE + c]; const p2 = board[(r + 2) * BOARD_SIZE + c];
                 if (p1?.pawn && p2?.pawn && !empty?.pawn && p1.pawn.playerId === p2.pawn.playerId && empty.boardColor === playerColors[p1.pawn.playerId]) {
                    deadZones.set(empty.index, p1.pawn.playerId === 1 ? 2 : 1); deadZoneCreatorPawnsInfo.add(p1.index); deadZoneCreatorPawnsInfo.add(p2.index);
                }
            }
        }
    }
    return { deadZones, deadZoneCreatorPawnsInfo };
}

function workerCheckWinCondition(gameState) {
    const { board, playerColors, deadZoneSquares, blockedPawnsInfo, blockingPawnsInfo, deadZoneCreatorPawnsInfo } = gameState;
    const directions = [{ dr: 1, dc: 1 },{ dr: 1, dc: -1 },{ dr: -1, dc: 1 },{ dr: -1, dc: -1 }];
    for (const playerId of [1, 2]) {
        const playerAssignedColor = playerColors[playerId];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const startIdx = r * BOARD_SIZE + c; const startSq = board[startIdx];
                if (!startSq.pawn || startSq.pawn.playerId !== playerId || startSq.boardColor !== playerAssignedColor || 
                    blockedPawnsInfo.has(startIdx) || blockingPawnsInfo.has(startIdx) || deadZoneCreatorPawnsInfo.has(startIdx)) continue;
                for (const dir of directions) {
                    const line = [startIdx]; let count = 1;
                    for (let s = 1; s < 4; s++) {
                        const nr = r + dir.dr * s; const nc = c + dir.dc * s;
                        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
                        const nextIdx = nr * BOARD_SIZE + nc; const nextSq = board[nextIdx];
                        if (!nextSq.pawn || nextSq.pawn.playerId !== playerId || nextSq.boardColor !== playerAssignedColor ||
                            blockedPawnsInfo.has(nextIdx) || blockingPawnsInfo.has(nextIdx) || deadZoneCreatorPawnsInfo.has(nextIdx) ||
                            deadZoneSquares.get(nextIdx) === playerId) break;
                        line.push(nextIdx); count++;
                    }
                    if (count >= 4) return { winner: playerId, winningLine: line };
                }
            }
        }
    }
    return { winner: null, winningLine: null };
}

function workerIsValidPlacement(squareIndex, playerId, state) {
    const square = state.board[squareIndex];
    if (!square || square.pawn || square.boardColor !== state.playerColors[playerId] || state.deadZoneSquares.get(squareIndex) === playerId) return false;
    const { row, col } = square; const opponentId = playerId === 1 ? 2 : 1;
    if (col > 0 && col < BOARD_SIZE - 1) { // Horizontal restricted
        if (state.board[row * BOARD_SIZE + (col - 1)]?.pawn?.playerId === opponentId && state.board[row * BOARD_SIZE + (col + 1)]?.pawn?.playerId === opponentId) return false;
    }
    if (row > 0 && row < BOARD_SIZE - 1) { // Vertical restricted
        if (state.board[(row - 1) * BOARD_SIZE + col]?.pawn?.playerId === opponentId && state.board[(row + 1) * BOARD_SIZE + col]?.pawn?.playerId === opponentId) return false;
    }
    return true;
}

function workerGetValidMoveDestinations(fromIndex, playerId, state) {
    const destinations = []; const fromSquare = state.board[fromIndex];
    if (!fromSquare?.pawn || fromSquare.pawn.playerId !== playerId || state.blockedPawnsInfo.has(fromIndex)) return [];
    for (let i = 0; i < state.board.length; i++) {
        const toSquare = state.board[i];
        if (!toSquare.pawn && toSquare.boardColor === state.playerColors[playerId] && state.deadZoneSquares.get(i) !== playerId) {
            destinations.push(i);
        }
    }
    return destinations;
}

// --- MCTS Logic ---
class MCTSNode {
  constructor(state, parent = null, action = null) {
    this.state = state; // This state MUST have proper Set/Map instances
    this.parent = parent;
    this.action = action;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    this.playerWhoseTurnItIs = state.currentPlayerId;
    this.untriedActions = this.getValidActions(state); 
  }

  getValidActions(currentState) {
    const actions = [];
    const playerId = currentState.currentPlayerId;
    if (currentState.gamePhase === 'placement') {
      for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        if (workerIsValidPlacement(i, playerId, currentState)) {
             actions.push({ type: 'place', squareIndex: i });
        }
      }
    } else { 
      for (let fromIdx = 0; fromIdx < BOARD_SIZE * BOARD_SIZE; fromIdx++) {
        if (currentState.board[fromIdx]?.pawn?.playerId === playerId && !currentState.blockedPawnsInfo.has(fromIdx)) {
          const destinations = workerGetValidMoveDestinations(fromIdx, playerId, currentState);
          for (const toIdx of destinations) {
            actions.push({ type: 'move', fromIndex: fromIdx, toIndex: toIdx });
          }
        }
      }
    }
    return actions;
  }

  selectChild(explorationWeight) {
    let bestChild = null;
    let bestUcb1 = -Infinity;

    for (const child of this.children) {
      if (child.visits === 0) return child; 
      const ucb1 = (child.wins / child.visits) + explorationWeight * Math.sqrt(Math.log(this.visits) / child.visits);
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
    const newState = applyActionToState(this.state, action);
    if (!newState) return null; // Action was invalid
    
    const childNode = new MCTSNode(newState, this, action);
    this.children.push(childNode);
    return childNode;
  }

  rollout(maxDepth) {
    let currentState = this.state; // Start from this node's state
    let depth = 0;

    while (!this.isTerminal(currentState) && depth < maxDepth) {
      const actions = this.getValidActions(currentState);
      if (actions.length === 0) break; 
      
      const action = actions[Math.floor(Math.random() * actions.length)];
      const nextState = applyActionToState(currentState, action);
      if(!nextState) break; // Should not happen with valid actions
      currentState = nextState;
      depth++;
    }
    return this.getResult(currentState, this.playerWhoseTurnItIs); 
  }

  isTerminal(state) { return state.winner !== null; }

  getResult(terminalState, perspectivePlayerId) {
    if (terminalState.winner === perspectivePlayerId) return 1; 
    if (terminalState.winner !== null && terminalState.winner !== perspectivePlayerId) return 0;
    return 0.5; // Draw or undecided
  }

  backpropagate(resultFromPerspectiveOfNodePlayer) {
    let node = this;
    while(node) {
        node.visits++;
        // If the result is from the perspective of the player whose turn it was at THIS node, use it directly.
        // Otherwise, it's a loss for this node's player (1 - result).
        // The 'result' passed to backpropagate should always be from the perspective of node.playerWhoseTurnItIs
        node.wins += resultFromPerspectiveOfNodePlayer; 
        node = node.parent;
        // For parent, the perspective flips
        resultFromPerspectiveOfNodePlayer = 1 - resultFromPerspectiveOfNodePlayer;
    }
  }
}

class MCTS {
  constructor(options = {}) {
    this.iterations = options.iterations || 100; 
    this.timeLimit = options.timeLimit || 500;
    this.explorationWeight = options.explorationWeight || Math.sqrt(2);
    this.maxRolloutDepth = options.maxRolloutDepth || 50;
  }
  
  findBestMove(initialState) {
    const rootNode = new MCTSNode(initialState); 
    const startTime = Date.now();
    
    if (rootNode.untriedActions.length === 0) return null; 
    if (rootNode.untriedActions.length === 1) return rootNode.untriedActions[0];

    for (let i = 0; i < this.iterations; i++) {
      if (Date.now() - startTime > this.timeLimit && i > 0) break; 
      
      let node = rootNode;
      while (node.untriedActions.length === 0 && node.children.length > 0) {
        const selected = node.selectChild(this.explorationWeight);
        if (!selected) break; 
        node = selected;
      }
      
      if (node.untriedActions.length > 0 && !node.isTerminal(node.state)) {
        const expandedNode = node.expand();
        if(expandedNode) node = expandedNode;
      }
      
      const result = node.rollout(this.maxRolloutDepth); // Result is from perspective of node.playerWhoseTurnItIs
      node.backpropagate(result);
    }
    
    if (rootNode.children.length === 0) {
        // Fallback if no children were expanded (e.g., iterations too low, or only one possible path explored)
        return rootNode.untriedActions.length > 0 ? rootNode.untriedActions[0] : null;
    }

    let bestChild = null;
    let maxScore = -Infinity;

    for(const child of rootNode.children) {
        const score = child.visits > 0 ? (child.wins / child.visits) : -Infinity;
        if (score > maxScore) {
            maxScore = score;
            bestChild = child;
        } else if (score === maxScore && child.visits > (bestChild?.visits || 0)) {
            bestChild = child;
        }
    }
    return bestChild ? bestChild.action : (rootNode.untriedActions.length > 0 ? rootNode.untriedActions[0] : null);
  }
}

self.onmessage = function(e) {
  const { gameState, difficulty } = e.data;
  
  const reconstructedState = JSON.parse(JSON.stringify(gameState));
  reconstructedState.blockedPawnsInfo = new Set(Array.from(gameState.blockedPawnsInfo || []));
  reconstructedState.blockingPawnsInfo = new Set(Array.from(gameState.blockingPawnsInfo || []));
  const deadZoneEntries = Array.isArray(gameState.deadZoneSquares) ? gameState.deadZoneSquares : Object.entries(gameState.deadZoneSquares || {});
  reconstructedState.deadZoneSquares = new Map(deadZoneEntries.map(([k,v]) => [parseInt(k), v]));
  reconstructedState.deadZoneCreatorPawnsInfo = new Set(Array.from(gameState.deadZoneCreatorPawnsInfo || []));
  
  const options = {
    easy: { iterations: 150, timeLimit: 300, explorationWeight: 2.0, maxRolloutDepth: 30 },
    medium: { iterations: 500, timeLimit: 700, explorationWeight: Math.sqrt(2), maxRolloutDepth: 50 },
    hard: { iterations: 1200, timeLimit: 1500, explorationWeight: 1.0, maxRolloutDepth: 70 }
  };
  
  const mcts = new MCTS(options[difficulty] || options.medium);
  try {
    const bestMove = mcts.findBestMove(reconstructedState);
    self.postMessage({ type: 'MOVE_CALCULATED', move: bestMove });
  } catch (error) {
    console.error("MCTS Worker Error:", error);
    self.postMessage({ type: 'ERROR', error: error.message });
  }
};
    