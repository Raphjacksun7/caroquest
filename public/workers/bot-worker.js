/**
 * Self-Contained AI Bot Worker
 * This file includes the BotEngine and the complete, real game logic dependencies
 * to run independently in a Web Worker thread.
 */

// --- Dependencies from gameLogic.ts ---
// The full, correct game logic is now included directly in this worker file.


// --- Constants ---
const BOARD_SIZE = 8;
const PAWNS_PER_PLAYER = 6;

// --- Game Logic Helper Functions (copied from your code) ---
function isValidPlacement(squareIndex, playerId, gameState) {
  playerId = playerId !== undefined ? playerId : gameState.currentPlayerId;

  const square = gameState.board[squareIndex];
  if (!square || square.pawn) return false;
  if (square.boardColor !== gameState.playerColors[playerId]) return false;
  if (gameState.deadZoneSquares.get(squareIndex) === playerId) return false;

  const { row, col } = square;
  const opponentId = playerId === 1 ? 2 : 1;

  if (col > 0 && col < BOARD_SIZE - 1) {
    const leftSquare = gameState.board[row * BOARD_SIZE + (col - 1)];
    const rightSquare = gameState.board[row * BOARD_SIZE + (col + 1)];
    if (
      leftSquare?.pawn?.playerId === opponentId &&
      rightSquare?.pawn?.playerId === opponentId
    ) {
      return false;
    }
  }

  if (row > 0 && row < BOARD_SIZE - 1) {
    const topSquare = gameState.board[(row - 1) * BOARD_SIZE + col];
    const bottomSquare = gameState.board[(row + 1) * BOARD_SIZE + col];
    if (
      topSquare?.pawn?.playerId === opponentId &&
      bottomSquare?.pawn?.playerId === opponentId
    ) {
      return false;
    }
  }

  return true;
}

function isValidMove(fromIndex, toIndex, playerId, gameState) {
  playerId = playerId !== undefined ? playerId : gameState.currentPlayerId;

  const fromSquare = gameState.board[fromIndex];
  const toSquare = gameState.board[toIndex];

  if (!fromSquare?.pawn || fromSquare.pawn.playerId !== playerId) return false;
  if (!toSquare || toSquare.pawn) return false;
  if (toSquare.boardColor !== gameState.playerColors[playerId]) return false;
  if (gameState.blockedPawnsInfo.has(fromIndex)) return false;
  if (gameState.deadZoneSquares.get(toIndex) === playerId) return false;

  return true;
}

function getValidMoveDestinations(fromIndex, playerId, gameState) {
  playerId = playerId !== undefined ? playerId : gameState.currentPlayerId;

  const validDestinations = [];
  const fromSquare = gameState.board[fromIndex];

  if (!fromSquare?.pawn || fromSquare.pawn.playerId !== playerId) return [];
  if (gameState.blockedPawnsInfo.has(fromIndex)) return [];

  for (const square of gameState.board) {
    if (
      !square.pawn &&
      square.boardColor === gameState.playerColors[playerId] &&
      !(gameState.deadZoneSquares.get(square.index) === playerId)
    ) {
      validDestinations.push(square.index);
    }
  }

  return validDestinations;
}

function updateBlockingStatus(board) {
  const blockedPawns = new Set();
  const blockingPawns = new Set();

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 1; col < BOARD_SIZE - 1; col++) {
      const centerIndex = row * BOARD_SIZE + col;
      const leftIndex = row * BOARD_SIZE + col - 1;
      const rightIndex = row * BOARD_SIZE + col + 1;

      const centerSquare = board[centerIndex];
      const leftSquare = board[leftIndex];
      const rightSquare = board[rightIndex];

      if (centerSquare?.pawn && leftSquare?.pawn && rightSquare?.pawn) {
        const opponentPawn = centerSquare.pawn;
        const leftBlockerPawn = leftSquare.pawn;
        const rightBlockerPawn = rightSquare.pawn;

        if (
          leftBlockerPawn.playerId === rightBlockerPawn.playerId &&
          leftBlockerPawn.playerId !== opponentPawn.playerId
        ) {
          blockedPawns.add(centerIndex);
          blockingPawns.add(leftIndex);
          blockingPawns.add(rightIndex);
        }
      }
    }
  }

  for (let col = 0; col < BOARD_SIZE; col++) {
    for (let row = 1; row < BOARD_SIZE - 1; row++) {
      const centerIndex = row * BOARD_SIZE + col;
      const topIndex = (row - 1) * BOARD_SIZE + col;
      const bottomIndex = (row + 1) * BOARD_SIZE + col;

      const centerSquare = board[centerIndex];
      const topSquare = board[topIndex];
      const bottomSquare = board[bottomIndex];

      if (centerSquare?.pawn && topSquare?.pawn && bottomSquare?.pawn) {
        const opponentPawn = centerSquare.pawn;
        const topBlockerPawn = topSquare.pawn;
        const bottomBlockerPawn = bottomSquare.pawn;

        if (
          topBlockerPawn.playerId === bottomBlockerPawn.playerId &&
          topBlockerPawn.playerId !== opponentPawn.playerId
        ) {
          blockedPawns.add(centerIndex);
          blockingPawns.add(topIndex);
          blockingPawns.add(bottomIndex);
        }
      }
    }
  }

  return { blockedPawns, blockingPawns };
}

