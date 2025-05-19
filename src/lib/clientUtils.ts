
import type { GameState, PlayerId, Pawn, SquareState, GameOptions } from './types';
import { updateBlockingStatus, updateDeadZones, checkWinCondition, assignPlayerColors } from './gameLogic';


export function applyDeltaUpdatesToGameState(
  currentState: GameState, 
  updates: { type: string, changes: any }[],
  seqId?: number // seqId is now optional
): GameState {
  let newState = JSON.parse(JSON.stringify(currentState)) as GameState;
  newState.blockedPawnsInfo = new Set(Array.from(currentState.blockedPawnsInfo || []));
  newState.blockingPawnsInfo = new Set(Array.from(currentState.blockingPawnsInfo || []));
  const deadZoneEntries = Array.isArray(currentState.deadZoneSquares) 
    ? currentState.deadZoneSquares 
    : Object.entries(currentState.deadZoneSquares || {});
  newState.deadZoneSquares = new Map(deadZoneEntries.map(([k,v]) => [parseInt(k as string), v as PlayerId]));
  newState.deadZoneCreatorPawnsInfo = new Set(Array.from(currentState.deadZoneCreatorPawnsInfo || []));
  newState.playerColors = currentState.playerColors || assignPlayerColors(); 
  newState.options = currentState.options || {};


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
      case 'selection_update': 
        newState.selectedPawnIndex = update.changes.selectedPawnIndex;
        break;
      case 'last_move_update':
        newState.lastMove = update.changes;
        break;
      case 'options_update': // Handle options update
        newState.options = { ...newState.options, ...update.changes };
        break;
      default:
        console.warn('Unknown delta update type:', update.type);
    }
  }
  
  const { blockedPawns, blockingPawns } = updateBlockingStatus(newState.board);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(newState.board, newState.playerColors);
  
  const tempStateForWinCheck: GameState = {
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
  
  if (newState.winner === null && winCheck.winner !== null) {
      newState.winner = winCheck.winner;
      newState.winningLine = winCheck.winningLine;
  } else if (newState.winner !== null && winCheck.winner === null) {
      newState.winner = null;
      newState.winningLine = null;
  }

  if (!updates.some(u => u.type === 'board_update' && u.changes.squares.some((s:any) => s.highlight !== undefined))) {
    newState.board.forEach(sq => sq.highlight = undefined); 
    if (newState.selectedPawnIndex !== null && newState.board[newState.selectedPawnIndex]) {
        // UI logic might re-highlight based on selectedPawnIndex
    }
  }
  
  return newState;
}

export function predictMove(
  currentState: GameState,
  fromIndex: number | null, 
  toIndex: number,
  playerId: PlayerId
): GameState {
  if (playerId !== currentState.currentPlayerId) {
    return currentState; 
  }
  
  const predictedState: GameState = JSON.parse(JSON.stringify(currentState));
  
  if (currentState.gamePhase === 'movement' && fromIndex !== null) {
    const fromSquare = predictedState.board[fromIndex];
    const toSquare = predictedState.board[toIndex];
    
    if (fromSquare?.pawn && !toSquare.pawn && toSquare.boardColor === predictedState.playerColors[playerId]) {
      toSquare.pawn = { ...fromSquare.pawn };
      fromSquare.pawn = null;
      predictedState.lastMove = { from: fromIndex, to: toIndex };
      predictedState.currentPlayerId = playerId === 1 ? 2 : 1;
    }
  } else if (currentState.gamePhase === 'placement') {
    const square = predictedState.board[toIndex];
    
    if (!square.pawn && square.boardColor === predictedState.playerColors[playerId]) {
      square.pawn = {
        id: `p${playerId}_pred_${predictedState.placedPawns[playerId] + 1}`, 
        playerId: playerId,
        color: predictedState.playerColors[playerId]
      };
      
      predictedState.placedPawns[playerId]++;
      predictedState.pawnsToPlace[playerId]--;
      predictedState.lastMove = { from: null, to: toIndex };
      
      if (predictedState.pawnsToPlace[1] === 0 && predictedState.pawnsToPlace[2] === 0) {
        predictedState.gamePhase = 'movement';
      }
      predictedState.currentPlayerId = playerId === 1 ? 2 : 1;
    }
  }
  
  const { blockedPawns, blockingPawns } = updateBlockingStatus(predictedState.board);
  const { deadZones, deadZoneCreatorPawns } = updateDeadZones(predictedState.board, predictedState.playerColors);
  const tempStateForWinCheck: GameState = {
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
    if (winCheck.winner === playerId) {
      predictedState.currentPlayerId = playerId;
    }
  }
  
  (predictedState as any).isPredicted = true; 
  
  return predictedState;
}