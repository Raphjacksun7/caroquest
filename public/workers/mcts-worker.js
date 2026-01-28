/**
 * MCTS Web Worker for CaroQuest - PROPERLY DIFFERENTIATED STRATEGIES
 * 
 * Normal Mode: Balanced play - prioritize creating own winning threats while
 *              maintaining reasonable defense. Goal is to WIN quickly.
 * 
 * Aggressive Mode: Defensive endurance - prioritize blocking opponent threats
 *                  but still maintain winning capability. Goal is to BLOCK and outlast.
 * 
 * Key insight: Both modes MUST leave openings to win, not just block endlessly.
 */

const BOARD_SIZE = 8;

// Strategy configs with DISTINCT scoring parameters
const STRATEGY_CONFIGS = {
  normal: {
    // Fast iterations - heuristic-first
    baseIterations: 100,
    maxIterations: 200,
    explorationConstant: 1.414,  // Standard UCT for balanced exploration
    maxSimulationDepth: 10,
    timeLimit: 400,
    
    // BALANCED: Favor own threats > blocking
    ownThreatMultiplier: 1.8,    // Strong preference for creating own threats
    oppThreatMultiplier: 0.8,    // Moderate concern for opponent threats
    
    // Blocking: Low priority - block only when critical
    blockingBonus: 15,           // Low bonus for blocking opponent pawns
    ownBlockedPenalty: 25,       // Moderate penalty for own pawns being blocked
    
    // Win setup: HIGH priority - actively create winning positions
    strongThreatBonus: 80,       // Big bonus for creating 3-in-a-row setups
    weakThreatBonus: 35,         // Good bonus for 2-in-a-row setups
    
    // Placement: Less focused on being near opponent
    placementProximityWeight: 0.3,
    placementCentralityWeight: 0.5,  // Prefer central positions for flexibility
  },
  
  aggressive: {
    // Slightly more iterations for deeper blocking analysis
    baseIterations: 120,
    maxIterations: 250,
    explorationConstant: 1.2,   // Lower exploration - exploit known good blocks
    maxSimulationDepth: 12,
    timeLimit: 500,
    
    // DEFENSIVE: Favor blocking > own threats
    ownThreatMultiplier: 0.6,    // Own threats still matter but less
    oppThreatMultiplier: 1.6,    // High concern for opponent threats
    
    // Blocking: HIGH priority - actively seek to block
    blockingBonus: 45,           // High bonus for blocking opponent pawns  
    ownBlockedPenalty: 30,       // Accept some own pawns being blocked
    
    // Win setup: Still important but secondary
    strongThreatBonus: 50,       // Moderate bonus - don't ignore winning
    weakThreatBonus: 20,         // Lower bonus for weak setups
    
    // Placement: Focus on being near opponent for blocking
    placementProximityWeight: 0.7,
    placementCentralityWeight: 0.2,
  }
};

// ============================================================================
// Lightweight Game State Operations - AVOID DEEP CLONING
// ============================================================================

function lightClone(state) {
  return {
    board: state.board.map(sq => ({
      index: sq.index,
      row: sq.row,
      col: sq.col,
      boardColor: sq.boardColor,
      pawn: sq.pawn ? { playerId: sq.pawn.playerId } : null
    })),
    currentPlayerId: state.currentPlayerId,
    playerColors: state.playerColors,
    gamePhase: state.gamePhase,
    pawnsToPlace: { ...state.pawnsToPlace },
    placedPawns: { ...state.placedPawns },
    blockedPawnsInfo: new Set(state.blockedPawnsInfo),
    blockingPawnsInfo: new Set(state.blockingPawnsInfo),
    deadZoneSquares: new Map(state.deadZoneSquares),
    deadZoneCreatorPawnsInfo: new Set(state.deadZoneCreatorPawnsInfo),
    winner: state.winner,
    options: state.options
  };
}