function updateDeadZones(board, playerColors) {
  const deadZones = new Map();
  const deadZoneCreatorPawns = new Set();

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE - 2; col++) {
      const p1Square = board[row * BOARD_SIZE + col];
      const emptySquare = board[row * BOARD_SIZE + (col + 1)];
      const p2Square = board[row * BOARD_SIZE + (col + 2)];

      if (
        p1Square?.pawn &&
        p2Square?.pawn &&
        !emptySquare?.pawn &&
        p1Square.pawn.playerId === p2Square.pawn.playerId
      ) {
        const creatorPlayerId = p1Square.pawn.playerId;
        const opponentPlayerId = creatorPlayerId === 1 ? 2 : 1;

        if (emptySquare.boardColor === playerColors[opponentPlayerId]) {
          deadZones.set(emptySquare.index, opponentPlayerId);
          deadZoneCreatorPawns.add(p1Square.index);
          deadZoneCreatorPawns.add(p2Square.index);
        }
      }
    }
  }

  for (let col = 0; col < BOARD_SIZE; col++) {
    for (let row = 0; row < BOARD_SIZE - 2; row++) {
      const p1Square = board[row * BOARD_SIZE + col];
      const emptySquare = board[(row + 1) * BOARD_SIZE + col];
      const p2Square = board[(row + 2) * BOARD_SIZE + col];

      if (
        p1Square?.pawn &&
        p2Square?.pawn &&
        !emptySquare?.pawn &&
        p1Square.pawn.playerId === p2Square.pawn.playerId
      ) {
        const creatorPlayerId = p1Square.pawn.playerId;
        const opponentPlayerId = creatorPlayerId === 1 ? 2 : 1;

        if (emptySquare.boardColor === playerColors[opponentPlayerId]) {
          deadZones.set(emptySquare.index, opponentPlayerId);
          deadZoneCreatorPawns.add(p1Square.index);
          deadZoneCreatorPawns.add(p2Square.index);
        }
      }
    }
  }

  return { deadZones, deadZoneCreatorPawns };
}

function checkWinCondition(gameState) {
  const {
    board,
    playerColors,
    deadZoneSquares,
    blockedPawnsInfo,
    blockingPawnsInfo,
    deadZoneCreatorPawnsInfo,
  } = gameState;

  const diagonalDirections = [
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 },
    { dr: -1, dc: 1 },
    { dr: -1, dc: -1 },
  ];

  for (const playerId of [1, 2]) {
    const playerAssignedColor = playerColors[playerId];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const startIndex = r * BOARD_SIZE + c;

        for (const direction of diagonalDirections) {
          const lineIndices = [];
          let possible = true;

          for (let step = 0; step < 4; step++) {
            const currentRow = r + direction.dr * step;
            const currentCol = c + direction.dc * step;

            if (
              currentRow < 0 ||
              currentRow >= BOARD_SIZE ||
              currentCol < 0 ||
              currentCol >= BOARD_SIZE
            ) {
              possible = false;
              break;
            }

            const currentIndex = currentRow * BOARD_SIZE + currentCol;
            const currentSquare = board[currentIndex];

            if (
              !currentSquare.pawn ||
              currentSquare.pawn.playerId !== playerId ||
              currentSquare.boardColor !== playerAssignedColor ||
              blockedPawnsInfo.has(currentIndex) ||
              blockingPawnsInfo.has(currentIndex) ||
              deadZoneCreatorPawnsInfo.has(currentIndex) ||
              deadZoneSquares.get(currentIndex) === playerId
            ) {
              possible = false;
              break;
            }
            lineIndices.push(currentIndex);
          }

          if (possible && lineIndices.length === 4) {
            return { winner: playerId, winningLine: lineIndices };
          }
        }
      }
    }
  }

  return { winner: null, winningLine: null };
}

