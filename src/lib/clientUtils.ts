
import type { GameState, PlayerId, Pawn, SquareState } from './types';
import { updateBlockingStatus, updateDeadZones, checkWinCondition, assignPlayerColors } from './gameLogic';


export function applyDeltaUpdatesToGameState(
  currentState: GameState, 
  updates: { type: string, changes: any }[],
  // seqId?: number // seqId can be used for more robust ordering if implemented fully
): GameState {
  // Ensure we are working with a mutable copy
  let newState = JSON.parse(JSON.stringify(currentState)) as GameState;
  // Re-hydrate Sets and Maps that might have been lost in JSON stringification
  newState.blockedPawnsInfo = new Set(Array.from(currentState.blockedPawnsInfo || []));
  newState.blockingPawnsInfo = new Set(Array.from(currentState.blockingPawnsInfo || []));
  const deadZoneEntries = Array.isArray(currentState.deadZoneSquares) 
    ? currentState.deadZoneSquares 
    : Object.entries(currentState.deadZoneSquares || {});
  newState.deadZoneSquares = new Map(deadZoneEntries.map(([k,v]) => [parseInt(k), v as PlayerId]));
  newState.deadZoneCreatorPawnsInfo = new Set(Array.from(currentState.deadZoneCreatorPawnsInfo || []));
  newState.playerColors = currentState.playerColors || assignPlayerColors(); // Ensure playerColors exists

  for (const update of updates) {
    switch (update.type) {
      case 'player_turn':
        newState.currentPlayerId = update.changes.playerId;
        break;
      case 'game_phase':
        newState.gamePhase = update.changes.phase;
        break;
      case 'board_update':
        update.changes.squares.forEach((sqUpdate: { index: number, pawn: Pawn | null, highlight?: SquareState['highlight'] }) => {
          if (newState.board[sqUpdate.index]) {
            newState.board[sqUpdate.index].pawn = sqUpdate.pawn;
            // Only update highlight if provided in the delta, otherwise it's managed client-side by selection logic
            if (sqUpdate.highlight !== undefined) { 
              newState.board[sqUpdate.index].highlight = sqUpdate.highlight;
            }
          } else {
            console.warn(`Board update for non-existent square index: ${sqUpdate.index}`);
          }
        });
        break;
      case 'game_over':
        newState.winner = update.changes.winner;
        newState.winningLine = update.changes.winningLine;
        break;
      case 'pawns_to_place_update':
        newState.pawnsToPlace = update.changes;
        break;
      case 'placed_pawns_update':
        newState.placedPawns = update.changes;
        break;
      case 'selection_update': // This is usually client-side, but if server dictates it:
        newState.selectedPawnIndex = update.changes.selectedPawnIndex;
        // If server sends selection, client should also update its highlightedValidMoves if necessary
        // For simplicity, this example assumes client recalculates highlights based on selectedPawnIndex
        break;
      case 'last_move_update':
        newState.lastMove = update.changes;
        break;
      default:
        console.warn('Unknown delta update type:', update.type);
    }
  }
  
  // After applying all delta updates, recalculate derived state based on the new board.
  // This ensures consistency even if deltas are minimal.
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newState.board);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newState.board, newState.playerColors);
  // Check win condition based on the fully updated state from deltas + recalculated derived state
  const tempStateForWinCheck = {
    ...newState,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
  };
  const winCheck = checkWinCondition(tempStateForWinCheck);

  newState.blockedPawnsInfo = blockedPawns;
  newState.blockingPawnsInfo = blockingPawns;
  newState.deadZoneSquares = deadZones;
  newState.deadZoneCreatorPawnsInfo = deadZoneCreatorPawns;
  
  // Only update winner if not already set by a 'game_over' delta to avoid conflicts
  if (newState.winner === null && winCheck.winner !== null) {
      newState.winner = winCheck.winner;
      newState.winningLine = winCheck.winningLine;
  } else if (newState.winner !== null && winCheck.winner === null) {
      // This case implies a game was over but a delta made it not over.
      // This should be rare unless a reset or undo is part of deltas.
      newState.winner = null;
      newState.winningLine = null;
  }


  // Client-side only highlights (if not sent by server explicitly in board_update)
  // If a pawn is selected, the UI might show valid moves. This part is typically UI-driven
  // and not part of the core state synced from server unless server dictates highlights.
  // For now, we assume highlights are either in the delta or client recalculates them.
  if (!updates.some(u => u.type === 'board_update' && u.changes.squares.some((s:any) => s.highlight !== undefined))) {
    newState.board.forEach(sq => sq.highlight = undefined); // Clear existing UI highlights if not in delta
    if (newState.selectedPawnIndex !== null && newState.board[newState.selectedPawnIndex]) {
        // Re-highlight based on new state, if needed by UI logic that isn't part of this function
    }
  }
  
  return newState;
}

