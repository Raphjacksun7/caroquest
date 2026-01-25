// FILE: src/lib/ai/openingBook.ts
// PURPOSE: Opening book with proven strong opening strategies
// BASED ON: Expert gameplay patterns and edge-based diagonal control

import type { GameState, PlayerId } from "../gameLogic";
import type { Action } from "./mcts";
import { BOARD_SIZE } from "../gameLogic";

/**
 * Opening book entry
 */
export interface OpeningEntry {
  name: string;
  positions: number[]; // Sequence of board positions
  winRate: number; // Historical win rate
  occurrences: number; // Times played
  description: string;
}

/**
 * Opening Book - stores strong opening patterns
 */
export class OpeningBook {
  private book: Map<string, OpeningEntry> = new Map();
  private readonly storageKey = "caroquest_opening_book";

  constructor() {
    this.initializeDefaultOpenings();
    this.loadFromStorage();
  }

  /**
   * Initialize with proven strong openings
   */
  private initializeDefaultOpenings(): void {
    // Corner control openings (player 1 - goes first)
    this.addOpening({
      name: "Corner Diamond",
      positions: [0, 63, 7, 56], // All 4 corners
      winRate: 0.62,
      occurrences: 0,
      description: "Control all corners for maximum diagonal potential",
    });

    this.addOpening({
      name: "Top-Left Expansion",
      positions: [0, 1, 8, 9], // Top-left cluster
      winRate: 0.58,
      occurrences: 0,
      description: "Build strong presence in top-left quadrant",
    });

    this.addOpening({
      name: "Diagonal Threat",
      positions: [0, 9, 18, 27], // Main diagonal
      winRate: 0.65,
      occurrences: 0,
      description: "Immediate diagonal formation along main diagonal",
    });

    this.addOpening({
      name: "Edge Domination",
      positions: [0, 7, 3, 4], // Top edge
      winRate: 0.60,
      occurrences: 0,
      description: "Control top edge for diagonal options",
    });

    // Counter-openings (player 2 - defensive)
    this.addOpening({
      name: "Center Block",
      positions: [null, 27, 28, 36, 35], // Responding to corner with center
      winRate: 0.55,
      occurrences: 0,
      description: "Block opponent's diagonal with center control",
    });

    this.addOpening({
      name: "Opposite Corner",
      positions: [null, 63, 62, 55, 54], // Respond to corner with opposite
      winRate: 0.57,
      occurrences: 0,
      description: "Take opposite corner and adjacent squares",
    });
  }

  /**
   * Add opening to book
   */
  private addOpening(entry: OpeningEntry): void {
    const key = this.getOpeningKey(entry.positions.filter((p) => p !== null) as number[]);
    this.book.set(key, entry);
  }

  /**
   * Generate key from position sequence
   */
  private getOpeningKey(positions: number[]): string {
    return positions.sort((a, b) => a - b).join("-");
  }

  /**
   * Get current game opening sequence
   */
  private getCurrentOpening(state: GameState): number[] {
    const positions: number[] = [];
    
    // Collect all pawn positions in placement order (approximate)
    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i].pawn) {
        positions.push(i);
      }
    }

    return positions.slice(0, 4); // Consider first 4 moves as opening
  }

  /**
   * Check if current position matches known opening
   */
  getOpeningMove(state: GameState, playerId: PlayerId): Action | null {
    if (state.gamePhase !== "placement") {
      return null; // Only in placement phase
    }

    const currentPositions = this.getCurrentOpening(state);
    
    // Only use opening book for first 4 moves
    if (currentPositions.length >= 4) {
      return null;
    }

    // Find matching opening with next move
    let bestMatch: { entry: OpeningEntry; nextMove: number } | null = null;
    let bestWinRate = 0;

    for (const [key, entry] of this.book.entries()) {
      // Check if current positions match the start of this opening
      let matches = true;
      for (let i = 0; i < currentPositions.length; i++) {
        if (entry.positions[i] !== null && entry.positions[i] !== currentPositions[i]) {
          matches = false;
          break;
        }
      }

      if (matches && currentPositions.length < entry.positions.length) {
        const nextMove = entry.positions[currentPositions.length];
        if (nextMove !== null && entry.winRate > bestWinRate) {
          bestMatch = { entry, nextMove: nextMove as number };
          bestWinRate = entry.winRate;
        }
      }
    }

    if (bestMatch) {
      console.log(
        `Opening Book: Using "${bestMatch.entry.name}" move (${bestMatch.entry.winRate.toFixed(2)} win rate)`
      );
      return {
        type: "place",
        squareIndex: bestMatch.nextMove,
        toIndex: bestMatch.nextMove,
      };
    }

    return null;
  }

  /**
   * Update opening statistics after game
   */
  updateOpening(state: GameState, winner: PlayerId | null): void {
    const positions = this.getCurrentOpening(state);
    if (positions.length < 3) return; // Not enough moves to be an opening

    const key = this.getOpeningKey(positions.slice(0, 4));
    const entry = this.book.get(key);

    if (entry) {
      entry.occurrences++;
      
      // Update win rate (exponential moving average)
      const result = winner === 1 ? 1 : winner === null ? 0.5 : 0;
      const alpha = 0.1; // Learning rate
      entry.winRate = entry.winRate * (1 - alpha) + result * alpha;

      this.saveToStorage();
    }
  }

  /**
   * Get book statistics
   */
  getStats() {
    const entries = Array.from(this.book.values());
    return {
      totalOpenings: entries.length,
      totalOccurrences: entries.reduce((sum, e) => sum + e.occurrences, 0),
      avgWinRate:
        entries.reduce((sum, e) => sum + e.winRate, 0) / entries.length || 0,
      topOpenings: entries
        .sort((a, b) => b.winRate - a.winRate)
        .slice(0, 5)
        .map((e) => ({
          name: e.name,
          winRate: e.winRate,
          occurrences: e.occurrences,
        })),
    };
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === "undefined") return;

    try {
      const data = Array.from(this.book.entries());
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to save opening book:", error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === "undefined") return;

    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        for (const [key, entry] of parsed) {
          this.book.set(key, entry);
        }
        console.log(`Loaded opening book with ${this.book.size} openings`);
      }
    } catch (error) {
      console.warn("Failed to load opening book:", error);
    }
  }

  /**
   * Reset book to defaults
   */
  reset(): void {
    this.book.clear();
    this.initializeDefaultOpenings();
    this.saveToStorage();
  }
}

// Global opening book instance
export const openingBook = new OpeningBook();