function placePawn(gameState, index) {
  if (!isValidPlacement(index, gameState.currentPlayerId, gameState)) {
    return null;
  }

  const { currentPlayerId, pawnsToPlace, board, placedPawns, playerColors } =
    gameState;

  const newPawn = {
    id: `p${currentPlayerId}_${placedPawns[currentPlayerId] + 1}`,
    playerId: currentPlayerId,
    color: playerColors[currentPlayerId],
  };

  const newBoard = board.map((sq, i) =>
    i === index
      ? { ...sq, pawn: newPawn, highlight: undefined }
      : { ...sq, highlight: undefined }
  );

  const newPawnsToPlace = {
    ...pawnsToPlace,
    [currentPlayerId]: pawnsToPlace[currentPlayerId] - 1,
  };
  const newPlacedPawns = {
    ...placedPawns,
    [currentPlayerId]: placedPawns[currentPlayerId] + 1,
  };

  let nextPhase = gameState.gamePhase;
  if (newPawnsToPlace[1] === 0 && newPawnsToPlace[2] === 0) {
    nextPhase = "movement";
  }

  return applyCommonLogic(
    {
      ...gameState,
      pawnsToPlace: newPawnsToPlace,
      placedPawns: newPlacedPawns,
      gamePhase: nextPhase,
      lastMove: { from: null, to: index },
    },
    newBoard
  );
}

function movePawn(gameState, fromIndex, toIndex) {
  if (!isValidMove(fromIndex, toIndex, gameState.currentPlayerId, gameState)) {
    return null;
  }

  const pawnToMove = gameState.board[fromIndex].pawn;
  if (!pawnToMove) return null;

  const newBoard = gameState.board.map((sq, i) => {
    let newSq = { ...sq, highlight: undefined };
    if (i === fromIndex) return { ...newSq, pawn: null };
    if (i === toIndex) return { ...newSq, pawn: pawnToMove };
    return newSq;
  });

  return applyCommonLogic(
    {
      ...gameState,
      lastMove: { from: fromIndex, to: toIndex },
    },
    newBoard
  );
}

function applyCommonLogic(gameState, newBoard) {
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newBoard);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(
    newBoard,
    gameState.playerColors
  );

  const tempGameState = {
    ...gameState,
    board: newBoard,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
    selectedPawnIndex: null,
  };

  const { winner, winningLine } = checkWinCondition(tempGameState);

  return {
    ...tempGameState,
    winner,
    winningLine,
    currentPlayerId: winner
      ? gameState.currentPlayerId
      : gameState.currentPlayerId === 1
      ? 2
      : 1,
  };
}

// --- Minimax Bot Implementation ---

// Zobrist hashing for transposition table
class ZobristHash {
  constructor() {
    this.pawnKeys = Array(64).fill(null).map(() => 
      Array(2).fill(null).map(() => this.randomInt())
    );
    this.blockedKeys = Array(64).fill(null).map(() => this.randomInt());
    this.deadZoneKeys = Array(64).fill(null).map(() => 
      Array(2).fill(null).map(() => this.randomInt())
    );
    this.phaseKey = this.randomInt();
    this.sideToMoveKey = this.randomInt();
  }

  randomInt() {
    return Math.floor(Math.random() * 2147483647);
  }

  hash(state) {
    let hash = 0;

    for (let i = 0; i < 64; i++) {
      const square = state.board[i];
      if (square.pawn) {
        const playerIdx = square.pawn.playerId - 1;
        hash ^= this.pawnKeys[i][playerIdx];
      }
      
      if (state.blockedPawnsInfo.has(i)) {
        hash ^= this.blockedKeys[i];
      }
      
      const deadZonePlayer = state.deadZoneSquares.get(i);
      if (deadZonePlayer !== undefined) {
        hash ^= this.deadZoneKeys[i][deadZonePlayer - 1];
      }
    }

    if (state.gamePhase === "placement") {
      hash ^= this.phaseKey;
    }

    if (state.currentPlayerId === 2) {
      hash ^= this.sideToMoveKey;
    }

    return hash;
  }
}

