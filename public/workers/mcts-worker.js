// workers/mcts-worker.js

// --- Simplified Game Logic for Worker (Copied and adapted from gameLogic.ts) ---
const BOARD_SIZE = 8;
const PAWNS_PER_PLAYER = 6; // Ensure this matches gameLogic.ts

function initializeBoard() {
  const board = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const index = row * BOARD_SIZE + col;
      board.push({
        index, row, col,
        boardColor: (row + col) % 2 === 0 ? 'light' : 'dark',
        pawn: null, highlight: undefined,
      });
    }
  }
  return board;
}

function assignPlayerColors() {
  return { 1: 'light', 2: 'dark' };
}

// --- Core Game Logic Functions (adapted for worker) ---
function isValidPlacement(squareIndex, gameState) {
  const playerId = gameState.currentPlayerId;
  const square = gameState.board[squareIndex];
  if (!square || square.pawn) return false;
  if (square.boardColor !== gameState.playerColors[playerId]) return false;
  if (gameState.deadZoneSquares.get(squareIndex) === playerId) return false;
  const { row, col } = square;
  const opponentId = playerId === 1 ? 2 : 1;
  if (col > 0 && col < BOARD_SIZE - 1) {
    const leftSquare = gameState.board[row * BOARD_SIZE + (col - 1)];
    const rightSquare = gameState.board[row * BOARD_SIZE + (col + 1)];
    if (leftSquare?.pawn?.playerId === opponentId && rightSquare?.pawn?.playerId === opponentId) return false;
  }
  if (row > 0 && row < BOARD_SIZE - 1) {
    const topSquare = gameState.board[(row - 1) * BOARD_SIZE + col];
    const bottomSquare = gameState.board[(row + 1) * BOARD_SIZE + col];
    if (topSquare?.pawn?.playerId === opponentId && bottomSquare?.pawn?.playerId === opponentId) return false;
  }
  return true;
}

function isValidMove(fromIndex, toIndex, gameState) {
  const playerId = gameState.currentPlayerId;
  const fromSquare = gameState.board[fromIndex];
  const toSquare = gameState.board[toIndex];
  if (!fromSquare?.pawn || fromSquare.pawn.playerId !== playerId) return false;
  if (!toSquare || toSquare.pawn) return false;
  if (toSquare.boardColor !== gameState.playerColors[playerId]) return false;
  if (gameState.blockedPawnsInfo.has(fromIndex)) return false;
  if (gameState.deadZoneSquares.get(toIndex) === playerId) return false;
  return true;
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
        if (leftSq?.pawn && rightSq?.pawn && leftSq.pawn.playerId === rightSq.pawn.playerId && leftSq.pawn.playerId !== centerSq.pawn.playerId) {
          blockedPawns.add(centerIdx); blockingPawns.add(leftSq.index); blockingPawns.add(rightSq.index);
        }
      }
      if (r > 0 && r < BOARD_SIZE - 1) {
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

function updateDeadZones(board, playerColors) {
  const deadZones = new Map();
  const deadZoneCreatorPawns = new Set(); // Changed from deadZoneCreatorPawnsInfo
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (c < BOARD_SIZE - 2) {
        const p1 = board[r * BOARD_SIZE + c]; const empty = board[r * BOARD_SIZE + (c + 1)]; const p2 = board[r * BOARD_SIZE + (c + 2)];
        if (p1?.pawn && p2?.pawn && !empty?.pawn && p1.pawn.playerId === p2.pawn.playerId && empty.boardColor === playerColors[p1.pawn.playerId]) {
          deadZones.set(empty.index, p1.pawn.playerId === 1 ? 2 : 1); deadZoneCreatorPawns.add(p1.index); deadZoneCreatorPawns.add(p2.index);
        }
      }
      if (r < BOARD_SIZE - 2) {
        const p1 = board[r * BOARD_SIZE + c]; const empty = board[(r + 1) * BOARD_SIZE + c]; const p2 = board[(r + 2) * BOARD_SIZE + c];
        if (p1?.pawn && p2?.pawn && !empty?.pawn && p1.pawn.playerId === p2.pawn.playerId && empty.boardColor === playerColors[p1.pawn.playerId]) {
          deadZones.set(empty.index, p1.pawn.playerId === 1 ? 2 : 1); deadZoneCreatorPawns.add(p1.index); deadZoneCreatorPawns.add(p2.index);
        }
      }
    }
  }
  return { deadZones, deadZoneCreatorPawns }; // Changed from deadZoneCreatorPawnsInfo
}

