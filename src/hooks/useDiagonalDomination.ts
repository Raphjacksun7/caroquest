'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GameBoardArray, Player, PawnPosition, GamePhase, WinningLine, DeadZone, SquareColorType, BoardSquareData, GameHistoryEntry } from '@/types/game';
import { BOARD_SIZE, PAWNS_PER_PLAYER as DEFAULT_PAWNS_PER_PLAYER, WINNING_LINE_LENGTH } from '@/config/game';
import { getSquareColorType as getBoardSquareColorType } from '@/lib/gameUtils';
import { useToast } from "@/hooks/use-toast";

export const useDiagonalDomination = () => {
  const { toast } = useToast();
  const [board, setBoard] = useState<GameBoardArray>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [selectedPawn, setSelectedPawn] = useState<PawnPosition | null>(null);
  const [draggedPawn, setDraggedPawn] = useState<PawnPosition | null>(null); // For drag operations
  const [gamePhase, setGamePhase] = useState<GamePhase>('PLACEMENT');
  const [winner, setWinner] = useState<Player | null>(null);
  const [pawnsPlaced, setPawnsPlaced] = useState<{ [key in Player]: number }>({ 1: 0, 2: 0 });
  const [pawnsPerPlayer, setPawnsPerPlayer] = useState<number>(DEFAULT_PAWNS_PER_PLAYER);
  const [deadZones, setDeadZones] = useState<DeadZone[]>([]);
  const [winningLine, setWinningLine] = useState<WinningLine | null>(null);
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
  const [validMoves, setValidMoves] = useState<PawnPosition[]>([]);

  const getPlayerSquareColor = useCallback((player: Player): SquareColorType => {
    return player === 1 ? 'light' : 'dark';
  }, []);

  const initializeNewBoard = useCallback((): GameBoardArray => {
    return Array(BOARD_SIZE).fill(null).map((_, r) =>
      Array(BOARD_SIZE).fill(null).map<BoardSquareData>((_, c) => ({
        player: null,
        isBlocked: false,
        isBlocking: false,
        isCreatingDeadZone: false,
        isPartOfWinningLine: false,
      }))
    );
  }, []);
  
  const resetGame = useCallback(() => {
    const initialBoard = initializeNewBoard();
    setBoard(initialBoard);
    setCurrentPlayer(1);
    setSelectedPawn(null);
    setDraggedPawn(null);
    setGamePhase('PLACEMENT');
    setWinner(null);
    setPawnsPlaced({ 1: 0, 2: 0 });
    setDeadZones([]);
    setWinningLine(null);
    setGameHistory([]);
    setValidMoves([]);
    const { newDeadZones } = updateBoardStateLogic(initialBoard, []); // Pass empty deadzones initially
    setDeadZones(newDeadZones);

    if (typeof pawnsPerPlayer === 'number' && pawnsPerPlayer > 0) {
        toast({ title: "Game Reset", description: `New game started with ${pawnsPerPlayer} pawns per player.` });
    }
  }, [initializeNewBoard, pawnsPerPlayer, toast]); 

  useEffect(() => {
    resetGame();
  }, [pawnsPerPlayer, resetGame]);

  const addToHistory = (from: PawnPosition | null, to: PawnPosition, actionType: 'place' | 'move') => {
    const moveRecord: GameHistoryEntry = {
      player: currentPlayer,
      action: actionType,
      from: actionType === 'move' ? from : null,
      to,
      timestamp: new Date().toISOString()
    };
    setGameHistory(prev => [moveRecord, ...prev]); // Add to beginning for easier display
  };

  const updateBoardStateLogic = useCallback((currentBoard: GameBoardArray, currentDeadZonesState: DeadZone[]): { updatedBoard: GameBoardArray, newDeadZones: DeadZone[] } => {
    const newBoard = currentBoard.map(r => r.map(s => ({...s, isBlocked: false, isBlocking: false, isCreatingDeadZone: false, isPartOfWinningLine: s.isPartOfWinningLine })));
    const allNewDeadZones: DeadZone[] = [];

    for (let r_idx = 0; r_idx < BOARD_SIZE; r_idx++) {
      for (let c_idx = 0; c_idx < BOARD_SIZE; c_idx++) {
        const piece = newBoard[r_idx][c_idx].player;
        if (!piece) continue;
        const opponent = piece === 1 ? 2 : 1;

        // Horizontal Blocking (P-O-P)
        if (c_idx < BOARD_SIZE - 2 && newBoard[r_idx][c_idx+1].player === opponent && newBoard[r_idx][c_idx+2].player === piece) {
          newBoard[r_idx][c_idx].isBlocking = true;
          newBoard[r_idx][c_idx+1].isBlocked = true;
          newBoard[r_idx][c_idx+2].isBlocking = true;
        }
        // Vertical Blocking (P-O-P)
        if (r_idx < BOARD_SIZE - 2 && newBoard[r_idx+1][c_idx].player === opponent && newBoard[r_idx+2][c_idx].player === piece) {
          newBoard[r_idx][c_idx].isBlocking = true;
          newBoard[r_idx+1][c_idx].isBlocked = true;
          newBoard[r_idx+2][c_idx].isBlocking = true;
        }
      }
    }
    
    for (const p of [1, 2] as Player[]) {
      const playerColor = getPlayerSquareColor(p);
      // Horizontal Dead Zone Creation (P-E-P)
      for (let r_dz = 0; r_dz < BOARD_SIZE; r_dz++) {
        for (let c_dz = 0; c_dz < BOARD_SIZE - 2; c_dz++) {
          if (newBoard[r_dz][c_dz].player === p &&
              newBoard[r_dz][c_dz+1].player === null && getBoardSquareColorType(r_dz, c_dz+1) === playerColor &&
              newBoard[r_dz][c_dz+2].player === p) {
            allNewDeadZones.push({ row: r_dz, col: c_dz + 1, player: (p === 1 ? 2 : 1) }); // DZ for opponent
            newBoard[r_dz][c_dz].isCreatingDeadZone = true;
            newBoard[r_dz][c_dz+2].isCreatingDeadZone = true;
          }
        }
      }
      // Vertical Dead Zone Creation (P-E-P)
      for (let c_dz_v = 0; c_dz_v < BOARD_SIZE; c_dz_v++) {
        for (let r_dz_v = 0; r_dz_v < BOARD_SIZE - 2; r_dz_v++) {
          if (newBoard[r_dz_v][c_dz_v].player === p &&
              newBoard[r_dz_v+1][c_dz_v].player === null && getBoardSquareColorType(r_dz_v+1, c_dz_v) === playerColor &&
              newBoard[r_dz_v+2][c_dz_v].player === p) {
            allNewDeadZones.push({ row: r_dz_v + 1, col: c_dz_v, player: (p === 1 ? 2 : 1) }); // DZ for opponent
            newBoard[r_dz_v][c_dz_v].isCreatingDeadZone = true;
            newBoard[r_dz_v+2][c_dz_v].isCreatingDeadZone = true;
          }
        }
      }
    }
    return { updatedBoard: newBoard, newDeadZones: allNewDeadZones };
  }, [getPlayerSquareColor]);

  const internalCheckWinCondition = useCallback((currentBoard: GameBoardArray, player: Player, currentAllDeadZones: DeadZone[]): PawnPosition[] | null => {
    const isValidForWin = (r: number, c: number): boolean => {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
      const square = currentBoard[r][c];
      return square.player === player && !square.isBlocked && !square.isBlocking && !square.isCreatingDeadZone;
    };

    const isSquareInPlayerDeadZone = (r: number, c: number): boolean => {
      // A square is a dead zone for 'player' if an opponent created it for 'player'
      return currentAllDeadZones.some(dz => dz.row === r && dz.col === c && dz.player === player);
    };

    const directions = [ { dr: 1, dc: 1 }, { dr: 1, dc: -1 } ];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!isValidForWin(r, c) || isSquareInPlayerDeadZone(r,c)) continue;

        for (const { dr, dc } of directions) {
          const line: PawnPosition[] = [{ row: r, col: c }];
          let possibleWin = true;
          for (let i = 1; i < WINNING_LINE_LENGTH; i++) {
            const nr = r + i * dr;
            const nc = c + i * dc;
            if (!isValidForWin(nr, nc) || isSquareInPlayerDeadZone(nr,nc)) {
              possibleWin = false;
              break;
            }
            line.push({ row: nr, col: nc });
          }
          if (possibleWin) return line;
        }
      }
    }
    return null;
  }, []);
  
  const highlightWinningPawnsOnBoard = useCallback((boardToUpdate: GameBoardArray, line: PawnPosition[]): GameBoardArray => {
    const newBoard = boardToUpdate.map(r => r.map(s => ({...s, isPartOfWinningLine: false}))); // Clear previous highlights
    line.forEach(({row, col}) => {
      if (newBoard[row] && newBoard[row][col]) {
        newBoard[row][col].isPartOfWinningLine = true;
      }
    });
    return newBoard;
  }, []);

  const afterTurnProcessing = useCallback((interimBoard: GameBoardArray, playerMakingMove: Player) => {
    const { updatedBoard: boardAfterBlockDeadZoneCalc, newDeadZones } = updateBoardStateLogic(interimBoard, deadZones);
    setDeadZones(newDeadZones);

    const winPath = internalCheckWinCondition(boardAfterBlockDeadZoneCalc, playerMakingMove, newDeadZones);
    if (winPath) {
      const finalBoardWithWin = highlightWinningPawnsOnBoard(boardAfterBlockDeadZoneCalc, winPath);
      setBoard(finalBoardWithWin);
      setWinner(playerMakingMove);
      setWinningLine({ player: playerMakingMove, positions: winPath });
      setGamePhase('GAME_OVER');
      setSelectedPawn(null);
      setDraggedPawn(null);
      setValidMoves([]);
      toast({ title: "Game Over!", description: `Player ${playerMakingMove} wins!`, duration: 5000 });
      return true; 
    }
    setBoard(boardAfterBlockDeadZoneCalc);
    return false; 
  }, [updateBoardStateLogic, internalCheckWinCondition, toast, highlightWinningPawnsOnBoard, deadZones]);

  const calculateValidMovesForPawn = useCallback((pawnPos: PawnPosition | null, currentBoard: GameBoardArray, forPlayer: Player, currentDeadZones: DeadZone[]): PawnPosition[] => {
    if (!pawnPos || currentBoard[pawnPos.row][pawnPos.col].player !== forPlayer || currentBoard[pawnPos.row][pawnPos.col].isBlocked) {
      return [];
    }
    const moves: PawnPosition[] = [];
    const playerRequiredColor = getPlayerSquareColor(forPlayer);
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (currentBoard[r][c].player === null && 
            getBoardSquareColorType(r, c) === playerRequiredColor &&
            !currentDeadZones.some(dz => dz.row === r && dz.col === c && dz.player === forPlayer)) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  }, [getPlayerSquareColor]);

  const selectPawnForMovement = useCallback((row: number, col: number) => {
    if (gamePhase !== 'MOVEMENT' || board[row][col].player !== currentPlayer || board[row][col].isBlocked || winner) {
      setSelectedPawn(null);
      setValidMoves([]);
      return;
    }
    const newSelectedPawn = { row, col };
    setSelectedPawn(newSelectedPawn);
    setValidMoves(calculateValidMovesForPawn(newSelectedPawn, board, currentPlayer, deadZones));
  }, [gamePhase, board, currentPlayer, calculateValidMovesForPawn, deadZones, winner]);

  const placePawnAction = useCallback((row: number, col: number) => {
    let newBoard = board.map(r => r.map(s => ({...s, isPartOfWinningLine: false })));
    const opponent = currentPlayer === 1 ? 2 : 1;

    let isRestrictedZone = false;
    if (col > 0 && col < BOARD_SIZE -1 && newBoard[row][col-1].player === opponent && newBoard[row][col+1].player === opponent && newBoard[row][col-1].isLightSquare !== newBoard[row][col+1].isLightSquare ) isRestrictedZone = true;
    if (row > 0 && row < BOARD_SIZE -1 && newBoard[row-1][col].player === opponent && newBoard[row+1][col].player === opponent && newBoard[row-1][col].isLightSquare !== newBoard[row+1][col].isLightSquare ) isRestrictedZone = true;
    
    if (isRestrictedZone) {
      toast({ title: "Invalid Placement", description: "Cannot place in a restricted zone (Opponent-You-Opponent).", variant: "destructive" });
      return;
    }
    
    newBoard[row][col].player = currentPlayer;
    addToHistory(null, {row, col}, 'place');
    
    const newPawnsPlaced = {...pawnsPlaced};
    newPawnsPlaced[currentPlayer]++;
    setPawnsPlaced(newPawnsPlaced);

    if (afterTurnProcessing(newBoard, currentPlayer)) return;

    if (newPawnsPlaced[1] === pawnsPerPlayer && newPawnsPlaced[2] === pawnsPerPlayer) {
      setGamePhase('MOVEMENT');
      toast({ title: "Phase Change", description: "All pawns placed. Movement phase begins." });
    }
    setCurrentPlayer(opponent);
    setSelectedPawn(null);
    setDraggedPawn(null);
    setValidMoves([]);
  }, [board, currentPlayer, pawnsPlaced, pawnsPerPlayer, afterTurnProcessing, toast]);

  const movePawnAction = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    const opponent = currentPlayer === 1 ? 2 : 1;
    let newBoard = board.map(r => r.map(s => ({...s, isPartOfWinningLine: false })));
    
    newBoard[toRow][toCol].player = currentPlayer;
    newBoard[fromRow][fromCol].player = null;
    
    addToHistory({row: fromRow, col: fromCol}, {row: toRow, col: toCol}, 'move');
    
    if (afterTurnProcessing(newBoard, currentPlayer)) return; 
    
    setCurrentPlayer(opponent);
    setSelectedPawn(null);
    setDraggedPawn(null);
    setValidMoves([]);
  }, [board, currentPlayer, afterTurnProcessing]);

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (winner || gamePhase === 'GAME_OVER') return;

    const clickedSquareData = board[row][col];
    const clickedActualSquareColor = getBoardSquareColorType(row, col);
    const currentPlayerRequiredColor = getPlayerSquareColor(currentPlayer);

    if (gamePhase === 'PLACEMENT') {
      if (clickedActualSquareColor !== currentPlayerRequiredColor) {
        toast({ title: "Invalid Square", description: "Must place on your color.", variant: "destructive" });
        return;
      }
      if (clickedSquareData.player === null) {
        placePawnAction(row, col);
      } else {
        toast({ title: "Occupied Square", description: "This square is already occupied.", variant: "destructive" });
      }
    } else if (gamePhase === 'MOVEMENT') {
      if (selectedPawn) { // A pawn is already selected (either by click or drag start)
        if (validMoves.some(m => m.row === row && m.col === col)) { // Clicked on a valid move target
           movePawnAction(selectedPawn.row, selectedPawn.col, row, col);
        } else if (clickedSquareData.player === currentPlayer && !clickedSquareData.isBlocked) { // Clicked on another of current player's pawns
           selectPawnForMovement(row, col); // Switch selection
        } else { // Clicked on an invalid square or opponent's pawn
           setSelectedPawn(null); // Deselect
           setValidMoves([]);
        }
      } else { // No pawn selected yet
        if (clickedSquareData.player === currentPlayer) { // Clicked on one of current player's pawns
          if (clickedSquareData.isBlocked) {
            toast({ title: "Blocked Pawn", description: "This pawn is blocked and cannot move.", variant: "destructive" });
          } else {
            selectPawnForMovement(row, col); // Select this pawn
          }
        }
      }
    }
  }, [winner, gamePhase, board, currentPlayer, getPlayerSquareColor, selectedPawn, validMoves, placePawnAction, movePawnAction, selectPawnForMovement, toast]);
  
  const handlePawnDragStart = useCallback((pawnRow: number, pawnCol: number) => {
    if (gamePhase === 'MOVEMENT' && board[pawnRow][pawnCol].player === currentPlayer && !board[pawnRow][pawnCol].isBlocked && !winner) {
      const pawnToDrag = { row: pawnRow, col: pawnCol };
      setDraggedPawn(pawnToDrag);
      setSelectedPawn(pawnToDrag); // Also set as selectedPawn to utilize existing valid move logic
      setValidMoves(calculateValidMovesForPawn(pawnToDrag, board, currentPlayer, deadZones));
    }
  }, [gamePhase, board, currentPlayer, winner, calculateValidMovesForPawn, deadZones]);

  const handlePawnDrop = useCallback((targetRow: number, targetCol: number) => {
    if (!draggedPawn || winner) {
      setDraggedPawn(null);
      // setSelectedPawn(null); // Keep selectedPawn if drop was invalid, for click-move
      // setValidMoves([]);
      return;
    }

    if (validMoves.some(m => m.row === targetRow && m.col === targetCol)) {
      movePawnAction(draggedPawn.row, draggedPawn.col, targetRow, targetCol);
    } else {
      // Invalid drop, maybe provide feedback
      toast({ title: "Invalid Move", description: "Cannot move pawn there.", variant: "destructive", duration: 2000});
    }
    // Reset drag state regardless of valid drop, selectedPawn state will be handled by movePawnAction or subsequent clicks
    setDraggedPawn(null);
    // If drop was invalid, selectedPawn and validMoves should persist from dragStart to allow click-move
    // If drop was valid, movePawnAction clears selectedPawn and validMoves.
  }, [draggedPawn, winner, validMoves, movePawnAction, toast]);
  
  const changePawnsPerPlayerCount = useCallback((count: number) => {
    const newCount = Math.max(3, Math.min(10, count)); // Clamp between 3 and 10
    if (newCount !== pawnsPerPlayer) {
        setPawnsPerPlayer(newCount); // useEffect will trigger resetGame
    } else if (count < 3 || count > 10) {
      toast({ title: "Invalid Input", description: "Pawns per player must be between 3 and 10.", variant: "destructive" });
    }
  }, [pawnsPerPlayer, toast]);

  return {
    board,
    currentPlayer,
    gamePhase,
    pawnsPlaced,
    selectedPawn, // For click interactions and highlighting selected
    draggedPawn,  // For drag operation state
    winner,
    winningLine,
    handleSquareClick,
    resetGame,
    pawnsPerPlayer,
    changePawnsPerPlayerCount,
    deadZones,
    getPlayerSquareColor,
    gameHistory,
    validMoves,
    handlePawnDragStart,
    handlePawnDrop,
  };
};
