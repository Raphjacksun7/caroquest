/**
 * MCTS Web Worker for CaroQuest - FIXED VERSION
 * 
 * Critical fixes:
 * 1. Backpropagation now tracks wins from ROOT player's perspective (not flipped)
 * 2. Simulations are properly random for exploration
 * 3. Added tactical layer: immediate win detection and blocking
 */

const BOARD_SIZE = 8;

const DIFFICULTY_CONFIGS = {
  easy: { iterations: 200, explorationConstant: 2.0, simulationDepth: 15, timeLimit: 300 },
  medium: { iterations: 1000, explorationConstant: 1.414, simulationDepth: 30, timeLimit: 800 },
  hard: { iterations: 3000, explorationConstant: 1.414, simulationDepth: 50, timeLimit: 1500 },
  expert: { iterations: 8000, explorationConstant: 1.2, simulationDepth: 80, timeLimit: 3000 },
};

// ============================================================================
// Game Logic (copied from gameLogic.ts for worker isolation)
// ============================================================================

function cloneGameState(state) {
  return {
    board: state.board.map(sq => ({
      ...sq,
      pawn: sq.pawn ? { ...sq.pawn } : null
    })),
    currentPlayerId: state.currentPlayerId,
    playerColors: { ...state.playerColors },
    gamePhase: state.gamePhase,
    pawnsToPlace: { ...state.pawnsToPlace },
    placedPawns: { ...state.placedPawns },
    selectedPawnIndex: state.selectedPawnIndex,
    blockedPawnsInfo: new Set(state.blockedPawnsInfo),
    blockingPawnsInfo: new Set(state.blockingPawnsInfo),
    deadZoneSquares: new Map(state.deadZoneSquares),
    deadZoneCreatorPawnsInfo: new Set(state.deadZoneCreatorPawnsInfo),
    winner: state.winner,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    winningLine: state.winningLine ? [...state.winningLine] : null,
    options: { ...state.options }
  };
}

function isValidPlacement(state, squareIndex, playerId) {
  const square = state.board[squareIndex];
  if (!square || square.pawn) return false;
  if (square.boardColor !== state.playerColors[playerId]) return false;
  if (state.deadZoneSquares.get(squareIndex) === playerId) return false;

  const { row, col } = square;
  const opponentId = playerId === 1 ? 2 : 1;

  if (col > 0 && col < BOARD_SIZE - 1) {
    const leftSquare = state.board[row * BOARD_SIZE + (col - 1)];
    const rightSquare = state.board[row * BOARD_SIZE + (col + 1)];
    if (leftSquare?.pawn?.playerId === opponentId && rightSquare?.pawn?.playerId === opponentId) {
      return false;
    }
  }
  if (row > 0 && row < BOARD_SIZE - 1) {
    const topSquare = state.board[(row - 1) * BOARD_SIZE + col];
    const bottomSquare = state.board[(row + 1) * BOARD_SIZE + col];
    if (topSquare?.pawn?.playerId === opponentId && bottomSquare?.pawn?.playerId === opponentId) {
      return false;
    }
  }
  return true;
}

function isValidMove(state, fromIndex, toIndex, playerId) {
  const fromSquare = state.board[fromIndex];
  const toSquare = state.board[toIndex];

  if (!fromSquare?.pawn || fromSquare.pawn.playerId !== playerId) return false;
  if (!toSquare || toSquare.pawn) return false;
  if (toSquare.boardColor !== state.playerColors[playerId]) return false;
  if (state.blockedPawnsInfo.has(fromIndex)) return false;
  if (state.deadZoneSquares.get(toIndex) === playerId) return false;

  return true;
}

function getValidMoveDestinations(state, fromIndex, playerId) {
  const validDests = [];
  const fromSq = state.board[fromIndex];
  
  if (!fromSq?.pawn || fromSq.pawn.playerId !== playerId || state.blockedPawnsInfo.has(fromIndex)) {
    return [];
  }
  
  for (let i = 0; i < 64; i++) {
    if (isValidMove(state, fromIndex, i, playerId)) {
      validDests.push(i);
    }
  }
  return validDests;
}

