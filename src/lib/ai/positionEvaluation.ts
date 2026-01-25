// FILE: src/lib/ai/positionEvaluation.ts
// PURPOSE: Advanced position evaluation using neural network-inspired approach

import type { GameState, PlayerId, SquareState } from "../gameLogic";
import { BOARD_SIZE } from "../gameLogic";

/**
 * Feature vector for a game position
 */
export interface PositionFeatures {
  // Material features
  pawnCount: number;
  pawnAdvantage: number;

  // Positional features
  centerControl: number;
  edgeControl: number;
  cornerControl: number;

  // Tactical features
  blockedPawns: number;
  blockingPawns: number;
  deadZones: number;
  deadZoneCreators: number;

  // Strategic features
  diagonalThreats: number; // 3-in-a-row threats
  diagonalPairs: number; // 2-in-a-row on same diagonal
  diagonalPotential: number; // Empty diagonals we control

  // Opponent features (negative values)
  opponentDiagonalThreats: number;
  opponentDiagonalPairs: number;
  opponentBlockedPawns: number;

  // Mobility
  mobility: number; // Number of legal moves
  opponentMobility: number;

  // Game phase features
  isPlacementPhase: boolean;
  placedPawnsRatio: number; // 0-1
}

/**
 * Neural network-inspired weights for position evaluation
 * These weights are tuned based on game theory and can be learned over time
 */
export class PositionEvaluator {
  // Feature weights (can be adjusted through learning)
  private weights = {
    // Material (less important in this game)
    pawnAdvantage: 0.05,

    // Positional (important for diagonal formation)
    centerControl: 0.08,
    edgeControl: 0.15, // Edges are crucial for diagonals
    cornerControl: 0.20, // Corners are very valuable

    // Tactical (medium importance)
    blockedPawns: -0.12, // Bad to have blocked pawns
    blockingPawns: 0.10, // Good to block opponent
    deadZones: -0.08, // Bad to have dead zones
    deadZoneCreators: 0.08, // Good to create opponent dead zones

    // Strategic (highest importance - this is how you win)
    diagonalThreats: 0.40, // 3-in-a-row is very dangerous
    diagonalPairs: 0.25, // 2-in-a-row is valuable
    diagonalPotential: 0.15, // Future potential matters

    // Opponent threats (must respond to these)
    opponentDiagonalThreats: -0.50, // Critical to block
    opponentDiagonalPairs: -0.20, // Important to disrupt
    opponentBlockedPawns: 0.10, // Good to block opponent

    // Mobility
    mobility: 0.05,
    opponentMobility: -0.05,

    // Phase-specific
    placementPhaseEdgeBonus: 0.10,
  };

