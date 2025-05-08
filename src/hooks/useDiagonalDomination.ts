
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GameBoardArray, Player, PawnPosition, GamePhase, WinningLine, DeadZone, SquareColorType, BoardSquareData } from '@/types/game';
import { BOARD_SIZE, PAWNS_PER_PLAYER as DEFAULT_PAWNS_PER_PLAYER, WINNING_LINE_LENGTH } from '@/config/game';
import { getSquareColorType as getBoardSquareColorType } from '@/lib/gameUtils';
import { useToast } from "@/hooks/use-toast";

export const useDiagonalDomination = () => {
  const { toast } = useToast();
  const [board, setBoard] = useState<GameBoardArray>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [selectedPawn, setSelectedPawn] = useState<PawnPosition | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('PLACEMENT'); // 'PLAYER_SETUP' can be used if there's async setup
  const [winner, setWinner] = useState<Player | null>(null);
  const [player1PawnsPlaced, setPlayer1PawnsPlaced] = useState(0);
  const [player2PawnsPlaced, setPlayer2PawnsPlaced] = useState(0);
  const [pawnsPerPlayer, setPawnsPerPlayer] = useState<number>(DEFAULT_PAWNS_PER_PLAYER);
  const [deadZones, setDeadZones] = useState<DeadZone[]>([]);
  const [winningLine, setWinningLine] = useState<WinningLine | null>(null);

  const getPlayerSquareColor = useCallback((player: Player): SquareColorType => {
    return player === 1 ? 'light' : 'dark';
  }, []);

  const initializeNewBoard = useCallback((): GameBoardArray => {
    const newBoard: GameBoardArray = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      const boardRow: BoardSquareData[] = [];
      for (let col = 0; col < BOARD_SIZE; col++) {
        boardRow.push({
          player: null,
          isBlocked: false,
          isBlocking: false,
          isCreatingDeadZone: false,
        });
      }
      newBoard.push(boardRow);
    }
    return newBoard;
  }, []);
  
  const resetGame = useCallback(() => {
    setBoard(initializeNewBoard());
    setCurrentPlayer(1);
    setSelectedPawn(null);
    setGamePhase('PLACEMENT');
    setWinner(null);
    setPlayer1PawnsPlaced(0);
    setPlayer2PawnsPlaced(0);
    setDeadZones([]);
    setWinningLine(null);
    if (typeof pawnsPerPlayer === 'number' && pawnsPerPlayer > 0) { // Ensure pawnsPerPlayer is valid before toasting
        toast({ title: "Game Reset", description: `New game started with ${pawnsPerPlayer} pawns per player.` });
    }
  }, [toast, initializeNewBoard]);

  useEffect(() => {
    // Initialize board on mount and when pawnsPerPlayer changes
    resetGame();
  }, [resetGame]);


  const updateBoardStateLogic = useCallback((currentBoard: GameBoardArray, forPlayer: Player): { updatedBoard: GameBoardArray, newDeadZonesForOpponent: DeadZone[] } => {
    const newBoard = currentBoard.map(r => r.map(s => ({...s}))); // Deep copy
    const newDeadZonesForOpponentList: DeadZone[] = [];

    // Reset statuses that depend on current player's action or opponent's pieces
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        newBoard[r][c].isBlocked = false;
        newBoard[r][c].isBlocking = false;
        newBoard[r][c].isCreatingDeadZone = false; 
      }
    }

    const opponentPlayer = forPlayer === 1 ? 2 : 1;

    // Blocking logic (Rule 4.1)
    // Check horizontal blocks (forPlayer blocks opponentPlayer)
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE - 2; c++) {
        if (newBoard[r][c].player === forPlayer && newBoard[r][c+1].player === opponentPlayer && newBoard[r][c+2].player === forPlayer) {
          newBoard[r][c].isBlocking = true;
          newBoard[r][c+1].isBlocked = true;
          newBoard[r][c+2].isBlocking = true;
        }
      }
    }
    // Check vertical blocks
    for (let c = 0; c < BOARD_SIZE; c++) {
      for (let r = 0; r < BOARD_SIZE - 2; r++) {
        if (newBoard[r][c].player === forPlayer && newBoard[r+1][c].player === opponentPlayer && newBoard[r+2][c].player === forPlayer) {
          newBoard[r][c].isBlocking = true;
          newBoard[r+1][c].isBlocked = true;
          newBoard[r+2][c].isBlocking = true;
        }
      }
    }
    
    // Dead Zone Creation & Marking Pawns Creating Dead Zones (Rule: My Pawn - empty space of my color - My Pawn)
    // Horizontal dead zones created by forPlayer for opponentPlayer
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE - 2; c++) {
        if (newBoard[r][c].player === forPlayer &&
            newBoard[r][c+1].player === null && getBoardSquareColorType(r, c+1) === getPlayerSquareColor(forPlayer) &&
            newBoard[r][c+2].player === forPlayer) {
          newDeadZonesForOpponentList.push({ row: r, col: c + 1, player: opponentPlayer }); // Dead zone FOR opponentPlayer
          newBoard[r][c].isCreatingDeadZone = true;
          newBoard[r][c+2].isCreatingDeadZone = true;
        }
      }
    }
    // Vertical dead zones created by forPlayer for opponentPlayer
    for (let c = 0; c < BOARD_SIZE; c++) {
      for (let r = 0; r < BOARD_SIZE - 2; r++) {
        if (newBoard[r][c].player === forPlayer &&
            newBoard[r+1][c].player === null && getBoardSquareColorType(r+1, c) === getPlayerSquareColor(forPlayer) &&
            newBoard[r+2][c].player === forPlayer) {
          newDeadZonesForOpponentList.push({ row: r + 1, col: c, player: opponentPlayer }); // Dead zone FOR opponentPlayer
          newBoard[r][c].isCreatingDeadZone = true;
          newBoard[r+2][c].isCreatingDeadZone = true;
        }
      }
    }
    return { updatedBoard: newBoard, newDeadZonesForOpponent: newDeadZonesForOpponentList };
  }, [getPlayerSquareColor]);


  const checkWinCondition = useCallback((currentBoard: GameBoardArray, player: Player, currentAllDeadZones: DeadZone[]): WinningLine | null => {
    const isValidForWin = (r: number, c: number): boolean => {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
      const square = currentBoard[r][c];
      // Pawns that are blocked, actively blocking, or creating dead zones cannot be part of a winning diagonal
      return square.player === player && !square.isBlocked && !square.isBlocking && !square.isCreatingDeadZone;
    };

    // A square in the potential winning line cannot be a dead zone FOR THE CURRENT PLAYER.
    const isSquareInDeadZoneForThisPlayer = (r: number, c: number): boolean => {
      return currentAllDeadZones.some(dz => dz.row === r && dz.col === c && dz.player === player);
    };

    const directions = [ { dr: 1, dc: 1 }, { dr: 1, dc: -1 } ]; // Check two main diagonal directions

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        // Start checking from a valid pawn that is not in its own dead zone
        if (!isValidForWin(r, c) || isSquareInDeadZoneForThisPlayer(r,c)) continue;

        for (const { dr, dc } of directions) {
          const line: PawnPosition[] = [{ row: r, col: c }];
          let possibleWin = true;
          for (let i = 1; i < WINNING_LINE_LENGTH; i++) {
            const nr = r + i * dr;
            const nc = c + i * dc;
            if (!isValidForWin(nr, nc) || isSquareInDeadZoneForThisPlayer(nr,nc)) {
              possibleWin = false;
              break;
            }
            line.push({ row: nr, col: nc });
          }
          if (possibleWin) {
            return { player, positions: line };
          }
        }
      }
    }
    return null;
  }, []);


  const afterTurnProcessing = useCallback((interimBoard: GameBoardArray, playerMakingMove: Player) => {
    const opponentOfPlayerMakingMove = playerMakingMove === 1 ? 2 : 1;

    // Calculate state based on playerMakingMove's action
    const { updatedBoard: boardAfterPlayerMove, newDeadZonesForOpponent: deadZonesCreatedByPlayer } = updateBoardStateLogic(interimBoard, playerMakingMove);
    
    // Now, re-evaluate for the opponent based on the new board state (e.g., if playerMakingMove unblocked opponent's pieces)
    // This will also determine dead zones created by the opponent FOR playerMakingMove.
    const { updatedBoard: finalBoardState, newDeadZonesForOpponent: deadZonesCreatedByOpponent } = updateBoardStateLogic(boardAfterPlayerMove, opponentOfPlayerMakingMove);

    const allCurrentDeadZones = [...deadZonesCreatedByPlayer, ...deadZonesCreatedByOpponent];
    
    setBoard(finalBoardState);
    setDeadZones(allCurrentDeadZones);

    const winCheck = checkWinCondition(finalBoardState, playerMakingMove, allCurrentDeadZones);
    if (winCheck) {
      setWinner(playerMakingMove);
      setWinningLine(winCheck);
      setGamePhase('GAME_OVER');
      toast({ title: "Game Over!", description: `Player ${playerMakingMove} wins!` });
      return true; // Game ended
    }
    return false; // Game continues
  }, [updateBoardStateLogic, checkWinCondition, toast]);


  const placePawn = useCallback((row: number, col: number) => {
    const opponent = currentPlayer === 1 ? 2 : 1;
    let newBoard = board.map(r => r.map(s => ({...s}))); // Create a mutable copy

    // Restricted Placement Check (Rule 4.4 "Restricted Zones")
    // "If a player places two pawns with a space between them horizontally (My Pawn - empty space - My Pawn), 
    // the opponent cannot place their pawn in that empty space."
    // This means if `opponent` has created such a zone, `currentPlayer` cannot place in `(row, col)`.
    let isPlacementRestricted = false;
    // Horizontal: OpponentPawn - (row,col) - OpponentPawn
    if (col > 0 && col < BOARD_SIZE - 1 &&
        newBoard[row][col-1].player === opponent && 
        newBoard[row][col+1].player === opponent &&
        getBoardSquareColorType(row, col) === getPlayerSquareColor(currentPlayer)) { // square must be of current player's color
            isPlacementRestricted = true;
    }
    // Vertical: OpponentPawn - (row,col) - OpponentPawn
    if (!isPlacementRestricted && row > 0 && row < BOARD_SIZE - 1 &&
        newBoard[row-1][col].player === opponent && 
        newBoard[row+1][col].player === opponent &&
        getBoardSquareColorType(row, col) === getPlayerSquareColor(currentPlayer)) {
            isPlacementRestricted = true;
    }

    if (isPlacementRestricted) {
      toast({ title: "Invalid Placement", description: "You cannot place a pawn in a zone restricted by your opponent.", variant: "destructive" });
      return;
    }

    newBoard[row][col].player = currentPlayer;
    
    let currentP1Pawns = player1PawnsPlaced;
    let currentP2Pawns = player2PawnsPlaced;

    if (currentPlayer === 1) {
      currentP1Pawns++;
      setPlayer1PawnsPlaced(currentP1Pawns);
    } else {
      currentP2Pawns++;
      setPlayer2PawnsPlaced(currentP2Pawns);
    }

    if (afterTurnProcessing(newBoard, currentPlayer)) return; // Win check happened

    if (currentP1Pawns === pawnsPerPlayer && currentP2Pawns === pawnsPerPlayer) {
      setGamePhase('MOVEMENT');
      toast({ title: "Phase Change", description: "All pawns placed. Movement phase begins." });
    }
    setCurrentPlayer(opponent);

  }, [afterTurnProcessing, toast, getPlayerSquareColor, board, currentPlayer, player1PawnsPlaced, player2PawnsPlaced, pawnsPerPlayer]);


  const movePawn = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    const opponent = currentPlayer === 1 ? 2 : 1;
    let newBoard = board.map(r => r.map(s => ({...s})));
    
    newBoard[toRow][toCol].player = currentPlayer;
    newBoard[fromRow][fromCol].player = null;
    
    setSelectedPawn(null);

    if (afterTurnProcessing(newBoard, currentPlayer)) return; // Win check happened
    
    setCurrentPlayer(opponent);
  }, [afterTurnProcessing, board, currentPlayer]);

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (winner || gamePhase === 'GAME_OVER') return;

    const clickedSquareData = board[row][col]; // Already a copy from board state
    const clickedActualSquareColor = getBoardSquareColorType(row, col);
    const currentPlayerRequiredColor = getPlayerSquareColor(currentPlayer);

    if (clickedActualSquareColor !== currentPlayerRequiredColor) {
      toast({ title: "Invalid Square", description: "You must play on squares of your assigned color.", variant: "destructive" });
      return;
    }

    if (gamePhase === 'PLACEMENT') {
      if (clickedSquareData.player === null) {
        placePawn(row, col);
      } else {
        toast({ title: "Occupied Square", description: "This square is already occupied.", variant: "destructive" });
      }
    } else if (gamePhase === 'MOVEMENT') {
      if (selectedPawn === null) { // Attempting to select a pawn
        if (clickedSquareData.player === currentPlayer) {
          if (clickedSquareData.isBlocked) {
            toast({ title: "Blocked Pawn", description: "This pawn is blocked and cannot move.", variant: "destructive" });
            return;
          }
          setSelectedPawn({ row, col });
        } else if (clickedSquareData.player !== null) {
          toast({ title: "Not Your Pawn", description: "You can only select your own pawns.", variant: "destructive" });
        } else {
           toast({ title: "Empty Square", description: "Select one of your pawns to move.", variant: "destructive" });
        }
      } else { // Attempting to move the selectedPawn
        if (clickedSquareData.player === null) { // Target square is empty
          // Check if target is the same as selected (deselect)
          if (selectedPawn.row === row && selectedPawn.col === col) {
            setSelectedPawn(null);
          } else {
            movePawn(selectedPawn.row, selectedPawn.col, row, col);
          }
        } else { // Target square is occupied
           toast({ title: "Occupied Target", description: "You cannot move to an occupied square.", variant: "destructive" });
           // Optionally deselect if player clicks another of their own pawns
           if (clickedSquareData.player === currentPlayer && !clickedSquareData.isBlocked) {
             setSelectedPawn({row, col});
           } else {
             setSelectedPawn(null);
           }
        }
      }
    }
  }, [board, currentPlayer, getPlayerSquareColor, selectedPawn, placePawn, movePawn, toast, winner, gamePhase]);


  const changePawnsPerPlayerCount = useCallback((count: number) => {
    if (count >= 3 && count <= 10) {
      setPawnsPerPlayer(count);
      // The useEffect for pawnsPerPlayer will call resetGame
    } else {
      toast({ title: "Invalid Input", description: "Pawns per player must be between 3 and 10.", variant: "destructive" });
    }
  }, [toast]);

  return {
    board,
    currentPlayer,
    gamePhase,
    pawnsPlaced: { 1: player1PawnsPlaced, 2: player2PawnsPlaced },
    selectedPawn,
    winner,
    winningLine,
    handleSquareClick,
    resetGame,
    pawnsPerPlayer,
    changePawnsPerPlayerCount,
    deadZones, // This should be all dead zones for UI rendering purposes
    getPlayerSquareColor,
  };
};

    