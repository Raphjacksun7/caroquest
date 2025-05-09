import type { GameState, PlayerId } from '../../lib/gameLogic';
import { 
  placePawn as applyPlacePawnLogic, 
  movePawn as applyMovePawnLogic, 
  isValidPlacement as checkIsValidPlacement, 
  getValidMoveDestinations as getValidMovesLogic,
  checkWinCondition, // For isTerminal and getReward
  updateBlockingStatus, // Needed for state updates
  updateDeadZones,      // Needed for state updates
  BOARD_SIZE
} from '../../lib/gameLogic'; // Assuming gameLogic is in the parent directory based on original structure
import type { AIConfigFeatures } from './ai-config'; // If this file exists

export interface Action {
  type: 'place' | 'move' | 'none'; 
  squareIndex?: number; 
  fromIndex?: number; 
  toIndex?: number;   
}

// This class can be used on the main thread if needed, but primarily for the worker structure.
// The worker will contain a self-contained version of this.
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
    // Critical: Ensure state properties are of correct types (Set/Map)
    this.state = {
        ...state,
        board: state.board.map(sq => ({...sq})), // Shallow copy board squares
        blockedPawnsInfo: new Set(state.blockedPawnsInfo),
        blockingPawnsInfo: new Set(state.blockingPawnsInfo),
        deadZoneSquares: new Map(state.deadZoneSquares),
        deadZoneCreatorPawnsInfo: new Set(state.deadZoneCreatorPawnsInfo), // Use correct field name
        highlightedValidMoves: Array.from(state.highlightedValidMoves || [])
    };
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
    const playerId = currentState.currentPlayerId;

    if (currentState.gamePhase === 'placement') {
      for (let i = 0; i < currentState.board.length; i++) {
        if (checkIsValidPlacement(i, playerId, currentState)) {
          actions.push({ type: 'place', squareIndex: i });
        }
      }
    } else { 
      for (let fromIdx = 0; fromIdx < currentState.board.length; fromIdx++) {
        const square = currentState.board[fromIdx];
        if (square.pawn?.playerId === playerId && !currentState.blockedPawnsInfo.has(fromIdx)) {
          const validDestinations = getValidMovesLogic(fromIdx, playerId, currentState);
          for (const toIdx of validDestinations) {
            actions.push({ type: 'move', fromIndex: fromIdx, toIndex: toIdx });
          }
        }
      }
    }
    return actions.length > 0 ? actions : [{type: 'none'}]; // Return 'none' if no valid actions
  }

  applyActionToState(currentState: GameState, action: Action): GameState | null {
    let tempState = structuredClone(currentState); // Deep clone for safety

    // Ensure Sets and Maps are correctly typed after cloning if structuredClone doesn't handle them perfectly for this context
    tempState.blockedPawnsInfo = new Set(tempState.blockedPawnsInfo);
    tempState.blockingPawnsInfo = new Set(tempState.blockingPawnsInfo);
    tempState.deadZoneSquares = new Map(Object.entries(tempState.deadZoneSquares).map(([k, v]) => [parseInt(k), v as PlayerId]));
    tempState.deadZoneCreatorPawnsInfo = new Set(tempState.deadZoneCreatorPawnsInfo);


    let nextState: GameState | null = null;
    if (action.type === 'place' && action.squareIndex !== undefined) {
      nextState = applyPlacePawnLogic(tempState, action.squareIndex);
    } else if (action.type === 'move' && action.fromIndex !== undefined && action.toIndex !== undefined) {
      nextState = applyMovePawnLogic(tempState, action.fromIndex, action.toIndex);
    } else if (action.type === 'none') {
      // If 'none' action, switch player but don't change board
      nextState = {
        ...tempState,
        currentPlayerId: tempState.currentPlayerId === 1 ? 2 : 1,
      };
    }
    
    // applyPlacePawnLogic and applyMovePawnLogic already handle derived state updates.
    return nextState;
  }
  
  isTerminal(state: GameState): boolean {
    return state.winner !== null || 
           (this.getValidActions(state).length === 1 && this.getValidActions(state)[0].type === 'none');
  }

  getReward(state: GameState, perspectivePlayerId: PlayerId): number {
    if (state.winner === perspectivePlayerId) return 1.0;
    if (state.winner !== null && state.winner !== perspectivePlayerId) return 0.0;
    return 0.5; 
  }
  // ... rest of MCTSNode methods (selectChild, expand, rollout, backpropagate) would be similar to the worker's version
  // but using the imported game logic functions directly.
}

// The MCTS class itself would also be similar, calling methods on MCTSNode.
// For brevity, I'm not repeating the full MCTS class here as it's similar to the worker.
// The key is that if this MCTS is run on the main thread, it uses the imported gameLogic.

    