  /**
   * Extract all features from a game state
   */
  extractFeatures(state: GameState, playerId: PlayerId): PositionFeatures {
    const opponentId = playerId === 1 ? 2 : 1;

    const features: PositionFeatures = {
      pawnCount: 0,
      pawnAdvantage: 0,
      centerControl: 0,
      edgeControl: 0,
      cornerControl: 0,
      blockedPawns: 0,
      blockingPawns: 0,
      deadZones: 0,
      deadZoneCreators: 0,
      diagonalThreats: 0,
      diagonalPairs: 0,
      diagonalPotential: 0,
      opponentDiagonalThreats: 0,
      opponentDiagonalPairs: 0,
      opponentBlockedPawns: 0,
      mobility: 0,
      opponentMobility: 0,
      isPlacementPhase: state.gamePhase === "placement",
      placedPawnsRatio: 0,
    };

    // Count pawns and positional features
    let myPawns = 0;
    let opponentPawns = 0;

    for (let i = 0; i < state.board.length; i++) {
      const square = state.board[i];
      const row = Math.floor(i / BOARD_SIZE);
      const col = i % BOARD_SIZE;

      if (square.pawn) {
        if (square.pawn.playerId === playerId) {
          myPawns++;

          // Positional scoring
          if (this.isCenter(row, col)) features.centerControl++;
          if (this.isEdge(row, col)) features.edgeControl++;
          if (this.isCorner(row, col)) features.cornerControl++;

          // Tactical features
          if (state.blockedPawnsInfo.has(i)) features.blockedPawns++;
          if (state.blockingPawnsInfo.has(i)) features.blockingPawns++;
          if (state.deadZoneCreatorPawnsInfo.has(i))
            features.deadZoneCreators++;
        } else {
          opponentPawns++;

          if (state.blockedPawnsInfo.has(i)) features.opponentBlockedPawns++;
        }
      }

      // Dead zones
      if (state.deadZoneSquares.has(i)) {
        if (state.deadZoneSquares.get(i) === playerId) {
          features.deadZones++;
        }
      }
    }

    features.pawnCount = myPawns;
    features.pawnAdvantage = myPawns - opponentPawns;
    features.placedPawnsRatio =
      (state.placedPawns[playerId] + state.placedPawns[opponentId]) /
      (state.options.pawnsPerPlayer * 2);

    // Strategic features - diagonal analysis
    const diagonalAnalysis = this.analyzeDiagonals(state, playerId);
    features.diagonalThreats = diagonalAnalysis.threats;
    features.diagonalPairs = diagonalAnalysis.pairs;
    features.diagonalPotential = diagonalAnalysis.potential;

    const opponentDiagonalAnalysis = this.analyzeDiagonals(state, opponentId);
    features.opponentDiagonalThreats = opponentDiagonalAnalysis.threats;
    features.opponentDiagonalPairs = opponentDiagonalAnalysis.pairs;

    // Mobility - count available moves
    features.mobility = this.countMobility(state, playerId);
    features.opponentMobility = this.countMobility(state, opponentId);

    return features;
  }

  /**
   * Evaluate a position using extracted features
   */
  evaluate(state: GameState, playerId: PlayerId): number {
    // Check for terminal positions
    if (state.winner === playerId) return 1.0;
    if (state.winner !== null) return 0.0;

    const features = this.extractFeatures(state, playerId);

    // Calculate weighted sum of features
    let score = 0.5; // Start at neutral

    score += features.pawnAdvantage * this.weights.pawnAdvantage;
    score += features.centerControl * this.weights.centerControl;
    score += features.edgeControl * this.weights.edgeControl;
    score += features.cornerControl * this.weights.cornerControl;
    score += features.blockedPawns * this.weights.blockedPawns;
    score += features.blockingPawns * this.weights.blockingPawns;
    score += features.deadZones * this.weights.deadZones;
    score += features.deadZoneCreators * this.weights.deadZoneCreators;
    score += features.diagonalThreats * this.weights.diagonalThreats;
    score += features.diagonalPairs * this.weights.diagonalPairs;
    score += features.diagonalPotential * this.weights.diagonalPotential;
    score +=
      features.opponentDiagonalThreats * this.weights.opponentDiagonalThreats;
    score += features.opponentDiagonalPairs * this.weights.opponentDiagonalPairs;
    score += features.opponentBlockedPawns * this.weights.opponentBlockedPawns;
    score += features.mobility * this.weights.mobility * 0.01; // Scale down
    score += features.opponentMobility * this.weights.opponentMobility * 0.01;

    // Phase-specific adjustments
    if (features.isPlacementPhase) {
      score += features.edgeControl * this.weights.placementPhaseEdgeBonus;
    }

    // Clamp score between 0 and 1
    return Math.max(0.0, Math.min(1.0, score));
  }

  /**
   * Analyze diagonal formations
   */
  private analyzeDiagonals(
    state: GameState,
    playerId: PlayerId
  ): {
    threats: number;
    pairs: number;
    potential: number;
  } {
    let threats = 0; // 3-in-a-row
    let pairs = 0; // 2-in-a-row
    let potential = 0; // Empty diagonals with 1 pawn

    const board = state.board;
    const playerColor = state.playerColors[playerId];

    // Directions for diagonals
    const directions = [
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 },
      { dr: -1, dc: 1 },
      { dr: -1, dc: -1 },
    ];