function updateBlockingStatus(board) {
  const blockedPawns = new Set();
  const blockingPawns = new Set();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const centerIdx = r * BOARD_SIZE + c;
      const centerSq = board[centerIdx];
      if (!centerSq?.pawn) continue;

      if (c > 0 && c < BOARD_SIZE - 1) {
        const leftSq = board[r * BOARD_SIZE + (c - 1)];
        const rightSq = board[r * BOARD_SIZE + (c + 1)];
        if (leftSq?.pawn && rightSq?.pawn &&
            leftSq.pawn.playerId === rightSq.pawn.playerId &&
            leftSq.pawn.playerId !== centerSq.pawn.playerId) {
          blockedPawns.add(centerIdx);
          blockingPawns.add(leftSq.index);
          blockingPawns.add(rightSq.index);
        }
      }
      if (r > 0 && r < BOARD_SIZE - 1) {
        const topSq = board[(r - 1) * BOARD_SIZE + c];
        const bottomSq = board[(r + 1) * BOARD_SIZE + c];
        if (topSq?.pawn && bottomSq?.pawn &&
            topSq.pawn.playerId === bottomSq.pawn.playerId &&
            topSq.pawn.playerId !== centerSq.pawn.playerId) {
          blockedPawns.add(centerIdx);
          blockingPawns.add(topSq.index);
          blockingPawns.add(bottomSq.index);
        }
      }
    }
  }
  return { blockedPawns, blockingPawns };
}

function updateDeadZones(board, playerColors) {
  const deadZones = new Map();
  const deadZoneCreatorPawns = new Set();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const currentSq = board[r * BOARD_SIZE + c];
      if (currentSq.pawn) continue;

      if (c > 0 && c < BOARD_SIZE - 1) {
        const leftSq = board[r * BOARD_SIZE + (c - 1)];
        const rightSq = board[r * BOARD_SIZE + (c + 1)];
        if (leftSq?.pawn && rightSq?.pawn && leftSq.pawn.playerId === rightSq.pawn.playerId) {
          const creatorPlayerId = leftSq.pawn.playerId;
          const opponentPlayerId = creatorPlayerId === 1 ? 2 : 1;
          if (currentSq.boardColor === playerColors[opponentPlayerId]) {
            deadZones.set(currentSq.index, opponentPlayerId);
            deadZoneCreatorPawns.add(leftSq.index);
            deadZoneCreatorPawns.add(rightSq.index);
          }
        }
      }
      if (r > 0 && r < BOARD_SIZE - 1) {
        const topSq = board[(r - 1) * BOARD_SIZE + c];
        const bottomSq = board[(r + 1) * BOARD_SIZE + c];
        if (topSq?.pawn && bottomSq?.pawn && topSq.pawn.playerId === bottomSq.pawn.playerId) {
          const creatorPlayerId = topSq.pawn.playerId;
          const opponentPlayerId = creatorPlayerId === 1 ? 2 : 1;
          if (currentSq.boardColor === playerColors[opponentPlayerId]) {
            deadZones.set(currentSq.index, opponentPlayerId);
            deadZoneCreatorPawns.add(topSq.index);
            deadZoneCreatorPawns.add(bottomSq.index);
          }
        }
      }
    }
  }
  return { deadZones, deadZoneCreatorPawns };
}

function checkWinCondition(state) {
  const { board, playerColors, deadZoneSquares, blockedPawnsInfo, blockingPawnsInfo, deadZoneCreatorPawnsInfo } = state;
  const directions = [{ dr: 1, dc: 1 }, { dr: 1, dc: -1 }];

  for (const playerId of [1, 2]) {
    const playerColor = playerColors[playerId];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        for (const dir of directions) {
          const line = [];
          let possible = true;
          for (let step = 0; step < 4; step++) {
            const curR = r + dir.dr * step;
            const curC = c + dir.dc * step;
            if (curR < 0 || curR >= BOARD_SIZE || curC < 0 || curC >= BOARD_SIZE) {
              possible = false;
              break;
            }
            const idx = curR * BOARD_SIZE + curC;
            const sq = board[idx];
            if (!sq.pawn || sq.pawn.playerId !== playerId || sq.boardColor !== playerColor ||
                blockedPawnsInfo.has(idx) || blockingPawnsInfo.has(idx) ||
                deadZoneCreatorPawnsInfo.has(idx) || deadZoneSquares.get(idx) === playerId) {
              possible = false;
              break;
            }
            line.push(idx);
          }
          if (possible && line.length === 4) {
            return { winner: playerId, winningLine: line };
          }
        }
      }
    }
  }
  return { winner: null, winningLine: null };
}

