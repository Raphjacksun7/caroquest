// FILE: src/lib/ai/endgameSolver.ts
// PURPOSE: Perfect play solver for endgame positions
// USES: Retrograde analysis for positions with few remaining moves

import type { GameState, PlayerId } from "../gameLogic";
import type { Action } from "./mcts";

/**
 * Endgame database entry
 */
export interface EndgameEntry {
  hash: string;
  outcome: "win" | "loss" | "draw";
  depth: number; // Moves to mate/draw
  bestMove: Action | null;
}

/**
 * Endgame Solver - Perfect play when few moves remain
 */
export class EndgameSolver {
  private database: Map<string, EndgameEntry> = new Map();
  private readonly MAX_PIECES_FOR_TABLEBASE = 8; // Solve when <= 8 total pieces
  private readonly MAX_DEPTH = 15; // Maximum depth to solve

  /**
   * Check if position is in endgame territory
   */
  isEndgame(state: GameState): boolean {
    const totalPieces = this.countPieces(state);
    return totalPieces <= this.MAX_PIECES_FOR_TABLEBASE && state.gamePhase === "movement";
  }

  /**
   * Count total pieces on board
   */
  private countPieces(state: GameState): number {
    let count = 0;
    for (const square of state.board) {
      if (square.pawn) count++;
    }
    return count;
  }

  /**
   * Solve endgame position (minimax with perfect play)
   */
  solvePosition(
    state: GameState,
    playerId: PlayerId,
    depth: number = 0
  ): EndgameEntry | null {
    if (!this.isEndgame(state)) {
      return null; // Not an endgame position
    }

    if (depth > this.MAX_DEPTH) {
      return null; // Too deep, can't solve efficiently
    }

    const hash = this.hashPosition(state);
    
    // Check database
    const cached = this.database.get(hash);
    if (cached) {
      return cached;
    }

    // Terminal position
    if (state.winner !== null) {
      const outcome: "win" | "loss" | "draw" =
        state.winner === playerId
          ? "win"
          : state.winner === null
          ? "draw"
          : "loss";

      const entry: EndgameEntry = {
        hash,
        outcome,
        depth: 0,
        bestMove: null,
      };

      this.database.set(hash, entry);
      return entry;
    }

    // Generate all possible moves
    const moves = this.generateMoves(state);
    
    if (moves.length === 0) {
      // No moves available = draw or loss
      const entry: EndgameEntry = {
        hash,
        outcome: "draw",
        depth: 0,
        bestMove: null,
      };
      this.database.set(hash, entry);
      return entry;
    }

    // Evaluate all moves (minimax)
    let bestOutcome: "win" | "loss" | "draw" = "loss";
    let bestDepth = Infinity;
    let bestMove: Action | null = null;

    for (const move of moves) {
      const nextState = this.applyMove(state, move);
      if (!nextState) continue;

      const opponentId = playerId === 1 ? 2 : 1;
      const opponentResult = this.solvePosition(
        nextState,
        opponentId as PlayerId,
        depth + 1
      );

      if (!opponentResult) continue;

      // Invert opponent's result
      let ourOutcome: "win" | "loss" | "draw";
      if (opponentResult.outcome === "win") {
        ourOutcome = "loss";
      } else if (opponentResult.outcome === "loss") {
        ourOutcome = "win";
      } else {
        ourOutcome = "draw";
      }

      // Update best move (prefer wins, then draws, then losses)
      // If same outcome, prefer shorter paths to wins, longer paths to losses
      if (
        ourOutcome === "win" &&
        (bestOutcome !== "win" || opponentResult.depth + 1 < bestDepth)
      ) {
        bestOutcome = "win";
        bestDepth = opponentResult.depth + 1;
        bestMove = move;
      } else if (
        ourOutcome === "draw" &&
        bestOutcome === "loss"
      ) {
        bestOutcome = "draw";
        bestDepth = opponentResult.depth + 1;
        bestMove = move;
      } else if (
        ourOutcome === "loss" &&
        bestOutcome === "loss" &&
        opponentResult.depth + 1 > bestDepth
      ) {
        // Delay loss as long as possible
        bestDepth = opponentResult.depth + 1;
        bestMove = move;
      }
    }

    const entry: EndgameEntry = {
      hash,
      outcome: bestOutcome,
      depth: bestDepth,
      bestMove,
    };

    this.database.set(hash, entry);
    return entry;
  }

  /**
   * Get best move from endgame database
   */
  getBestMove(state: GameState, playerId: PlayerId): Action | null {
    const entry = this.solvePosition(state, playerId);
    
    if (entry && entry.bestMove) {
      console.log(
        `Endgame Solver: ${entry.outcome} in ${entry.depth} moves`
      );
      return entry.bestMove;
    }

    return null;
  }

  /**
   * Hash position (simplified)
   */
  private hashPosition(state: GameState): string {
    const positions: string[] = [];
    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i].pawn) {
        positions.push(`${i}:${state.board[i].pawn!.playerId}`);
      }
    }
    return positions.join("|") + `|turn:${state.currentPlayerId}`;
  }

  /**
   * Generate all legal moves (simplified - needs proper implementation)
   */
  private generateMoves(state: GameState): Action[] {
    // Placeholder - should use proper game logic
    // Import getValidMoveDestinations, etc.
    return [];
  }

  /**
   * Apply move to state (needs proper implementation)
   */
  private applyMove(state: GameState, move: Action): GameState | null {
    // Placeholder - should use movePawn from gameLogic
    return null;
  }

  /**
   * Get database statistics
   */
  getStats() {
    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (const entry of this.database.values()) {
      if (entry.outcome === "win") wins++;
      else if (entry.outcome === "loss") losses++;
      else draws++;
    }

    return {
      totalPositions: this.database.size,
      wins,
      losses,
      draws,
      maxPiecesForSolver: this.MAX_PIECES_FOR_TABLEBASE,
    };
  }

  /**
   * Clear database
   */
  clear(): void {
    this.database.clear();
  }
}

// Global endgame solver
export const endgameSolver = new EndgameSolver();

