/**
 * Simple, correct AI for CaroQuest
 * 
 * Key game rules:
 * - Player 1 plays on LIGHT squares, Player 2 plays on DARK squares
 * - Win by forming 4 pawns in a DIAGONAL on your assigned color
 * - Blocked pawns (sandwiched) cannot move and don't count for winning
 * - Dead zones are squares you cannot place/move to
 * 
 * Strategy:
 * - Placement: Prioritize corners/edges for diagonal potential
 * - Movement: Complete diagonals or block opponent's diagonals
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

export interface SimpleAction {
  type: "place" | "move";
  squareIndex?: number;
  fromIndex?: number;
  toIndex?: number;
}

/**
 * Get all valid placement positions for a player
 */
function getValidPlacements(state: GameState, playerId: PlayerId): number[] {
  const validPositions: number[] = [];
  for (let i = 0; i < 64; i++) {
    if (isValidPlacement(state, i, playerId)) {
      validPositions.push(i);
    }
  }
  return validPositions;
}

/**
 * Get all valid move actions for a player
 */
function getValidMoves(state: GameState, playerId: PlayerId): { from: number; to: number }[] {
  const validMoves: { from: number; to: number }[] = [];
  
  for (let i = 0; i < 64; i++) {
    const square = state.board[i];
    if (square.pawn?.playerId === playerId && !state.blockedPawnsInfo.has(i)) {
      const destinations = getValidMoveDestinations(state, i, playerId);
      for (const dest of destinations) {
        validMoves.push({ from: i, to: dest });
      }
    }
  }
  
  return validMoves;
}

/**
 * Count pawns in a diagonal line from a position
 * Returns: { myPawns, opponentPawns, emptyValidSquares }
 */
function countDiagonalLine(
  state: GameState,
  startIdx: number,
  dr: number,
  dc: number,
  playerId: PlayerId
): { myPawns: number[]; empty: number[]; blocked: boolean } {
  const myPawns: number[] = [];
  const empty: number[] = [];
  const myColor = state.playerColors[playerId];
  
  const startRow = Math.floor(startIdx / BOARD_SIZE);
  const startCol = startIdx % BOARD_SIZE;
  
  for (let step = 0; step < 4; step++) {
    const row = startRow + dr * step;
    const col = startCol + dc * step;
    
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      return { myPawns: [], empty: [], blocked: true }; // Can't form 4-in-line here
    }
    
    const idx = row * BOARD_SIZE + col;
    const square = state.board[idx];
    
    // Only count squares on our color
    if (square.boardColor !== myColor) {
      return { myPawns: [], empty: [], blocked: true }; // Diagonal broken by wrong color
    }
    
    // Check if this square is usable for winning
    if (square.pawn) {
      if (square.pawn.playerId === playerId) {
        // Our pawn - but check if it's blocked/blocking (can't count for win)
        if (state.blockedPawnsInfo.has(idx) || 
            state.blockingPawnsInfo.has(idx) ||
            state.deadZoneCreatorPawnsInfo.has(idx)) {
          return { myPawns: [], empty: [], blocked: true }; // Unusable pawn
        }
        myPawns.push(idx);
      } else {
        return { myPawns: [], empty: [], blocked: true }; // Opponent blocks this diagonal
      }
    } else {
      // Empty square - check if it's a dead zone for us
      if (state.deadZoneSquares.get(idx) === playerId) {
        return { myPawns: [], empty: [], blocked: true }; // Dead zone blocks us
      }
      empty.push(idx);
    }
  }
  
  return { myPawns, empty, blocked: false };
}

/**
 * Find all potential winning diagonals for a player
 */
function findDiagonalOpportunities(
  state: GameState,
  playerId: PlayerId
): { position: number; score: number; type: 'win' | 'threat' | 'build' }[] {
  const opportunities: { position: number; score: number; type: 'win' | 'threat' | 'build' }[] = [];
  const myColor = state.playerColors[playerId];
  
  // Check all possible 4-in-line diagonal starts
  const directions = [
    { dr: 1, dc: 1 },   // Down-right
    { dr: 1, dc: -1 },  // Down-left
  ];
  
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const idx = row * BOARD_SIZE + col;
      
      // Only start from our color squares
      if (state.board[idx].boardColor !== myColor) continue;
      
      for (const dir of directions) {
        const result = countDiagonalLine(state, idx, dir.dr, dir.dc, playerId);
        
        if (!result.blocked) {
          // This is a potential winning diagonal
          const pawnCount = result.myPawns.length;
          const emptyCount = result.empty.length;
          
          // Score empty positions based on how close we are to winning
          for (const emptyPos of result.empty) {
            if (pawnCount === 3 && emptyCount === 1) {
              // WINNING MOVE - highest priority
              opportunities.push({ position: emptyPos, score: 1000, type: 'win' });
            } else if (pawnCount === 2 && emptyCount === 2) {
              // Building toward win - high priority
              opportunities.push({ position: emptyPos, score: 100, type: 'threat' });
            } else if (pawnCount === 1 && emptyCount === 3) {
              // Potential diagonal - medium priority
              opportunities.push({ position: emptyPos, score: 10, type: 'build' });
            } else if (pawnCount === 0 && emptyCount === 4) {
              // New diagonal - low priority
              opportunities.push({ position: emptyPos, score: 1, type: 'build' });
            }
          }
        }
      }
    }
  }
  
  return opportunities;
}

