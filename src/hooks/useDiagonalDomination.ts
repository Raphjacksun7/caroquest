
"use client";

import { useState, useCallback, useEffect } from 'react';
import type { Player, GamePhase, GameBoardArray, PawnPosition, PlayerAssignedColors, SquareColorType, WinningLine, BoardSquareData } from '@/types/game';
import { BOARD_SIZE, PAWNS_PER_PLAYER, WINNING_LINE_LENGTH } from '@/config/game';
import { getSquareColorType } from '@/lib/gameUtils';

const initialBoard = (): GameBoardArray =>
  Array(BOARD_SIZE)
    .fill(null)
    .map(() =>
      Array(BOARD_SIZE)
        .fill(null)
        .map(() => ({
          player: null,
          isBlocked: false,
          isBlocking: false,
          isDeadZoneForOpponent: false,
        }))
    );

export const useDiagonalDomination = () => {
  const [board, setBoard] = useState<GameBoardArray>(initialBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [gamePhase, setGamePhase] = useState<GamePhase>('PLAYER_SETUP');
  const [playerPawnsPlaced, setPlayerPawnsPlaced] = useState<{ [key in Player]: number }>({ 1: 0, 2: 0 });
  const [selectedPawn, setSelectedPawn] = useState<PawnPosition | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [winningLine, setWinningLine] = useState<WinningLine | null>(null);
  const [playerAssignedColors, setPlayerAssignedColors] = useState<PlayerAssignedColors>({ player1: 'light', player2: 'dark' }); // Default assignment

  const resetGame = useCallback(() => {
    setBoard(initialBoard());
    setCurrentPlayer(1);
    setGamePhase('PLAYER_SETUP');
    setPlayerPawnsPlaced({ 1: 0, 2: 0 });
    setSelectedPawn(null);
    setWinner(null);
    setWinningLine(null);
    // Player assigned colors could be re-randomized or allow selection here
  }, []);

  const getPlayerColorAssignment = useCallback((player: Player): SquareColorType => {
    return player === 1 ? playerAssignedColors.player1 : playerAssignedColors.player2;
  }, [playerAssignedColors]);


  const updateGameStatus = useCallback((newBoard: GameBoardArray, lastMovedPlayer: Player) => {
    // Placeholder for complex logic: identify blocked pawns, blocking pawns, and dead zones
    // This function will modify newBoard directly or return a new state for these properties
    
    // Check for win condition
    const directions = [
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, // Diagonal up-left, up-right
      { dr: 1, dc: -1 }, { dr: 1, dc: 1 },   // Diagonal down-left, down-right
    ];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const square = newBoard[r][c];
        if (square.player === lastMovedPlayer) {
          // Check pawn validity for winning line
          if (square.isBlocked || square.isBlocking) continue;
          // Add dead zone check later: if this square is a dead zone for lastMovedPlayer (created by opponent)

          for (const { dr, dc } of directions) {
            const line: PawnPosition[] = [{ row: r, col: c }];
            let count = 1;
            for (let i = 1; i < WINNING_LINE_LENGTH; i++) {
              const nr = r + dr * i;
              const nc = c + dc * i;
              if (
                nr >= 0 && nr < BOARD_SIZE &&
                nc >= 0 && nc < BOARD_SIZE &&
                newBoard[nr][nc].player === lastMovedPlayer &&
                !newBoard[nr][nc].isBlocked && // Check validity for each pawn in line
                !newBoard[nr][nc].isBlocking   // Add dead zone check later
              ) {
                line.push({ row: nr, col: nc });
                count++;
              } else {
                break;
              }
            }
            if (count === WINNING_LINE_LENGTH) {
              setWinner(lastMovedPlayer);
              setWinningLine({ player: lastMovedPlayer, positions: line });
              setGamePhase('GAME_OVER');
              return; // Found a winner
            }
          }
        }
      }
    }

    // Update board state with new blocked/blocking/deadzone info
    // For now, just set the board as is
    setBoard(newBoard);

  }, [ /* dependencies for deadzone/block checks */ ]);


  const handleSquareClick = useCallback((row: number, col: number) => {
    if (winner || gamePhase === 'GAME_OVER') return;

    const targetSquareColorType = getSquareColorType(row, col);
    const currentPlayerAssignedColor = getPlayerColorAssignment(currentPlayer);

    if (gamePhase === 'PLACEMENT') {
      if (board[row][col].player === null && targetSquareColorType === currentPlayerAssignedColor) {
        const newBoard = board.map((r, rowIndex) =>
          r.map((s, colIndex) =>
            rowIndex === row && colIndex === col ? { ...s, player: currentPlayer } : s
          )
        );
        // updateGameStatus(newBoard, currentPlayer); // Simplified, full update needed
        setBoard(newBoard); // Temporary direct set

        const newPawnsPlaced = {
          ...playerPawnsPlaced,
          [currentPlayer]: playerPawnsPlaced[currentPlayer] + 1,
        };
        setPlayerPawnsPlaced(newPawnsPlaced);

        const allPawnsPlacedP1 = newPawnsPlaced[1] === PAWNS_PER_PLAYER;
        const allPawnsPlacedP2 = newPawnsPlaced[2] === PAWNS_PER_PLAYER;

        if (allPawnsPlacedP1 && allPawnsPlacedP2) {
          setGamePhase('MOVEMENT');
        }
        // Check win immediately after placement
        updateGameStatus(newBoard, currentPlayer);
        if (!winner) { // only switch player if no winner
          setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
        }

      }
    } else if (gamePhase === 'MOVEMENT') {
      if (selectedPawn) {
        if (board[row][col].player === null && targetSquareColorType === currentPlayerAssignedColor) {
          // Move pawn
          const newBoard = board.map(r => r.map(s => ({ ...s }))); // Deep copy
          newBoard[selectedPawn.row][selectedPawn.col].player = null;
          newBoard[row][col].player = currentPlayer;
          
          // updateGameStatus(newBoard, currentPlayer); // Simplified, full update needed
          setBoard(newBoard); // Temporary direct set
          updateGameStatus(newBoard, currentPlayer);

          setSelectedPawn(null);
          if (!winner) {
             setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
          }
        } else {
          // Invalid move target or deselect
          setSelectedPawn(null);
        }
      } else {
        // Select pawn
        if (board[row][col].player === currentPlayer) {
          setSelectedPawn({ row, col });
        }
      }
    }
  }, [board, currentPlayer, gamePhase, playerPawnsPlaced, selectedPawn, winner, getPlayerColorAssignment, updateGameStatus]);
  
  // Effect to handle player setup completion (e.g., color assignment choice)
  useEffect(() => {
    if (gamePhase === 'PLAYER_SETUP') {
      // For now, auto-start placement. Could add UI for color selection here.
      setGamePhase('PLACEMENT');
    }
  }, [gamePhase]);

  // Effect for simplified win check for now (will be part of updateGameStatus)
  useEffect(() => {
    if (winner || gamePhase === 'GAME_OVER' || gamePhase === 'PLAYER_SETUP') return;
    // The full win check is now in updateGameStatus, this effect might be redundant or for other logic
  }, [board, winner, gamePhase]);


  return {
    board,
    currentPlayer,
    gamePhase,
    playerPawnsPlaced,
    selectedPawn,
    winner,
    winningLine,
    playerAssignedColors,
    handleSquareClick,
    resetGame,
    getPlayerColorAssignment,
  };
};