function isValidPlacement(state, squareIndex, playerId) {
  const square = state.board[squareIndex];
  if (!square || square.pawn) return false;
  if (square.boardColor !== state.playerColors[playerId]) return false;
  if (state.deadZoneSquares.get(squareIndex) === playerId) return false;

  const { row, col } = square;
  const opponentId = playerId === 1 ? 2 : 1;

  // Check restricted zone (sandwiched)
  if (col > 0 && col < BOARD_SIZE - 1) {
    const leftSq = state.board[row * BOARD_SIZE + (col - 1)];
    const rightSq = state.board[row * BOARD_SIZE + (col + 1)];
    if (leftSq?.pawn?.playerId === opponentId && rightSq?.pawn?.playerId === opponentId) {
      return false;
    }
  }
  if (row > 0 && row < BOARD_SIZE - 1) {
    const topSq = state.board[(row - 1) * BOARD_SIZE + col];
    const bottomSq = state.board[(row + 1) * BOARD_SIZE + col];
    if (topSq?.pawn?.playerId === opponentId && bottomSq?.pawn?.playerId === opponentId) {
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

// ============================================================================
// Fast Action Generation
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
        for (let toIdx = 0; toIdx < 64; toIdx++) {
          if (isValidMove(state, fromIdx, toIdx, playerId)) {
            actions.push({ type: "move", fromIndex: fromIdx, toIndex: toIdx });
          }
        }
      }
    }
  }
  
  return actions;
}

// ============================================================================
// State Update Functions
// ============================================================================

function updateBlockingStatus(board) {
  const blockedPawns = new Set();
  const blockingPawns = new Set();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const centerIdx = r * BOARD_SIZE + c;
      const centerSq = board[centerIdx];
      if (!centerSq?.pawn) continue;

      // Horizontal check
      if (c > 0 && c < BOARD_SIZE - 1) {
        const leftSq = board[r * BOARD_SIZE + (c - 1)];
        const rightSq = board[r * BOARD_SIZE + (c + 1)];
        if (leftSq?.pawn && rightSq?.pawn &&
            leftSq.pawn.playerId === rightSq.pawn.playerId &&
            leftSq.pawn.playerId !== centerSq.pawn.playerId) {
          blockedPawns.add(centerIdx);
          blockingPawns.add(r * BOARD_SIZE + (c - 1));
          blockingPawns.add(r * BOARD_SIZE + (c + 1));
        }
      }
      // Vertical check
      if (r > 0 && r < BOARD_SIZE - 1) {
        const topSq = board[(r - 1) * BOARD_SIZE + c];
        const bottomSq = board[(r + 1) * BOARD_SIZE + c];
        if (topSq?.pawn && bottomSq?.pawn &&
            topSq.pawn.playerId === bottomSq.pawn.playerId &&
            topSq.pawn.playerId !== centerSq.pawn.playerId) {
          blockedPawns.add(centerIdx);
          blockingPawns.add((r - 1) * BOARD_SIZE + c);
          blockingPawns.add((r + 1) * BOARD_SIZE + c);
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

      // Horizontal
      if (c > 0 && c < BOARD_SIZE - 1) {
        const leftSq = board[r * BOARD_SIZE + (c - 1)];
        const rightSq = board[r * BOARD_SIZE + (c + 1)];
        if (leftSq?.pawn && rightSq?.pawn && leftSq.pawn.playerId === rightSq.pawn.playerId) {
          const creatorId = leftSq.pawn.playerId;
          const opponentId = creatorId === 1 ? 2 : 1;
          if (currentSq.boardColor === playerColors[opponentId]) {
            deadZones.set(currentSq.index, opponentId);
            deadZoneCreatorPawns.add(r * BOARD_SIZE + (c - 1));
            deadZoneCreatorPawns.add(r * BOARD_SIZE + (c + 1));
          }
        }
      }
      // Vertical
      if (r > 0 && r < BOARD_SIZE - 1) {
        const topSq = board[(r - 1) * BOARD_SIZE + c];
        const bottomSq = board[(r + 1) * BOARD_SIZE + c];
        if (topSq?.pawn && bottomSq?.pawn && topSq.pawn.playerId === bottomSq.pawn.playerId) {
          const creatorId = topSq.pawn.playerId;
          const opponentId = creatorId === 1 ? 2 : 1;
          if (currentSq.boardColor === playerColors[opponentId]) {
            deadZones.set(currentSq.index, opponentId);
            deadZoneCreatorPawns.add((r - 1) * BOARD_SIZE + c);
            deadZoneCreatorPawns.add((r + 1) * BOARD_SIZE + c);
          }
        }
      }
    }
  }
  return { deadZones, deadZoneCreatorPawns };
}