/**
 * Evaluate a position score for placement
 */
function evaluatePlacement(state: GameState, idx: number, playerId: PlayerId): number {
  let score = 0;
  const opponentId = playerId === 1 ? 2 : 1;
  
  const row = Math.floor(idx / BOARD_SIZE);
  const col = idx % BOARD_SIZE;
  
  // 1. Check if this completes OUR winning diagonal
  const myOpportunities = findDiagonalOpportunities(state, playerId);
  for (const opp of myOpportunities) {
    if (opp.position === idx) {
      score += opp.score;
    }
  }
  
  // 2. Check if this BLOCKS opponent's winning diagonal (critical!)
  const oppOpportunities = findDiagonalOpportunities(state, opponentId);
  for (const opp of oppOpportunities) {
    // We can't directly place on opponent's color, but we need to check
    // if our placement affects their diagonal potential
  }
  
  // 3. Corner bonus - corners can only be blocked from one diagonal direction
  const isCorner = (row === 0 || row === 7) && (col === 0 || col === 7);
  if (isCorner) {
    score += 25;
  }
  
  // 4. Edge bonus - edges are good for diagonal control
  const isEdge = row === 0 || row === 7 || col === 0 || col === 7;
  if (isEdge && !isCorner) {
    score += 15;
  }
  
  // 5. Penalize center in early game (harder to form diagonals from center)
  const isCenter = row >= 2 && row <= 5 && col >= 2 && col <= 5;
  if (isCenter) {
    score -= 5;
  }
  
  // 6. Bonus for squares that extend existing pawns diagonally
  const directions = [
    { dr: 1, dc: 1 }, { dr: 1, dc: -1 },
    { dr: -1, dc: 1 }, { dr: -1, dc: -1 },
  ];
  
  for (const dir of directions) {
    // Check adjacent diagonal
    const adjRow = row + dir.dr;
    const adjCol = col + dir.dc;
    if (adjRow >= 0 && adjRow < 8 && adjCol >= 0 && adjCol < 8) {
      const adjIdx = adjRow * BOARD_SIZE + adjCol;
      const adjSquare = state.board[adjIdx];
      if (adjSquare.pawn?.playerId === playerId && 
          !state.blockedPawnsInfo.has(adjIdx)) {
        score += 20; // Adjacent to our pawn diagonally
      }
    }
  }
  
  return score;
}

/**
 * Evaluate a move score
 */
function evaluateMove(
  state: GameState, 
  fromIdx: number, 
  toIdx: number, 
  playerId: PlayerId
): number {
  // Apply the move temporarily to evaluate the resulting position
  const newState = movePawn(state, fromIdx, toIdx, playerId);
  if (!newState) return -1000; // Invalid move
  
  // Check if this move wins the game
  if (newState.winner === playerId) {
    return 10000; // Winning move
  }
  
  // Check opponent's winning threats before and after
  const opponentId = playerId === 1 ? 2 : 1;
  const oppThreatsAfter = findDiagonalOpportunities(newState, opponentId);
  const criticalThreats = oppThreatsAfter.filter(o => o.type === 'win');
  
  // If opponent can win next turn after our move, very bad
  if (criticalThreats.length > 0) {
    return -500;
  }
  
  // Evaluate our diagonal potential after the move
  const myOpportunities = findDiagonalOpportunities(newState, playerId);
  let score = 0;
  
  for (const opp of myOpportunities) {
    if (opp.type === 'win') score += 1000;
    else if (opp.type === 'threat') score += 100;
    else if (opp.type === 'build') score += 10;
  }
  
  // Subtract opponent's opportunities
  for (const opp of oppThreatsAfter) {
    if (opp.type === 'win') score -= 500;
    else if (opp.type === 'threat') score -= 50;
    else if (opp.type === 'build') score -= 5;
  }
  
  return score;
}

