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
  const [gamePhase, setGamePhase] = useState<GamePhase>('PLACEMENT');
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
    return Array(BOARD_SIZE).fill(null).map(() =>
      Array(BOARD_SIZE).fill(null).map<BoardSquareData>(() => ({
        player: null,
        isBlocked: false,
        isBlocking: false,
        isCreatingDeadZone: false,
      }))
    );
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
    if (typeof pawnsPerPlayer === 'number' && pawnsPerPlayer > 0) {
        toast({ title: "Game Reset", description: `New game started with ${pawnsPerPlayer} pawns per player.` });
    }
  }, [toast, initializeNewBoard, pawnsPerPlayer]);

  useEffect(() => {
    resetGame();
  }, [pawnsPerPlayer]); // resetGame dependency already includes pawnsPerPlayer indirectly through toast

  const updateBoardStateLogic = useCallback((currentBoard: GameBoardArray): { updatedBoard: GameBoardArray, newDeadZones: DeadZone[] } => {
    const newBoard = currentBoard.map(r => r.map(s => ({...s, isBlocked: false, isBlocking: false, isCreatingDeadZone: false })));
    const allNewDeadZones: DeadZone[] = [];

    for (const player of [1, 2] as Player[]) {
      const opponent = player === 1 ? 2 : 1;
      // Blocking logic (Rule 4.1)
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE - 2; c++) { // Horizontal O-X-O
          if (newBoard[r][c].player === player && newBoard[r][c+1].player === opponent && newBoard[r][c+2].player === player) {
            newBoard[r][c].isBlocking = true;
            newBoard[r][c+1].isBlocked = true;
            newBoard[r][c+2].isBlocking = true;
          }
        }
      }
      for (let c = 0; c < BOARD_SIZE; c++) { // Vertical O-X-O
        for (let r = 0; r < BOARD_SIZE - 2; r++) {
          if (newBoard[r][c].player === player && newBoard[r+1][c].player === opponent && newBoard[r+2][c].player === player) {
            newBoard[r][c].isBlocking = true;
            newBoard[r+1][c].isBlocked = true;
            newBoard[r+2][c].isBlocking = true;
          }
        }
      }

      // Dead Zone Creation & Marking Pawns Creating Dead Zones (Rule: My Pawn - empty space of my color - My Pawn)
      const playerColor = getPlayerSquareColor(player);
      for (let r = 0; r < BOARD_SIZE; r++) { // Horizontal MyPawn - EmptyMyColor - MyPawn
        for (let c = 0; c < BOARD_SIZE - 2; c++) {
          if (newBoard[r][c].player === player &&
              newBoard[r][c+1].player === null && getBoardSquareColorType(r, c+1) === playerColor &&
              newBoard[r][c+2].player === player) {
            allNewDeadZones.push({ row: r, col: c + 1, player: opponent }); // Dead zone FOR opponent
            newBoard[r][c].isCreatingDeadZone = true;
            newBoard[r][c+2].isCreatingDeadZone = true;
          }
        }
      }
      for (let c = 0; c < BOARD_SIZE; c++) { // Vertical MyPawn - EmptyMyColor - MyPawn
        for (let r = 0; r < BOARD_SIZE - 2; r++) {
          if (newBoard[r][c].player === player &&
              newBoard[r+1][c].player === null && getBoardSquareColorType(r+1, c) === playerColor &&
              newBoard[r+2][c].player === player) {
            allNewDeadZones.push({ row: r + 1, col: c, player: opponent }); // Dead zone FOR opponent
            newBoard[r][c].isCreatingDeadZone = true;
            newBoard[r+2][c].isCreatingDeadZone = true;
          }
        }
      }
    }
    return { updatedBoard: newBoard, newDeadZones: allNewDeadZones };
  }, [getPlayerSquareColor]);


  const checkWinCondition = useCallback((currentBoard: GameBoardArray, player: Player, currentAllDeadZones: DeadZone[]): WinningLine | null => {
    const isValidForWin = (r: number, c: number): boolean => {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
      const square = currentBoard[r][c];
      return square.player === player && !square.isBlocked && !square.isBlocking && !square.isCreatingDeadZone;
    };

    const isSquareInDeadZoneForThisPlayer = (r: number, c: number): boolean => {
      return currentAllDeadZones.some(dz => dz.row === r && dz.col === c && dz.player === player);
    };

    const directions = [ { dr: 1, dc: 1 }, { dr: 1, dc: -1 } ];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
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
    const { updatedBoard, newDeadZones } = updateBoardStateLogic(interimBoard);
    
    setBoard(updatedBoard);
    setDeadZones(newDeadZones);

    const winCheck = checkWinCondition(updatedBoard, playerMakingMove, newDeadZones);
    if (winCheck) {
      setWinner(playerMakingMove);
      setWinningLine(winCheck);
      setGamePhase('GAME_OVER');
      setSelectedPawn(null);
      toast({ title: "Game Over!", description: `Player ${playerMakingMove} wins!` });
      return true; 
    }
    return false; 
  }, [updateBoardStateLogic, checkWinCondition, toast]);

  const placePawn = useCallback((row: number, col: number) => {
    let newBoard = board.map(r => r.map(s => ({...s})));
    const opponent = currentPlayer === 1 ? 2 : 1;

    // Restricted Placement Check: "If a player places two pawns with a space between them horizontally (My Pawn - empty space - My Pawn), 
    // the opponent cannot place their pawn in that empty space"
    // This is about opponent creating a P-E-P pattern on *their* color, and current player trying to place on E.
    // The current deadZone logic already covers this if we interpret "dead zone" as "restricted for placement by opponent".
    // Let's ensure the target square for placement isn't a dead zone created by the opponent for the current player.
    const isPlacementRestricted = deadZones.some(dz => dz.row === row && dz.col === col && dz.player === currentPlayer);
    
    if (isPlacementRestricted) {
      toast({ title: "Invalid Placement", description: "You cannot place a pawn in a restricted zone.", variant: "destructive" });
      return;
    }

    newBoard[row][col].player = currentPlayer;
    
    if (currentPlayer === 1) setPlayer1PawnsPlaced(p => p + 1);
    else setPlayer2PawnsPlaced(p => p + 1);

    if (afterTurnProcessing(newBoard, currentPlayer)) return;

    if (player1PawnsPlaced + (currentPlayer === 1 ? 1 : 0) === pawnsPerPlayer && 
        player2PawnsPlaced + (currentPlayer === 2 ? 1 : 0) === pawnsPerPlayer) {
      setGamePhase('MOVEMENT');
      toast({ title: "Phase Change", description: "All pawns placed. Movement phase begins." });
    }
    setCurrentPlayer(opponent);
    setSelectedPawn(null);

  }, [board, currentPlayer, player1PawnsPlaced, player2PawnsPlaced, pawnsPerPlayer, afterTurnProcessing, toast, deadZones]);


  const movePawn = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    const opponent = currentPlayer === 1 ? 2 : 1;
    let newBoard = board.map(r => r.map(s => ({...s})));
    
    newBoard[toRow][toCol].player = currentPlayer;
    newBoard[fromRow][fromCol].player = null;
    
    if (afterTurnProcessing(newBoard, currentPlayer)) return; 
    
    setCurrentPlayer(opponent);
    setSelectedPawn(null);
  }, [board, currentPlayer, afterTurnProcessing]);

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (winner || gamePhase === 'GAME_OVER') return;

    const clickedSquareData = board[row][col];
    const clickedActualSquareColor = getBoardSquareColorType(row, col);
    const currentPlayerRequiredColor = getPlayerSquareColor(currentPlayer);

    if (gamePhase === 'PLACEMENT') {
      if (clickedActualSquareColor !== currentPlayerRequiredColor) {
        toast({ title: "Invalid Square", description: "You must place on squares of your assigned color.", variant: "destructive" });
        return;
      }
      if (clickedSquareData.player === null) {
        placePawn(row, col);
      } else {
        toast({ title: "Occupied Square", description: "This square is already occupied.", variant: "destructive" });
      }
    } else if (gamePhase === 'MOVEMENT') {
      if (selectedPawn) { // A pawn is already selected
        if (selectedPawn.row === row && selectedPawn.col === col) { // Clicked selected pawn again
          setSelectedPawn(null); // Deselect
        } else if (clickedSquareData.player === null && clickedActualSquareColor === currentPlayerRequiredColor) { // Clicked an empty valid square
          const isTargetDeadZone = deadZones.some(dz => dz.row === row && dz.col === col && dz.player === currentPlayer);
          if (isTargetDeadZone) {
            toast({ title: "Invalid Move", description: "Cannot move to a dead zone.", variant: "destructive" });
            setSelectedPawn(null);
            return;
          }
          movePawn(selectedPawn.row, selectedPawn.col, row, col);
        } else if (clickedSquareData.player === currentPlayer && !clickedSquareData.isBlocked) { // Clicked another of current player's pawns
           setSelectedPawn({ row, col }); // Select the new pawn
        } else { // Clicked an invalid square or opponent's pawn
          setSelectedPawn(null); 
          if (clickedSquareData.player !== null && clickedSquareData.player !== currentPlayer) {
             toast({ title: "Invalid Action", description: "Cannot select opponent's pawn.", variant: "destructive" });
          } else if (clickedActualSquareColor !== currentPlayerRequiredColor) {
             toast({ title: "Invalid Square", description: "Can only move to squares of your color.", variant: "destructive" });
          } else if (clickedSquareData.player !== null) {
             toast({ title: "Occupied Square", description: "Cannot move to an occupied square.", variant: "destructive" });
          }
        }
      } else { // No pawn selected yet
        if (clickedSquareData.player === currentPlayer) {
          if (clickedSquareData.isBlocked) {
            toast({ title: "Blocked Pawn", description: "This pawn is blocked and cannot move.", variant: "destructive" });
          } else {
            setSelectedPawn({ row, col });
          }
        } else if (clickedSquareData.player !== null) {
           toast({ title: "Not Your Pawn", description: "Select one of your own pawns.", variant: "destructive" });
        }
      }
    }
  }, [board, currentPlayer, getPlayerSquareColor, selectedPawn, placePawn, movePawn, toast, winner, gamePhase, deadZones]);

  const handlePawnDragStart = useCallback((row: number, col: number, player: Player) => {
    if (gamePhase === 'MOVEMENT' && player === currentPlayer && !board[row][col].isBlocked) {
      setSelectedPawn({ row, col });
      // Data for drag event is set in Square.tsx's onDragStart
    }
  }, [gamePhase, currentPlayer, board]);

  const handlePawnDrop = useCallback((targetRow: number, targetCol: number, draggedPawnInfo: { sourceRow: number, sourceCol: number, player: Player }) => {
    const { sourceRow, sourceCol, player: draggedPlayer } = draggedPawnInfo;

    if (winner || gamePhase !== 'MOVEMENT' || draggedPlayer !== currentPlayer) {
      setSelectedPawn(null);
      return;
    }

    const targetSquareData = board[targetRow][targetCol];
    const targetActualSquareColor = getBoardSquareColorType(targetRow, targetCol);
    const currentPlayerRequiredColor = getPlayerSquareColor(currentPlayer);
    const isTargetDeadZone = deadZones.some(dz => dz.row === targetRow && dz.col === targetCol && dz.player === currentPlayer);

    if (targetSquareData.player === null && 
        targetActualSquareColor === currentPlayerRequiredColor &&
        !isTargetDeadZone) {
      movePawn(sourceRow, sourceCol, targetRow, targetCol);
    } else {
      // Invalid drop
      if (targetSquareData.player !== null) toast({ title: "Invalid Drop", description: "Cannot drop on an occupied square.", variant: "destructive" });
      else if (targetActualSquareColor !== currentPlayerRequiredColor) toast({ title: "Invalid Drop", description: "Cannot drop on a square of the wrong color.", variant: "destructive" });
      else if (isTargetDeadZone) toast({ title: "Invalid Drop", description: "Cannot drop into a dead zone.", variant: "destructive" });
      setSelectedPawn(null); // Clear selection on invalid drop
    }
  }, [winner, gamePhase, currentPlayer, board, getPlayerSquareColor, deadZones, movePawn, toast]);


  const getValidMoveTargets = useCallback((pawnPlayer: Player, pawnPosition: PawnPosition | null): PawnPosition[] => {
    if (!pawnPosition || gamePhase !== 'MOVEMENT' || board[pawnPosition.row][pawnPosition.col].player !== pawnPlayer || board[pawnPosition.row][pawnPosition.col].isBlocked) {
      return [];
    }

    const targets: PawnPosition[] = [];
    const playerRequiredColor = getPlayerSquareColor(pawnPlayer);

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c].player === null && 
            getBoardSquareColorType(r, c) === playerRequiredColor &&
            !deadZones.some(dz => dz.row === r && dz.col === c && dz.player === pawnPlayer)) {
          targets.push({ row: r, col: c });
        }
      }
    }
    return targets;
  }, [board, gamePhase, getPlayerSquareColor, deadZones]);

  const changePawnsPerPlayerCount = useCallback((count: number) => {
    if (count >= 3 && count <= 10) {
      setPawnsPerPlayer(count); // useEffect will trigger resetGame
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
    deadZones,
    getPlayerSquareColor,
    handlePawnDragStart,
    handlePawnDrop,
    getValidMoveTargets,
  };
};