// Transposition table
class TranspositionTable {
  constructor(maxSize = 100000) {
    this.table = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    return this.table.get(key) || null;
  }

  set(key, result) {
    if (this.table.size >= this.maxSize) {
      const firstKey = this.table.keys().next().value;
      this.table.delete(firstKey);
    }
    this.table.set(key, result);
  }

  clear() {
    this.table.clear();
  }
}

// Main Bot Engine
class MinimaxBot {
  constructor(difficulty) {
    this.zobrist = new ZobristHash();
    this.tt = new TranspositionTable();
    this.difficulty = difficulty;
    
    // Three difficulty levels
    switch (difficulty) {
      case 'easy':
        this.maxDepth = 3;
        this.timeLimit = 500;
        this.randomFactor = 0.3; // 30% chance of random move
        break;
      case 'medium':
        this.maxDepth = 5;
        this.timeLimit = 1000;
        this.randomFactor = 0.1; // 10% chance of random move
        break;
      case 'hard':
        this.maxDepth = 8; // Expert level
        this.timeLimit = 2000;
        this.randomFactor = 0; // No random moves
        break;
    }
  }

  findBestMove(gameState) {
    this.startTime = Date.now();
    this.nodesSearched = 0;

    // Easy mode: sometimes make random moves
    if (this.difficulty === 'easy' && Math.random() < this.randomFactor) {
      const moves = this.generateMoves(gameState);
      if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        // Convert to expected format
        if (randomMove.type === 'place') {
          return {
            type: 'place',
            squareIndex: randomMove.squareIndex,
            toIndex: randomMove.squareIndex,
            quality: 0
          };
        } else {
          return randomMove;
        }
      }
    }

    // Iterative deepening
    let bestMove = null;
    
    for (let depth = 1; depth <= this.maxDepth; depth++) {
      if (Date.now() - this.startTime > this.timeLimit * 0.8) {
        break;
      }
      
      const result = this.minimax(gameState, depth, -Infinity, Infinity, true);
      if (result.bestMove) {
        bestMove = result.bestMove;
      }
      
      // If we found a winning move, stop searching
      if (result.score >= 900) {
        break;
      }
    }

    console.log(`Bot searched ${this.nodesSearched} nodes in ${Date.now() - this.startTime}ms`);
    