function placePawn(state, squareIndex, playerId) {
  if (state.currentPlayerId !== playerId) return null;
  if (!isValidPlacement(state, squareIndex, playerId)) return null;

  const newPawn = {
    id: `p${playerId}_${state.placedPawns[playerId] + 1}`,
    playerId: playerId,
    color: state.playerColors[playerId],
  };

  const newBoard = state.board.map((sq, i) =>
    i === squareIndex ? { ...sq, pawn: newPawn, highlight: undefined } : { ...sq, highlight: undefined }
  );

  const newPawnsToPlace = { ...state.pawnsToPlace, [playerId]: state.pawnsToPlace[playerId] - 1 };
  const newPlacedPawns = { ...state.placedPawns, [playerId]: state.placedPawns[playerId] + 1 };

  let nextGamePhase = state.gamePhase;
  if (newPawnsToPlace[1] === 0 && newPawnsToPlace[2] === 0) {
    nextGamePhase = "movement";
  }

  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newBoard, state.playerColors);

  const tempState = {
    ...state,
    board: newBoard,
    pawnsToPlace: newPawnsToPlace,
    placedPawns: newPlacedPawns,
    gamePhase: nextGamePhase,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
    selectedPawnIndex: null,
    lastMove: { from: null, to: squareIndex },
    options: { ...state.options },
  };

  const { winner, winningLine } = checkWinCondition(tempState);
  const nextPlayerId = playerId === 1 ? 2 : 1;

  return {
    ...tempState,
    winner,
    winningLine,
    currentPlayerId: winner ? playerId : nextPlayerId,
  };
}

function movePawn(state, fromIndex, toIndex, playerId) {
  if (state.currentPlayerId !== playerId) return null;
  if (!isValidMove(state, fromIndex, toIndex, playerId)) return null;

  const pawnToMove = state.board[fromIndex].pawn;
  if (!pawnToMove || pawnToMove.playerId !== playerId) return null;

  const newBoard = state.board.map((sq, i) => {
    let newSq = { ...sq, highlight: undefined };
    if (i === fromIndex) return { ...newSq, pawn: null };
    if (i === toIndex) return { ...newSq, pawn: pawnToMove };
    return newSq;
  });

  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newBoard, state.playerColors);

  const tempState = {
    ...state,
    board: newBoard,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
    selectedPawnIndex: null,
    lastMove: { from: fromIndex, to: toIndex },
    options: { ...state.options },
  };

  const { winner, winningLine } = checkWinCondition(tempState);
  const nextPlayerId = playerId === 1 ? 2 : 1;

  return {
    ...tempState,
    winner,
    winningLine,
    currentPlayerId: winner ? playerId : nextPlayerId,
  };
}

// ============================================================================
// Get All Actions Helper
// ============================================================================

