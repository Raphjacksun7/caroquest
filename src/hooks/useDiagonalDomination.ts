
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

  // Player 1 (Red) uses light squares, Player 2 (Blue) uses dark squares.
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
    const isValidAndPlayerPiece = (r: number, c: number) => {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
      const square = currentBoard[r][c];
      return square.player === player && !square.isBlocked && !square.isBlocking;
    };

    const isInDeadZoneForPlayer = (r: number, c: number) => {
      return currentDeadZones.some(dz => dz.row === r && dz.col === c && dz.player === player);
    };

    const directions = [
      { dr: 1, dc: 1 }, // Diagonal down-right
      { dr: 1, dc: -1 }, // Diagonal down-left
      // Check up-right and up-left by starting from different cells, covered by iterating all cells
    ];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!isValidAndPlayerPiece(r, c) || isInDeadZoneForPlayer(r,c)) continue;

        for (const { dr, dc } of directions) {
          const line: PawnPosition[] = [{ row: r, col: c }];
          let count = 1;
          for (let i = 1; i < WINNING_LINE_LENGTH; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (isValidAndPlayerPiece(nr, nc) && !isInDeadZoneForPlayer(nr,nc)) {
              line.push({ row: nr, col: nc });
              count++;
            } else {
              break;
            }
          }
          if (count === WINNING_LINE_LENGTH) {
            setWinner(player);
            setWinningLine({ player, positions: line });
            setGamePhase('GAME_OVER');
            toast({ title: `Player ${player} Wins!`, description: "Congratulations!" });
            return true;
          }
        }
      }
    }
    return false;
  }, [toast]);

  const updateBoardState = useCallback((currentBoard: GameBoardArray, playerWhoMoved: Player) => {
    let newBoard = currentBoard.map(row => row.map(cell => ({ ...cell, isBlocked: false, isBlocking: false })));

    // Check for horizontal blocks
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE - 2; c++) {
        const p1 = newBoard[r][c].player;
        const p2 = newBoard[r][c+1].player;
        const p3 = newBoard[r][c+2].player;

        if (p1 && p2 && p3 && p1 === p3 && p1 !== p2) {
          // p1 (current player) blocks p2 (opponent)
          newBoard[r][c].isBlocking = true;
          newBoard[r][c+1].isBlocked = true;
          newBoard[r][c+2].isBlocking = true;
        }
      }
    }

    // Update dead zones
    const newDeadZones: DeadZone[] = [];
    // Player 1 creates dead zone for Player 2
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE - 2; c++) {
        if (newBoard[r][c].player === 1 &&
            newBoard[r][c+1].player === null &&
            getSquareColorType(r, c+1) === getPlayerSquareColor(1) && // Player 1's color square
            newBoard[r][c+2].player === 1) {
          newDeadZones.push({ row: r, col: c+1, player: 2 }); // Dead zone for Player 2
        }
      }
    }
    // Player 2 creates dead zone for Player 1
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE - 2; c++) {
        if (newBoard[r][c].player === 2 &&
            newBoard[r][c+1].player === null &&
            getSquareColorType(r, c+1) === getPlayerSquareColor(2) && // Player 2's color square
            newBoard[r][c+2].player === 2) {
          newDeadZones.push({ row: r, col: c+1, player: 1 }); // Dead zone for Player 1
        }
      }
    }
    setDeadZones(newDeadZones);
    setBoard(newBoard); // Set board with updated blocking statuses

    // Check for win after all updates
    if (checkWinCondition(newBoard, playerWhoMoved, newDeadZones)) {
        return; // Winner found, game over
    }

    // Switch player if no winner
    setCurrentPlayer(playerWhoMoved === 1 ? 2 : 1);

  }, [checkWinCondition, getPlayerSquareColor]);


  const placePawn = useCallback((row: number, col: number) => {
    const newBoard = board.map(r => r.map(s => ({ ...s })));
    newBoard[row][col].player = currentPlayer;

    const newPawnsPlacedCount = pawnsPlaced[currentPlayer] + 1;
    setPawnsPlaced(prev => ({ ...prev, [currentPlayer]: newPawnsPlacedCount }));

    if (newPawnsPlacedCount === pawnsPerPlayer && pawnsPlaced[currentPlayer === 1 ? 2 : 1] === pawnsPerPlayer) {
      setGamePhase('MOVEMENT');
    }
    
    updateBoardState(newBoard, currentPlayer);

  }, [board, currentPlayer, pawnsPlaced, pawnsPerPlayer, updateBoardState]);

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
      if (selectedPawn === null) { // Selecting a pawn
        if (square.player === currentPlayer) {
          setSelectedPawn({ row, col });
        } else if (square.player !== null) {
          toast({ title: "Invalid Selection", description: "Not your pawn.", variant: "destructive" });
        } else {
           toast({ title: "Empty Square", description: "Select one of your pawns to move.", variant: "destructive" });
        }
      } else { // Moving a selected pawn
        if (row === selectedPawn.row && col === selectedPawn.col) {
            setSelectedPawn(null); // Deselect if clicking the same pawn
            return;
        }
        if (square.player === null) {
          movePawn(selectedPawn.row, selectedPawn.col, row, col);
        } else {
          toast({ title: "Invalid Move", description: "You can't move to an occupied square.", variant: "destructive" });
          setSelectedPawn(null); // Deselect on invalid move attempt
        }
      }
    }
  }, [winner, gamePhase, board, currentPlayer, getPlayerSquareColor, pawnsPlaced, pawnsPerPlayer, placePawn, movePawn, selectedPawn, toast]);

  const changePawnsPerPlayerCount = useCallback((count: number) => {
    const newCount = Math.max(3, Math.min(10, count)); // Clamp between 3 and 10
    setPawnsPerPlayer(newCount);
    // useEffect will trigger initializeBoard
  }, []);

  return {
    board,
    currentPlayer,
    gamePhase,
    pawnsPlaced,
    selectedPawn,
    winner,
    winningLine,
    playerAssignedColors, // Remains { player1: 'light', player2: 'dark' }
    handleSquareClick,
    resetGame: initializeBoard, // Renamed for clarity
    pawnsPerPlayer,
    changePawnsPerPlayerCount,
    deadZones,
    getPlayerSquareColor, // Export for components if needed
  };
};
