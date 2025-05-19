// mcts-worker.js - Complete Implementation

// --- Constants ---
const BOARD_SIZE = 8;
const PAWNS_PER_PLAYER = 6;

// --- Game Logic Helper Functions with Fixed Parameter Issues ---
function isValidPlacement(squareIndex, playerId, gameState) {
  // Always ensure playerId is provided or extracted from gameState
  playerId = playerId !== undefined ? playerId : gameState.currentPlayerId;

  const square = gameState.board[squareIndex];
  if (!square || square.pawn) return false;
  if (square.boardColor !== gameState.playerColors[playerId]) return false;
  if (gameState.deadZoneSquares.get(squareIndex) === playerId) return false;

  const { row, col } = square;
  const opponentId = playerId === 1 ? 2 : 1;

  // Check horizontally (left-center-right)
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

  // Check vertically (top-center-bottom)
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
  // Always ensure playerId is provided or extracted from gameState
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
  // Always ensure playerId is provided or extracted from gameState
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

  // Check horizontal blocking
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

  // Check vertical blocking
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

  // Horizontal dead zones
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

  // Vertical dead zones
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
    { dr: 1, dc: 1 }, // Down-Right
    { dr: 1, dc: -1 }, // Down-Left
    { dr: -1, dc: 1 }, // Up-Right
    { dr: -1, dc: -1 }, // Up-Left
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

// --- Enhanced MCTS Implementation ---
class MCTSNode {
  constructor(state, parent = null, action = null) {
    this.state = structuredClone(state);
    this.parent = parent;
    this.action = action;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    this.playerWhoseTurnItIs = this.state.currentPlayerId;
    this.untriedActions = this.getValidActions(this.state);
    this.boardEvaluationCache = new Map();
  }

  getValidActions(currentState) {
    const actions = [];
    const playerId = currentState.currentPlayerId;

    if (currentState.gamePhase === "placement") {
      // For placement phase
      const placementCandidates = [];
      const opponentId = playerId === 1 ? 2 : 1;

      // Count placed pawns to adjust strategy based on game progress
      const myPlacedPawns = currentState.placedPawns[playerId];
      const opponentPlacedPawns = currentState.placedPawns[opponentId];

      // Get all valid placement options first
      for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        if (isValidPlacement(i, playerId, currentState)) {
          const row = Math.floor(i / BOARD_SIZE);
          const col = i % BOARD_SIZE;

          // Calculate if this is an edge or corner position
          const isEdgeRow = row === 0 || row === BOARD_SIZE - 1;
          const isEdgeCol = col === 0 || col === BOARD_SIZE - 1;
          const isCorner = isEdgeRow && isEdgeCol;
          const isEdge = isEdgeRow || isEdgeCol;

          // Start with base placement score
          let placementQuality = 0;

          // CRITICAL: First priority - Block opponent diagonal formations
          const blockingValue = this.evaluateBlockingDiagonalInPlacement(
            currentState,
            i,
            opponentId
          );

          // HIGH PRIORITY: Block opponent diagonal formations
          // Even higher priority when opponent has 2+ pawns in a diagonal
          if (blockingValue > 0) {
            // Much higher weight for blocking potential winning diagonals
            placementQuality += blockingValue * 30;
          }

          // NEW: Early game edge strategy - first few moves focus heavily on edges
          if (myPlacedPawns < 3) {
            if (isCorner) {
              placementQuality += 25; // Highest priority for corners
            } else if (isEdge) {
              placementQuality += 20; // High priority for edges
            }
          }

          // NEW: Evaluate offensive diagonal potential from this position
          const offensiveDiagonalValue =
            this.evaluateOffensiveDiagonalPotential(currentState, i, playerId);
          placementQuality += offensiveDiagonalValue * 10; // Substantial weight

          // If we're the second player, need stronger blocking
          if (playerId === 2) {
            // Increased compensation for second player disadvantage
            placementQuality += blockingValue * 15; // Even more blocking bias

            // For the second player's first move, prioritize blocking over edges
            if (myPlacedPawns === 0 && opponentPlacedPawns === 1) {
              // Look where first player placed and strategically respond
              placementQuality +=
                this.evaluateCounterFirstMove(currentState, i) * 20;
            }
          }

          placementCandidates.push({
            type: "place",
            squareIndex: i,
            toIndex: i,
            quality: placementQuality,
          });
        }
      }

      // Sort placements by quality (highest first)
      placementCandidates.sort((a, b) => b.quality - a.quality);
      actions.push(...placementCandidates);
    } else {
      // Movement phase - similar to your existing code but with improved priorities
      const potentialWinningMoves = [];
      const criticalBlockingMoves = []; // For opponent about to win
      const blockingMoves = []; // For regular blocking moves
      const normalMoves = [];

      // Loop through our pawns
      for (let fromIdx = 0; fromIdx < BOARD_SIZE * BOARD_SIZE; fromIdx++) {
        const fromSquare = currentState.board[fromIdx];

        if (
          fromSquare?.pawn?.playerId === playerId &&
          !currentState.blockedPawnsInfo.has(fromIdx)
        ) {
          const validDestinations = getValidMoveDestinations(
            fromIdx,
            playerId,
            currentState
          );

          for (const toIdx of validDestinations) {
            // Try the move and see if it leads to a win
            const moveAction = {
              type: "move",
              fromIndex: fromIdx,
              toIndex: toIdx,
            };

            const resultState = this.applyActionToState(
              structuredClone(currentState),
              moveAction
            );

            if (resultState && resultState.winner === playerId) {
              // This is a winning move! Prioritize it highly
              potentialWinningMoves.push(moveAction);
            } else {
              // Check if opponent has a potential win we need to block
              const criticalBlockValue = this.evaluateCriticalBlock(
                currentState,
                toIdx
              );

              // Regular blocking value
              const blockingValue = this.evaluateBlockingWinningDiagonal(
                currentState,
                toIdx
              );

              if (criticalBlockValue >= 40) {
                // CRITICAL priority - opponent about to win
                criticalBlockingMoves.push({
                  ...moveAction,
                  quality: criticalBlockValue,
                });
              } else if (blockingValue >= 15) {
                // High blocking value - this is an important block
                blockingMoves.push({
                  ...moveAction,
                  quality: blockingValue,
                });
              } else {
                // Regular move - evaluate with standard heuristics
                const quality = this.evaluateMove(currentState, fromIdx, toIdx);
                normalMoves.push({
                  ...moveAction,
                  quality,
                });
              }
            }
          }
        }
      }

      // Sort all move categories by quality
      criticalBlockingMoves.sort((a, b) => b.quality - a.quality);
      blockingMoves.sort((a, b) => b.quality - a.quality);
      normalMoves.sort((a, b) => b.quality - a.quality);

      // Priority order: winning moves, critical blocks, regular blocks, then normal moves
      actions.push(
        ...potentialWinningMoves,
        ...criticalBlockingMoves,
        ...blockingMoves,
        ...normalMoves
      );
    }

    return actions.length > 0 ? actions : [{ type: "none" }];
  }

  // Enhanced method to evaluate offensive diagonal potential
  evaluateOffensiveDiagonalPotential(state, position, playerId) {
    const board = state.board;
    const row = Math.floor(position / BOARD_SIZE);
    const col = position % BOARD_SIZE;

    // Check if this position is on our color
    const positionSquare = board[position];
    if (positionSquare.boardColor !== state.playerColors[playerId]) {
      return 0; // Can't build diagonal if not on our color
    }

    let maxPotential = 0;

    // Check all 4 diagonal directions
    const directions = [
      { dr: 1, dc: 1 }, // Down-right
      { dr: 1, dc: -1 }, // Down-left
      { dr: -1, dc: 1 }, // Up-right
      { dr: -1, dc: -1 }, // Up-left
    ];

    for (const direction of directions) {
      // Count pawns and eligible empty spaces in this diagonal
      let myPawnsInLine = 0;
      let emptyValidSquares = 0;
      let maxConsecutive = 0;
      let currentConsecutive = 0;
      let edgeBased = false;

      // Look in both directions along this diagonal up to 3 steps
      for (let step = -3; step <= 3; step++) {
        if (step === 0) continue; // Skip current position

        const r = row + direction.dr * step;
        const c = col + direction.dc * step;

        // Skip invalid positions
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;

        const idx = r * BOARD_SIZE + c;
        const square = board[idx];

        // Only consider squares of our color for diagonal
        if (square.boardColor !== state.playerColors[playerId]) continue;

        // Check if this position is on an edge
        if (
          r === 0 ||
          r === BOARD_SIZE - 1 ||
          c === 0 ||
          c === BOARD_SIZE - 1
        ) {
          edgeBased = true;
        }

        if (square.pawn?.playerId === playerId) {
          myPawnsInLine++;
          currentConsecutive++;
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        } else if (
          !square.pawn &&
          !(state.deadZoneSquares.get(idx) === playerId)
        ) {
          emptyValidSquares++;
          currentConsecutive = 0;
        } else {
          // Opponent's pawn or our deadzone
          currentConsecutive = 0;
        }
      }

      // Calculate potential for this diagonal
      let potential = 0;

      // Base potential based on our pawns and consecutive pawns
      potential += myPawnsInLine * 3;
      potential += maxConsecutive * 2;

      // Bonus for having enough spaces to complete a diagonal
      if (myPawnsInLine + emptyValidSquares + 1 >= 4) {
        potential += 5;

        // Extra potential if we already have 2+ pawns in place
        if (myPawnsInLine >= 2) {
          potential += 10;
        }
      }

      // SIGNIFICANTLY higher potential for edge-based diagonals
      if (edgeBased) {
        potential *= 1.5; // 50% boost for edge-based diagonals
      }

      // Factor in if this position forms a "winning diagonal" with existing pawns
      if (
        myPawnsInLine >= 2 &&
        this.wouldCompleteDiagonal(state, position, direction, playerId)
      ) {
        potential += 30; // Huge boost for forming winning patterns
      }

      maxPotential = Math.max(maxPotential, potential);
    }

    return maxPotential;
  }

  // Helper method to check if a position would complete a winning diagonal
  wouldCompleteDiagonal(state, position, direction, playerId) {
    const board = state.board;
    const row = Math.floor(position / BOARD_SIZE);
    const col = position % BOARD_SIZE;

    // Need to find 3 of our pawns in this direction that could form a 4-in-row with this position
    const positions = [position]; // Start with this position

    // Look 3 steps forward and backward in this direction
    for (let step = -3; step <= 3; step++) {
      if (step === 0) continue; // Skip current position

      const r = row + direction.dr * step;
      const c = col + direction.dc * step;

      // Skip invalid positions
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;

      const idx = r * BOARD_SIZE + c;
      const square = board[idx];

      // Only add our pawns on our color
      if (
        square.pawn?.playerId === playerId &&
        square.boardColor === state.playerColors[playerId] &&
        !state.blockedPawnsInfo.has(idx)
      ) {
        positions.push(idx);
      }
    }

    // Check if there's a set of 4 contiguous positions that could form a diagonal
    if (positions.length >= 4) {
      // Sort by position index (this will work for diagonals too since they increase/decrease uniformly)
      positions.sort((a, b) => a - b);

      // Check for 4 contiguous positions
      for (let i = 0; i <= positions.length - 4; i++) {
        const p1 = positions[i];
        const p2 = positions[i + 1];
        const p3 = positions[i + 2];
        const p4 = positions[i + 3];

        // TODO: Validate that these are actually in a diagonal pattern
        // For now, a rough check - could be improved
        if (p4 - p3 === p3 - p2 && p3 - p2 === p2 - p1) {
          return true;
        }
      }
    }

    return false;
  }

  // Enhanced method for better diagonal blocking
  evaluateBlockingDiagonalInPlacement(state, position, opponentId) {
    const board = state.board;
    const row = Math.floor(position / BOARD_SIZE);
    const col = position % BOARD_SIZE;
    let maxBlockingValue = 0;

    // Get opponent's color
    const opponentColor = state.playerColors[opponentId];

    // Check all 4 diagonal directions
    const directions = [
      { dr: 1, dc: 1 }, // Down-right
      { dr: 1, dc: -1 }, // Down-left
      { dr: -1, dc: 1 }, // Up-right
      { dr: -1, dc: -1 }, // Up-left
    ];

    for (const direction of directions) {
      // Look in both directions (forward and backward along diagonal)
      let opponentPawnsInLine = 0;
      let emptyValidSquares = 0;
      let opponentPawnPositions = [];

      // Check 3 steps in each direction along the diagonal
      for (let step = -3; step <= 3; step++) {
        if (step === 0) continue; // Skip the position itself

        const r = row + direction.dr * step;
        const c = col + direction.dc * step;

        // Skip invalid positions
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;

        const idx = r * BOARD_SIZE + c;
        const square = board[idx];

        // Only consider squares of opponent's color for their diagonal
        if (square.boardColor !== opponentColor) continue;

        // Count opponent pawns in this diagonal
        if (
          square.pawn?.playerId === opponentId &&
          !state.blockedPawnsInfo.has(idx)
        ) {
          opponentPawnsInLine++;
          opponentPawnPositions.push(idx);
        }
        // Count empty spots that could form a diagonal
        else if (
          !square.pawn &&
          !(state.deadZoneSquares.get(idx) === opponentId)
        ) {
          emptyValidSquares++;
        }
      }

      // Calculate blocking value - more aggressive blocking
      let blockingValue = 0;

      // Critical blocking: Even a single opponent pawn on their color should be considered
      if (opponentPawnsInLine >= 1) {
        // Base value proportional to opponent pawns
        blockingValue = 8 * opponentPawnsInLine;

        // VERY high value for blocking 2+ pawns
        if (opponentPawnsInLine >= 2) {
          blockingValue = 20 * opponentPawnsInLine;
        }

        // CRITICAL priority if they also have empty spots to complete a 4-in-a-row
        if (opponentPawnsInLine + emptyValidSquares >= 4) {
          blockingValue += 25;
        }

        // Check for consecutive pawns - much more dangerous
        if (
          this.hasPotentialDiagonal(state, opponentPawnPositions, opponentId)
        ) {
          blockingValue *= 2; // Double the blocking value for consecutive or nearly consecutive pawns
        }
      }

      // Keep track of highest blocking value across all diagonals
      maxBlockingValue = Math.max(maxBlockingValue, blockingValue);
    }

    return maxBlockingValue;
  }

  // Improved helper method to check if opponent pawns form a potential diagonal
  hasPotentialDiagonal(state, positions, opponentId) {
    if (positions.length < 2) return false;

    // First, get the opponent's color
    const opponentColor = state.playerColors[opponentId];

    // Sort positions
    positions.sort((a, b) => a - b);

    // Check for consecutive or near-consecutive positions along diagonals
    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = positions[i];
      const p2 = positions[i + 1];

      const row1 = Math.floor(p1 / BOARD_SIZE);
      const col1 = p1 % BOARD_SIZE;
      const row2 = Math.floor(p2 / BOARD_SIZE);
      const col2 = p2 % BOARD_SIZE;

      // Check if they're in a diagonal pattern
      if (Math.abs(row2 - row1) === Math.abs(col2 - col1)) {
        // Calculate the diagonal direction
        const dr = Math.sign(row2 - row1);
        const dc = Math.sign(col2 - col1);

        // Check if there's a potential to extend this diagonal
        const distance = Math.abs(row2 - row1); // Same as Math.abs(col2 - col1)

        // If pawns are adjacent or have a small gap
        if (distance <= 2) {
          // Look for empty spots that could complete the diagonal
          let emptySpacesBetween = 0;
          let extendableSpaces = 0;

          // Check spaces between the two pawns if they're not adjacent
          if (distance === 2) {
            const middleRow = row1 + dr;
            const middleCol = col1 + dc;
            const middleIdx = middleRow * BOARD_SIZE + middleCol;

            // If the space between is empty and on opponent's color, it's dangerous
            if (
              !state.board[middleIdx].pawn &&
              state.board[middleIdx].boardColor === opponentColor &&
              !(state.deadZoneSquares.get(middleIdx) === opponentId)
            ) {
              emptySpacesBetween++;
            }
          }

          // Check for extendable spaces beyond these two pawns
          // Forward direction
          let checkRow = row2 + dr;
          let checkCol = col2 + dc;
          while (
            checkRow >= 0 &&
            checkRow < BOARD_SIZE &&
            checkCol >= 0 &&
            checkCol < BOARD_SIZE
          ) {
            const checkIdx = checkRow * BOARD_SIZE + checkCol;
            const square = state.board[checkIdx];

            if (square.pawn?.playerId === opponentId) {
              // Another opponent pawn - this is very threatening
              return true;
            } else if (
              !square.pawn &&
              square.boardColor === opponentColor &&
              !(state.deadZoneSquares.get(checkIdx) === opponentId)
            ) {
              // Empty spot where they could extend
              extendableSpaces++;
            } else {
              // Blocked by our pawn or not on their color
              break;
            }

            checkRow += dr;
            checkCol += dc;
          }

          // Backward direction
          checkRow = row1 - dr;
          checkCol = col1 - dc;
          while (
            checkRow >= 0 &&
            checkRow < BOARD_SIZE &&
            checkCol >= 0 &&
            checkCol < BOARD_SIZE
          ) {
            const checkIdx = checkRow * BOARD_SIZE + checkCol;
            const square = state.board[checkIdx];

            if (square.pawn?.playerId === opponentId) {
              // Another opponent pawn - this is very threatening
              return true;
            } else if (
              !square.pawn &&
              square.boardColor === opponentColor &&
              !(state.deadZoneSquares.get(checkIdx) === opponentId)
            ) {
              // Empty spot where they could extend
              extendableSpaces++;
            } else {
              // Blocked by our pawn or not on their color
              break;
            }

            checkRow -= dr;
            checkCol -= dc;
          }

          // If they have empty spaces to extend and form a diagonal, it's dangerous
          if (emptySpacesBetween + extendableSpaces >= 2) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // New method to counter the first player's opening move strategically
  evaluateCounterFirstMove(state, position) {
    // Find where the first player placed their first pawn
    const opponentId = state.currentPlayerId === 1 ? 2 : 1;
    let firstOpponentPawnIndex = -1;

    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i].pawn?.playerId === opponentId) {
        firstOpponentPawnIndex = i;
        break;
      }
    }

    if (firstOpponentPawnIndex === -1) return 0;

    const opRow = Math.floor(firstOpponentPawnIndex / BOARD_SIZE);
    const opCol = firstOpponentPawnIndex % BOARD_SIZE;
    const myRow = Math.floor(position / BOARD_SIZE);
    const myCol = position % BOARD_SIZE;

    // If opponent placed on a corner or edge, we should place on the opposite side
    // to prevent them from forming a diagonal from that edge
    const opIsCorner =
      (opRow === 0 || opRow === BOARD_SIZE - 1) &&
      (opCol === 0 || opCol === BOARD_SIZE - 1);
    const opIsEdge =
      opRow === 0 ||
      opRow === BOARD_SIZE - 1 ||
      opCol === 0 ||
      opCol === BOARD_SIZE - 1;

    if (opIsCorner) {
      // For corner placement, high value for the opposite diagonal area
      // For example, if opponent placed at top-left, we want bottom-right area
      const isGoodCounter =
        (opRow === 0 && opCol === 0 && myRow >= 3 && myCol >= 3) ||
        (opRow === 0 && opCol === BOARD_SIZE - 1 && myRow >= 3 && myCol <= 4) ||
        (opRow === BOARD_SIZE - 1 && opCol === 0 && myRow <= 4 && myCol >= 3) ||
        (opRow === BOARD_SIZE - 1 &&
          opCol === BOARD_SIZE - 1 &&
          myRow <= 4 &&
          myCol <= 4);

      return isGoodCounter ? 15 : 0;
    } else if (opIsEdge) {
      // For edge placement, good to place on opposite side
      const isOppositeEdge =
        (opRow === 0 && myRow === BOARD_SIZE - 1) ||
        (opRow === BOARD_SIZE - 1 && myRow === 0) ||
        (opCol === 0 && myCol === BOARD_SIZE - 1) ||
        (opCol === BOARD_SIZE - 1 && myCol === 0);

      return isOppositeEdge ? 10 : 0;
    }

    // For center placements, we should try to control edges
    const isCenterResponse =
      myRow === 0 ||
      myRow === BOARD_SIZE - 1 ||
      myCol === 0 ||
      myCol === BOARD_SIZE - 1;

    return isCenterResponse ? 8 : 0;
  }

  // New method to detect if opponent is about to win
  evaluateCriticalBlock(state, position) {
    const opponentId = state.currentPlayerId === 1 ? 2 : 1;
    const board = state.board;
    const row = Math.floor(position / BOARD_SIZE);
    const col = position % BOARD_SIZE;

    // Check all 4 diagonal directions
    const directions = [
      { dr: 1, dc: 1 }, // Down-right
      { dr: 1, dc: -1 }, // Down-left
      { dr: -1, dc: 1 }, // Up-right
      { dr: -1, dc: -1 }, // Up-left
    ];

    for (const direction of directions) {
      // Count opponent pawns in this diagonal
      let opponentPawnsInDiagonal = 0;
      let opponentPositions = [];

      // Check up to 4 positions in each direction
      for (let offset = -3; offset <= 3; offset++) {
        if (offset === 0) continue; // Skip our position

        const r = row + direction.dr * offset;
        const c = col + direction.dc * offset;

        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;

        const idx = r * BOARD_SIZE + c;
        const square = board[idx];

        // Only consider opponent pawns on their color that aren't blocked
        if (
          square.pawn?.playerId === opponentId &&
          square.boardColor === state.playerColors[opponentId] &&
          !state.blockedPawnsInfo.has(idx)
        ) {
          opponentPawnsInDiagonal++;
          opponentPositions.push({ index: idx, offset });
        }
      }

      // If opponent has 3 pawns in this diagonal, this is CRITICAL to block
      if (opponentPawnsInDiagonal >= 3) {
        // Check if these 3 pawns can form a winning diagonal with an empty space
        if (this.canFormWinningDiagonal(opponentPositions, direction)) {
          return 100; // Absolute highest priority - must block this
        }
        return 50; // Still very high priority
      }
    }

    return 0;
  }

  // Helper to check if pawns can form a winning diagonal
  canFormWinningDiagonal(positions, direction) {
    // Sort positions by offset to check for consecutive positions
    positions.sort((a, b) => a.offset - b.offset);

    // Check for 3 consecutive or near-consecutive positions
    if (positions.length >= 3) {
      for (let i = 0; i <= positions.length - 3; i++) {
        const p1 = positions[i];
        const p2 = positions[i + 1];
        const p3 = positions[i + 2];

        // Check if these are in a relatively straight diagonal line
        // with at most one gap
        if (Math.abs(p2.offset - p1.offset - (p3.offset - p2.offset)) <= 1) {
          return true;
        }
      }
    }

    return false;
  }

    // New method to evaluate blocking of nearly-complete opponent diagonals
    evaluateBlockingWinningDiagonal(state, position) {
      const opponentId = state.currentPlayerId === 1 ? 2 : 1;
      const board = state.board;
      const row = Math.floor(position / BOARD_SIZE);
      const col = position % BOARD_SIZE;
      let maxBlockingValue = 0;

      // Check all 4 diagonal directions
      const directions = [
        { dr: 1, dc: 1 }, // Down-right
        { dr: 1, dc: -1 }, // Down-left
        { dr: -1, dc: 1 }, // Up-right
        { dr: -1, dc: -1 }, // Up-left
      ];

      for (const direction of directions) {
        // For each direction, we'll check both sides of the diagonal
        let opponentPawnsInDiagonal = 0;
        let diagonalPositions = [];

        // Check the diagonal (3 steps in each direction)
        for (let offset = -3; offset <= 3; offset++) {
          if (offset === 0) continue; // Skip our own position

          const r = row + direction.dr * offset;
          const c = col + direction.dc * offset;

          if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;

          const idx = r * BOARD_SIZE + c;
          const square = board[idx];
          diagonalPositions.push(idx);

          // Count opponent pawns in the diagonal
          if (
            square.pawn?.playerId === opponentId &&
            square.boardColor === state.playerColors[opponentId] &&
            !state.blockedPawnsInfo.has(idx)
          ) {
            opponentPawnsInDiagonal++;
          }
        }

        // Calculate blocking value based on number of opponent pawns
        let blockingValue = 0;

        if (opponentPawnsInDiagonal >= 3) {
          // Critical! Opponent has 3 in a diagonal - must block
          blockingValue = 50;
        } else if (opponentPawnsInDiagonal === 2) {
          // Important to block 2 in a diagonal
          blockingValue = 20;

          // Even more important if those 2 are close to each other
          // TODO: Add logic to check if the 2 pawns are adjacent or close
        }

        maxBlockingValue = Math.max(maxBlockingValue, blockingValue);
      }

      return maxBlockingValue;
    }

    evaluateMove(state, fromIndex, toIndex) {
      let score = 0;
      const playerId = state.currentPlayerId;
      const opponentId = playerId === 1 ? 2 : 1;

      // Calculate board position
      const toRow = Math.floor(toIndex / BOARD_SIZE);
      const toCol = toIndex % BOARD_SIZE;

      // 1. Evaluate diagonal formation potential
      score += this.evaluateDiagonalPotential(state, toIndex, playerId);

      // 2. Evaluate blocking opponent's diagonals
      score += this.evaluateBlockingPotential(state, toIndex, opponentId);

      // 3. Check for dead zone creation
      const moveState = this.applyActionToState(structuredClone(state), {
        type: "move",
        fromIndex,
        toIndex,
      });

      if (moveState) {
        // Count new dead zones created for opponent
        let newDeadZonesCount = 0;

        moveState.deadZoneSquares.forEach((affectedPlayer, squareIdx) => {
          const wasAlreadyDeadZone =
            state.deadZoneSquares.has(squareIdx) &&
            state.deadZoneSquares.get(squareIdx) === affectedPlayer;

          if (affectedPlayer === opponentId && !wasAlreadyDeadZone) {
            newDeadZonesCount++;
          }
        });

        score += newDeadZonesCount * 3; // Dead zones are very valuable

        // 4. Avoid moves that could get our pawn blocked
        if (this.couldBeBlocked(moveState, toIndex, playerId)) {
          score -= 2;
        }

        // 5. Prefer moves that block opponent pawns
        const oldBlockedCount = Array.from(state.blockedPawnsInfo).filter(
          (idx) => state.board[idx]?.pawn?.playerId === opponentId
        ).length;

        const newBlockedCount = Array.from(moveState.blockedPawnsInfo).filter(
          (idx) => moveState.board[idx]?.pawn?.playerId === opponentId
        ).length;

        score += (newBlockedCount - oldBlockedCount) * 2.5;
      }

      // 6. Slightly prefer center positions over edges
      const distanceFromCenter = Math.abs(toRow - 3.5) + Math.abs(toCol - 3.5);
      score += (7 - distanceFromCenter) * 0.2;

      return score;
    }

    // Evaluate diagonal formation potential
    evaluateDiagonalPotential(state, position, playerId) {
      const board = state.board;
      const row = Math.floor(position / BOARD_SIZE);
      const col = position % BOARD_SIZE;
      let score = 0;

      // Check all 4 diagonal directions
      const directions = [
        { dr: 1, dc: 1 }, // Down-right
        { dr: 1, dc: -1 }, // Down-left
        { dr: -1, dc: 1 }, // Up-right
        { dr: -1, dc: -1 }, // Up-left
      ];

      for (const direction of directions) {
        let friendlyPawnsInLine = 0;
        let emptyValidSquares = 0;
        const lineIndices = [];

        // Look 3 steps in each direction
        for (let step = -3; step <= 3; step++) {
          if (step === 0) {
            // This is the position itself
            lineIndices.push(position);
            continue;
          }

          const r = row + direction.dr * step;
          const c = col + direction.dc * step;

          // Skip invalid positions
          if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;

          const idx = r * BOARD_SIZE + c;
          const square = board[idx];
          lineIndices.push(idx);

          if (
            square.pawn?.playerId === playerId &&
            square.boardColor === state.playerColors[playerId] &&
            !state.blockedPawnsInfo.has(idx) &&
            !state.blockingPawnsInfo.has(idx) &&
            !state.deadZoneCreatorPawnsInfo.has(idx)
          ) {
            friendlyPawnsInLine++;
          } else if (
            !square.pawn &&
            square.boardColor === state.playerColors[playerId] &&
            !(state.deadZoneSquares.get(idx) === playerId)
          ) {
            emptyValidSquares++;
          }
        }

        // Calculate value of this diagonal line
        // Higher score for lines with more friendly pawns and enough space to complete
        if (
          friendlyPawnsInLine >= 1 &&
          friendlyPawnsInLine + emptyValidSquares + 1 >= 4
        ) {
          // More points for lines with more friendly pawns already in place
          score += friendlyPawnsInLine * 2;

          // Extra points if we're close to winning (3 pawns in line)
          if (friendlyPawnsInLine >= 2) {
            score += 3;
          }
        }
      }

      return score;
    }

    // Evaluate blocking opponent's diagonal formations
    evaluateBlockingPotential(state, position, opponentId) {
      const board = state.board;
      const row = Math.floor(position / BOARD_SIZE);
      const col = position % BOARD_SIZE;
      let score = 0;

      // Check all 4 diagonal directions
      const directions = [
        { dr: 1, dc: 1 }, // Down-right
        { dr: 1, dc: -1 }, // Down-left
        { dr: -1, dc: 1 }, // Up-right
        { dr: -1, dc: -1 }, // Up-left
      ];

      for (const direction of directions) {
        let opponentPawnsInLine = 0;
        let emptyValidSquaresForOpponent = 0;

        // Look 3 steps in each direction
        for (let step = -3; step <= 3; step++) {
          if (step === 0) continue; // Skip the position itself

          const r = row + direction.dr * step;
          const c = col + direction.dc * step;

          // Skip invalid positions
          if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;

          const idx = r * BOARD_SIZE + c;
          const square = board[idx];

          if (
            square.pawn?.playerId === opponentId &&
            square.boardColor === state.playerColors[opponentId] &&
            !state.blockedPawnsInfo.has(idx)
          ) {
            opponentPawnsInLine++;
          } else if (
            !square.pawn &&
            square.boardColor === state.playerColors[opponentId] &&
            !(state.deadZoneSquares.get(idx) === opponentId)
          ) {
            emptyValidSquaresForOpponent++;
          }
        }

        // Calculate blocking value
        // Higher score for blocking opponents with more pawns in a line
        if (
          opponentPawnsInLine >= 2 &&
          opponentPawnsInLine + emptyValidSquaresForOpponent >= 3
        ) {
          score += opponentPawnsInLine * 1.5;

          // Extra points for blocking opponent close to winning
          if (opponentPawnsInLine >= 3) {
            score += 5; // This is critical to block
          }
        }
      }

      return score;
    }

    // Check if a pawn could be blocked by opponent in next move
    couldBeBlocked(state, position, playerId) {
      const board = state.board;
      const row = Math.floor(position / BOARD_SIZE);
      const col = position % BOARD_SIZE;
      const opponentId = playerId === 1 ? 2 : 1;

      // Check horizontal blocking potential (needs opponent pawns left+right)
      if (col > 0 && col < BOARD_SIZE - 1) {
        const leftIdx = row * BOARD_SIZE + (col - 1);
        const rightIdx = row * BOARD_SIZE + (col + 1);

        // If one side has opponent pawn and other side is valid for opponent
        if (board[leftIdx].pawn?.playerId === opponentId) {
          if (
            !board[rightIdx].pawn &&
            board[rightIdx].boardColor === state.playerColors[opponentId] &&
            !(state.deadZoneSquares.get(rightIdx) === opponentId)
          ) {
            return true;
          }
        }

        if (board[rightIdx].pawn?.playerId === opponentId) {
          if (
            !board[leftIdx].pawn &&
            board[leftIdx].boardColor === state.playerColors[opponentId] &&
            !(state.deadZoneSquares.get(leftIdx) === opponentId)
          ) {
            return true;
          }
        }
      }

      // Check vertical blocking potential (needs opponent pawns above+below)
      if (row > 0 && row < BOARD_SIZE - 1) {
        const aboveIdx = (row - 1) * BOARD_SIZE + col;
        const belowIdx = (row + 1) * BOARD_SIZE + col;

        if (board[aboveIdx].pawn?.playerId === opponentId) {
          if (
            !board[belowIdx].pawn &&
            board[belowIdx].boardColor === state.playerColors[opponentId] &&
            !(state.deadZoneSquares.get(belowIdx) === opponentId)
          ) {
            return true;
          }
        }

        if (board[belowIdx].pawn?.playerId === opponentId) {
          if (
            !board[aboveIdx].pawn &&
            board[aboveIdx].boardColor === state.playerColors[opponentId] &&
            !(state.deadZoneSquares.get(aboveIdx) === opponentId)
          ) {
            return true;
          }
        }
      }

      return false;
    }

  applyActionToState(state, action) {
    // Handle placement actions
    if (action.type === "place") {
      // Check both squareIndex and toIndex properties
      const index =
        action.squareIndex !== undefined ? action.squareIndex : action.toIndex;
      if (index !== undefined) {
        return placePawn(state, index);
      }
    }
    // Handle movement actions
    else if (
      action.type === "move" &&
      action.fromIndex !== undefined &&
      action.toIndex !== undefined
    ) {
      return movePawn(state, action.fromIndex, action.toIndex);
    }
    // Handle 'none' actions
    else if (action.type === "none") {
      // Switch player and recalculate derived state
      let tempState = structuredClone(state);
      tempState.currentPlayerId = tempState.currentPlayerId === 1 ? 2 : 1;

      // Apply common logic to recalculate derived state
      const { blockedPawns, blockingPawns } = updateBlockingStatus(
        tempState.board
      );
      const { deadZones, deadZoneCreatorPawns } = updateDeadZones(
        tempState.board,
        tempState.playerColors
      );
      const { winner, winningLine } = checkWinCondition({
        ...tempState,
        blockedPawnsInfo: blockedPawns,
        blockingPawnsInfo: blockingPawns,
        deadZoneSquares: deadZones,
        deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
      });

      return {
        ...tempState,
        blockedPawnsInfo: blockedPawns,
        blockingPawnsInfo: blockingPawns,
        deadZoneSquares: deadZones,
        deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
        winner,
        winningLine,
      };
    }
    return null;
  }

  // UCT selection with quality bias
  selectChild(explorationWeight) {
    let bestChild = null;
    let bestScore = -Infinity;

    for (const child of this.children) {
      if (child.visits === 0) return child;

      // UCT formula with additional quality bias
      const exploitation = child.wins / child.visits;
      const exploration =
        explorationWeight * Math.sqrt(Math.log(this.visits) / child.visits);

      // Add quality bias if available
      let qualityBias = 0;
      if (child.action && child.action.quality !== undefined) {
        qualityBias = child.action.quality * 0.05; // Small weight for quality
      }

      const score = exploitation + exploration + qualityBias;

      if (score > bestScore) {
        bestScore = score;
        bestChild = child;
      }
    }

    return bestChild;
  }

  // Expand node by selecting an untried action
  expand() {
    if (this.untriedActions.length === 0) return null;

    // Take the first (highest quality) untried action
    // This biases expansion toward better moves
    const action = this.untriedActions.shift();

    const newState = this.applyActionToState(this.state, action);
    if (!newState) {
      // If invalid action, try another
      if (this.untriedActions.length > 0) {
        return this.expand();
      }
      return null;
    }

    const childNode = new MCTSNode(newState, this, action);
    this.children.push(childNode);
    return childNode;
  }

  // Improved rollout with heuristic guidance
  rollout(maxDepth) {
    let currentState = structuredClone(this.state);
    let depth = 0;

    while (!this.isTerminal(currentState) && depth < maxDepth) {
      const actions = this.getValidActions(currentState);
      if (
        actions.length === 0 ||
        (actions.length === 1 && actions[0].type === "none")
      ) {
        break;
      }

      // Modified epsilon-greedy policy with strategic bias for early game
      let chosenAction;

      // Placement phase: Be more deterministic about edge strategy
      if (currentState.gamePhase === "placement") {
        // 90% choose best action in placement phase
        if (Math.random() < 0.9) {
          chosenAction = actions[0]; // Best action (already sorted)
        } else {
          // 10% exploration, but still prefer higher quality moves
          // Choose from top 3 actions if available
          const topActions = actions.slice(0, Math.min(3, actions.length));
          chosenAction =
            topActions[Math.floor(Math.random() * topActions.length)];
        }
      }
      // Movement phase: More standard epsilon-greedy
      else {
        if (Math.random() < 0.8) {
          chosenAction = actions[0]; // Best action
        } else {
          chosenAction = actions[Math.floor(Math.random() * actions.length)];
        }
      }

      const nextState = this.applyActionToState(currentState, chosenAction);
      if (!nextState) break;

      currentState = nextState;
      depth++;
    }

    // For terminal states, return win/loss/draw
    if (currentState.winner === this.playerWhoseTurnItIs) {
      return 1.0; // Win
    } else if (currentState.winner !== null) {
      return 0.0; // Loss
    }

    // For non-terminal states, use heuristic evaluation
    return this.evaluateState(currentState);
  }

  // Evaluate non-terminal states using heuristics
  evaluateState(state) {
    const myPlayerId = this.playerWhoseTurnItIs;
    const opponentId = myPlayerId === 1 ? 2 : 1;

    if (state.gamePhase === "placement") {
      // If we're player 2, we need to be more defensive
      if (myPlayerId === 2) {
        // Check if opponent has any pawn pairs forming potential diagonals
        for (let i = 0; i < state.board.length; i++) {
          if (state.board[i].pawn?.playerId === opponentId) {
            // High blocking value indicates opponent is forming diagonals
            const blockingValue = this.evaluateBlockingDiagonalInPlacement(
              state,
              i,
              opponentId
            );

            if (blockingValue > 0) {
              // Penalize states where opponent has diagonal formations
              return 0.3; // Significantly below average (0.5)
            }
          }
        }
      }
    }

    // Start with draw value
    let score = 0.5;

    // Count important game features
    let myPawns = 0,
      opponentPawns = 0;
    let myBlockedPawns = 0,
      opponentBlockedPawns = 0;
    let myDeadZones = 0,
      opponentDeadZones = 0;

    // Count diagonal potential
    let myDiagonalPotential = 0;
    let opponentDiagonalPotential = 0;

    // Count pawns and blocked pawns
    for (let i = 0; i < state.board.length; i++) {
      const square = state.board[i];

      if (square.pawn) {
        if (square.pawn.playerId === myPlayerId) {
          myPawns++;
          if (state.blockedPawnsInfo.has(i)) {
            myBlockedPawns++;
          }
        } else {
          opponentPawns++;
          if (state.blockedPawnsInfo.has(i)) {
            opponentBlockedPawns++;
          }
        }
      }
    }

    // Count dead zones
    state.deadZoneSquares.forEach((player, _) => {
      if (player === myPlayerId) {
        myDeadZones++;
      } else {
        opponentDeadZones++;
      }
    });

    // Evaluate diagonal formation potential for both players
    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i].pawn?.playerId === myPlayerId) {
        myDiagonalPotential += this.evaluateDiagonalPotential(
          state,
          i,
          myPlayerId
        );
      } else if (state.board[i].pawn?.playerId === opponentId) {
        opponentDiagonalPotential += this.evaluateDiagonalPotential(
          state,
          i,
          opponentId
        );
      }
    }

    // Calculate final score
    // Small adjustment for pawn count
    score += 0.02 * (myPawns - opponentPawns);

    // Medium adjustment for blocked pawns (bad to have blocked pawns)
    score += 0.05 * (opponentBlockedPawns - myBlockedPawns);

    // Large adjustment for dead zones (bad to have dead zones)
    score += 0.07 * (opponentDeadZones - myDeadZones);

    // Very large adjustment for diagonal potential (this is how you win)
    score += 0.1 * (myDiagonalPotential - opponentDiagonalPotential);

    // First-player advantage compensation
    if (myPlayerId === 2) {
      // If we're the second player
      score -= 0.05; // Slight penalty to account for first-player advantage
    }

    // Clamp between 0.1 and 0.9 to avoid overconfidence
    return Math.max(0.1, Math.min(0.9, score));
  }

  isTerminal(state) {
    return state.winner !== null;
  }

  backpropagate(result) {
    let node = this;
    while (node) {
      node.visits++;
      node.wins += result;
      node = node.parent;
      result = 1 - result; // Flip result for parent (opponent's perspective)
    }
  }
}

