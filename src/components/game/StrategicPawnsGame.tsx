"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type {
  GameState,
  GameMode,
  AIDifficulty,
} from "@/lib/types";
import {
  createInitialGameState,
  placePawn as placePawnLogic,
  movePawn as movePawnLogic,
  highlightValidMoves,
  clearHighlights,
  PAWNS_PER_PLAYER, 
} from "@/lib/gameLogic";

// UI Components 
import { GameBoard } from "@/components/game/GameBoard";
import { PlayerCard } from "@/components/game/PlayerCard";
import { ControlsCard } from "@/components/game/ControlsCard";
import { HistoryCard } from "@/components/game/HistoryCard";
import { RulesDialogContent } from "@/components/game/RulesDialog";
import { WinnerDialog } from "@/components/game/WinnerDialog";
import { StatusDisplay } from "@/components/game/StatusDisplay";
import { GameExpiredModal } from "@/components/game/GameExpiredModal";
import { WaitingRoom } from "@/components/game/WaitingRoom";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Users,
  Wifi,
  Copy,
  Link as LinkIcon,
  Home,
  Loader2,
  RefreshCw,
} from "lucide-react";

// Hooks
import { useTranslation } from "@/hooks/useTranslation";
import { useGameConnection, gameStore } from "@/hooks/useGameConnection"; 
import { useAI } from "@/hooks/useAI";
import { useRouter, useParams } from "next/navigation";

// Sub-component for the game mode selection screen 
interface SelectGameModeScreenProps {
  onStartGameMode: (mode: GameMode) => void;
  player1Name: string;
  setPlayer1Name: (name: string) => void;
  player2Name: string;
  setPlayer2Name: (name: string) => void;
  remotePlayerNameInput: string;
  setRemotePlayerNameInput: (name: string) => void;
  remoteGameIdInput: string;
  setRemoteGameIdInput: (id: string) => void;
  aiDifficulty: AIDifficulty;
  setAiDifficulty: (difficulty: AIDifficulty) => void;
  isConnecting: boolean;
  gameConnectionError?: string | null;
}