function checkWinCondition(gameState) {
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

function getValidMoveDestinations(fromIndex, gameState) {
  const playerId = gameState.currentPlayerId;
  const validDestinations = [];
  const fromSquare = gameState.board[fromIndex];
  if (!fromSquare?.pawn || fromSquare.pawn.playerId !== playerId || gameState.blockedPawnsInfo.has(fromIndex)) return [];
  for (let i = 0; i < gameState.board.length; i++) {
    if (isValidMove(fromIndex, i, gameState)) { // Pass gameState
      validDestinations.push(i);
    }
  }
  return validDestinations;
}

function applyCommonLogic(gameState, newBoard) {
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newBoard, gameState.playerColors);
  const tempGameState = {
    ...gameState, board: newBoard,
    blockedPawnsInfo: blockedPawns, blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones, deadZoneCreatorPawnsInfo: deadZoneCreatorPawns, // Changed field name
    selectedPawnIndex: null, highlightedValidMoves: [],
  };
  const { winner, winningLine } = checkWinCondition(tempGameState);
  return {
    ...tempGameState, winner, winningLine,
    currentPlayerId: winner ? tempGameState.currentPlayerId : (tempGameState.currentPlayerId === 1 ? 2 : 1),
  };
}

function placePawn(gameState, index) {
  if (!isValidPlacement(index, gameState)) return null; // Pass gameState
  const playerId = gameState.currentPlayerId;
  const newPawn = { id: `p${playerId}_${gameState.placedPawns[playerId] + 1}`, playerId, color: gameState.playerColors[playerId] };
  const newBoard = gameState.board.map((sq, i) => i === index ? { ...sq, pawn: newPawn } : sq );
  const newPawnsToPlace = { ...gameState.pawnsToPlace, [playerId]: gameState.pawnsToPlace[playerId] - 1 };
  const newPlacedPawns = { ...gameState.placedPawns, [playerId]: gameState.placedPawns[playerId] + 1 };
  let nextPhase = gameState.gamePhase;
  if (newPawnsToPlace[1] === 0 && newPawnsToPlace[2] === 0) nextPhase = 'movement';
  const updatedGameStateBase = { ...gameState, pawnsToPlace: newPawnsToPlace, placedPawns: newPlacedPawns, gamePhase: nextPhase, lastMove: { from: null, to: index } };
  return applyCommonLogic(updatedGameStateBase, newBoard);
}

function movePawn(gameState, fromIndex, toIndex) {
  if (!isValidMove(fromIndex, toIndex, gameState)) return null; // Pass gameState
  const pawnToMove = gameState.board[fromIndex].pawn;
  if (!pawnToMove) return null;
  const newBoard = gameState.board.map((sq, i) => {
    if (i === fromIndex) return { ...sq, pawn: null }; if (i === toIndex) return { ...sq, pawn: pawnToMove }; return sq;
  });
  const updatedGameStateBase = { ...gameState, lastMove: { from: fromIndex, to: toIndex } };
  return applyCommonLogic(updatedGameStateBase, newBoard);
}


// --- MCTS Logic ---
class MCTSNode {
  constructor(state, parent = null, action = null) {
    this.state = structuredClone(state); // Critical: Deep clone state for each node
    this.parent = parent;
    this.action = action;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    this.playerWhoseTurnItIs = this.state.currentPlayerId;
    this.untriedActions = this.getValidActions(this.state); 
  }

