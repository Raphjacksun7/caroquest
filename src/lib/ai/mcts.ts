import type { GameState, PlayerId } from '../../lib/gameLogic';
import { 
  placePawn as applyPlacePawnLogic, 
  movePawn as applyMovePawnLogic, 
  isValidPlacement as checkIsValidPlacement, 
  getValidMoveDestinations as getValidMovesLogic,
  // checkWinCondition, // isTerminal and getReward use gameState.winner directly
  // updateBlockingStatus, // Not needed for MCTS node's internal state updates, applyActionToState does it
  // updateDeadZones,      // Not needed for MCTS node's internal state updates, applyActionToState does it
  BOARD_SIZE
} from '../../lib/gameLogic'; 
// import type { AIConfigFeatures } from './ai-config'; // Not used in this file

export interface Action {
  type: 'place' | 'move' | 'none'; 
  squareIndex?: number; 
  fromIndex?: number; 
  toIndex?: number;   
}

export class MCTSNode {
  state: GameState;
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  untriedActions: Action[];
  actionThatLedToThisNode: Action | null;
  playerWhoseTurnItIs: PlayerId;

  constructor(state: GameState, parent: MCTSNode | null = null, action: Action | null = null) {
    this.state = structuredClone(state); // Always deep clone for safety
    this.parent = parent;
    this.actionThatLedToThisNode = action;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    this.playerWhoseTurnItIs = this.state.currentPlayerId;
    this.untriedActions = this.getValidActions(this.state);
  }

  getValidActions(currentState: GameState): Action[] {
    const actions: Action[] = [];
    // PlayerId is implicitly currentState.currentPlayerId for these checks
    if (currentState.gamePhase === 'placement') {
      for (let i = 0; i < currentState.board.length; i++) {
        if (checkIsValidPlacement(i, currentState)) { // Pass full gameState
          actions.push({ type: 'place', squareIndex: i });
        }
      }
    } else { 
      for (let fromIdx = 0; fromIdx < currentState.board.length; fromIdx++) {
        const square = currentState.board[fromIdx];
        if (square.pawn?.playerId === currentState.currentPlayerId && !currentState.blockedPawnsInfo.has(fromIdx)) {
          const validDestinations = getValidMovesLogic(fromIdx, currentState); // Pass full gameState
          for (const toIdx of validDestinations) {
            actions.push({ type: 'move', fromIndex: fromIdx, toIndex: toIdx });
          }
        }
      }
    }
    return actions.length > 0 ? actions : [{type: 'none'}];
  }

  applyActionToState(currentState: GameState, action: Action): GameState | null {
    // applyPlacePawnLogic and applyMovePawnLogic from gameLogic.ts already handle
    // deep cloning and all derived state updates (blocking, dead zones, winner).
    if (action.type === 'place' && action.squareIndex !== undefined) {
      return applyPlacePawnLogic(currentState, action.squareIndex);
    } else if (action.type === 'move' && action.fromIndex !== undefined && action.toIndex !== undefined) {
      return applyMovePawnLogic(currentState, action.fromIndex, action.toIndex);
    } else if (action.type === 'none') {
      // If 'none' action, switch player but don't change board. Recalculate derived state in case.
      // This scenario should be rare if getValidActions works correctly.
      let tempState = structuredClone(currentState);
      tempState.currentPlayerId = tempState.currentPlayerId === 1 ? 2 : 1;
      // applyPlacePawn/Move normally handle these; doing a simplified update for 'none'
      const { blockedPawns, blockingPawns } = updateBlockingStatus(tempState.board);
      const { deadZones, deadZoneCreatorPawnsInfo } = updateDeadZones(tempState.board, tempState.playerColors); // Corrected name
      const {winner, winningLine} = checkWinCondition(tempState);
      
      return {
        ...tempState,
        blockedPawnsInfo: blockedPawns,
        blockingPawnsInfo: blockingPawns,
        deadZoneSquares: deadZones,
        deadZoneCreatorPawnsInfo: deadZoneCreatorPawnsInfo, // Corrected name
        winner,
        winningLine
      };
    }
    return null;
  }
  
  isTerminal(state: GameState): boolean {
    return state.winner !== null || 
           (this.getValidActions(state).length === 1 && this.getValidActions(state)[0].type === 'none');
  }

  getReward(state: GameState, perspectivePlayerId: PlayerId): number {
    if (state.winner === perspectivePlayerId) return 1.0;
    if (state.winner !== null && state.winner !== perspectivePlayerId) return 0.0; // Opponent won
    return 0.5; // Draw or game still ongoing (should ideally not happen if isTerminal is true)
  }
}