
"use client";

import { useState, useCallback, useEffect } from 'react';
import type { Player, GamePhase, GameBoardArray, PawnPosition, PlayerAssignedColors, SquareColorType, WinningLine, DeadZone, BoardSquareData } from '@/types/game';
import { BOARD_SIZE, WINNING_LINE_LENGTH, PAWNS_PER_PLAYER as DEFAULT_PAWNS_PER_PLAYER } from '@/config/game';
import { getSquareColorType } from '@/lib/gameUtils';
import { useToast } from "@/hooks/use-toast";


const createInitialBoard = (): GameBoardArray =>
  Array(BOARD_SIZE)
    .fill(null)
    .map(() =>
      Array(BOARD_SIZE)
        .fill(null)
        .map((): BoardSquareData => ({
          player: null,
          isBlocked: false,
          isBlocking: false,
          isCreatingDeadZone: false, // Initialize new property
        }))
    );

export const useDiagonalDomination = () => {
  const [board, setBoard] = useState<GameBoardArray>(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [selectedPawn, setSelectedPawn] = useState<PawnPosition | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('PLACEMENT');
  const [winner, setWinner] = useState<Player | null>(null);
  const [pawnsPlaced, setPawnsPlaced] = useState<{ [key in Player]: number }>({ 1: 0, 2: 0 });
  const [pawnsPerPlayer, setPawnsPerPlayer] = useState<number>(DEFAULT_PAWNS_PER_PLAYER);
  const [deadZones, setDeadZones] = useState<DeadZone[]>([]);
  const [winningLine, setWinningLine] = useState<WinningLine | null>(null);
  const { toast } = useToast();

  const playerAssignedColors: PlayerAssignedColors = { player1: 'light', player2: 'dark' };

  const getPlayerSquareColor = useCallback((player: Player): SquareColorType => {
    return player === 1 ? playerAssignedColors.player1 : playerAssignedColors.player2;
  }, [playerAssignedColors]);

  const initializeBoard = useCallback(() => {
    setBoard(createInitialBoard());
    setCurrentPlayer(1);
    setSelectedPawn(null);
    setGamePhase('PLACEMENT');
    setWinner(null);
    setPawnsPlaced({ 1: 0, 2: 0 });
    setDeadZones([]);
    setWinningLine(null);
  }, []);

  useEffect(() => {
    initializeBoard();
  }, [pawnsPerPlayer, initializeBoard]);


  const checkWinCondition = useCallback((currentBoard: GameBoardArray, player: Player, currentDeadZones: DeadZone[]): boolean => {
    const isValidAndEligibleForWin = (r: number, c: number) => {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
      const square = currentBoard[r][c];
      return square.player === player && !square.isBlocked && !square.isBlocking && !square.isCreatingDeadZone;
    };

    const isSquareDeadZoneForPlayer = (r: number, c: number) => {
      return currentDeadZones.some(dz => dz.row === r && dz.col === c && dz.player === player);
    };

    const directions = [
      { dr: 1, dc: 1 }, // Diagonal down-right
      { dr: 1, dc: -1 }, // Diagonal down-left
    ];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!isValidAndEligibleForWin(r, c)) continue; // Initial piece must be valid for win

        for (const { dr, dc } of directions) {
          const line: PawnPosition[] = [{ row: r, col: c }];
          let count = 1;
          let linePassesThroughDeadZone = isSquareDeadZoneForPlayer(r,c); // Check first piece

          if (linePassesThroughDeadZone) continue; // First piece cannot be on a dead zone

          for (let i = 1; i < WINNING_LINE_LENGTH; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (isValidAndEligibleForWin(nr, nc)) {
              if (isSquareDeadZoneForPlayer(nr,nc)) {
                linePassesThroughDeadZone = true;
                break; 
              }
              line.push({ row: nr, col: nc });
              count++;
            } else {
              break;
            }
          }
          if (count === WINNING_LINE_LENGTH && !linePassesThroughDeadZone) {
            setWinner(player);
            setWinningLine({ player, positions: line });
            setGamePhase('GAME_OVER');
            toast({ title: `Player ${player} (${player === 1 ? "Red" : "Blue"}) Wins!`, description: "Congratulations!" });
            return true;
          }
        }
      }
    }
    return false;
  }, [toast]);

  const updateBoardState = useCallback((currentBoard: GameBoardArray, playerWhoMoved: Player) => {
    let newBoard = currentBoard.map(row => row.map(cell => ({ 
        ...cell, 
        isBlocked: false, 
        isBlocking: false,
        isCreatingDeadZone: false, // Reset this as well
    })));

    // Check for horizontal blocks (O-X-O)
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE - 2; c++) {
        const p1 = newBoard[r][c].player;
        const p2 = newBoard[r][c+1].player;
        const p3 = newBoard[r][c+2].player;

        if (p1 && p2 && p3 && p1 === p3 && p1 !== p2) {
          newBoard[r][c].isBlocking = true;
          newBoard[r][c+1].isBlocked = true;
          newBoard[r][c+2].isBlocking = true;
        }
      }
    }
    // Check for vertical blocks (O-X-O)
     for (let c = 0; c < BOARD_SIZE; c++) {
      for (let r = 0; r < BOARD_SIZE - 2; r++) {
        const p1 = newBoard[r][c].player;
        const p2 = newBoard[r+1][c].player;
        const p3 = newBoard[r+2][c].player;

        if (p1 && p2 && p3 && p1 === p3 && p1 !== p2) {
          newBoard[r][c].isBlocking = true;
          newBoard[r+1][c].isBlocked = true;
          newBoard[r+2][c].isBlocking = true;
        }
      }
    }

    // Update dead zones and mark pawns creating them
    const newDeadZones: DeadZone[] = [];
    
    // Horizontal dead zones
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE - 2; c++) {
        const s1 = newBoard[r][c];
        const s2_empty = newBoard[r][c+1];
        const s3 = newBoard[r][c+2];
        const s1Color = getPlayerSquareColor(s1.player as Player); // Safe if s1.player is not null
        const s2Color = getSquareColorType(r, c+1);

        if (s1.player && s2_empty.player === null && s3.player && s1.player === s3.player && s1Color === s2Color) {
          newDeadZones.push({ row: r, col: c+1, player: s1.player === 1 ? 2 : 1 }); // Dead zone for opponent
          s1.isCreatingDeadZone = true;
          s3.isCreatingDeadZone = true;
        }
      }
    }
    // Vertical dead zones
    for (let c = 0; c < BOARD_SIZE; c++) {
      for (let r = 0; r < BOARD_SIZE - 2; r++) {
        const s1 = newBoard[r][c];
        const s2_empty = newBoard[r+1][c];
        const s3 = newBoard[r+2][c];
        const s1Color = getPlayerSquareColor(s1.player as Player);
        const s2Color = getSquareColorType(r+1, c);

        if (s1.player && s2_empty.player === null && s3.player && s1.player === s3.player && s1Color === s2Color) {
          newDeadZones.push({ row: r+1, col: c, player: s1.player === 1 ? 2 : 1 }); // Dead zone for opponent
          s1.isCreatingDeadZone = true;
          s3.isCreatingDeadZone = true;
        }
      }
    }

    setDeadZones(newDeadZones);
    setBoard(newBoard); 

    if (checkWinCondition(newBoard, playerWhoMoved, newDeadZones)) {
        return; 
    }

    setCurrentPlayer(playerWhoMoved === 1 ? 2 : 1);

  }, [checkWinCondition, getPlayerSquareColor]);


  const placePawn = useCallback((row: number, col: number) => {
    const opponent = currentPlayer === 1 ? 2 : 1;
    // Check for restricted zone placement by opponent
    // Horizontal check: OpponentPawn - (row,col) - OpponentPawn
    if (col > 0 && col < BOARD_SIZE - 1 &&
        board[row][col-1].player === opponent &&
        board[row][col+1].player === opponent &&
        getSquareColorType(row,col) === getPlayerSquareColor(currentPlayer) ) { // Must be on player's color
      toast({ title: "Restricted Zone", description: "Cannot place pawn in opponent's horizontal restricted zone.", variant: "destructive" });
      return;
    }
    // Vertical check: OpponentPawn - (row,col) - OpponentPawn
    if (row > 0 && row < BOARD_SIZE - 1 &&
        board[row-1][col].player === opponent &&
        board[row+1][col].player === opponent &&
        getSquareColorType(row,col) === getPlayerSquareColor(currentPlayer) ) {
      toast({ title: "Restricted Zone", description: "Cannot place pawn in opponent's vertical restricted zone.", variant: "destructive" });
      return;
    }


    const newBoard = board.map(r => r.map(s => ({ ...s })));
    newBoard[row][col].player = currentPlayer;

    const newPawnsPlacedCount = pawnsPlaced[currentPlayer] + 1;
    setPawnsPlaced(prev => ({ ...prev, [currentPlayer]: newPawnsPlacedCount }));

    if (newPawnsPlacedCount === pawnsPerPlayer && pawnsPlaced[currentPlayer === 1 ? 2 : 1] === pawnsPerPlayer) {
      setGamePhase('MOVEMENT');
    }
    
    updateBoardState(newBoard, currentPlayer);

  }, [board, currentPlayer, pawnsPlaced, pawnsPerPlayer, updateBoardState, toast, getPlayerSquareColor]);

  const movePawn = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    const newBoard = board.map(r => r.map(s => ({ ...s })));
    newBoard[toRow][toCol].player = currentPlayer;
    newBoard[fromRow][fromCol].player = null;
    
    setSelectedPawn(null);
    updateBoardState(newBoard, currentPlayer);

  }, [board, currentPlayer, updateBoardState]);


  const handleSquareClick = useCallback((row: number, col: number) => {
    if (winner || gamePhase === 'GAME_OVER') return;

    const square = board[row][col];
    const clickedSquareColor = getSquareColorType(row, col);
    const currentPlayerRequiredSquareColor = getPlayerSquareColor(currentPlayer);

    if (clickedSquareColor !== currentPlayerRequiredSquareColor) {
      toast({ title: "Invalid Square", description: "You can only use squares of your assigned color.", variant: "destructive" });
      return;
    }

    if (gamePhase === 'PLACEMENT') {
      if (square.player === null) {
        if (pawnsPlaced[currentPlayer] < pawnsPerPlayer) {
          placePawn(row, col);
        } else {
          toast({ title: "Placement Limit", description: "You have placed all your pawns.", variant: "destructive" });
        }
      } else {
        toast({ title: "Occupied Square", description: "This square is already occupied.", variant: "destructive" });
      }
    } else if (gamePhase === 'MOVEMENT') {
      if (selectedPawn === null) { 
        if (square.player === currentPlayer && !square.isBlocked) { // Cannot select a blocked pawn to move
          setSelectedPawn({ row, col });
        } else if (square.player === currentPlayer && square.isBlocked) {
           toast({ title: "Blocked Pawn", description: "This pawn is blocked and cannot move.", variant: "destructive" });
        } else if (square.player !== null) {
          toast({ title: "Invalid Selection", description: "Not your pawn.", variant: "destructive" });
        } else {
           toast({ title: "Empty Square", description: "Select one of your pawns to move.", variant: "destructive" });
        }
      } else { 
        if (row === selectedPawn.row && col === selectedPawn.col) {
            setSelectedPawn(null); 
            return;
        }
        if (square.player === null) {
          movePawn(selectedPawn.row, selectedPawn.col, row, col);
        } else {
          toast({ title: "Invalid Move", description: "You can't move to an occupied square.", variant: "destructive" });
          // Keep pawn selected if move is invalid to an occupied square for retrying
          // setSelectedPawn(null); 
        }
      }
    }
  }, [winner, gamePhase, board, currentPlayer, getPlayerSquareColor, pawnsPlaced, pawnsPerPlayer, placePawn, movePawn, selectedPawn, toast]);

  const changePawnsPerPlayerCount = useCallback((count: number) => {
    const newCount = Math.max(3, Math.min(10, count)); 
    setPawnsPerPlayer(newCount);
  }, []);

  return {
    board,
    currentPlayer,
    gamePhase,
    pawnsPlaced,
    selectedPawn,
    winner,
    winningLine,
    playerAssignedColors,
    handleSquareClick,
    resetGame: initializeBoard,
    pawnsPerPlayer,
    changePawnsPerPlayerCount,
    deadZones,
    getPlayerSquareColor,
  };
};
