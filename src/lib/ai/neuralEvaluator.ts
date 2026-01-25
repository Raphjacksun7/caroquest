// FILE: src/lib/ai/neuralEvaluator.ts
// PURPOSE: Neural Network-based Position Evaluator with training capabilities
// INSPIRED BY: AlphaZero approach - learns position evaluation through self-play

import type { GameState, PlayerId } from "../gameLogic";

/**
 * Simple feedforward neural network for position evaluation
 * Architecture: Input Layer (Board Features) -> Hidden Layer -> Output (Win Probability)
 */
export class NeuralNetworkEvaluator {
  private weights1: number[][]; // Input to hidden layer
  private bias1: number[];
  private weights2: number[]; // Hidden to output layer
  private bias2: number;
  
  private readonly inputSize = 192; // 64 squares * 3 features (empty, player1, player2)
  private readonly hiddenSize = 64;
  private readonly learningRate = 0.001;
  private readonly momentum = 0.9;
  
  // Momentum terms for gradient descent
  private velocity1: number[][] = [];
  private velocityBias1: number[] = [];
  private velocity2: number[] = [];
  private velocityBias2: number = 0;

  private trainingExamples: Array<{
    features: number[];
    target: number;
    weight: number; // Importance weight
  }> = [];

  private readonly storageKey = "caroquest_neural_weights";
  private trainedGames = 0;

  constructor() {
    this.weights1 = [];
    this.bias1 = [];
    this.weights2 = [];
    this.bias2 = 0;
    
    this.initializeWeights();
    this.loadWeights();
  }

  /**
   * Initialize weights with He initialization
   */
  private initializeWeights(): void {
    // Input to hidden layer
    const std1 = Math.sqrt(2.0 / this.inputSize);
    for (let i = 0; i < this.hiddenSize; i++) {
      this.weights1[i] = [];
      this.velocity1[i] = [];
      for (let j = 0; j < this.inputSize; j++) {
        this.weights1[i][j] = this.randomNormal(0, std1);
        this.velocity1[i][j] = 0;
      }
      this.bias1[i] = 0;
      this.velocityBias1[i] = 0;
    }

    // Hidden to output layer
    const std2 = Math.sqrt(2.0 / this.hiddenSize);
    for (let i = 0; i < this.hiddenSize; i++) {
      this.weights2[i] = this.randomNormal(0, std2);
      this.velocity2[i] = 0;
    }
    this.bias2 = 0;
  }

  /**
   * Generate random number from normal distribution (Box-Muller transform)
   */
  private randomNormal(mean: number, std: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * std + mean;
  }

  /**
   * Extract features from game state
   */
  private extractFeatures(state: GameState, playerId: PlayerId): number[] {
    const features: number[] = new Array(this.inputSize).fill(0);
    const board = state.board;
    
    // For each square, encode: player1 pawn, player2 pawn, empty
    for (let i = 0; i < board.length; i++) {
      const square = board[i];
      const baseIdx = i * 3;
      
      if (!square.pawn) {
        features[baseIdx + 2] = 1; // Empty
      } else if (square.pawn.playerId === playerId) {
        features[baseIdx] = 1; // Our pawn
      } else {
        features[baseIdx + 1] = 1; // Opponent pawn
      }
      
      // Additional features: blocked status, dead zones
      if (state.blockedPawnsInfo.has(i) && square.pawn?.playerId === playerId) {
        features[baseIdx] = 0.5; // Our blocked pawn (reduced value)
      }
      
      if (state.deadZoneSquares.has(i)) {
        const deadZonePlayer = state.deadZoneSquares.get(i);
        if (deadZonePlayer === playerId) {
          features[baseIdx + 2] = -0.5; // Dead zone for us (negative)
        }
      }
    }

    return features;
  }

  /**
   * ReLU activation function
   */
  private relu(x: number): number {
    return Math.max(0, x);
  }

  /**
   * Sigmoid activation function
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Derivative of sigmoid
   */
  private sigmoidDerivative(x: number): number {
    return x * (1 - x);
  }

  /**
   * Forward pass through network
   */
  private forward(features: number[]): { hidden: number[]; output: number } {
    // Input to hidden layer with ReLU
    const hidden: number[] = new Array(this.hiddenSize);
    for (let i = 0; i < this.hiddenSize; i++) {
      let sum = this.bias1[i];
      for (let j = 0; j < this.inputSize; j++) {
        sum += features[j] * this.weights1[i][j];
      }
      hidden[i] = this.relu(sum);
    }

    // Hidden to output layer with sigmoid
    let output = this.bias2;
    for (let i = 0; i < this.hiddenSize; i++) {
      output += hidden[i] * this.weights2[i];
    }
    output = this.sigmoid(output);

    return { hidden, output };
  }

  /**
   * Evaluate position (0 = loss, 1 = win, 0.5 = draw)
   */
  evaluate(state: GameState, playerId: PlayerId): number {
    const features = this.extractFeatures(state, playerId);
    const result = this.forward(features);
    return result.output;
  }