    // Check all possible diagonal starting points
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (const dir of directions) {
          const diagonalInfo = this.checkDiagonal(
            board,
            row,
            col,
            dir,
            playerId,
            playerColor,
            state
          );

          if (diagonalInfo.length >= 4) {
            // Can form a winning diagonal
            if (diagonalInfo.myPawns === 3) threats++;
            else if (diagonalInfo.myPawns === 2) pairs++;
            else if (diagonalInfo.myPawns === 1) potential++;
          }
        }
      }
    }

    return { threats, pairs, potential };
  }

  /**
   * Check a specific diagonal
   */
  private checkDiagonal(
    board: SquareState[],
    startRow: number,
    startCol: number,
    direction: { dr: number; dc: number },
    playerId: PlayerId,
    playerColor: "black" | "white",
    state: GameState
  ): {
    length: number;
    myPawns: number;
    emptySquares: number;
    opponentPawns: number;
  } {
    let length = 0;
    let myPawns = 0;
    let emptySquares = 0;
    let opponentPawns = 0;

    for (let step = 0; step < 4; step++) {
      const row = startRow + direction.dr * step;
      const col = startCol + direction.dc * step;

      if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
        break;
      }

      const idx = row * BOARD_SIZE + col;
      const square = board[idx];

      // Only count squares on our color
      if (square.boardColor !== playerColor) continue;

      length++;

      if (square.pawn) {
        if (square.pawn.playerId === playerId) {
          myPawns++;
        } else {
          opponentPawns++;
        }
      } else if (!state.deadZoneSquares.has(idx)) {
        emptySquares++;
      }
    }

    return { length, myPawns, emptySquares, opponentPawns };
  }

  /**
   * Count available moves (mobility)
   */
  private countMobility(state: GameState, playerId: PlayerId): number {
    if (state.gamePhase === "placement") {
      // Count valid placement squares
      let count = 0;
      const playerColor = state.playerColors[playerId];

      for (let i = 0; i < state.board.length; i++) {
        const square = state.board[i];
        if (
          square.boardColor === playerColor &&
          !square.pawn &&
          !state.deadZoneSquares.has(i)
        ) {
          count++;
        }
      }

      return count;
    } else {
      // Count valid moves
      let count = 0;

      for (let i = 0; i < state.board.length; i++) {
        const square = state.board[i];
        if (
          square.pawn?.playerId === playerId &&
          !state.blockedPawnsInfo.has(i)
        ) {
          // This pawn can potentially move
          // Check adjacent squares (simplified mobility count)
          const row = Math.floor(i / BOARD_SIZE);
          const col = i % BOARD_SIZE;

          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;

              const newRow = row + dr;
              const newCol = col + dc;

              if (
                newRow >= 0 &&
                newRow < BOARD_SIZE &&
                newCol >= 0 &&
                newCol < BOARD_SIZE
              ) {
                const newIdx = newRow * BOARD_SIZE + newCol;
                const targetSquare = state.board[newIdx];

                if (
                  !targetSquare.pawn &&
                  targetSquare.boardColor === state.playerColors[playerId] &&
                  !state.deadZoneSquares.has(newIdx)
                ) {
                  count++;
                }
              }
            }
          }
        }
      }

      return count;
    }
  }

  /**
   * Update weights based on learning (for future enhancement)
   */
  updateWeights(deltas: Partial<typeof this.weights>): void {
    Object.assign(this.weights, deltas);
  }

  /**
   * Get current weights
   */
  getWeights(): typeof this.weights {
    return { ...this.weights };
  }

  // Helper functions
  private isCenter(row: number, col: number): boolean {
    return row >= 2 && row <= 5 && col >= 2 && col <= 5;
  }

  private isEdge(row: number, col: number): boolean {
    return (
      row === 0 || row === BOARD_SIZE - 1 || col === 0 || col === BOARD_SIZE - 1
    );
  }

  private isCorner(row: number, col: number): boolean {
    return (
      (row === 0 || row === BOARD_SIZE - 1) &&
      (col === 0 || col === BOARD_SIZE - 1)
    );
  }
}

// Global position evaluator instance
export const positionEvaluator = new PositionEvaluator();