/**
 * Simple minimax with alpha-beta pruning for move phase
 */
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  aiPlayerId: PlayerId
): number {
  // Terminal conditions
  if (state.winner === aiPlayerId) return 10000;
  if (state.winner !== null) return -10000;
  if (depth === 0) {
    // Heuristic evaluation
    const myOpps = findDiagonalOpportunities(state, aiPlayerId);
    const oppOpps = findDiagonalOpportunities(state, aiPlayerId === 1 ? 2 : 1);
    
    let score = 0;
    for (const o of myOpps) {
      if (o.type === 'win') score += 1000;
      else if (o.type === 'threat') score += 100;
      else score += 10;
    }
    for (const o of oppOpps) {
      if (o.type === 'win') score -= 1000;
      else if (o.type === 'threat') score -= 100;
      else score -= 10;
    }
    
    return score;
  }
  
  const currentPlayer = state.currentPlayerId;
  const isMaximizing = currentPlayer === aiPlayerId;
  
  if (state.gamePhase === 'placement') {
    const placements = getValidPlacements(state, currentPlayer);
    if (placements.length === 0) return 0;
    
    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const pos of placements.slice(0, 10)) { // Limit branching
        const newState = placePawn(state, pos, currentPlayer);
        if (newState) {
          const evalScore = minimax(newState, depth - 1, alpha, beta, false, aiPlayerId);
          maxEval = Math.max(maxEval, evalScore);
          alpha = Math.max(alpha, evalScore);
          if (beta <= alpha) break;
        }
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const pos of placements.slice(0, 10)) {
        const newState = placePawn(state, pos, currentPlayer);
        if (newState) {
          const evalScore = minimax(newState, depth - 1, alpha, beta, true, aiPlayerId);
          minEval = Math.min(minEval, evalScore);
          beta = Math.min(beta, evalScore);
          if (beta <= alpha) break;
        }
      }
      return minEval;
    }
  } else {
    const moves = getValidMoves(state, currentPlayer);
    if (moves.length === 0) return 0;
    
    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves.slice(0, 15)) {
        const newState = movePawn(state, move.from, move.to, currentPlayer);
        if (newState) {
          const evalScore = minimax(newState, depth - 1, alpha, beta, false, aiPlayerId);
          maxEval = Math.max(maxEval, evalScore);
          alpha = Math.max(alpha, evalScore);
          if (beta <= alpha) break;
        }
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves.slice(0, 15)) {
        const newState = movePawn(state, move.from, move.to, currentPlayer);
        if (newState) {
          const evalScore = minimax(newState, depth - 1, alpha, beta, true, aiPlayerId);
          minEval = Math.min(minEval, evalScore);
          beta = Math.min(beta, evalScore);
          if (beta <= alpha) break;
        }
      }
      return minEval;
    }
  }
}

/**
 * Main AI function - find the best action
 */
export function findBestAction(
  state: GameState,
  aiPlayerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'medium'
): SimpleAction | null {
  console.log(`SimpleAI: Finding best action for Player ${aiPlayerId}, phase: ${state.gamePhase}`);
  
  // Validate it's AI's turn
  if (state.currentPlayerId !== aiPlayerId) {
    console.error(`SimpleAI: Not AI's turn! Current: ${state.currentPlayerId}, AI: ${aiPlayerId}`);
    return null;
  }
  
  // Difficulty settings
  const depthMap = { easy: 1, medium: 2, hard: 3, expert: 4 };
  const searchDepth = depthMap[difficulty];
  const randomnessFactor = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.1 : 0;
  
  if (state.gamePhase === 'placement') {
    return findBestPlacement(state, aiPlayerId, searchDepth, randomnessFactor);
  } else {
    return findBestMove(state, aiPlayerId, searchDepth, randomnessFactor);
  }
}

function findBestPlacement(
  state: GameState,
  aiPlayerId: PlayerId,
  depth: number,
  randomness: number
): SimpleAction | null {
  const validPlacements = getValidPlacements(state, aiPlayerId);
  
  if (validPlacements.length === 0) {
    console.error("SimpleAI: No valid placements!");
    return null;
  }
  
  console.log(`SimpleAI: ${validPlacements.length} valid placements`);
  
  // Score all placements
  const scoredPlacements = validPlacements.map(pos => ({
    pos,
    score: evaluatePlacement(state, pos, aiPlayerId)
  }));
  
  // Sort by score (highest first)
  scoredPlacements.sort((a, b) => b.score - a.score);
  
  // For harder difficulties, use minimax on top candidates
  if (depth >= 2) {
    const topCandidates = scoredPlacements.slice(0, 5);
    let bestPos = topCandidates[0].pos;
    let bestScore = -Infinity;
    
    for (const candidate of topCandidates) {
      const newState = placePawn(state, candidate.pos, aiPlayerId);
      if (newState) {
        const score = minimax(newState, depth - 1, -Infinity, Infinity, false, aiPlayerId);
        if (score > bestScore) {
          bestScore = score;
          bestPos = candidate.pos;
        }
      }
    }
    
    console.log(`SimpleAI: Placing at ${bestPos} with score ${bestScore}`);
    return { type: 'place', squareIndex: bestPos, toIndex: bestPos };
  }
  
  // For easy/medium, occasionally pick a random good move
  if (randomness > 0 && Math.random() < randomness) {
    const topN = Math.min(3, scoredPlacements.length);
    const randomIdx = Math.floor(Math.random() * topN);
    const chosen = scoredPlacements[randomIdx];
    console.log(`SimpleAI: Random placement at ${chosen.pos}`);
    return { type: 'place', squareIndex: chosen.pos, toIndex: chosen.pos };
  }
  
  const best = scoredPlacements[0];
  console.log(`SimpleAI: Best placement at ${best.pos} with score ${best.score}`);
  return { type: 'place', squareIndex: best.pos, toIndex: best.pos };
}