const SelectGameModeScreen: React.FC<SelectGameModeScreenProps> = ({
  onStartGameMode,
  player1Name,
  setPlayer1Name,
  player2Name,
  setPlayer2Name,
  remotePlayerNameInput,
  setRemotePlayerNameInput,
  remoteGameIdInput,
  setRemoteGameIdInput,
  aiDifficulty,
  setAiDifficulty,
  isConnecting,
  gameConnectionError,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("playerName");
      if (storedName) {
        setPlayer1Name(storedName);
        setRemotePlayerNameInput(storedName);
      }
    }
  }, [setPlayer1Name, setRemotePlayerNameInput]);

  const handleRemoteAction = () => {
    if (!remotePlayerNameInput.trim()) {
      toast({
        title: t("errorTitle"),
        description: t("playerNameRequired"),
        variant: "destructive",
      });
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("playerName", remotePlayerNameInput.trim());
    }
    onStartGameMode("remote");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-lg shadow-2xl bg-card rounded-xl overflow-hidden">
        <CardHeader className="text-center p-6 sm:p-8 bg-primary/10">
          <CardTitle className="text-3xl sm:text-4xl font-bold text-primary tracking-tight">
            {t("diagonalDomination")}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm sm:text-base">
            {t("chooseHowToPlay")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8 space-y-6">
          <Tabs defaultValue="local" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-lg">
              <TabsTrigger
                value="local"
                className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md py-2.5 text-sm font-medium"
              >
                <Users className="mr-2 h-5 w-5 inline-block" />
                {t("localTwoPlayer")}
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md py-2.5 text-sm font-medium"
              >
                <Bot className="mr-2 h-5 w-5 inline-block" />
                {t("playVsAI")}
              </TabsTrigger>
              <TabsTrigger
                value="remote"
                className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md py-2.5 text-sm font-medium"
              >
                <Wifi className="mr-2 h-5 w-5 inline-block" />
                {t("gameModeRemote")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="player1NameLocal"
                  className="text-foreground/80"
                >
                  {t("player1Name")}
                </Label>
                <Input
                  id="player1NameLocal"
                  value={player1Name}
                  onChange={(e) => setPlayer1Name(e.target.value)}
                  placeholder={t("player1Name")}
                  className="bg-input focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="player2NameLocal"
                  className="text-foreground/80"
                >
                  {t("player2Name")}
                </Label>
                <Input
                  id="player2NameLocal"
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  placeholder={t("player2Name")}
                  className="bg-input focus:ring-primary"
                />
              </div>
              <Button
                onClick={() => onStartGameMode("local")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base font-semibold rounded-lg shadow-md transition-transform hover:scale-105"
              >
                <Users className="mr-2 h-5 w-5" />
                {t("startGame")}
              </Button>
            </TabsContent>

            <TabsContent value="ai" className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playerNameAI" className="text-foreground/80">
                  {t("yourName")}
                </Label>
                <Input
                  id="playerNameAI"
                  value={player1Name}
                  onChange={(e) => setPlayer1Name(e.target.value)}
                  placeholder={t("enterYourName")}
                  className="bg-input focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80">
                  {t("aiDifficulty")}
                </Label>
                <RadioGroup
                  value={aiDifficulty}
                  onValueChange={(v: string) =>
                    setAiDifficulty(v as AIDifficulty)
                  }
                  className="flex space-x-2 sm:space-x-4 justify-around p-2 bg-muted rounded-lg"
                >
                  {(["easy", "medium", "hard"] as AIDifficulty[]).map((d) => (
                    <Label
                      key={d}
                      htmlFor={`diff-${d}`}
                      className="flex items-center space-x-2 p-2 px-3 rounded-md hover:bg-accent cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground transition-colors"
                    >
                      <RadioGroupItem
                        value={d}
                        id={`diff-${d}`}
                        className="border-foreground data-[state=checked]:border-primary-foreground"
                      />
                      <span className="capitalize text-sm">{t(d)}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              <Button
                onClick={() => onStartGameMode("ai")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base font-semibold rounded-lg shadow-md transition-transform hover:scale-105"
              >
                <Bot className="mr-2 h-5 w-5" />
                {t("startGame")}
              </Button>
            </TabsContent>

            <TabsContent value="remote" className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="playerNameRemote"
                  className="text-foreground/80"
                >
                  {t("yourName")}
                </Label>
                <Input
                  id="playerNameRemote"
                  value={remotePlayerNameInput}
                  onChange={(e) => setRemotePlayerNameInput(e.target.value)}
                  placeholder={t("enterYourName")}
                  className="bg-input focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gameIdInput" className="text-foreground/80">
                  {t("gameIdLabel")}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="gameIdInput"
                    value={remoteGameIdInput}
                    onChange={(e) => setRemoteGameIdInput(e.target.value)}
                    placeholder={t("enterGameIdToJoinOrCreate")}
                    className="bg-input focus:ring-primary"
                  />
                  <Button
                    onClick={() =>
                      navigator.clipboard
                        .writeText(remoteGameIdInput)
                        .then(() => toast({ title: t("linkCopiedTitle") }))
                    }
                    variant="outline"
                    size="icon"
                    disabled={!remoteGameIdInput}
                    className="border-border hover:bg-accent"
                  >
                    <Copy className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <Button
                onClick={handleRemoteAction}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base font-semibold rounded-lg shadow-md transition-transform hover:scale-105"
                disabled={isConnecting || !remotePlayerNameInput.trim()}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t("connectingToServer")}
                  </>
                ) : remoteGameIdInput.trim() ? (
                  <>
                    <LinkIcon className="mr-2 h-5 w-5" />
                    {t("joinGameButton")}
                  </>
                ) : (
                  <>
                    <Wifi className="mr-2 h-5 w-5" />
                    {t("createGameButton")}
                  </>
                )}
              </Button>
              {gameConnectionError && (
                <p className="text-xs text-destructive text-center pt-2">
                  {gameConnectionError}
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="p-6 pt-0 text-center">
          <p className="text-xs text-muted-foreground">
            {t("selectLanguageInfo")}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export function StrategicPawnsGame() {
  const router = useRouter();
  const pathParams = useParams();

  const [localGameState, setLocalGameState] = useState<GameState>(() =>
    createInitialGameState({ pawnsPerPlayer: PAWNS_PER_PLAYER })
  );
  const [gameMode, setGameMode] = useState<GameMode>("select");

  const [player1NameLocal, setPlayer1NameLocal] = useState("");
  const [player2NameLocal, setPlayer2NameLocal] = useState("");
  const [remotePlayerNameInput, setRemotePlayerNameInput] = useState("");
  const [remoteGameIdInput, setRemoteGameIdInput] = useState("");
  const [currentAiDifficulty, setCurrentAiDifficulty] =
    useState<AIDifficulty>("medium");

  const {
    gameState: remoteSocketGameState,
    localPlayerId: remoteLocalPlayerId,
    players: remotePlayers,
    isConnected,
    isConnecting,
    error: gameConnectionError,
    errorType: gameConnectionErrorType,
    gameId: connectedGameId,
    isWaitingForOpponent,
    createGame: createRemoteGame,
    joinGame: joinRemoteGame,
    placePawnAction: remotePlacePawn,
    movePawnAction: remoteMovePawn,
    clearError: clearRemoteError,
    connectSocketIO,
    disconnect: disconnectSocketIO,
  } = useGameConnection();

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [showGameExpiredModal, setShowGameExpiredModal] = useState(false);
  const { toast } = useToast();
  const { t, currentLanguage, setLanguage } = useTranslation();
  const {
    calculateBestMove,
    isLoading: isAILoading,
    error: aiError,
  } = useAI(currentAiDifficulty);

  const gameIdFromUrl = useMemo(() => {
    const id = Array.isArray(pathParams?.gameId)
      ? pathParams.gameId[0]
      : pathParams?.gameId;
    return id && id !== "local" && id !== "ai" ? id : "";
  }, [pathParams]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("playerName");
      if (storedName) {
        setPlayer1NameLocal(storedName);
        setRemotePlayerNameInput(storedName);
      }
      if (gameIdFromUrl) {
        setRemoteGameIdInput(gameIdFromUrl);
      }
    }
  }, [gameIdFromUrl]);

  useEffect(() => {
    if (gameConnectionError && gameConnectionErrorType) {
      console.log("CLIENT: Game Connection Error received:", {
        gameConnectionError,
        gameConnectionErrorType,
      });
      if (
        ["GAME_NOT_FOUND", "GAME_FULL", "JOIN_FAILED", "SERVER_ERROR"].includes(
          gameConnectionErrorType
        )
      ) {
        setShowGameExpiredModal(true);
      } else {
        toast({
          title: t("errorTitle"),
          description: gameConnectionError,
          variant: "destructive",
        });
      }
    }
  }, [gameConnectionError, gameConnectionErrorType, toast, t]);

  useEffect(() => {
    if (
      gameIdFromUrl &&
      gameMode === "select" &&
      !isConnecting &&
      !connectedGameId &&
      !isConnected
    ) {
      console.log(
        "CLIENT: URL detected with gameId:",
        gameIdFromUrl,
        "Preparing for remote join."
      );
    }
  }, [gameIdFromUrl, gameMode, isConnecting, connectedGameId, isConnected]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentPath = window.location.pathname;
    console.log(
      "CLIENT: URL Management Effect - Current Mode:",
      gameMode,
      "Connected Game ID:",
      connectedGameId,
      "Current Path:",
      currentPath
    );

    if (gameMode === "remote" && connectedGameId) {
      const expectedPath = `/game/${connectedGameId}`;
      if (currentPath !== expectedPath) {
        console.log(`CLIENT: Updating URL to game room: ${expectedPath}`);
        window.history.replaceState(null, "", expectedPath);
      }
    } else if (gameMode === "select" && currentPath !== "/") {
      console.log("CLIENT: In select mode, ensuring URL is root.");
      window.history.replaceState(null, "", "/");
    }
  }, [gameMode, connectedGameId]);

  useEffect(() => {
    if (
      gameMode === "ai" &&
      localGameState?.currentPlayerId === 2 &&
      !localGameState?.winner &&
      !isAILoading
    ) {
      const timerId = setTimeout(async () => {
        if (!localGameState) return;
        console.log("CLIENT (AI): AI's turn. Calculating move...");
        const clonedState = structuredClone(localGameState);
        const aiAction = await calculateBestMove(clonedState);

        if (aiAction && localGameState) {
          console.log("CLIENT (AI): AI action received:", aiAction);
          let nextState: GameState | null = null;
          // ** Ensure actingPlayerId is passed for AI moves **
          const actingPlayerIdForAI = clonedState.currentPlayerId; // AI acts as current player
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
          }
          if (nextState) {
            console.log(
              "CLIENT (AI): Applying AI move. New turn:",
              nextState.currentPlayerId
            );
            setLocalGameState(nextState);
          } else
            console.error(
              "CLIENT (AI): AI made an invalid or null move:",
              aiAction
            );
        }
      }, 700);
      return () => clearTimeout(timerId);
    }
  }, [
    gameMode,
    localGameState,
    calculateBestMove,
    isAILoading,
    currentAiDifficulty,
  ]);

  useEffect(() => {
    if (aiError)
      toast({
        title: t("aiErrorTitle"),
        description: aiError,
        variant: "destructive",
      });
  }, [aiError, toast, t]);

  const activeGameState = useMemo(() => {
    const state =
      gameMode === "remote" ? remoteSocketGameState : localGameState;
    return state;
  }, [gameMode, remoteSocketGameState, localGameState]);

  const p1DisplayName = useMemo(() => {
    if (gameMode === "remote")
      return (
        remotePlayers.find((p) => p.playerId === 1)?.name ||
        t("player", { id: 1 })
      );
    return player1NameLocal || t("player", { id: 1 });
  }, [gameMode, remotePlayers, player1NameLocal, t]);

  const p2DisplayName = useMemo(() => {
    if (gameMode === "remote")
      return (
        remotePlayers.find((p) => p.playerId === 2)?.name ||
        t("player", { id: 2 })
      );
    if (gameMode === "ai") return t("aiOpponent");
    return player2NameLocal || t("player", { id: 2 });
  }, [gameMode, remotePlayers, player2NameLocal, t]);

  useEffect(() => {
    if (activeGameState?.winner) {
      const winnerName =
        activeGameState.winner === 1 ? p1DisplayName : p2DisplayName;
      console.log(
        `CLIENT: Game Over. Winner: Player ${activeGameState.winner} (${winnerName})`
      );
      toast({
        title: t("playerDynamicWins", { playerName: winnerName }),
        description: t("congratulations"),
        duration: 8000,
      });
    }
  }, [activeGameState?.winner, p1DisplayName, p2DisplayName, toast, t]);

  const handleStartGameMode = useCallback(
    async (mode: GameMode) => {
      console.log(`CLIENT: Attempting to start game in mode: ${mode}`);
      // Reset local game state for all modes to ensure a fresh start
      setLocalGameState(
        createInitialGameState({
          pawnsPerPlayer: PAWNS_PER_PLAYER,
          ...activeGameState?.options,
        })
      );

      if (mode === "remote") {
        if (!remotePlayerNameInput.trim()) {
          toast({
            title: t("errorTitle"),
            description: t("playerNameRequired"),
            variant: "destructive",
          });
          return;
        }
        console.log(
          `CLIENT: Starting remote game. Player: ${remotePlayerNameInput}, Game ID to join/create: '${remoteGameIdInput.trim()}'`
        );
        try {
          await connectSocketIO();
          if (remoteGameIdInput.trim()) {
            console.log(
              `CLIENT: Attempting to join game: ${remoteGameIdInput.trim()}`
            );
            await joinRemoteGame(
              remoteGameIdInput.trim(),
              remotePlayerNameInput.trim(),
              activeGameState?.options
            );
          } else {
            console.log("CLIENT: Attempting to create new remote game.");
            await createRemoteGame(
              remotePlayerNameInput.trim(),
              activeGameState?.options
            );
          }
          // Game mode will be effectively set when connection events (game_created/game_joined) are received
          // and update the Zustand store, which in turn updates `remoteSocketGameState` and other relevant states.
          // We can set it here to move away from the SelectGameModeScreen optimistically.
          setGameMode("remote");
        } catch (err) {
          console.error("CLIENT: Remote game start/join failed:", err);
          toast({
            title: t("errorTitle"),
            description: t("connectionOrGameSetupFailed"),
            variant: "destructive",
          });
        }
      } else {
        if (mode === "local") {
          setPlayer1NameLocal((prev) => prev.trim() || t("player1Name"));
          setPlayer2NameLocal((prev) => prev.trim() || t("player2Name"));
        } else if (mode === "ai") {
          setPlayer1NameLocal((prev) => prev.trim() || t("player1Name"));
        }
        setGameMode(mode);
      }
    },
    [
      connectSocketIO,
      joinRemoteGame,
      createRemoteGame,
      remoteGameIdInput,
      remotePlayerNameInput,
      toast,
      t,
      activeGameState?.options,
    ]
  );

  const goBackToMenu = useCallback(() => {
    console.log("CLIENT: Navigating back to menu. Current mode:", gameMode);
    if (gameMode === "remote" && isConnected) {
      console.log("CLIENT: Disconnecting from remote game.");
      disconnectSocketIO();
    }
    setGameMode("select");
    setLocalGameState(
      createInitialGameState({ pawnsPerPlayer: PAWNS_PER_PLAYER })
    );
    clearRemoteError?.();
    setRemoteGameIdInput("");
  }, [gameMode, isConnected, disconnectSocketIO, clearRemoteError]);

  const resetGameHandler = useCallback(() => {
    if (gameMode === "remote") {
      toast({
        title: t("gameReset"),
        description: t("featureNotAvailableRemote"),
      });
    } else {
      console.log("CLIENT: Resetting local/AI game.");
      setLocalGameState(
        createInitialGameState({
          pawnsPerPlayer: PAWNS_PER_PLAYER,
          ...activeGameState?.options,
        })
      );
      toast({ title: t("gameReset"), description: t("gameResetDescription") });
    }
  }, [gameMode, toast, t, activeGameState?.options]);

  const handleLocalSquareClick = useCallback(
    (index: number) => {
      if (!localGameState || localGameState.winner) return;
      if (
        gameMode === "ai" &&
        localGameState.currentPlayerId === 2 &&
        isAILoading
      ) {
        console.log("CLIENT (Local/AI): AI is thinking, player click ignored.");
        return;
      }

      const actingPlayerId = localGameState.currentPlayerId; // Player whose turn it is in local/AI
      console.log(
        `CLIENT (Local/AI): Square ${index} clicked. Player P${actingPlayerId}'s turn. Phase: ${localGameState.gamePhase}`
      );

      const square = localGameState.board[index];
      let newState: GameState | null = null;

      if (localGameState.gamePhase === "placement") {
        newState = placePawnLogic(localGameState, index, actingPlayerId); // Pass actingPlayerId
        if (!newState)
          toast({
            title: t("invalidPlacement"),
            description: t("invalidPlacementDescription"),
            variant: "destructive",
          });
      } else {
        if (localGameState.selectedPawnIndex === null) {
          if (
            square.pawn &&
            square.pawn.playerId === actingPlayerId &&
            !localGameState.blockedPawnsInfo.has(index)
          ) {
            newState = highlightValidMoves(localGameState, index);
            console.log(
              `CLIENT (Local/AI): Pawn at ${index} selected. Highlighting moves.`
            );
          } else if (
            square.pawn &&
            localGameState.blockedPawnsInfo.has(index)
          ) {
            toast({
              title: t("pawnBlocked"),
              description: t("pawnBlockedDescription"),
              variant: "destructive",
            });
          }
        } else {
          if (localGameState.selectedPawnIndex === index) {
            newState = clearHighlights(localGameState);
            console.log("CLIENT (Local/AI): Deselected pawn.");
          } else if (square.highlight === "validMove") {
            newState = movePawnLogic(
              localGameState,
              localGameState.selectedPawnIndex,
              index,
              actingPlayerId
            ); // Pass actingPlayerId
            console.log(
              `CLIENT (Local/AI): Attempting move from ${localGameState.selectedPawnIndex} to ${index}.`
            );
          } else if (
            square.pawn &&
            square.pawn.playerId === actingPlayerId &&
            !localGameState.blockedPawnsInfo.has(index)
          ) {
            newState = highlightValidMoves(localGameState, index);
            console.log(`CLIENT (Local/AI): Reselected pawn at ${index}.`);
          } else {
            newState = clearHighlights(localGameState);
            console.log(
              "CLIENT (Local/AI): Invalid move/click, clearing highlights."
            );
          }
        }
      }
      if (newState) {
        console.log(
          "CLIENT (Local/AI): State updated. New turn:",
          newState.currentPlayerId
        );
        setLocalGameState(newState);
      }
    },
    [localGameState, gameMode, isAILoading, toast, t]
  );

  const handleRemoteSquareClick = useCallback(
    (index: number) => {
      if (
        !remoteSocketGameState ||
        !remoteLocalPlayerId ||
        remoteSocketGameState.winner ||
        !connectedGameId
      ) {
        console.log("CLIENT (Remote): Click ignored - conditions not met.");
        return;
      }
      if (remoteSocketGameState.currentPlayerId !== remoteLocalPlayerId) {
        console.log(
          `CLIENT (Remote): Not your turn. Current: P${remoteSocketGameState.currentPlayerId}, You: P${remoteLocalPlayerId}`
        );
        toast({
          title: t("notYourTurnTitle"),
          description: t("notYourTurnDescription"),
        });
        return;
      }
      console.log(
        `CLIENT (Remote): Square ${index} clicked. Your turn (P${remoteLocalPlayerId}). Phase: ${remoteSocketGameState.gamePhase}`
      );

      const square = remoteSocketGameState.board[index];
      if (remoteSocketGameState.gamePhase === "placement") {
        console.log(
          `CLIENT (Remote): Sending place_pawn action for square ${index}.`
        );
        remotePlacePawn(index);
      } else {
        if (remoteSocketGameState.selectedPawnIndex === null) {
          if (
            square.pawn &&
            square.pawn.playerId === remoteLocalPlayerId &&
            !remoteSocketGameState.blockedPawnsInfo.has(index)
          ) {
            console.log(
              `CLIENT (Remote): Selecting pawn at ${index}. Optimistically highlighting.`
            );
            const tempState = highlightValidMoves(remoteSocketGameState, index);
            gameStore.getState().setGameState(tempState);
          } else if (
            square.pawn &&
            remoteSocketGameState.blockedPawnsInfo.has(index)
          ) {
            toast({
              title: t("pawnBlocked"),
              description: t("pawnBlockedDescription"),
              variant: "destructive",
            });
          }
        } else {
          if (remoteSocketGameState.selectedPawnIndex === index) {
            console.log(
              "CLIENT (Remote): Deselecting pawn. Optimistically clearing highlights."
            );
            const tempState = clearHighlights(remoteSocketGameState);
            gameStore.getState().setGameState(tempState);
          } else if (square.highlight === "validMove") {
            console.log(
              `CLIENT (Remote): Sending move_pawn action from ${remoteSocketGameState.selectedPawnIndex} to ${index}.`
            );
            remoteMovePawn(remoteSocketGameState.selectedPawnIndex, index);
          } else if (
            square.pawn &&
            square.pawn.playerId === remoteLocalPlayerId &&
            !remoteSocketGameState.blockedPawnsInfo.has(index)
          ) {
            console.log(
              `CLIENT (Remote): Reselecting pawn at ${index}. Optimistically highlighting.`
            );
            const tempState = highlightValidMoves(remoteSocketGameState, index);
            gameStore.getState().setGameState(tempState);
          } else {
            console.log(
              "CLIENT (Remote): Invalid move/click. Optimistically clearing highlights."
            );
            const tempState = clearHighlights(remoteSocketGameState);
            gameStore.getState().setGameState(tempState);
          }
        }
      }
    },
    [
      remoteSocketGameState,
      remoteLocalPlayerId,
      connectedGameId,
      remotePlacePawn,
      remoteMovePawn,
      toast,
      t,
    ]
  );

  const handleSquareClick =
    gameMode === "remote" ? handleRemoteSquareClick : handleLocalSquareClick;

  const handlePawnDragStart = useCallback(
    (pawnIndex: number) => {
      const currentActiveState =
        gameMode === "remote" ? remoteSocketGameState : localGameState;
      if (!currentActiveState || currentActiveState.winner) return;

      const actingPlayer =
        gameMode === "remote"
          ? remoteLocalPlayerId
          : currentActiveState.currentPlayerId;
      if (currentActiveState.currentPlayerId !== actingPlayer) return;

      if (
        currentActiveState.gamePhase === "movement" &&
        !currentActiveState.blockedPawnsInfo.has(pawnIndex)
      ) {
        console.log(
          `CLIENT (Drag): Drag start on pawn ${pawnIndex}. Highlighting.`
        );
        const highlightedState = highlightValidMoves(
          currentActiveState,
          pawnIndex
        );
        if (gameMode === "remote")
          gameStore.getState().setGameState(highlightedState);
        else setLocalGameState(highlightedState);
      }
    },
    [gameMode, remoteSocketGameState, localGameState, remoteLocalPlayerId]
  );

  const handlePawnDrop = useCallback(
    (targetIndex: number) => {
      const currentActiveState =
        gameMode === "remote" ? remoteSocketGameState : localGameState;
      if (
        !currentActiveState ||
        currentActiveState.selectedPawnIndex === null
      ) {
        if (currentActiveState) {
          console.log(
            "CLIENT (Drag): Drop without selection or invalid state. Clearing highlights."
          );
          const clearedState = clearHighlights(currentActiveState);
          if (gameMode === "remote")
            gameStore.getState().setGameState(clearedState);
          else setLocalGameState(clearedState);
        }
        return;
      }

      const targetSquare = currentActiveState.board[targetIndex];
      if (targetSquare.highlight === "validMove") {
        console.log(
          `CLIENT (Drag): Pawn dropped on valid square ${targetIndex}.`
        );
        handleSquareClick(targetIndex);
      } else {
        toast({
          title: t("invalidDrop"),
          description: t("invalidDropDescription"),
          variant: "destructive",
        });
        console.log(
          "CLIENT (Drag): Pawn dropped on invalid square. Clearing highlights."
        );
        const clearedState = clearHighlights(currentActiveState);
        if (gameMode === "remote")
          gameStore.getState().setGameState(clearedState);
        else setLocalGameState(clearedState);
      }
    },
    [
      gameMode,
      remoteSocketGameState,
      localGameState,
      handleSquareClick,
      toast,
      t,
    ]
  );

  const handleModalCreateNewGame = useCallback(() => {
    setShowGameExpiredModal(false);
    goBackToMenu();
  }, [goBackToMenu]);

  const handleModalGoHome = useCallback(() => {
    setShowGameExpiredModal(false);
    goBackToMenu();
  }, [goBackToMenu]);

  useEffect(() => {
    console.log(
      "CLIENT: Debug Render - GameMode:",
      gameMode,
      "IsConnected:",
      isConnected,
      "IsConnecting:",
      isConnecting,
      "IsWaiting:",
      isWaitingForOpponent,
      "ConnectedGameID:",
      connectedGameId,
      "LocalPlayerID:",
      remoteLocalPlayerId
    );
    if (activeGameState) {
      console.log(
        "CLIENT: Debug Render - ActiveGameState CurrentPlayer:",
        activeGameState.currentPlayerId,
        "Phase:",
        activeGameState.gamePhase
      );
    }
  }, [
    gameMode,
    isConnected,
    isConnecting,
    isWaitingForOpponent,
    connectedGameId,
    remoteLocalPlayerId,
    activeGameState,
  ]);

  // ---- RENDER LOGIC ----
  if (gameMode === "select") {
    return (
      <SelectGameModeScreen
        onStartGameMode={handleStartGameMode}
        player1Name={player1NameLocal}
        setPlayer1Name={setPlayer1NameLocal}
        player2Name={player2NameLocal}
        setPlayer2Name={setPlayer2NameLocal}
        remotePlayerNameInput={remotePlayerNameInput}
        setRemotePlayerNameInput={setRemotePlayerNameInput}
        remoteGameIdInput={remoteGameIdInput}
        setRemoteGameIdInput={setRemoteGameIdInput}
        aiDifficulty={currentAiDifficulty}
        setAiDifficulty={setCurrentAiDifficulty}
        isConnecting={isConnecting}
        gameConnectionError={gameConnectionError}
      />
    );
  }

  if (gameMode === "remote" && isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <span>{t("connectingToServer")}...</span>
      </div>
    );
  }

  if (
    gameMode === "remote" &&
    !isConnected &&
    !isConnecting &&
    gameConnectionError
  ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <span>
          {t("connectionFailed")}: {gameConnectionError}
        </span>
        <Button onClick={goBackToMenu} className="mt-4" variant="outline">
          <Home className="mr-2 h-4 w-4" /> {t("backToMenu")}
        </Button>
      </div>
    );
  }

  if (
    gameMode === "remote" &&
    connectedGameId &&
    isConnected &&
    isWaitingForOpponent
  ) {
    console.log("CLIENT: Rendering WaitingRoom component.");
    const clientPlayer = remotePlayers.find(
      (p) => p.playerId === remoteLocalPlayerId
    );
    const clientPlayerName =
      clientPlayer?.name || remotePlayerNameInput || t("yourName");
    return (
      <WaitingRoom gameId={connectedGameId} playerName={clientPlayerName} />
    );
  }

  if (!activeGameState) {
    console.warn(
      "CLIENT: activeGameState is null/undefined when expected. GameMode:",
      gameMode
    );
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <span>{t("loadingGame")}...</span>
      </div>
    );
  }

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary text-foreground p-2 sm:p-4 selection:bg-primary selection:text-primary-foreground">
        <Button
          variant="ghost"
          onClick={goBackToMenu}
          className="absolute top-4 left-4 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground px-3 py-1.5 rounded-md z-10"
        >
          <Home className="mr-2 h-4 w-4" /> {t("backToMenu")}
        </Button>
        <div className="w-full max-w-7xl mx-auto">
          <header className="mb-4 sm:mb-6 text-center pt-12 sm:pt-0">
            <h1 className="text-4xl sm:text-5xl font-bold text-primary tracking-tight">
              {t("diagonalDomination")}
            </h1>
            {gameMode === "remote" && connectedGameId && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <p className="text-sm text-muted-foreground">
                  {t("gameRoomID")}:{" "}
                  <span className="font-semibold text-foreground">
                    {connectedGameId}
                  </span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border hover:bg-accent h-8 px-2.5"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      navigator.clipboard
                        .writeText(
                          `${window.location.origin}/game/${connectedGameId}`
                        )
                        .then(() =>
                          toast({
                            title: t("linkCopiedTitle"),
                            description: t("linkCopiedDescription"),
                          })
                        );
                    }
                  }}
                >
                  <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                  {t("copyGameLink")}
                </Button>
              </div>
            )}
          </header>

          <StatusDisplay
            gameState={activeGameState}
            player1Name={p1DisplayName}
            player2Name={p2DisplayName}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,_1fr)_auto_minmax(280px,_1fr)] gap-4 sm:gap-6 items-start mt-4">
            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6 order-2 lg:order-1">
              <ControlsCard
                onReset={resetGameHandler}
                onOpenRules={() => setIsRulesOpen(true)}
                pawnsPerPlayer={
                  activeGameState.options?.pawnsPerPlayer || PAWNS_PER_PLAYER
                }
                isGameActive={!activeGameState.winner}
                currentLanguage={currentLanguage}
                onSetLanguage={setLanguage}
              />
              <PlayerCard
                playerId={1}
                playerName={p1DisplayName}
                isLocalPlayer={
                  gameMode === "remote" ? remoteLocalPlayerId === 1 : true
                }
                gameState={activeGameState}
              />
              <PlayerCard
                playerId={2}
                playerName={p2DisplayName}
                isLocalPlayer={
                  gameMode === "remote"
                    ? remoteLocalPlayerId === 2
                    : gameMode === "local"
                }
                gameState={activeGameState}
              />
            </div>

            <div className="flex flex-col items-center justify-center order-1 lg:order-2">
              <GameBoard
                gameState={activeGameState}
                onSquareClick={handleSquareClick}
                onPawnDragStart={handlePawnDragStart}
                onPawnDrop={handlePawnDrop}
              />
              {gameMode === "remote" &&
                activeGameState &&
                remoteLocalPlayerId && (
                  <div className="mt-3 flex items-center text-sm font-medium">
                    {activeGameState.currentPlayerId === remoteLocalPlayerId ? (
                      <span className="text-green-600 dark:text-green-400">
                        🎯 {t("yourTurn")}
                      </span>
                    ) : (
                      <span className="text-orange-600 dark:text-orange-400">
                        ⏳ {t("opponentTurn")}
                      </span>
                    )}
                    <span className="ml-2 text-muted-foreground">
                      ({t("player")} {activeGameState.currentPlayerId})
                    </span>
                  </div>
                )}
            </div>

            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6 order-3">
              <HistoryCard gameState={activeGameState} />
            </div>
          </div>
        </div>
      </main>
      <Toaster />
      <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
        <RulesDialogContent
          pawnsPerPlayer={
            activeGameState.options?.pawnsPerPlayer || PAWNS_PER_PLAYER
          }
        />
      </Dialog>
      {activeGameState.winner && (
        <WinnerDialog
          winner={activeGameState.winner}
          winnerName={
            activeGameState.winner === 1 ? p1DisplayName : p2DisplayName
          }
          isOpen={!!activeGameState.winner}
          onOpenChange={(open) => !open && resetGameHandler()}
          onPlayAgain={resetGameHandler}
        />
      )}
      <GameExpiredModal
        isOpen={showGameExpiredModal}
        onCreateNew={handleModalCreateNewGame}
        onGoHome={handleModalGoHome}
        errorType={
          (gameConnectionErrorType === "INVALID_MOVE"
            ? "SERVER_ERROR"
            : gameConnectionErrorType) || "GAME_NOT_FOUND"
        }
        gameId={connectedGameId || remoteGameIdInput}
      />
    </>
  );
}