    return bestMove;
  }

  minimax(state, depth, alpha, beta, maximizing) {
    this.nodesSearched++;

    // Check transposition table
    const hash = this.zobrist.hash(state);
    const ttEntry = this.tt.get(hash);
    if (ttEntry && depth <= 3) {
      return ttEntry;
    }

    // Terminal node or depth limit
    if (state.winner !== null) {
      const score = state.winner === state.currentPlayerId ? 1000 : -1000;
      return { score, bestMove: null };
    }

    if (depth === 0) {
      return { score: this.evaluate(state), bestMove: null };
    }

    // Time limit check
    if (Date.now() - this.startTime > this.timeLimit) {
      return { score: this.evaluate(state), bestMove: null };
    }

    // Generate and order moves
    const moves = this.generateOrderedMoves(state);
    
    if (moves.length === 0) {
      return { score: 0, bestMove: null };
    }

    let bestScore = maximizing ? -Infinity : Infinity;
    let bestMove = null;

    for (const move of moves) {
      const newState = this.applyMove(state, move);
      if (!newState) continue;

      const result = this.minimax(newState, depth - 1, alpha, beta, !maximizing);
      const score = result.score;

      if (maximizing) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        alpha = Math.max(alpha, score);
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = move;
        }
        beta = Math.min(beta, score);
      }
      
      if (beta <= alpha) {
        break; // Alpha-beta pruning
      }
    }

    const result = { score: bestScore, bestMove };
    
    // Store in transposition table
    if (depth >= 3) {
      this.tt.set(hash, result);
    }

    return result;
  }

  generateOrderedMoves(state) {
    const moves = this.generateMoves(state);
    
    // Score each move for ordering
    const scoredMoves = moves.map(move => {
      let score = 0;
      
      // Check for immediate win
      const newState = this.applyMove(state, move);
      if (newState && newState.winner === state.currentPlayerId) {
        score += 1000;
      }
      
      // Prefer moves that block opponent diagonals
      if (this.blocksOpponentDiagonal(state, move)) {
        score += 100;
      }
      
      // Prefer moves that contribute to our diagonals
      if (this.contributesDiagonal(state, move)) {
        score += 50;
      }
      
      // Prefer edge positions in placement phase
      if (state.gamePhase === "placement") {
        const row = Math.floor(move.squareIndex / BOARD_SIZE);
        const col = move.squareIndex % BOARD_SIZE;
        if (row === 0 || row === 7 || col === 0 || col === 7) {
          score += 30;
        }
      }
      
      return { move, score };
    });
    
    // Sort by score (highest first)
    scoredMoves.sort((a, b) => b.score - a.score);
    
    return scoredMoves.map(sm => sm.move);
  }

  generateMoves(state) {
    const moves = [];
    const playerId = state.currentPlayerId;

    if (state.gamePhase === "placement") {
      // Generate placement moves
      for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        if (isValidPlacement(i, playerId, state)) {
          moves.push({ 
            type: "place", 
            squareIndex: i,
            toIndex: i,
            fromIndex: null
          });
        }
      }
    } else {
      // Generate movement moves
      for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        const square = state.board[i];
        if (
          square.pawn?.playerId === playerId && 
          !state.blockedPawnsInfo.has(i)
        ) {
          const destinations = getValidMoveDestinations(i, playerId, state);
          for (const dest of destinations) {
            moves.push({ 
              type: "move", 
              fromIndex: i, 
              toIndex: dest,
              squareIndex: dest
            });
          }
        }
      }
    }

    return moves;
  }

  applyMove(state, move) {
    if (move.type === "place") {
      return placePawn(state, move.squareIndex);
    } else {
      return movePawn(state, move.fromIndex, move.toIndex);
    }
  }

  evaluate(state) {
    const playerId = state.currentPlayerId;
    const opponentId = playerId === 1 ? 2 : 1;
    
    let score = 0;

    // Material (active pawns)
    let myActivePawns = 0;
    let oppActivePawns = 0;
    
    // Diagonal threats
    let myDiagonalThreats = 0;
    let oppDiagonalThreats = 0;
    
    // Count pawns and evaluate positions
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const square = state.board[i];
      
      if (square.pawn?.playerId === playerId) {
        if (!state.blockedPawnsInfo.has(i)) {
          myActivePawns++;
          
          // Check diagonal potential
          const diagonalValue = this.evaluateDiagonalPosition(state, i, playerId);
          myDiagonalThreats += diagonalValue;
        }
      } else if (square.pawn?.playerId === opponentId) {
        if (!state.blockedPawnsInfo.has(i)) {
          oppActivePawns++;
          
          const diagonalValue = this.evaluateDiagonalPosition(state, i, opponentId);
          oppDiagonalThreats += diagonalValue;
        }
      }
    }
    
    // Scoring
    score += (myActivePawns - oppActivePawns) * 10;
    score += (myDiagonalThreats - oppDiagonalThreats) * 15;
    
    // Dead zones
    let myDeadZones = 0;
    let oppDeadZones = 0;
    
    state.deadZoneSquares.forEach((affectedPlayer) => {
      if (affectedPlayer === playerId) oppDeadZones++;
      else myDeadZones++;
    });
    
    score += (myDeadZones - oppDeadZones) * 8;
    
    // Blocked pawns
    let myBlockedPawns = 0;
    let oppBlockedPawns = 0;
    
    state.blockedPawnsInfo.forEach(idx => {
      const pawn = state.board[idx].pawn;
      if (pawn?.playerId === playerId) myBlockedPawns++;
      else if (pawn?.playerId === opponentId) oppBlockedPawns++;
    });
    
    score += (oppBlockedPawns - myBlockedPawns) * 12;

    return score;
  }

  evaluateDiagonalPosition(state, position, playerId) {
    const row = Math.floor(position / BOARD_SIZE);
    const col = position % BOARD_SIZE;
    const playerColor = state.playerColors[playerId];
    
    let maxValue = 0;
    
    const directions = [
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 },
      { dr: -1, dc: 1 },
      { dr: -1, dc: -1 },
    ];
    
    for (const dir of directions) {
      let pawnsInLine = 1;
      let emptySpaces = 0;
      let totalLength = 1;
      
      for (const sign of [-1, 1]) {
        for (let step = 1; step < 4; step++) {
          const r = row + dir.dr * step * sign;
          const c = col + dir.dc * step * sign;
          
          if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
          
          const idx = r * BOARD_SIZE + c;
          const square = state.board[idx];
          
          if (square.boardColor !== playerColor) break;
          
          totalLength++;
          
          if (
            square.pawn?.playerId === playerId &&
            !state.blockedPawnsInfo.has(idx) &&
            !state.blockingPawnsInfo.has(idx)
          ) {
            pawnsInLine++;
          } else if (!square.pawn && !state.deadZoneSquares.has(idx)) {
            emptySpaces++;
          } else {
            break;
          }
        }
      }
      
      if (totalLength >= 4) {
        let value = pawnsInLine * pawnsInLine;
        
        if (pawnsInLine === 3 && emptySpaces >= 1) {
          value += 20;
        } else if (pawnsInLine === 2 && emptySpaces >= 2) {
          value += 10;
        }
        
        maxValue = Math.max(maxValue, value);
      }
    }
    
    return maxValue;
  }

  blocksOpponentDiagonal(state, move) {
    const opponentId = state.currentPlayerId === 1 ? 2 : 1;
    const position = move.squareIndex || move.toIndex;
    const row = Math.floor(position / BOARD_SIZE);
    const col = position % BOARD_SIZE;
    
    const directions = [
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 },
      { dr: -1, dc: 1 },
      { dr: -1, dc: -1 },
    ];
    
    for (const dir of directions) {
      let opponentPawns = 0;
      
      for (let step = -3; step <= 3; step++) {
        if (step === 0) continue;
        
        const r = row + dir.dr * step;
        const c = col + dir.dc * step;
        
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;
        
        const idx = r * BOARD_SIZE + c;
        const square = state.board[idx];
        
        if (
          square.pawn?.playerId === opponentId &&
          square.boardColor === state.playerColors[opponentId] &&
          !state.blockedPawnsInfo.has(idx)
        ) {
          opponentPawns++;
        }
      }
      
      if (opponentPawns >= 2) {
        return true;
      }
    }
    
    return false;
  }

  contributesDiagonal(state, move) {
    const playerId = state.currentPlayerId;
    const position = move.squareIndex || move.toIndex;
    
    const testState = this.applyMove(state, move);
    if (!testState) return false;
    
    const newValue = this.evaluateDiagonalPosition(testState, position, playerId);
    return newValue > 5;
  }
}

