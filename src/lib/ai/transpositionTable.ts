// FILE: src/lib/ai/transpositionTable.ts
// PURPOSE: Caching system for previously evaluated positions (massive performance boost)
// TECHNIQUE: Zobrist hashing for fast position comparison

import type { GameState, PlayerId } from "../gameLogic";

/**
 * Transposition table entry
 */
export interface TranspositionEntry {
  hash: string;
  evaluation: number;
  depth: number; // Search depth when evaluated
  nodeType: "exact" | "lowerBound" | "upperBound";
  bestMove: string | null; // Serialized action
  timestamp: number;
  accessCount: number;
}

/**
 * Transposition Table - Cache for position evaluations
 */
export class TranspositionTable {
  private table: Map<string, TranspositionEntry> = new Map();
  private readonly maxSize = 100000; // ~100k positions (10-20MB)
  private hits = 0;
  private misses = 0;

  // Zobrist hashing random values (for fast position hashing)
  private zobristTable: number[][][] = [];

  constructor() {
    this.initializeZobrist();
  }

  /**
   * Initialize Zobrist hash table
   */
  private initializeZobrist(): void {
    const BOARD_SIZE = 8;
    const NUM_SQUARES = 64;
    const NUM_PIECES = 3; // empty, player1, player2

    // Generate random 64-bit values for each square and piece type
    for (let square = 0; square < NUM_SQUARES; square++) {
      this.zobristTable[square] = [];
      for (let piece = 0; piece < NUM_PIECES; piece++) {
        // Generate pseudo-random 53-bit number (JS number safe integer range)
        this.zobristTable[square][piece] = Math.floor(
          Math.random() * Number.MAX_SAFE_INTEGER
        );
      }
    }
  }

  /**
   * Compute Zobrist hash for game state (very fast)
   */
  computeHash(state: GameState): string {
    let hash = 0;

    for (let i = 0; i < state.board.length; i++) {
      const square = state.board[i];
      
      if (!square.pawn) {
        hash ^= this.zobristTable[i][0]; // Empty square
      } else if (square.pawn.playerId === 1) {
        hash ^= this.zobristTable[i][1]; // Player 1
      } else {
        hash ^= this.zobristTable[i][2]; // Player 2
      }
    }

    // Include game phase
    hash ^= state.gamePhase === "placement" ? 1 : 2;

    // Include current player
    hash ^= state.currentPlayerId === 1 ? 3 : 4;

    return hash.toString(36); // Convert to base-36 for smaller string
  }

  /**
   * Store position evaluation
   */
  store(
    state: GameState,
    evaluation: number,
    depth: number,
    nodeType: "exact" | "lowerBound" | "upperBound",
    bestMove: string | null = null
  ): void {
    const hash = this.computeHash(state);

    // Check if we should replace existing entry
    const existing = this.table.get(hash);
    if (existing) {
      // Replace if this search was deeper, or same depth but more recent
      if (depth < existing.depth) {
        return; // Don't replace with shallower search
      }
    }

    this.table.set(hash, {
      hash,
      evaluation,
      depth,
      nodeType,
      bestMove,
      timestamp: Date.now(),
      accessCount: 0,
    });

    // Cleanup if table is too large
    if (this.table.size > this.maxSize) {
      this.cleanup();
    }
  }

  /**
   * Probe table for cached evaluation
   */
  probe(
    state: GameState,
    depth: number
  ): {
    found: boolean;
    evaluation?: number;
    bestMove?: string | null;
    nodeType?: "exact" | "lowerBound" | "upperBound";
  } {
    const hash = this.computeHash(state);
    const entry = this.table.get(hash);

    if (!entry) {
      this.misses++;
      return { found: false };
    }

    // Entry must be from search at least as deep as current
    if (entry.depth < depth) {
      this.misses++;
      return { found: false };
    }

    // Update access tracking
    entry.accessCount++;
    entry.timestamp = Date.now();

    this.hits++;
    return {
      found: true,
      evaluation: entry.evaluation,
      bestMove: entry.bestMove,
      nodeType: entry.nodeType,
    };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalLookups = this.hits + this.misses;
    const hitRate = totalLookups > 0 ? this.hits / totalLookups : 0;

    return {
      size: this.table.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate,
      hitRatePercent: (hitRate * 100).toFixed(1) + "%",
    };
  }

  /**
   * Cleanup old/unused entries (LRU-style)
   */
  private cleanup(): void {
    const entries = Array.from(this.table.entries());

    // Sort by access count and timestamp (prefer frequently accessed, recent entries)
    entries.sort((a, b) => {
      const scoreA = a[1].accessCount * 0.7 + (a[1].timestamp / 1000000) * 0.3;
      const scoreB = b[1].accessCount * 0.7 + (b[1].timestamp / 1000000) * 0.3;
      return scoreB - scoreA;
    });

    // Keep top 75% of entries
    const keepCount = Math.floor(this.maxSize * 0.75);
    this.table.clear();

    for (let i = 0; i < keepCount && i < entries.length; i++) {
      this.table.set(entries[i][0], entries[i][1]);
    }

    console.log(
      `Transposition table cleanup: ${entries.length} -> ${this.table.size} entries`
    );
  }

  /**
   * Clear entire table
   */
  clear(): void {
    this.table.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

// Global transposition table instance
export const transpositionTable = new TranspositionTable();