function getAllActions(state, playerId) {
  const actions = [];
  
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

function applyAction(state, action, playerId) {
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

// ============================================================================
// Tactical Analysis - Check for immediate wins and blocks
// ============================================================================

function findWinningMove(state, playerId) {
  const actions = getAllActions(state, playerId);
  
  for (const action of actions) {
    const newState = applyAction(state, action, playerId);
    if (newState && newState.winner === playerId) {
      return action;
    }
  }
  return null;
}

function findBlockingMove(state, playerId) {
  const opponentId = playerId === 1 ? 2 : 1;
  
  // Check if opponent can win on their next turn
  const opponentActions = getAllActions(state, opponentId);
  const threateningSquares = [];
  
  for (const action of opponentActions) {
    const simState = cloneGameState(state);
    simState.currentPlayerId = opponentId;
    const newState = applyAction(simState, action, opponentId);
    
    if (newState && newState.winner === opponentId) {
      // Opponent can win - need to block
      if (action.type === "place" && action.squareIndex !== undefined) {
        threateningSquares.push(action.squareIndex);
      }
      if (action.type === "move" && action.toIndex !== undefined) {
        threateningSquares.push(action.toIndex);
      }
    }
  }
  
  if (threateningSquares.length === 0) return null;
  
  // Find our action that prevents opponent win
  const myActions = getAllActions(state, playerId);
  
  for (const action of myActions) {
    const newState = applyAction(state, action, playerId);
    if (!newState) continue;
    
    // After our move, can opponent still win immediately?
    const oppActionsAfter = getAllActions(newState, opponentId);
    let canOppWin = false;
    
    for (const oppAction of oppActionsAfter) {
      const simState = cloneGameState(newState);
      simState.currentPlayerId = opponentId;
      const afterOpp = applyAction(simState, oppAction, opponentId);
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

// ============================================================================
// MCTS Node - FIXED: Always track value from ROOT player's perspective
// ============================================================================

class MCTSNode {
  constructor(state, parent = null, action = null) {
    this.state = state;
    this.parent = parent;
    this.action = action;
    this.children = [];
    this.visits = 0;
    this.totalValue = 0; // Sum of values from ROOT player's perspective (NOT flipped!)
    this.untriedActions = this.getValidActions();
  }

  getValidActions() {
    const playerId = this.state.currentPlayerId;
    if (this.state.winner !== null) return [];
    
    const actions = getAllActions(this.state, playerId);
    
    // Simple ordering: prefer center/diagonal squares
    if (this.state.gamePhase === "placement") {
      actions.sort((a, b) => {
        const scoreA = this.quickScore(a.squareIndex);
        const scoreB = this.quickScore(b.squareIndex);
        return scoreB - scoreA;
      });
    }
    
    return actions.length > 0 ? actions : [];
  }

  quickScore(idx) {
    const row = Math.floor(idx / 8);
    const col = idx % 8;
    const centerDist = Math.abs(row - 3.5) + Math.abs(col - 3.5);
    const onDiagonal = row === col || row === 7 - col;
    return (onDiagonal ? 3 : 0) - centerDist * 0.5;
  }

  ucb1(explorationConstant) {
    if (this.visits === 0) return Infinity;
    const exploitation = this.totalValue / this.visits;
    const exploration = explorationConstant * Math.sqrt(Math.log(this.parent.visits) / this.visits);
    return exploitation + exploration;
  }

  selectChild(explorationConstant) {
    let bestChild = null;
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

  expand() {
    if (this.untriedActions.length === 0) return null;
    
    const action = this.untriedActions.shift();
    const currentPlayer = this.state.currentPlayerId;
    const newState = applyAction(this.state, action, currentPlayer);
    
    if (!newState) {
      return this.untriedActions.length > 0 ? this.expand() : null;
    }
    
    const child = new MCTSNode(newState, this, action);
    this.children.push(child);
    return child;
  }

  // FIXED: Simulate with PURE RANDOM playouts
  // Returns value from ROOT player's perspective
  simulate(maxDepth, rootPlayerId) {
    let state = cloneGameState(this.state);
    let depth = 0;
    
    while (state.winner === null && depth < maxDepth) {
      const actions = getAllActions(state, state.currentPlayerId);
      if (actions.length === 0) break;
      
      // PURE RANDOM selection - critical for MCTS exploration!
      const chosenAction = actions[Math.floor(Math.random() * actions.length)];
      const newState = applyAction(state, chosenAction, state.currentPlayerId);
      
      if (!newState) break;
      state = newState;
      depth++;
    }
    
    // Return result from ROOT player's perspective
    if (state.winner === rootPlayerId) return 1.0;
    if (state.winner !== null) return 0.0;
    
    // Heuristic for non-terminal
    return this.evaluateForPlayer(state, rootPlayerId);
  }

  evaluateForPlayer(state, playerId) {
    const opponentId = playerId === 1 ? 2 : 1;
    
    const myThreats = this.countThreats(state, playerId);
    const oppThreats = this.countThreats(state, opponentId);
    
    let myActive = 0, oppActive = 0;
    for (let i = 0; i < 64; i++) {
      const pawn = state.board[i].pawn;
      if (pawn && !state.blockedPawnsInfo.has(i)) {
        if (pawn.playerId === playerId) myActive++;
        else oppActive++;
      }
    }
    
    let score = 0.5;
    score += myThreats * 0.1;
    score -= oppThreats * 0.15;
    score += (myActive - oppActive) * 0.02;
    
    return Math.max(0.1, Math.min(0.9, score));
  }

  countThreats(state, playerId) {
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
          
          if (valid && myPawns >= 2 && myPawns + empty === 4) {
            threats += myPawns - 1;
          }
        }
      }
    }
    
    return threats;
  }

  // FIXED: No more value flipping! Values are ALWAYS from root perspective
  backpropagate(value) {
    let node = this;
    while (node) {
      node.visits++;
      node.totalValue += value;
      node = node.parent;
    }
  }

  isTerminal() {
    return this.state.winner !== null;
  }

  isFullyExpanded() {
    return this.untriedActions.length === 0;
  }
}

// ============================================================================
// MCTS Main Function
// ============================================================================

function findBestAction(state, config, aiPlayerId) {
  if (state.currentPlayerId !== aiPlayerId) {
    console.log("Not AI's turn");
    return null;
  }

  if (state.winner !== null) {
    return null;
  }

  // Convert Sets/Maps from arrays (deserialization)
  const gameState = {
    ...state,
    blockedPawnsInfo: new Set(state.blockedPawnsInfo || []),
    blockingPawnsInfo: new Set(state.blockingPawnsInfo || []),
    deadZoneSquares: new Map(state.deadZoneSquares || []),
    deadZoneCreatorPawnsInfo: new Set(state.deadZoneCreatorPawnsInfo || []),
  };

  // ========================================
  // PRIORITY 1: Tactical moves (immediate wins/blocks)
  // ========================================
  
  const winningMove = findWinningMove(gameState, aiPlayerId);
  if (winningMove) {
    console.log("Worker: Found immediate winning move!");
    return winningMove;
  }
  
  const blockingMove = findBlockingMove(gameState, aiPlayerId);
  if (blockingMove) {
    console.log("Worker: Found blocking move!");
    return blockingMove;
  }

  // ========================================
  // PRIORITY 2: MCTS for positional play
  // ========================================

  const rootNode = new MCTSNode(cloneGameState(gameState));
  
  if (rootNode.untriedActions.length === 0) {
    return null;
  }
  if (rootNode.untriedActions.length === 1) {
    return rootNode.untriedActions[0];
  }

  const startTime = Date.now();
  let iterations = 0;

  while (iterations < config.iterations && (Date.now() - startTime) < config.timeLimit) {
    // 1. Selection
    let node = rootNode;
    while (node.isFullyExpanded() && node.children.length > 0 && !node.isTerminal()) {
      const selected = node.selectChild(config.explorationConstant);
      if (!selected) break;
      node = selected;
    }

    // 2. Expansion
    if (!node.isTerminal() && !node.isFullyExpanded()) {
      const expanded = node.expand();
      if (expanded) node = expanded;
    }

    // 3. Simulation - ALWAYS from AI's perspective
    const result = node.simulate(config.simulationDepth, aiPlayerId);

    // 4. Backpropagation
    node.backpropagate(result);
    iterations++;
  }

  // Select best action by visit count (most robust)
  let bestChild = null;
  let bestVisits = -1;

  for (const child of rootNode.children) {
    if (child.visits > bestVisits) {
      bestVisits = child.visits;
      bestChild = child;
    }
  }

  if (bestChild && bestChild.action) {
    const winRate = bestChild.visits > 0 
      ? (bestChild.totalValue / bestChild.visits * 100).toFixed(1) 
      : "0";
    console.log(`Worker MCTS: ${winRate}% win rate, ${bestChild.visits} visits, ${iterations} iters, ${Date.now() - startTime}ms`);
    return bestChild.action;
  }

  if (rootNode.untriedActions.length > 0) {
    return rootNode.untriedActions[0];
  }

  return null;
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = function(event) {
  const { type, gameState, difficulty, aiPlayerId } = event.data;
  
  if (type === "CALCULATE_MOVE") {
    try {
      const config = DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS.medium;
      const action = findBestAction(gameState, config, aiPlayerId);
      
      self.postMessage({
        type: "MOVE_CALCULATED",
        move: action,
      });
    } catch (error) {
      console.error("Worker error:", error);
      self.postMessage({
        type: "ERROR",
        error: error.message || "Unknown error in AI worker",
      });
    }
  }
};

console.log("MCTS Worker initialized (FIXED version)");