// Worker message handler
self.onmessage = function (e) {
  const { gameState, difficulty } = e.data;

  // Ensure Sets and Maps are properly reconstructed
  const reconstructedState = structuredClone(gameState);
  reconstructedState.blockedPawnsInfo = new Set(
    Array.from(gameState.blockedPawnsInfo || [])
  );
  reconstructedState.blockingPawnsInfo = new Set(
    Array.from(gameState.blockingPawnsInfo || [])
  );

  // Handle deadZoneSquares which might be an array of entries or an object
  const deadZoneEntries = Array.isArray(gameState.deadZoneSquares)
    ? gameState.deadZoneSquares
    : Object.entries(gameState.deadZoneSquares || {});
  reconstructedState.deadZoneSquares = new Map(
    deadZoneEntries.map(([k, v]) => [parseInt(k), v])
  );

  reconstructedState.deadZoneCreatorPawnsInfo = new Set(
    Array.from(gameState.deadZoneCreatorPawnsInfo || [])
  );

  try {
    const bot = new MinimaxBot(difficulty || 'medium');
    const bestMove = bot.findBestMove(reconstructedState);

    // Return the selected move in the exact format expected by existing code
    self.postMessage({ type: "MOVE_CALCULATED", move: bestMove });
  } catch (error) {
    console.error("Bot Worker Error:", error);
    self.postMessage({ type: "ERROR", error: error.message });
  }
};