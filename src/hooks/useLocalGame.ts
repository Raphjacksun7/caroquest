"use client";

import { useState, useCallback, useEffect }  from "react";
import type { GameState, AIDifficulty, GameMode } from "@/lib/types";
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

interface UseLocalGameProps {
  aiDifficulty: AIDifficulty;
  gameMode: GameMode; // To know if AI should be active
  initialOptions?: Partial<GameState["options"]>;
}

export function useLocalGame({ aiDifficulty, gameMode, initialOptions }: UseLocalGameProps) {
  const [localGameState, setLocalGameState] = useState<GameState>(() =>
    createInitialGameState({ pawnsPerPlayer: PAWNS_PER_PLAYER, ...initialOptions })
  );
  const { toast } = useToast();
  const { t } = useTranslation();
  const {
    calculateBestMove,
    isLoading: isAILoading,
    error: aiError,
  } = useAI(aiDifficulty);

  // Effect for AI's turn
  useEffect(() => {
    if (
      gameMode === "ai" &&
      localGameState?.currentPlayerId === 2 && // AI is Player 2
      !localGameState?.winner &&
      !isAILoading
    ) {
      const timerId = setTimeout(async () => {
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

        if (aiAction.type === "place" && aiAction.squareIndex !== undefined) {
          nextState = placePawnLogic(
            localGameState,
            aiAction.squareIndex,
            actingPlayerIdForAI
          );
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
        } else {
          console.error("CLIENT (AI Hook): AI action has invalid format:", aiAction);
          return;
        }
        
        if (nextState) {
          console.log("CLIENT (AI Hook): Applying AI move. New turn:", nextState.currentPlayerId);
          setLocalGameState(nextState);
        } else {
          console.error("CLIENT (AI Hook): Move resulted in null state. Action was:", aiAction);
        }
      }, 700);
      return () => clearTimeout(timerId);
    }
  }, [gameMode, localGameState, calculateBestMove, isAILoading]);


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
      const square = localGameState.board[index];

      if (localGameState.gamePhase === "placement") {
        newState = placePawnLogic(localGameState, index, actingPlayerId);
        if (!newState) {
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
          } else if (square.pawn && localGameState.blockedPawnsInfo.has(index)) {
            toast({ title: t("pawnBlocked"), description: t("pawnBlockedDescription"), variant: "destructive" });
          }
        } else {
          if (localGameState.selectedPawnIndex === index) { // Deselect
            newState = clearHighlights(localGameState);
          } else if (square.highlight === "validMove") { // Move
            newState = movePawnLogic(localGameState, localGameState.selectedPawnIndex, index, actingPlayerId);
          } else if (square.pawn && square.pawn.playerId === actingPlayerId && !localGameState.blockedPawnsInfo.has(index)) { // Reselect another pawn
            newState = highlightValidMoves(localGameState, index);
          } else { // Invalid click
            newState = clearHighlights(localGameState);
          }
        }
      }

      if (newState) {
        setLocalGameState(newState);
      }
    },
    [localGameState, gameMode, isAILoading, toast, t]
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
      const newState = movePawnLogic(localGameState, localGameState.selectedPawnIndex, targetIndex, actingPlayerId);
      if (newState) {
        setLocalGameState(newState);
      } else {
        setLocalGameState(clearHighlights(localGameState));
      }
    } else {
      toast({ title: t("invalidDrop"), description: t("invalidDropDescription"), variant: "destructive" });
      setLocalGameState(clearHighlights(localGameState));
    }
  }, [localGameState, toast, t]);


  const resetGame = useCallback((options?: Partial<GameState["options"]>) => {
    const newOptions = { ...initialOptions, ...options, pawnsPerPlayer: PAWNS_PER_PLAYER };
    setLocalGameState(createInitialGameState(newOptions));
    toast({ title: t("gameReset"), description: t("gameResetDescription") });
  }, [toast, t, initialOptions]);

  return {
    localGameState,
    isAILoading,
    // aiError, // Handled internally by this hook's toast
    handleLocalSquareClick: handleSquareClick,
    handleLocalPawnDragStart: handlePawnDragStart,
    handleLocalPawnDrop: handlePawnDrop,
    resetLocalGame: resetGame,
    setLocalGameState, // Expose setter if direct manipulation is needed (e.g. for initial options)
  };
}