// Fast win check - only check diagonals
function checkWin(state) {
  const { board, playerColors, blockedPawnsInfo, blockingPawnsInfo, deadZoneCreatorPawnsInfo, deadZoneSquares } = state;
  const directions = [{ dr: 1, dc: 1 }, { dr: 1, dc: -1 }];

  for (const playerId of [1, 2]) {
    const playerColor = playerColors[playerId];
    for (let r = 0; r < BOARD_SIZE - 3; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        for (const dir of directions) {
          const endR = r + dir.dr * 3;
          const endC = c + dir.dc * 3;
          if (endR < 0 || endR >= BOARD_SIZE || endC < 0 || endC >= BOARD_SIZE) continue;

          let valid = true;
          for (let step = 0; step < 4 && valid; step++) {
            const curR = r + dir.dr * step;
            const curC = c + dir.dc * step;
            const idx = curR * BOARD_SIZE + curC;
            const sq = board[idx];
            
            if (!sq.pawn || sq.pawn.playerId !== playerId || sq.boardColor !== playerColor ||
                blockedPawnsInfo.has(idx) || blockingPawnsInfo.has(idx) ||
                deadZoneCreatorPawnsInfo.has(idx) || deadZoneSquares.get(idx) === playerId) {
              valid = false;
            }
          }
          if (valid) return playerId;
        }
      }
    }
  }
  return null;
}

function applyAction(state, action, playerId) {
  const newState = lightClone(state);
  
  if (action.type === "place" && action.squareIndex !== undefined) {
    const sq = newState.board[action.squareIndex];
    if (!sq || sq.pawn) return null;
    
    sq.pawn = { playerId };
    newState.pawnsToPlace[playerId]--;
    newState.placedPawns[playerId]++;
    
    if (newState.pawnsToPlace[1] === 0 && newState.pawnsToPlace[2] === 0) {
      newState.gamePhase = "movement";
    }
  } else if (action.type === "move") {
    const fromSq = newState.board[action.fromIndex];
    const toSq = newState.board[action.toIndex];
    if (!fromSq?.pawn || toSq?.pawn) return null;
    
    toSq.pawn = fromSq.pawn;
    fromSq.pawn = null;
  } else {
    return null;
  }

  const { blockedPawns, blockingPawns } = updateBlockingStatus(newState.board);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newState.board, newState.playerColors);
  
  newState.blockedPawnsInfo = blockedPawns;
  newState.blockingPawnsInfo = blockingPawns;
  newState.deadZoneSquares = deadZones;
  newState.deadZoneCreatorPawnsInfo = deadZoneCreatorPawns;
  newState.currentPlayerId = playerId === 1 ? 2 : 1;
  newState.winner = checkWin(newState);
  
  return newState;
}

// ============================================================================
// PRIORITY 1: Immediate Threat Detection (NO MCTS needed)
// ============================================================================

function findImmediateWin(state, playerId) {
  const actions = getAllActions(state, playerId);
  for (const action of actions) {
    const newState = applyAction(state, action, playerId);
    if (newState && newState.winner === playerId) {
      return action;
    }
  }
  return null;
}