function findBestMove(
  state: GameState,
  aiPlayerId: PlayerId,
  depth: number,
  randomness: number
): SimpleAction | null {
  const validMoves = getValidMoves(state, aiPlayerId);
  
  if (validMoves.length === 0) {
    console.error("SimpleAI: No valid moves!");
    return null;
  }
  
  console.log(`SimpleAI: ${validMoves.length} valid moves`);
  
  // First check for immediate winning moves
  for (const move of validMoves) {
    const newState = movePawn(state, move.from, move.to, aiPlayerId);
    if (newState?.winner === aiPlayerId) {
      console.log(`SimpleAI: Found winning move! ${move.from} -> ${move.to}`);
      return { type: 'move', fromIndex: move.from, toIndex: move.to };
    }
  }
  
  // Check if opponent has winning threat we must block
  const opponentId = aiPlayerId === 1 ? 2 : 1;
  const oppThreats = findDiagonalOpportunities(state, opponentId);
  const criticalThreats = oppThreats.filter(o => o.type === 'win');
  
  if (criticalThreats.length > 0) {
    console.log(`SimpleAI: Opponent has ${criticalThreats.length} winning threats!`);
    // We need to try to disrupt their diagonal - but we can't place on their squares
    // So we need to find a move that changes the board state to block them
    // This is complex - for now, prioritize our own winning moves
  }
  
  // Score all moves
  const scoredMoves = validMoves.map(move => ({
    move,
    score: evaluateMove(state, move.from, move.to, aiPlayerId)
  }));
  
  // Sort by score
  scoredMoves.sort((a, b) => b.score - a.score);
  
  // For harder difficulties, use minimax
  if (depth >= 2) {
    const topCandidates = scoredMoves.slice(0, 8);
    let bestMove = topCandidates[0].move;
    let bestScore = -Infinity;
    
    for (const candidate of topCandidates) {
      const newState = movePawn(state, candidate.move.from, candidate.move.to, aiPlayerId);
      if (newState) {
        const score = minimax(newState, depth - 1, -Infinity, Infinity, false, aiPlayerId);
        if (score > bestScore) {
          bestScore = score;
          bestMove = candidate.move;
        }
      }
    }
    
    console.log(`SimpleAI: Moving ${bestMove.from} -> ${bestMove.to} with score ${bestScore}`);
    return { type: 'move', fromIndex: bestMove.from, toIndex: bestMove.to };
  }
  
  // Random element for easier difficulties
  if (randomness > 0 && Math.random() < randomness) {
    const topN = Math.min(3, scoredMoves.length);
    const randomIdx = Math.floor(Math.random() * topN);
    const chosen = scoredMoves[randomIdx];
    console.log(`SimpleAI: Random move ${chosen.move.from} -> ${chosen.move.to}`);
    return { type: 'move', fromIndex: chosen.move.from, toIndex: chosen.move.to };
  }
  
  const best = scoredMoves[0];
  console.log(`SimpleAI: Best move ${best.move.from} -> ${best.move.to} with score ${best.score}`);
  return { type: 'move', fromIndex: best.move.from, toIndex: best.move.to };
}

/**
 * Create AI instance (for compatibility)
 */
export class SimpleAI {
  private state: GameState;
  private difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  private aiPlayerId: PlayerId;
  
  constructor(
    state: GameState,
    difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'medium',
    aiPlayerId: PlayerId = 2
  ) {
    this.state = cloneGameState(state);
    this.difficulty = difficulty;
    this.aiPlayerId = aiPlayerId;
  }
  
  findBestAction(): SimpleAction | null {
    return findBestAction(this.state, this.aiPlayerId, this.difficulty);
  }
  
  recordGameOutcome(winner: PlayerId | null): void {
    // No-op for simple AI (no learning)
    console.log(`SimpleAI: Game ended. Winner: ${winner || 'Draw'}`);
  }
}

/**
 * Factory function
 */
export function createSimpleAI(
  state: GameState,
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'medium',
  aiPlayerId: PlayerId = 2
): SimpleAI {
  return new SimpleAI(state, difficulty, aiPlayerId);
}