// Client-side prediction (optional, for smoother UI)
export function predictMove(
  currentState: GameState,
  fromIndex: number | null, 
  toIndex: number,
  playerId: PlayerId
): GameState {
  if (playerId !== currentState.currentPlayerId) {
    return currentState; // Can't predict opponent's moves or if not current player
  }
  
  // Create a deep copy for prediction
  const predictedState: GameState = JSON.parse(JSON.stringify(currentState));
  
  if (currentState.gamePhase === 'movement' && fromIndex !== null) {
    const fromSquare = predictedState.board[fromIndex];
    const toSquare = predictedState.board[toIndex];
    
    // Basic move prediction
    if (fromSquare?.pawn && !toSquare.pawn && toSquare.boardColor === predictedState.playerColors[playerId]) {
      toSquare.pawn = { ...fromSquare.pawn };
      fromSquare.pawn = null;
      predictedState.lastMove = { from: fromIndex, to: toIndex };
      // Switch player turn for prediction
      predictedState.currentPlayerId = playerId === 1 ? 2 : 1;
    }
  } else if (currentState.gamePhase === 'placement') {
    const square = predictedState.board[toIndex];
    
    if (!square.pawn && square.boardColor === predictedState.playerColors[playerId]) {
      square.pawn = {
        id: `p${playerId}_pred_${predictedState.placedPawns[playerId] + 1}`, // Temporary ID
        playerId: playerId,
        color: predictedState.playerColors[playerId]
      };
      
      predictedState.placedPawns[playerId]++;
      predictedState.pawnsToPlace[playerId]--;
      predictedState.lastMove = { from: null, to: toIndex };
      
      if (predictedState.pawnsToPlace[1] === 0 && predictedState.pawnsToPlace[2] === 0) {
        predictedState.gamePhase = 'movement';
      }
      // Switch player turn for prediction
      predictedState.currentPlayerId = playerId === 1 ? 2 : 1;
    }
  }
  
  // For a more accurate prediction, you'd also recalculate derived state here
  const { blockedPawns, blockingPawns } = updateBlockingStatus(predictedState.board);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(predictedState.board, predictedState.playerColors);
  const tempStateForWinCheck = {
    ...predictedState,
    blockedPawnsInfo: blockedPawns,
    blockingPawnsInfo: blockingPawns,
    deadZoneSquares: deadZones,
    deadZoneCreatorPawnsInfo: deadZoneCreatorPawns,
  };
  const winCheck = checkWinCondition(tempStateForWinCheck);

  predictedState.blockedPawnsInfo = blockedPawns;
  predictedState.blockingPawnsInfo = blockingPawns;
  predictedState.deadZoneSquares = deadZones;
  predictedState.deadZoneCreatorPawnsInfo = deadZoneCreatorPawns;
  
  if (winCheck.winner) {
    predictedState.winner = winCheck.winner;
    predictedState.winningLine = winCheck.winningLine;
    // Don't switch player if prediction results in a win for current player
    if (winCheck.winner === playerId) {
      predictedState.currentPlayerId = playerId;
    }
  }
  
  (predictedState as any).isPredicted = true; // Mark as predicted for UI if needed
  
  return predictedState;
}