function findImmediateBlock(state, playerId) {
  const opponentId = playerId === 1 ? 2 : 1;
  
  // Check if opponent can win next turn
  const oppActions = getAllActions(state, opponentId);
  const winningOppMoves = [];
  
  for (const action of oppActions) {
    const simState = lightClone(state);
    simState.currentPlayerId = opponentId;
    const newState = applyAction(simState, action, opponentId);
    if (newState && newState.winner === opponentId) {
      winningOppMoves.push(action);
    }
  }
  
  if (winningOppMoves.length === 0) return null;
  
  // Find our move that blocks ALL opponent wins
  const myActions = getAllActions(state, playerId);
  
  for (const action of myActions) {
    const afterMyMove = applyAction(state, action, playerId);
    if (!afterMyMove) continue;
    
    let canOppWin = false;
    const oppActionsAfter = getAllActions(afterMyMove, opponentId);
    
    for (const oppA of oppActionsAfter) {
      const simState = lightClone(afterMyMove);
      simState.currentPlayerId = opponentId;
      const afterOpp = applyAction(simState, oppA, opponentId);
      if (afterOpp && afterOpp.winner === opponentId) {
        canOppWin = true;
        break;
      }
    }
    
    if (!canOppWin) {
      return action;
    }
  }
  
  return null;
}

// ============================================================================
// PRIORITY 2: Two-Move Threat Detection
// ============================================================================

function findTwoMoveWin(state, playerId) {
  const actions = getAllActions(state, playerId);
  
  for (const action of actions) {
    const afterMove = applyAction(state, action, playerId);
    if (!afterMove || afterMove.winner) continue;
    
    const opponentId = playerId === 1 ? 2 : 1;
    const oppActions = getAllActions(afterMove, opponentId);
    
    let guaranteedWin = true;
    
    for (const oppAction of oppActions) {
      const afterOpp = applyAction(afterMove, oppAction, opponentId);
      if (!afterOpp) continue;
      
      const ourNextActions = getAllActions(afterOpp, playerId);
      let canWinAfter = false;
      
      for (const ourNext of ourNextActions) {
        const final = applyAction(afterOpp, ourNext, playerId);
        if (final && final.winner === playerId) {
          canWinAfter = true;
          break;
        }
      }
      
      if (!canWinAfter) {
        guaranteedWin = false;
        break;
      }
    }
    
    if (guaranteedWin && oppActions.length > 0) {
      return action;
    }
  }
  
  return null;
}

// ============================================================================
// STRATEGY-SPECIFIC SCORING - The Key Differentiation
// ============================================================================

function countDiagonalThreats(state, playerId) {
  const myColor = state.playerColors[playerId];
  const directions = [{ dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
  let strong = 0; // 3 in a row with 1 empty (one move from win)
  let weak = 0;   // 2 in a row with 2 empty (two moves from win)
  
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      for (const dir of directions) {
        let myPawns = 0;
        let empty = 0;
        let valid = true;
        
        for (let step = 0; step < 4 && valid; step++) {
          const curR = r + dir.dr * step;
          const curC = c + dir.dc * step;
          
          if (curR < 0 || curR >= BOARD_SIZE || curC < 0 || curC >= BOARD_SIZE) {
            valid = false;
            continue;
          }
          
          const idx = curR * BOARD_SIZE + curC;
          const sq = state.board[idx];
          
          if (sq.boardColor !== myColor) {
            valid = false;
            continue;
          }
          
          const pawn = sq.pawn;
          if (pawn?.playerId === playerId && !state.blockedPawnsInfo.has(idx) && 
              !state.blockingPawnsInfo.has(idx) && !state.deadZoneCreatorPawnsInfo.has(idx)) {
            myPawns++;
          } else if (!pawn && state.deadZoneSquares.get(idx) !== playerId) {
            empty++;
          } else if (pawn?.playerId !== playerId) {
            valid = false;
          }
        }
        
        if (valid && myPawns + empty === 4) {
          if (myPawns === 3) strong++;
          else if (myPawns === 2) weak++;
        }
      }
    }
  }
  
  return { strong, weak };
}