// Main MCTS algorithm
class MCTS {
  constructor(initialState, difficulty, config = {}) {
    // Set parameters based on difficulty
    this.iterations = config.iterations || 10000;
    this.timeLimit = 2000; // 2 seconds max
    this.explorationWeight = config.exploration || Math.sqrt(2);
    this.maxRolloutDepth = config.simulationDepth || 50;
    this.initialState = structuredClone(initialState);
  }

  findBestAction() {
    const rootNode = new MCTSNode(this.initialState);

    // Immediate return if only one valid action
    if (rootNode.untriedActions.length === 0) return null;
    if (rootNode.untriedActions.length === 1) return rootNode.untriedActions[0];

    const startTime = Date.now();
    let iterations = 0;

    // Run MCTS iterations
    while (
      iterations < this.iterations &&
      Date.now() - startTime < this.timeLimit
    ) {
      // Selection
      let node = rootNode;
      while (node.untriedActions.length === 0 && node.children.length > 0) {
        node = node.selectChild(this.explorationWeight);
        if (!node) break;
      }

      // Expansion
      if (node.untriedActions.length > 0 && !node.isTerminal(node.state)) {
        node = node.expand();
        if (!node) continue; // Invalid action, try again
      }

      // Simulation
      const result = node.rollout(this.maxRolloutDepth);

      // Backpropagation
      node.backpropagate(result);

      iterations++;
    }

    // Find best child based on average score (not visit count)
    let bestChild = null;
    let bestScore = -Infinity;

    for (const child of rootNode.children) {
      // Use average score for final selection, not UCT
      const score = child.visits > 0 ? child.wins / child.visits : 0;

      if (score > bestScore) {
        bestScore = score;
        bestChild = child;
      }
    }

    // Return the action of the best child
    if (bestChild) {
      // Log info about the decision quality
      const winRate = ((bestChild.wins / bestChild.visits) * 100).toFixed(1);
      console.log(
        `Selected move: ${JSON.stringify(
          bestChild.action
        )} with win rate ${winRate}% after ${iterations} iterations`
      );
      return bestChild.action;
    }

    // Fallback to first action if no children
    return rootNode.untriedActions.length > 0
      ? rootNode.untriedActions[0]
      : null;
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

  // Set configuration based on difficulty
  const difficultyConfig = {
    easy: {
      iterations: 5000,
      exploration: Math.sqrt(8),
      simulationDepth: 20,
    },
    medium: {
      iterations: 10000,
      exploration: Math.sqrt(2),
      simulationDepth: 50,
    },
    hard: {
      iterations: 15000,
      exploration: Math.sqrt(2),
      simulationDepth: 70,
    },
  };

  try {
    const config = difficultyConfig[difficulty] || difficultyConfig.medium;
    const mcts = new MCTS(reconstructedState, difficulty, config);
    const bestMove = mcts.findBestAction();

    // Return the selected move
    self.postMessage({ type: "MOVE_CALCULATED", move: bestMove });
  } catch (error) {
    console.error("MCTS Worker Error:", error);
    self.postMessage({ type: "ERROR", error: error.message });
  }
};
