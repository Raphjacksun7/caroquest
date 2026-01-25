// FILE: src/lib/ai/redisAdapter.ts
// PURPOSE: Redis adapter for persistent AI learning across server restarts
// ENABLES: Shared learning between multiple game instances

/**
 * Redis configuration
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
}

/**
 * Learning data structure for Redis storage
 */
export interface RedisLearningData {
  patterns: Record<string, {
    hash: string;
    occurrences: number;
    wins: number;
    losses: number;
    draws: number;
    avgEvaluation: number;
    bestMoves: Array<[string, number]>;
  }>;
  gameHistory: Array<{
    id: string;
    timestamp: number;
    difficulty: string;
    winner: number | null;
    moves: number;
    outcome: string;
  }>;
  neuralWeights?: {
    weights1: number[][];
    bias1: number[];
    weights2: number[];
    bias2: number;
    trainedGames: number;
  };
  openingBook: Array<[string, {
    name: string;
    positions: number[];
    winRate: number;
    occurrences: number;
  }]>;
}

/**
 * Redis Adapter - Interfaces with Redis for persistent storage
 * Note: This is a client-side adapter that communicates with server
 */
export class RedisAdapter {
  private config: RedisConfig;
  private enabled: boolean = false;
  private serverEndpoint: string;

  constructor(serverEndpoint: string = "/api/ai/redis") {
    this.serverEndpoint = serverEndpoint;
    this.config = {
      host: "localhost",
      port: 6379,
      db: 0,
      keyPrefix: "caroquest:ai:",
    };
  }

  /**
   * Enable Redis integration
   */
  enable(config?: Partial<RedisConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.enabled = true;
    console.log("Redis adapter enabled for AI learning persistence");
  }

  /**
   * Disable Redis integration
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Save learning data to Redis (via server API)
   */
  async saveLearningData(data: RedisLearningData): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const response = await fetch(this.serverEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "save",
          key: "learning_data",
          data,
        }),
      });

      if (!response.ok) {
        console.warn("Failed to save to Redis:", response.statusText);
        return false;
      }

      console.log("AI learning data saved to Redis");
      return true;
    } catch (error) {
      console.warn("Error saving to Redis:", error);
      return false;
    }
  }

  /**
   * Load learning data from Redis (via server API)
   */
  async loadLearningData(): Promise<RedisLearningData | null> {
    if (!this.enabled) return null;

    try {
      const response = await fetch(
        `${this.serverEndpoint}?action=load&key=learning_data`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        console.warn("Failed to load from Redis:", response.statusText);
        return null;
      }

      const data = await response.json();
      console.log("AI learning data loaded from Redis");
      return data;
    } catch (error) {
      console.warn("Error loading from Redis:", error);
      return null;
    }
  }

  /**
   * Save pattern to Redis
   */
  async savePattern(
    hash: string,
    pattern: {
      occurrences: number;
      wins: number;
      losses: number;
      draws: number;
      avgEvaluation: number;
      bestMoves: Map<string, number>;
    }
  ): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const response = await fetch(this.serverEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "savePattern",
          key: `pattern:${hash}`,
          data: {
            ...pattern,
            bestMoves: Array.from(pattern.bestMoves.entries()),
          },
        }),
      });

      return response.ok;
    } catch (error) {
      console.warn("Error saving pattern to Redis:", error);
      return false;
    }
  }

  /**
   * Increment game counter
   */
  async incrementGameCounter(difficulty: string): Promise<number> {
    if (!this.enabled) return 0;

    try {
      const response = await fetch(this.serverEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "increment",
          key: `games:${difficulty}`,
        }),
      });

      if (!response.ok) return 0;

      const result = await response.json();
      return result.value || 0;
    } catch (error) {
      console.warn("Error incrementing counter:", error);
      return 0;
    }
  }

  /**
   * Get global AI statistics from Redis
   */
  async getGlobalStats(): Promise<{
    totalGames: number;
    totalPatterns: number;
    avgWinRate: number;
  } | null> {
    if (!this.enabled) return null;

    try {
      const response = await fetch(
        `${this.serverEndpoint}?action=getStats`,
        {
          method: "GET",
        }
      );

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.warn("Error getting global stats:", error);
      return null;
    }
  }

  /**
   * Check if Redis is enabled and connected
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get configuration
   */
  getConfig(): RedisConfig {
    return { ...this.config };
  }
}

// Global Redis adapter instance
export const redisAdapter = new RedisAdapter();

/**
 * Server-side Redis handler (for reference - implement on server)
 * 
 * Example implementation for server.ts:
 * 
 * import { createClient } from 'redis';
 * 
 * const redisClient = createClient({
 *   host: process.env.REDIS_HOST || 'localhost',
 *   port: parseInt(process.env.REDIS_PORT || '6379'),
 *   password: process.env.REDIS_PASSWORD,
 * });
 * 
 * app.post('/api/ai/redis', async (req, res) => {
 *   const { action, key, data } = req.body;
 *   
 *   try {
 *     if (action === 'save') {
 *       await redisClient.set(
 *         `caroquest:ai:${key}`,
 *         JSON.stringify(data),
 *         { EX: 60 * 60 * 24 * 30 } // 30 days expiry
 *       );
 *       res.json({ success: true });
 *     } else if (action === 'savePattern') {
 *       await redisClient.hSet(`caroquest:ai:patterns`, key, JSON.stringify(data));
 *       res.json({ success: true });
 *     } else if (action === 'increment') {
 *       const value = await redisClient.incr(`caroquest:ai:${key}`);
 *       res.json({ value });
 *     }
 *   } catch (error) {
 *     res.status(500).json({ error: error.message });
 *   }
 * });
 * 
 * app.get('/api/ai/redis', async (req, res) => {
 *   const { action, key } = req.query;
 *   
 *   try {
 *     if (action === 'load') {
 *       const data = await redisClient.get(`caroquest:ai:${key}`);
 *       res.json(data ? JSON.parse(data) : null);
 *     } else if (action === 'getStats') {
 *       const patterns = await redisClient.hLen('caroquest:ai:patterns');
 *       const games = await redisClient.get('caroquest:ai:games:total') || '0';
 *       res.json({
 *         totalGames: parseInt(games),
 *         totalPatterns: patterns,
 *         avgWinRate: 0.5,
 *       });
 *     }
 *   } catch (error) {
 *     res.status(500).json({ error: error.message });
 *   }
 * });
 */