function getProximityScore(state, squareIndex, opponentId) {
  const sq = state.board[squareIndex];
  const { row, col } = sq;
  let score = 0;
  
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        const idx = nr * BOARD_SIZE + nc;
        if (state.board[idx].pawn?.playerId === opponentId) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          score += (3 - dist);
        }
      }
    }
  }
  
  return score;
}

function getCentralityScore(squareIndex) {
  const row = Math.floor(squareIndex / BOARD_SIZE);
  const col = squareIndex % BOARD_SIZE;
  
  // Distance from center (3.5, 3.5)
  const distFromCenter = Math.abs(row - 3.5) + Math.abs(col - 3.5);
  
  // Max distance is 7, normalize to 0-1 and invert (center = 1, edge = 0)
  return 1 - (distFromCenter / 7);
}

// Count how many free pawns (not blocked, not blocking) each player has
function countFreePawns(state, playerId) {
  let free = 0;
  for (let i = 0; i < 64; i++) {
    const sq = state.board[i];
    if (sq.pawn?.playerId === playerId) {
      if (!state.blockedPawnsInfo.has(i) && !state.blockingPawnsInfo.has(i)) {
        free++;
      }
    }
  }
  return free;
}

function scoreAction(state, action, playerId, config) {
  const newState = applyAction(state, action, playerId);
  if (!newState) return -Infinity;
  
  // Immediate outcomes
  if (newState.winner === playerId) return 10000;
  if (newState.winner !== null) return -10000;
  
  const opponentId = playerId === 1 ? 2 : 1;
  let score = 0;
  
  // =========================================================================
  // 1. OWN WINNING THREATS - Strategy-weighted
  // =========================================================================
  const myThreats = countDiagonalThreats(newState, playerId);
  const oppThreats = countDiagonalThreats(newState, opponentId);
  
  // Normal: Strong bonus for own threats (winning focus)
  // Aggressive: Moderate bonus for own threats (balanced)
  score += myThreats.strong * config.strongThreatBonus * config.ownThreatMultiplier;
  score += myThreats.weak * config.weakThreatBonus * config.ownThreatMultiplier;
  
  // =========================================================================
  // 2. OPPONENT THREAT PENALTIES - Strategy-weighted
  // =========================================================================
  // Normal: Moderate penalty (don't obsess over blocking)
  // Aggressive: High penalty (prioritize stopping opponent)
  score -= oppThreats.strong * config.strongThreatBonus * config.oppThreatMultiplier;
  score -= oppThreats.weak * config.weakThreatBonus * config.oppThreatMultiplier;
  
  // =========================================================================
  // 3. BLOCKING STATUS - Strategy-specific bonus/penalty
  // =========================================================================
  let myBlocked = 0, oppBlocked = 0;
  for (const idx of newState.blockedPawnsInfo) {
    if (newState.board[idx].pawn?.playerId === playerId) myBlocked++;
    else oppBlocked++;
  }
  
  // Strategy-specific blocking values
  score += oppBlocked * config.blockingBonus;
  score -= myBlocked * config.ownBlockedPenalty;
  
  // =========================================================================
  // 4. FREE PAWN COUNT - Ensure we keep options open
  // =========================================================================
  const myFreePawns = countFreePawns(newState, playerId);
  const oppFreePawns = countFreePawns(newState, opponentId);
  
  // Bonus for having more free pawns than opponent (flexibility)
  score += (myFreePawns - oppFreePawns) * 8;
  
  // Penalty if we have very few free pawns (can't win!)
  if (myFreePawns <= 1) {
    score -= 50; // Danger zone - not enough pawns to create winning line
  }
  
  // =========================================================================
  // 5. PLACEMENT PHASE BONUSES
  // =========================================================================
  if (action.type === "place") {
    // Proximity to opponent (for potential blocking)
    const proximityScore = getProximityScore(state, action.squareIndex, opponentId);
    score += proximityScore * config.placementProximityWeight * 15;
    
    // Centrality (for flexibility and more diagonal options)
    const centralityScore = getCentralityScore(action.squareIndex);
    score += centralityScore * config.placementCentralityWeight * 20;
  }
  
  // =========================================================================
  // 6. MOVEMENT PHASE: Avoid wasting pawns on pure blocking
  // =========================================================================
  if (action.type === "move") {
    const toIdx = action.toIndex;
    
    // Check if this move contributes to a potential winning line
    const beforeThreats = countDiagonalThreats(state, playerId);
    const threatImprovement = (myThreats.strong - beforeThreats.strong) * 2 + 
                              (myThreats.weak - beforeThreats.weak);
    
    score += threatImprovement * 15; // Bonus for moves that improve our threats
    
    // Mild preference for moves that don't sacrifice too much mobility
    if (newState.blockingPawnsInfo.has(toIdx) && !state.blockingPawnsInfo.has(action.fromIndex)) {
      score -= 10; // Slight penalty for becoming a blocking pawn (reduces mobility)
    }
  }
  
  // Small randomness to avoid repetitive play
  score += Math.random() * 3;
  
  return score;
}

