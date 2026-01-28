"use client";

import { useState, useCallback, useEffect, useRef }  from "react";
import type { GameState, AIStrategy, GameMode, GameAction } from "@/lib/types";
import {
  createInitialGameState,
  placePawn as placePawnLogic,
  movePawn as movePawnLogic,
  highlightValidMoves,
  clearHighlights,
  PAWNS_PER_PLAYER,
  cloneGameState,
} from "@/lib/gameLogic";
import { useAI } from "@/hooks/useAI";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameHistory } from "@/hooks/useGameHistory";

interface UseLocalGameProps {
  aiStrategy: AIStrategy;
  gameMode: GameMode; // To know if AI should be active
  initialOptions?: Partial<GameState["options"]>;
}

export function useLocalGame({ aiStrategy, gameMode, initialOptions }: UseLocalGameProps) {
  const [localGameState, setLocalGameState] = useState<GameState>(() =>
    createInitialGameState({ pawnsPerPlayer: PAWNS_PER_PLAYER, ...initialOptions })
  );
  const { toast } = useToast();
  const { t } = useTranslation();
  const {
    calculateBestMove,
    isLoading: isAILoading,
    error: aiError,
  } = useAI(aiStrategy);
  
  // Game history for undo/redo functionality
  const {
    pushState: pushHistoryState,
    initHistory,
    undo: undoHistory,
    canUndo,
    canRedo,
    redo: redoHistory,
    clearHistory,
  } = useGameHistory({ maxHistorySize: 50 });
  
  // Track if we're in the middle of an undo operation (to prevent AI from responding)
  const isUndoingRef = useRef(false);
  // Track the last AI action for proper undo (undo both player + AI moves)
  const pendingAIUndoRef = useRef(false);
  
  // Initialize history when game starts
  useEffect(() => {
    initHistory(localGameState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Effect for AI's turn
  useEffect(() => {
    // Skip AI turn if we're in the middle of an undo operation
    if (isUndoingRef.current) {
      console.log("CLIENT (AI Hook): Skipping AI turn - undo in progress");
      return;
    }
    
    if (
      gameMode === "ai" &&
      localGameState?.currentPlayerId === 2 && // AI is Player 2
      !localGameState?.winner &&
      !isAILoading
    ) {
      const timerId = setTimeout(async () => {
        // Double-check undo state after timeout
        if (isUndoingRef.current) {
          console.log("CLIENT (AI Hook): Aborting AI turn - undo triggered during delay");
          return;
        }
        
        if (!localGameState) return;
        console.log("CLIENT (AI Hook): AI's turn. Calculating move...", {
          phase: localGameState.gamePhase,
          currentPlayer: localGameState.currentPlayerId,
          blockedPawnsSize: localGameState.blockedPawnsInfo.size,
          deadZonesSize: localGameState.deadZoneSquares.size
        });
        const clonedState = cloneGameState(localGameState);
        console.log("CLIENT (AI Hook): Cloned state:", {
          phase: clonedState.gamePhase,
          blockedPawnsSize: clonedState.blockedPawnsInfo.size,
          deadZonesSize: clonedState.deadZoneSquares.size
        });
        const aiAction = await calculateBestMove(clonedState);

        console.log("CLIENT (AI Hook): AI action received:", JSON.stringify(aiAction));

        // Strict validation
        if (!aiAction) {
          console.error("CLIENT (AI Hook): AI returned null/undefined");
          return;
        }
        
        if (typeof aiAction !== 'object') {
          console.error("CLIENT (AI Hook): AI returned non-object:", typeof aiAction);
          return;
        }
        
        if (Object.keys(aiAction).length === 0) {
          console.error("CLIENT (AI Hook): AI returned empty object {}");
          return;
        }
        
        if (!aiAction.type || aiAction.type === 'none') {
          console.error("CLIENT (AI Hook): AI returned invalid type:", aiAction.type);
          return;
        }
        
        if (!localGameState) {
          console.error("CLIENT (AI Hook): Game state became null");
          return;
        }
        
        let nextState: GameState | null = null;
        const actingPlayerIdForAI = clonedState.currentPlayerId;

        // Build the action for history
        let historyAction: GameAction;
        
        if (aiAction.type === "place" && aiAction.squareIndex !== undefined) {
          nextState = placePawnLogic(
            localGameState,
            aiAction.squareIndex,
            actingPlayerIdForAI
          );
          historyAction = { type: 'place', squareIndex: aiAction.squareIndex };
        } else if (
          aiAction.type === "move" &&
          aiAction.fromIndex !== undefined &&
          aiAction.toIndex !== undefined
        ) {
          nextState = movePawnLogic(
            localGameState,
            aiAction.fromIndex,
            aiAction.toIndex,
            actingPlayerIdForAI
          );
          historyAction = { type: 'move', fromIndex: aiAction.fromIndex, toIndex: aiAction.toIndex };
        } else {
          console.error("CLIENT (AI Hook): AI action has invalid format:", aiAction);
          return;
        }
        
        if (nextState) {
          console.log("CLIENT (AI Hook): Applying AI move. New turn:", nextState.currentPlayerId);
          // Push AI's move to history
          pushHistoryState(nextState, historyAction, 2);
          setLocalGameState(nextState);
        } else {
          console.error("CLIENT (AI Hook): Move resulted in null state. Action was:", aiAction);
        }
      }, 700);
      return () => clearTimeout(timerId);
    }
  }, [gameMode, localGameState, calculateBestMove, isAILoading, pushHistoryState]);


  useEffect(() => {
    if (aiError) {
      toast({
        title: t("aiErrorTitle"),
        description: aiError,
        variant: "destructive",
      });
    }
  }, [aiError, toast, t]);

  const handleSquareClick = useCallback(
    (index: number) => {
      if (!localGameState || localGameState.winner) return;
      if (gameMode === "ai" && localGameState.currentPlayerId === 2 && isAILoading) {
        console.log("CLIENT (LocalGame Hook): AI is thinking, player click ignored.");
        return;
      }

      const actingPlayerId = localGameState.currentPlayerId;
      console.log(`CLIENT (LocalGame Hook): Square ${index} clicked. Player P${actingPlayerId}'s turn. Phase: ${localGameState.gamePhase}`);

      let newState: GameState | null = null;
      let historyAction: GameAction | null = null;
      const square = localGameState.board[index];

      if (localGameState.gamePhase === "placement") {
        newState = placePawnLogic(localGameState, index, actingPlayerId);
        if (newState) {
          historyAction = { type: 'place', squareIndex: index };
        } else {
          toast({
            title: t("invalidPlacement"),
            description: t("invalidPlacementDescription"),
            variant: "destructive",
          });
        }
      } else { // Movement phase
        if (localGameState.selectedPawnIndex === null) {
          if (square.pawn && square.pawn.playerId === actingPlayerId && !localGameState.blockedPawnsInfo.has(index)) {
            newState = highlightValidMoves(localGameState, index);
            // Selection is not a "move" - don't push to history
          } else if (square.pawn && localGameState.blockedPawnsInfo.has(index)) {
            toast({ title: t("pawnBlocked"), description: t("pawnBlockedDescription"), variant: "destructive" });
          }
        } else {
          if (localGameState.selectedPawnIndex === index) { // Deselect
            newState = clearHighlights(localGameState);
            // Deselection is not a "move" - don't push to history
          } else if (square.highlight === "validMove") { // Move
            const fromIndex = localGameState.selectedPawnIndex;
            newState = movePawnLogic(localGameState, fromIndex, index, actingPlayerId);
            if (newState) {
              historyAction = { type: 'move', fromIndex, toIndex: index };
            }
          } else if (square.pawn && square.pawn.playerId === actingPlayerId && !localGameState.blockedPawnsInfo.has(index)) { // Reselect another pawn
            newState = highlightValidMoves(localGameState, index);
            // Reselection is not a "move" - don't push to history
          } else { // Invalid click
            newState = clearHighlights(localGameState);
          }
        }
      }

      if (newState) {
        // Only push to history if this was an actual game action (not just selection/deselection)
        if (historyAction) {
          pushHistoryState(newState, historyAction, actingPlayerId);
        }
        setLocalGameState(newState);
      }
    },
    [localGameState, gameMode, isAILoading, toast, t, pushHistoryState]
  );

  const handlePawnDragStart = useCallback((pawnIndex: number) => {
    if (!localGameState || localGameState.winner || localGameState.gamePhase !== "movement") return;
    
    const actingPlayer = localGameState.currentPlayerId;
    if (gameMode === "ai" && actingPlayer === 2) return; // AI is player 2

    if (!localGameState.blockedPawnsInfo.has(pawnIndex)) {
      const pawnOwnerId = localGameState.board[pawnIndex]?.pawn?.playerId;
      if (pawnOwnerId === actingPlayer) {
        console.log(`CLIENT (LocalGame Hook): Drag start on pawn ${pawnIndex}. Highlighting.`);
        const highlightedState = highlightValidMoves(localGameState, pawnIndex);
        setLocalGameState(highlightedState);
      }
    }
  }, [localGameState, gameMode]);

  const handlePawnDrop = useCallback((targetIndex: number) => {
    if (!localGameState || localGameState.selectedPawnIndex === null) {
      if (localGameState) setLocalGameState(clearHighlights(localGameState));
      return;
    }

    const targetSquare = localGameState.board[targetIndex];
    if (targetSquare.highlight === "validMove") {
      console.log(`CLIENT (LocalGame Hook): Pawn dropped on valid square ${targetIndex}.`);
      const actingPlayerId = localGameState.currentPlayerId;
      const fromIndex = localGameState.selectedPawnIndex;
      const newState = movePawnLogic(localGameState, fromIndex, targetIndex, actingPlayerId);
      if (newState) {
        // Push to history
        pushHistoryState(newState, { type: 'move', fromIndex, toIndex: targetIndex }, actingPlayerId);
        setLocalGameState(newState);
      } else {
        setLocalGameState(clearHighlights(localGameState));
      }
    } else {
      toast({ title: t("invalidDrop"), description: t("invalidDropDescription"), variant: "destructive" });
      setLocalGameState(clearHighlights(localGameState));
    }
  }, [localGameState, toast, t, pushHistoryState]);


  const resetGame = useCallback((options?: Partial<GameState["options"]>) => {
    const newOptions = { ...initialOptions, ...options, pawnsPerPlayer: PAWNS_PER_PLAYER };
    const newState = createInitialGameState(newOptions);
    setLocalGameState(newState);
    // Clear and reinitialize history
    clearHistory();
    initHistory(newState);
    toast({ title: t("gameReset"), description: t("gameResetDescription") });
  }, [toast, t, initialOptions, clearHistory, initHistory]);

  /**
   * Undo the last move(s).
   * - In AI mode: Undoes both the AI's move and the player's previous move (2 steps)
   * - In local mode: Undoes just the last move (1 step)
   * 
   * Returns true if undo was successful, false otherwise.
   */
  const handleUndo = useCallback(() => {
    if (!canUndo) {
      toast({ 
        title: t("cannotUndo") || "Cannot Undo", 
        description: t("cannotUndoDescription") || "No moves to undo",
        variant: "destructive" 
      });
      return false;
    }

    // Prevent AI from making a move during undo
    isUndoingRef.current = true;

    // In AI mode, undo 2 moves (player's move + AI's response) if player 1's turn
    // If it's currently player 1's turn, the last move was AI's, so undo 2
    // If it's currently player 2's turn (shouldn't happen in AI mode while player is active), undo 1
    const stepsToUndo = gameMode === "ai" ? 2 : 1;
    
    console.log(`CLIENT (LocalGame Hook): Undoing ${stepsToUndo} step(s). Mode: ${gameMode}`);
    
    const restoredState = undoHistory(stepsToUndo);
    
    if (restoredState) {
      setLocalGameState(restoredState);
      toast({ 
        title: t("moveUndone") || "Move Undone", 
        description: gameMode === "ai" 
          ? (t("yourMoveAndAIUndone") || "Your move and AI's response have been undone")
          : (t("lastMoveUndone") || "Last move has been undone")
      });
      
      // Reset undo flag after a short delay to allow state to settle
      setTimeout(() => {
        isUndoingRef.current = false;
      }, 100);
      
      return true;
    } else {
      isUndoingRef.current = false;
      return false;
    }
  }, [canUndo, gameMode, undoHistory, toast, t]);

  /**
   * Redo a previously undone move.
   * Returns true if redo was successful, false otherwise.
   */
  const handleRedo = useCallback(() => {
    if (!canRedo) {
      toast({ 
        title: t("cannotRedo") || "Cannot Redo", 
        description: t("cannotRedoDescription") || "No moves to redo",
        variant: "destructive" 
      });
      return false;
    }

    // In AI mode, redo 2 moves to restore both player and AI moves
    const stepsToRedo = gameMode === "ai" ? 2 : 1;
    
    console.log(`CLIENT (LocalGame Hook): Redoing ${stepsToRedo} step(s). Mode: ${gameMode}`);
    
    const restoredState = redoHistory(stepsToRedo);
    
    if (restoredState) {
      setLocalGameState(restoredState);
      toast({ 
        title: t("moveRedone") || "Move Redone", 
        description: t("moveRestoredDescription") || "Move has been restored"
      });
      return true;
    }
    
    return false;
  }, [canRedo, gameMode, redoHistory, toast, t]);

  return {
    localGameState,
    isAILoading,
    // aiError, // Handled internally by this hook's toast
    handleLocalSquareClick: handleSquareClick,
    handleLocalPawnDragStart: handlePawnDragStart,
    handleLocalPawnDrop: handlePawnDrop,
    resetLocalGame: resetGame,
    setLocalGameState, // Expose setter if direct manipulation is needed (e.g. for initial options)
    // Undo/Redo functionality
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  };
}