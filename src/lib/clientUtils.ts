
import type { GameState, PlayerId, Pawn, SquareState } from './types';
import { updateBlockingStatus, updateDeadZones, checkWinCondition } from './gameLogic';


export function applyDeltaUpdatesToGameState(
  currentState: GameState, 
  updates: { type: string, changes: any }[],
  // seqId?: number // seqId can be used for more robust ordering if implemented fully
): GameState {
  let newState = { ...currentState, board: [...currentState.board.map(sq => ({...sq}))] };

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
            if (sqUpdate.highlight !== undefined) { // Only update highlight if provided
              newState.board[sqUpdate.index].highlight = sqUpdate.highlight;
            }
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
      case 'selection_update':
        newState.selectedPawnIndex = update.changes.selectedPawnIndex;
        break;
      case 'last_move_update':
        newState.lastMove = update.changes;
        break;
      default:
        console.warn('Unknown delta update type:', update.type);
    }
  }
  
  // After applying all delta updates, recalculate derived state.
  // This is important because deltas might only provide partial information.
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newState.board);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newState.board, newState.playerColors);
  const winCheck = checkWinCondition(newState);

  newState.blockedPawnsInfo = blockedPawns;
  newState.blockingPawnsInfo = blockingPawns;
  newState.deadZoneSquares = deadZones;
  newState.deadZoneCreatorPawnsInfo = deadZoneCreatorPawns;
  newState.winner = winCheck.winner;
  newState.winningLine = winCheck.winningLine;
  
  return newState;
}

export function predictMove(
  currentState: GameState,
  fromIndex: number | null, // fromIndex can be null for placement
  toIndex: number,
  playerId: PlayerId
): GameState {
  if (playerId !== currentState.currentPlayerId) {
    return currentState; 
  }
  
  const predictedState = JSON.parse(JSON.stringify(currentState)) as GameState;
  
  if (currentState.gamePhase === 'movement' && fromIndex !== null) {
    const fromSquare = predictedState.board[fromIndex];
    const toSquare = predictedState.board[toIndex];
    
    if (fromSquare?.pawn && !toSquare.pawn) {
      toSquare.pawn = { ...fromSquare.pawn };
      fromSquare.pawn = null;
      predictedState.lastMove = { from: fromIndex, to: toIndex };
    }
  } else if (currentState.gamePhase === 'placement') {
    const square = predictedState.board[toIndex];
    
    if (!square.pawn) {
      square.pawn = {
        id: `p${playerId}_${predictedState.placedPawns[playerId] + 1}`,
        playerId: playerId as PlayerId,
        color: predictedState.playerColors[playerId]
      };
      
      predictedState.placedPawns[playerId]++;
      predictedState.pawnsToPlace[playerId]--;
      predictedState.lastMove = { from: null, to: toIndex };

      if (predictedState.pawnsToPlace[1] === 0 && predictedState.pawnsToPlace[2] === 0) {
        predictedState.gamePhase = 'movement';
      }
    }
  }
  
  // Recalculate derived state for the prediction
  const { blockedPawns, blockingPawns } = updateBlockingStatus(predictedState.board);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(predictedState.board, predictedState.playerColors);
  const winCheck = checkWinCondition(predictedState);

  predictedState.blockedPawnsInfo = blockedPawns;
  predictedState.blockingPawnsInfo = blockingPawns;
  predictedState.deadZoneSquares = deadZones;
  predictedState.deadZoneCreatorPawnsInfo = deadZoneCreatorPawns;
  predictedState.winner = winCheck.winner;
  predictedState.winningLine = winCheck.winningLine;
  predictedState.currentPlayerId = winCheck.winner ? predictedState.currentPlayerId : (playerId === 1 ? 2 : 1);
  
  (predictedState as any).isPredicted = true; // Mark as predicted for UI if needed
  
  return predictedState;
}