// ============================================================================
// MCTS with Strategy-Aware Scoring
// ============================================================================

function runMinimalMCTS(state, playerId, config) {
  const actions = getAllActions(state, playerId);
  if (actions.length === 0) return null;
  if (actions.length === 1) return actions[0];
  
  // Score all actions with strategy-specific heuristic
  const scoredActions = actions.map(action => ({
    action,
    score: scoreAction(state, action, playerId, config),
    visits: 0
  }));
  
  // Sort by heuristic score
  scoredActions.sort((a, b) => b.score - a.score);
  
  // If top action is clearly better, just use it
  if (scoredActions.length > 1 && scoredActions[0].score > scoredActions[1].score + 100) {
    return scoredActions[0].action;
  }
  
  // Adaptive iterations based on game complexity
  const blockedCount = state.blockedPawnsInfo.size;
  const iterationMultiplier = 1 + Math.min(blockedCount * 0.1, 0.5);
  const iterations = Math.min(
    Math.floor(config.baseIterations * iterationMultiplier),
    config.maxIterations
  );
  
  const startTime = Date.now();
  
  // Run quick simulations on top candidates only
  const topCandidates = scoredActions.slice(0, Math.min(5, scoredActions.length));
  
  for (let iter = 0; iter < iterations && (Date.now() - startTime) < config.timeLimit; iter++) {
    const candidate = topCandidates[iter % topCandidates.length];
    
    const afterMove = applyAction(state, candidate.action, playerId);
    if (!afterMove) continue;
    
    const result = quickRollout(afterMove, playerId, config);
    candidate.visits++;
    
    // Update score with rollout result
    candidate.score = candidate.score * 0.9 + result * 100 * 0.1;
  }
  
  // Return best by combined score
  topCandidates.sort((a, b) => b.score - a.score);
  
  console.log(`MCTS: ${iterations} iters, ${Date.now() - startTime}ms, best score: ${topCandidates[0].score.toFixed(1)}`);
  
  return topCandidates[0].action;
}

