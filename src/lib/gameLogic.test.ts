import {
  createInitialGameState,
  placePawn,
  movePawn,
  updateBlockingStatus,
  updateDeadZones,
  checkWinCondition,
  getValidMoveDestinations,
  highlightValidMoves,
  clearHighlights,
  isValidPlacement,
  isValidMove,
  BOARD_SIZE,
  PAWNS_PER_PLAYER,
  type GameState,
  type PlayerId,
  type SquareState,
  type Pawn,
  type SquareColor,
} from './gameLogic';

describe('Game Logic Tests', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = createInitialGameState();
  });

  describe('Initial State', () => {
    it('should create a board with 64 squares', () => {
      expect(gameState.board.length).toBe(BOARD_SIZE * BOARD_SIZE);
    });

    it('should initialize with Player 1 as current player', () => {
      expect(gameState.currentPlayerId).toBe(1);
    });

    it('should assign colors correctly to players', () => {
      expect(gameState.playerColors[1]).toBe('light');
      expect(gameState.playerColors[2]).toBe('dark');
    });

    it('should start in placement phase', () => {
      expect(gameState.gamePhase).toBe('placement');
    });

    it(`should give each player ${PAWNS_PER_PLAYER} pawns to place`, () => {
      expect(gameState.pawnsToPlace[1]).toBe(PAWNS_PER_PLAYER);
      expect(gameState.pawnsToPlace[2]).toBe(PAWNS_PER_PLAYER);
    });

    it('should have no winner initially', () => {
      expect(gameState.winner).toBeNull();
    });
  });

  describe('Pawn Placement', () => {
    it('should allow Player 1 to place a pawn on their color square', () => {
      const placementIndex = 0; // (0,0) is light
      const newState = placePawn(gameState, placementIndex);
      expect(newState).not.toBeNull();
      expect(newState?.board[placementIndex].pawn?.playerId).toBe(1);
      expect(newState?.pawnsToPlace[1]).toBe(PAWNS_PER_PLAYER - 1);
      expect(newState?.currentPlayerId).toBe(2); // Switch to Player 2
    });

    it('should not allow Player 1 to place on Player 2 color square', () => {
      const placementIndex = 1; // (0,1) is dark
      const newState = placePawn(gameState, placementIndex);
      expect(newState).toBeNull();
    });

    it('should switch to movement phase after all pawns are placed', () => {
      let currentGameState: GameState | null = gameState;
      // Player 1 places all pawns
      for (let i = 0; i < PAWNS_PER_PLAYER; i++) {
        const validPlacement = currentGameState!.board.findIndex(
          (sq, idx) => sq.boardColor === 'light' && !sq.pawn && isValidPlacement(idx, currentGameState!)
        );
        currentGameState = placePawn(currentGameState!, validPlacement);
      }
      // Player 2 places all pawns
      for (let i = 0; i < PAWNS_PER_PLAYER; i++) {
         const validPlacement = currentGameState!.board.findIndex(
          (sq, idx) => sq.boardColor === 'dark' && !sq.pawn && isValidPlacement(idx, currentGameState!)
        );
        currentGameState = placePawn(currentGameState!, validPlacement);
      }
      expect(currentGameState?.gamePhase).toBe('movement');
    });

    it('should prevent placing in a restricted zone (opponent sandwich)', () => {
      // P2 places at (0,1) and (0,3)
      gameState.board[1].pawn = { id: 'p2_1', playerId: 2, color: 'dark' };
      gameState.board[3].pawn = { id: 'p2_2', playerId: 2, color: 'dark' };
      gameState = { ...gameState, currentPlayerId: 1}; // P1's turn

      const placementIndex = 2; // (0,2) is light, P1's color, but between P2 pawns
      const newState = placePawn(gameState, placementIndex);
      expect(newState).toBeNull(); // Should not allow placement
    });
    
    it('should prevent placing in a dead zone for the current player', () => {
        // P1 places at (0,0) and (2,0) creating dead zone at (1,0) for P2
        gameState.board[0].pawn = { id: 'p1_1', playerId: 1, color: 'light' };
        gameState.board[BOARD_SIZE * 2].pawn = { id: 'p1_2', playerId: 1, color: 'light' };
        const { deadZones: dz, deadZoneCreatorPawns: dzcp } = updateDeadZones(gameState.board, gameState.playerColors);
        gameState.deadZoneSquares = dz;
        gameState.deadZoneCreatorPawnsInfo = dzcp;
        gameState.currentPlayerId = 2; // P2's turn

        const placementIndex = BOARD_SIZE * 1; // (1,0) is dark, but a dead zone for P2
        const newState = placePawn(gameState, placementIndex);
        expect(newState).toBeNull();
    });
  });

  describe('Pawn Movement', () => {
    beforeEach(() => {
      // Place some pawns and switch to movement phase
      gameState.board[0].pawn = { id: 'p1_1', playerId: 1, color: 'light' }; // (0,0)
      gameState.board[1].pawn = { id: 'p2_1', playerId: 2, color: 'dark' };  // (0,1)
      gameState.placedPawns = { 1: 1, 2: 1 };
      gameState.pawnsToPlace = { 1: PAWNS_PER_PLAYER -1, 2: PAWNS_PER_PLAYER -1 };
      // Simulate all pawns placed to enter movement phase
      gameState.pawnsToPlace = {1:0, 2:0};
      gameState.gamePhase = 'movement';
      gameState.currentPlayerId = 1;
    });

    it('should allow Player 1 to move their pawn to a valid empty square of their color', () => {
      const fromIndex = 0;
      const toIndex = 2; // (0,2) is light and empty
      const newState = movePawn(gameState, fromIndex, toIndex);
      expect(newState).not.toBeNull();
      expect(newState?.board[fromIndex].pawn).toBeNull();
      expect(newState?.board[toIndex].pawn?.id).toBe('p1_1');
      expect(newState?.currentPlayerId).toBe(2);
    });

    it('should not allow moving to an occupied square', () => {
      gameState.board[2].pawn = { id: 'p1_2', playerId: 1, color: 'light' };
      const fromIndex = 0;
      const toIndex = 2; // Occupied by another P1 pawn
      const newState = movePawn(gameState, fromIndex, toIndex);
      expect(newState).toBeNull();
    });

    it('should not allow moving to a square of the wrong color', () => {
      const fromIndex = 0;
      const toIndex = 1; // (0,1) is dark
      const newState = movePawn(gameState, fromIndex, toIndex);
      expect(newState).toBeNull();
    });
    
    it('should not allow moving a blocked pawn', () => {
        gameState.board[0].pawn = {id: 'p2_1', playerId: 2, color: 'dark'}; // Blocker
        gameState.board[BOARD_SIZE].pawn = {id: 'p1_1', playerId: 1, color: 'light'}; // Blocked
        gameState.board[BOARD_SIZE*2].pawn = {id: 'p2_2', playerId: 2, color: 'dark'}; // Blocker
        const {blockedPawns} = updateBlockingStatus(gameState.board);
        gameState.blockedPawnsInfo = blockedPawns;
        gameState.currentPlayerId = 1;

        const fromIndex = BOARD_SIZE; // P1's blocked pawn
        const toIndex = BOARD_SIZE + 2; // A valid light square
        const newState = movePawn(gameState, fromIndex, toIndex);
        expect(newState).toBeNull();
    });

    it('should not allow moving to a dead zone for the current player', () => {
        // P2 creates dead zone for P1 at (1,1) - dark square
        gameState.board[1].pawn = { id: 'p2_1', playerId: 2, color: 'dark'}; // (0,1)
        gameState.board[BOARD_SIZE*2 + 1].pawn = { id: 'p2_2', playerId: 2, color: 'dark'}; // (2,1)
        const { deadZones } = updateDeadZones(gameState.board, gameState.playerColors);
        gameState.deadZoneSquares = deadZones;
        
        // P1's turn, try to move to (1,1)
        gameState.board[0].pawn = {id: 'p1_1', playerId: 1, color: 'light'};
        gameState.currentPlayerId = 1;
        
        // (1,1) is index 9, should be a light square for P1
        // But P2 has created a dead zone there for P1 if (1,1) is player 2's assigned color
        // This test case needs review, dead zone should be for opponent, on THEIR color
        // For this test, let's assume (1,1) is a dead zone for P1.
        // It's a light square (index 9)
        gameState.deadZoneSquares.set(9, 1); // Manually set (1,1) as dead for P1

        const fromIndex = 0; // P1's pawn at (0,0)
        const toIndex = 9; // P1 attempts to move to (1,1) - a dead zone for P1
        const newState = movePawn(gameState, fromIndex, toIndex);
        expect(newState).toBeNull();
    });
  });

  describe('Blocking and Dead Zones', () => {
    it('should correctly identify blocked and blocking pawns (horizontal)', () => {
      gameState.board[0].pawn = { id: 'p1_1', playerId: 1, color: 'light' };
      gameState.board[1].pawn = { id: 'p2_1', playerId: 2, color: 'dark' };
      gameState.board[2].pawn = { id: 'p1_2', playerId: 1, color: 'light' };
      const { blockedPawns, blockingPawns } = updateBlockingStatus(gameState.board);
      expect(blockedPawns.has(1)).toBe(true);
      expect(blockingPawns.has(0)).toBe(true);
      expect(blockingPawns.has(2)).toBe(true);
    });

    it('should correctly identify dead zones and creator pawns (horizontal)', () => {
      // P1 creates a dead zone for P2 at (0,1) which is a dark square
      gameState.board[0].pawn = { id: 'p1_1', playerId: 1, color: 'light' }; // (0,0)
      // gameState.board[1] is empty, (0,1) dark
      gameState.board[2].pawn = { id: 'p1_2', playerId: 1, color: 'light' }; // (0,2)
      
      const { deadZones, deadZoneCreatorPawns } = updateDeadZones(gameState.board, gameState.playerColors);
      expect(deadZones.get(1)).toBe(2); // Square 1 is dead zone for player 2
      expect(deadZoneCreatorPawns.has(0)).toBe(true);
      expect(deadZoneCreatorPawns.has(2)).toBe(true);
    });
  });

  describe('Win Condition', () => {
    it('should declare Player 1 winner with a valid diagonal', () => {
      // P1 winning diagonal on light squares: (0,0), (1,1), (2,2), (3,3)
      [0, 9, 18, 27].forEach(idx => {
        gameState.board[idx].pawn = { id: `p1_${idx}`, playerId: 1, color: 'light' };
      });
      const { winner, winningLine } = checkWinCondition(gameState);
      expect(winner).toBe(1);
      expect(winningLine).toEqual([0, 9, 18, 27]);
    });

    it('should not declare a winner if a pawn in the line is blocked', () => {
      [0, 9, 18, 27].forEach(idx => {
        gameState.board[idx].pawn = { id: `p1_${idx}`, playerId: 1, color: 'light' };
      });
      gameState.blockedPawnsInfo.add(18); // Pawn at (2,2) is blocked
      const { winner } = checkWinCondition(gameState);
      expect(winner).toBeNull();
    });
    
    it('should not declare a winner if a pawn in the line is creating a dead zone', () => {
      [0, 9, 18, 27].forEach(idx => {
        gameState.board[idx].pawn = { id: `p1_${idx}`, playerId: 1, color: 'light' };
      });
      gameState.deadZoneCreatorPawnsInfo.add(18); // Pawn at (2,2) creates a dead zone
      const { winner } = checkWinCondition(gameState);
      expect(winner).toBeNull();
    });

    it('should not declare a winner if the line passes through a dead zone for that player', () => {
      [0, 9, 18, 27].forEach(idx => {
        gameState.board[idx].pawn = { id: `p1_${idx}`, playerId: 1, color: 'light' };
      });
      gameState.deadZoneSquares.set(18, 1); // Square (2,2) is a dead zone for player 1
      const { winner } = checkWinCondition(gameState);
      expect(winner).toBeNull();
    });
  });

  describe('Highlighting Logic', () => {
    it('should correctly highlight valid moves for a selected pawn', () => {
        gameState.gamePhase = 'movement';
        gameState.board[0].pawn = {id: 'p1_1', playerId:1, color: 'light'};
        gameState.currentPlayerId = 1;
        const newState = highlightValidMoves(gameState, 0);
        expect(newState.board[0].highlight).toBe('selectedPawn');
        expect(newState.selectedPawnIndex).toBe(0);
        // Check a few valid light squares
        expect(newState.board[2].highlight).toBe('validMove'); // (0,2)
        expect(newState.board[10].highlight).toBe('validMove'); // (1,2)
    });

    it('should clear highlights', () => {
        gameState.gamePhase = 'movement';
        gameState.board[0].pawn = {id: 'p1_1', playerId:1, color: 'light'};
        let newState = highlightValidMoves(gameState, 0);
        newState = clearHighlights(newState);
        expect(newState.selectedPawnIndex).toBeNull();
        expect(newState.board.every(sq => sq.highlight === undefined)).toBe(true);
    });
  });

});