  getValidActions(currentState) {
    const actions = [];
    if (currentState.gamePhase === 'placement') {
      for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        if (isValidPlacement(i, currentState)) { // Pass full gameState
             actions.push({ type: 'place', squareIndex: i });
        }
      }
    } else { 
      for (let fromIdx = 0; fromIdx < BOARD_SIZE * BOARD_SIZE; fromIdx++) {
        if (currentState.board[fromIdx]?.pawn?.playerId === currentState.currentPlayerId && !currentState.blockedPawnsInfo.has(fromIdx)) {
          const destinations = getValidMoveDestinations(fromIdx, currentState); // Pass full gameState
          for (const toIdx of destinations) {
            actions.push({ type: 'move', fromIndex: fromIdx, toIndex: toIdx });
          }
        }
      }
    }
    return actions.length > 0 ? actions : [{ type: 'none' }];
  }

  applyActionToState(currentState, action) {
    // Use the game logic functions which handle cloning and derived state updates
    if (action.type === 'place' && action.squareIndex !== undefined) {
      return placePawn(currentState, action.squareIndex);
    } else if (action.type === 'move' && action.fromIndex !== undefined && action.toIndex !== undefined) {
      return movePawn(currentState, action.fromIndex, action.toIndex);
    } else if (action.type === 'none') {
      let tempState = structuredClone(currentState);
      tempState.currentPlayerId = tempState.currentPlayerId === 1 ? 2 : 1;
       // Recalculate derived state for 'none' action as well
      const { blockedPawns, blockingPawns } = updateBlockingStatus(tempState.board);
      const { deadZones, deadZoneCreatorPawns } = updateDeadZones(tempState.board, tempState.playerColors);
      const { winner, winningLine } = checkWinCondition(tempState);
      return { ...tempState, blockedPawnsInfo: blockedPawns, blockingPawnsInfo: blockingPawns, deadZoneSquares: deadZones, deadZoneCreatorPawnsInfo: deadZoneCreatorPawns, winner, winningLine };
    }
    return null;
  }
  
  selectChild(explorationWeight) {
    let bestChild = null; let bestUcb1 = -Infinity;
    for (const child of this.children) {
      if (child.visits === 0) return child; 
      const ucb1 = (child.wins / child.visits) + explorationWeight * Math.sqrt(Math.log(this.visits) / child.visits);
      if (ucb1 > bestUcb1) { bestUcb1 = ucb1; bestChild = child; }
    }
    return bestChild;
  }

  expand() {
    if (this.untriedActions.length === 0) return null;
    const action = this.untriedActions.pop(); // Simple pop, can be random
    const newState = this.applyActionToState(this.state, action);
    if (!newState) return null; 
    const childNode = new MCTSNode(newState, this, action);
    this.children.push(childNode);
    return childNode;
  }

  rollout(maxDepth) {
    let currentState = structuredClone(this.state); 
    let depth = 0;
    while (!this.isTerminal(currentState) && depth < maxDepth) {
      const actions = this.getValidActions(currentState);
      if (actions.length === 0 || (actions.length === 1 && actions[0].type === 'none')) break;
      const action = actions[Math.floor(Math.random() * actions.length)];
      const nextState = this.applyActionToState(currentState, action);
      if(!nextState) break; 
      currentState = nextState;
      depth++;
    }
    return this.getResult(currentState, this.playerWhoseTurnItIs); 
  }

  isTerminal(state) { return state.winner !== null; }
  getResult(terminalState, perspectivePlayerId) {
    if (terminalState.winner === perspectivePlayerId) return 1; 
    if (terminalState.winner !== null && terminalState.winner !== perspectivePlayerId) return 0;
    return 0.5; 
  }
  backpropagate(resultFromPerspectiveOfNodePlayer) {
    let node = this;
    while(node) {
        node.visits++;
        node.wins += resultFromPerspectiveOfNodePlayer; 
        node = node.parent;
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
        if (!selected) break; node = selected;
      }
      if (node.untriedActions.length > 0 && !node.isTerminal(node.state)) {
        const expandedNode = node.expand();
        if(expandedNode) node = expandedNode;
      }
      const result = node.rollout(this.maxRolloutDepth);
      node.backpropagate(result);
    }
    if (rootNode.children.length === 0) return rootNode.untriedActions.length > 0 ? rootNode.untriedActions[0] : null;
    let bestChild = null; let maxScore = -Infinity;
    for(const child of rootNode.children) {
        const score = child.visits > 0 ? (child.wins / child.visits) : -Infinity;
        if (score > maxScore) { maxScore = score; bestChild = child; }
        else if (score === maxScore && child.visits > (bestChild?.visits || 0)) bestChild = child;
    }
    return bestChild ? bestChild.action : (rootNode.untriedActions.length > 0 ? rootNode.untriedActions[0] : null);
  }
}

self.onmessage = function(e) {
  const { gameState, difficulty } = e.data;
  // Reconstruct Sets and Maps for the gameState inside the worker
  const reconstructedState = structuredClone(gameState); // Deep clone first
  reconstructedState.blockedPawnsInfo = new Set(Array.from(gameState.blockedPawnsInfo || []));
  reconstructedState.blockingPawnsInfo = new Set(Array.from(gameState.blockingPawnsInfo || []));
  
  // Ensure deadZoneSquares is a Map
  const deadZoneEntries = Array.isArray(gameState.deadZoneSquares) 
      ? gameState.deadZoneSquares // If it's already an array of entries
      : Object.entries(gameState.deadZoneSquares || {}); // If it's an object from structuredClone
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
    