function quickRollout(state, rootPlayerId, config) {
  let currentState = state;
  let depth = 0;
  
  while (currentState.winner === null && depth < config.maxSimulationDepth) {
    const actions = getAllActions(currentState, currentState.currentPlayerId);
    if (actions.length === 0) break;
    
    // Semi-random: 70% random, 30% heuristic-guided
    let action;
    if (Math.random() < 0.3 && actions.length > 1) {
      // Quick heuristic choice
      const scored = actions.slice(0, 5).map(a => ({
        action: a,
        score: scoreAction(currentState, a, currentState.currentPlayerId, config)
      }));
      scored.sort((a, b) => b.score - a.score);
      action = scored[0].action;
    } else {
      action = actions[Math.floor(Math.random() * actions.length)];
    }
    
    const newState = applyAction(currentState, action, currentState.currentPlayerId);
    if (!newState) break;
    currentState = newState;
    depth++;
  }
  
  if (currentState.winner === rootPlayerId) return 1.0;
  if (currentState.winner !== null) return 0.0;
  
  // Strategy-aware terminal evaluation
  const myThreats = countDiagonalThreats(currentState, rootPlayerId);
  const oppThreats = countDiagonalThreats(currentState, rootPlayerId === 1 ? 2 : 1);
  
  // Base score
  let evalScore = 0.5;
  
  // Own threats contribute positively (weighted by strategy)
  evalScore += myThreats.strong * 0.12 * config.ownThreatMultiplier;
  evalScore += myThreats.weak * 0.03 * config.ownThreatMultiplier;
  
  // Opponent threats contribute negatively (weighted by strategy)
  evalScore -= oppThreats.strong * 0.12 * config.oppThreatMultiplier;
  evalScore -= oppThreats.weak * 0.03 * config.oppThreatMultiplier;
  
  return Math.max(0, Math.min(1, evalScore));
}

// ============================================================================
// Main Entry Point
// ============================================================================

function findBestAction(state, config, aiPlayerId, strategy) {
  if (state.currentPlayerId !== aiPlayerId) {
    return null;
  }

  if (state.winner !== null) {
    return null;
  }

  // Deserialize Sets/Maps
  const gameState = {
    ...state,
    blockedPawnsInfo: new Set(state.blockedPawnsInfo || []),
    blockingPawnsInfo: new Set(state.blockingPawnsInfo || []),
    deadZoneSquares: new Map(state.deadZoneSquares || []),
    deadZoneCreatorPawnsInfo: new Set(state.deadZoneCreatorPawnsInfo || []),
  };

  const startTime = Date.now();

  // PRIORITY 1: Immediate win (always take it!)
  const winningMove = findImmediateWin(gameState, aiPlayerId);
  if (winningMove) {
    console.log(`[${strategy}] Immediate WIN found in ${Date.now() - startTime}ms`);
    return winningMove;
  }
  
  // PRIORITY 2: Block immediate opponent win (must do or we lose!)
  const blockingMove = findImmediateBlock(gameState, aiPlayerId);
  if (blockingMove) {
    console.log(`[${strategy}] Immediate BLOCK found in ${Date.now() - startTime}ms`);
    return blockingMove;
  }

  // PRIORITY 3: Two-move winning threat
  const twoMoveWin = findTwoMoveWin(gameState, aiPlayerId);
  if (twoMoveWin) {
    console.log(`[${strategy}] Two-move WIN threat found in ${Date.now() - startTime}ms`);
    return twoMoveWin;
  }

  // PRIORITY 4: Strategy-specific MCTS with differentiated scoring
  const bestAction = runMinimalMCTS(gameState, aiPlayerId, config);
  
  console.log(`[${strategy}] MCTS complete in ${Date.now() - startTime}ms`);
  
  return bestAction;
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = function(event) {
  const { type, gameState, difficulty, strategy, aiPlayerId } = event.data;
  
  if (type === "CALCULATE_MOVE") {
    try {
      // Map old difficulty to strategy
      const strategyMode = strategy || (difficulty === 'hard' || difficulty === 'expert' ? 'aggressive' : 'normal');
      const config = STRATEGY_CONFIGS[strategyMode] || STRATEGY_CONFIGS.normal;
      
      console.log(`[${strategyMode}] Config: ownThreatMult=${config.ownThreatMultiplier}, oppThreatMult=${config.oppThreatMultiplier}, blockBonus=${config.blockingBonus}`);
      
      const action = findBestAction(gameState, config, aiPlayerId, strategyMode);
      
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

console.log("MCTS Worker initialized (Strategy-Differentiated)");