  /**
   * Add training example from game outcome
   */
  addTrainingExample(
    state: GameState,
    playerId: PlayerId,
    gameResult: number, // 1 = win, 0 = loss, 0.5 = draw
    importance: number = 1.0
  ): void {
    const features = this.extractFeatures(state, playerId);
    this.trainingExamples.push({
      features,
      target: gameResult,
      weight: importance,
    });

    // Limit training buffer size
    if (this.trainingExamples.length > 10000) {
      this.trainingExamples.shift();
    }
  }

  /**
   * Train network on accumulated examples (mini-batch gradient descent)
   */
  train(epochs: number = 10, batchSize: number = 32): void {
    if (this.trainingExamples.length < batchSize) {
      return; // Not enough data
    }

    for (let epoch = 0; epoch < epochs; epoch++) {
      // Shuffle training examples
      this.shuffleArray(this.trainingExamples);

      let totalLoss = 0;
      let batches = 0;

      // Process mini-batches
      for (let i = 0; i < this.trainingExamples.length; i += batchSize) {
        const batch = this.trainingExamples.slice(i, i + batchSize);
        const loss = this.trainBatch(batch);
        totalLoss += loss;
        batches++;
      }

      if (epoch % 5 === 0) {
        console.log(
          `Neural Network Training Epoch ${epoch}: Avg Loss = ${(totalLoss / batches).toFixed(4)}`
        );
      }
    }

    this.trainedGames++;
    this.saveWeights();
  }

  /**
   * Train on a mini-batch
   */
  private trainBatch(
    batch: Array<{ features: number[]; target: number; weight: number }>
  ): number {
    let totalLoss = 0;

    // Accumulate gradients
    const gradWeights1: number[][] = Array(this.hiddenSize)
      .fill(0)
      .map(() => Array(this.inputSize).fill(0));
    const gradBias1: number[] = Array(this.hiddenSize).fill(0);
    const gradWeights2: number[] = Array(this.hiddenSize).fill(0);
    let gradBias2 = 0;

    for (const example of batch) {
      // Forward pass
      const { hidden, output } = this.forward(example.features);

      // Calculate loss (Mean Squared Error)
      const error = output - example.target;
      totalLoss += error * error * example.weight;

      // Backpropagation
      // Output layer gradient
      const outputDelta = error * this.sigmoidDerivative(output) * example.weight;

      for (let i = 0; i < this.hiddenSize; i++) {
        gradWeights2[i] += outputDelta * hidden[i];
      }
      gradBias2 += outputDelta;

      // Hidden layer gradient
      for (let i = 0; i < this.hiddenSize; i++) {
        const hiddenDelta =
          outputDelta * this.weights2[i] * (hidden[i] > 0 ? 1 : 0); // ReLU derivative

        for (let j = 0; j < this.inputSize; j++) {
          gradWeights1[i][j] += hiddenDelta * example.features[j];
        }
        gradBias1[i] += hiddenDelta;
      }
    }

    // Update weights with momentum
    const learningRateScaled = this.learningRate / batch.length;

    // Update hidden to output layer
    for (let i = 0; i < this.hiddenSize; i++) {
      this.velocity2[i] =
        this.momentum * this.velocity2[i] - learningRateScaled * gradWeights2[i];
      this.weights2[i] += this.velocity2[i];
    }
    this.velocityBias2 =
      this.momentum * this.velocityBias2 - learningRateScaled * gradBias2;
    this.bias2 += this.velocityBias2;

    // Update input to hidden layer
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.inputSize; j++) {
        this.velocity1[i][j] =
          this.momentum * this.velocity1[i][j] -
          learningRateScaled * gradWeights1[i][j];
        this.weights1[i][j] += this.velocity1[i][j];
      }
      this.velocityBias1[i] =
        this.momentum * this.velocityBias1[i] - learningRateScaled * gradBias1[i];
      this.bias1[i] += this.velocityBias1[i];
    }

    return totalLoss / batch.length;
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Get training statistics
   */
  getStats() {
    return {
      trainedGames: this.trainedGames,
      trainingExamples: this.trainingExamples.length,
      networkSize: {
        input: this.inputSize,
        hidden: this.hiddenSize,
        output: 1,
      },
    };
  }

  /**
   * Save weights to localStorage
   */
  private saveWeights(): void {
    if (typeof window === "undefined") return;

    try {
      const data = {
        weights1: this.weights1,
        bias1: this.bias1,
        weights2: this.weights2,
        bias2: this.bias2,
        trainedGames: this.trainedGames,
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to save neural network weights:", error);
    }
  }

  /**
   * Load weights from localStorage
   */
  private loadWeights(): void {
    if (typeof window === "undefined") return;

    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.weights1 = parsed.weights1;
        this.bias1 = parsed.bias1;
        this.weights2 = parsed.weights2;
        this.bias2 = parsed.bias2;
        this.trainedGames = parsed.trainedGames || 0;
        console.log(
          `Loaded neural network weights (${this.trainedGames} games trained)`
        );
      }
    } catch (error) {
      console.warn("Failed to load neural network weights:", error);
    }
  }

  /**
   * Reset network
   */
  reset(): void {
    this.initializeWeights();
    this.trainingExamples = [];
    this.trainedGames = 0;
    this.saveWeights();
  }
}

// Global neural evaluator instance
export const neuralEvaluator = new NeuralNetworkEvaluator();

