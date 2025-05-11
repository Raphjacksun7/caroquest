
"use client"; 

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, PlayerId } from '@/lib/gameLogic';
import { 
  createInitialGameState, 
  placePawn as placePawnLogic, 
  movePawn as movePawnLogic, 
  selectPawn,
  clearSelection,
  PAWNS_PER_PLAYER
} from '@/lib/gameLogic';

import { GameBoard } from '@/components/game/GameBoard';
import { PlayerCard } from '@/components/game/PlayerCard';
import { ControlsCard } from '@/components/game/ControlsCard';
import { HistoryCard } from '@/components/game/HistoryCard';
import { RulesDialog } from '@/components/game/RulesDialog'; 
import { WinnerDialog } from '@/components/game/WinnerDialog';
import { StatusDisplay } from '@/components/game/StatusDisplay';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Dialog } from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameConnection, type StoredPlayer as RemotePlayerInfo, useGameStore } from '@/hooks/useGameConnection';
import { useAI } from '@/hooks/useAI';
import { WaitingRoom } from '@/components/game/WaitingRoom';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Bot, Users, Wifi, Copy, LinkIcon, Home, Loader2 } from 'lucide-react'; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


type GameMode = 'ai' | 'local' | 'remote' | 'select';
type AIDifficulty = 'easy' | 'medium' | 'hard';

export function StrategicPawnsGame() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathParams = useParams(); 

  const [localGameState, setLocalGameState] = useState<GameState>(() => createInitialGameState(PAWNS_PER_PLAYER));
  const [gameMode, setGameMode] = useState<GameMode>('select');
  
  const [player1Name, setPlayer1Name] = useState('Player 1');
  const [player2Name, setPlayer2Name] = useState('Player 2'); 
  const [remotePlayerNameInput, setRemotePlayerNameInput] = useState(''); 
  const [remoteGameIdInput, setRemoteGameIdInput] = useState('');
  
  const {
    gameState: remoteSocketGameState,
    localPlayerId: remoteLocalPlayerId,
    players: remotePlayers,
    isConnected,
    isConnecting,
    error: gameConnectionError,
    gameId: connectedGameId,
    isWaitingForOpponent,
    createGame: createRemoteGame,
    joinGame: joinRemoteGame,
    placePawnAction: remotePlacePawn,
    movePawnAction: remoteMovePawn,
    clearError: clearRemoteError,
    connect: connectSocketIO, 
    disconnect: disconnectSocketIO 
  } = useGameConnection();

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const { toast } = useToast();
  const { t, currentLanguage, setLanguage } = useTranslation();

  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const { calculateBestMove, isLoading: isAILoading, error: aiError } = useAI(aiDifficulty);


  useEffect(() => {
    const gameIdFromPath = Array.isArray(pathParams?.gameId) ? pathParams.gameId[0] : pathParams?.gameId;
    if (gameIdFromPath && gameIdFromPath !== 'local' && gameIdFromPath !== 'ai' && gameMode === 'select') {
      setGameMode('remote');
      setRemoteGameIdInput(gameIdFromPath);
      const nameFromQuery = searchParams.get('playerName');
      const storedName = typeof window !== 'undefined' ? localStorage.getItem('playerName') : null;
      const nameToUse = nameFromQuery || storedName || `Guest${Math.floor(Math.random()*1000)}`;
      setRemotePlayerNameInput(nameToUse);
      
      if(!isConnected && !isConnecting) {
        connectSocketIO().then(() => {
          if (gameIdFromPath) joinRemoteGame(gameIdFromPath, nameToUse);
        }).catch(err => console.error("Socket connection failed on mount:", err));
      } else if (isConnected && !connectedGameId && gameIdFromPath) {
         joinRemoteGame(gameIdFromPath, nameToUse);
      }
    }
  }, [pathParams, gameMode, searchParams, isConnected, connectedGameId, joinRemoteGame, isConnecting, connectSocketIO]);


  const activeGameState = gameMode === 'remote' ? remoteSocketGameState : localGameState;
  const activeLocalPlayerId = gameMode === 'remote' ? remoteLocalPlayerId : activeGameState?.currentPlayerId;
  
  const p1DisplayName = gameMode === 'remote' ? remotePlayers.find(p => p.playerId === 1)?.name || t('player', { id: 1 }) : player1Name;
  const p2DisplayName = gameMode === 'remote' ? remotePlayers.find(p => p.playerId === 2)?.name || t('player', { id: 2 }) : (gameMode === 'ai' ? t('aiOpponent') : player2Name);

  useEffect(() => {
    if (gameMode === 'ai' && localGameState?.currentPlayerId === 2 && !localGameState?.winner && !isAILoading) {
      const makeAIMove = async () => {
        if(!localGameState) return; 
        const clonedState = structuredClone(localGameState);
        const aiAction = await calculateBestMove(clonedState);
        
        if (aiAction && localGameState) { 
          let nextState: GameState | null = null;
          if (aiAction.type === 'place' && aiAction.squareIndex !== undefined) {
            nextState = placePawnLogic(localGameState, aiAction.squareIndex);
          } else if (aiAction.type === 'move' && aiAction.fromIndex !== undefined && aiAction.toIndex !== undefined) {
            nextState = movePawnLogic(localGameState, aiAction.fromIndex, aiAction.toIndex);
          }
          if (nextState) setLocalGameState(nextState);
          else console.error("AI made an invalid or null move:", aiAction);
        }
      };
      const timeoutId = setTimeout(makeAIMove, 700); 
      return () => clearTimeout(timeoutId);
    }
  }, [gameMode, localGameState, calculateBestMove, isAILoading, aiDifficulty]);

  useEffect(() => {
    if (gameConnectionError) {
      toast({ title: t('errorTitle'), description: gameConnectionError, variant: "destructive" });
      clearRemoteError?.();
    }
    if (aiError) {
      toast({ title: t('aiErrorTitle'), description: aiError, variant: "destructive" });
    }
  }, [gameConnectionError, aiError, toast, t, clearRemoteError]);

  useEffect(() => {
    if (activeGameState?.winner) {
      const winnerInfo = activeGameState.winner === 1 ? p1DisplayName : p2DisplayName;
      toast({ title: t('playerDynamicWins', { playerName: winnerInfo }), description: t('congratulations'), duration: 8000 });
    }
  }, [activeGameState?.winner, p1DisplayName, p2DisplayName, toast, t]);

  const handleLocalSquareClick = useCallback((index: number) => {
    if (!localGameState || localGameState.winner) return;
    if (gameMode === 'ai' && localGameState.currentPlayerId === 2 && isAILoading) return;

    const square = localGameState.board[index];
    let newState: GameState | null = null;

    if (localGameState.gamePhase === 'placement') {
      newState = placePawnLogic(localGameState, index);
      if (!newState) toast({ title: t('invalidPlacement'), description: t('invalidPlacementDescription'), variant: "destructive" });
    } else { 
      if (localGameState.selectedPawnIndex === null) {
        if (square.pawn && square.pawn.playerId === localGameState.currentPlayerId && !localGameState.blockedPawnsInfo.has(index)) {
          newState = selectPawn(localGameState, index); // Use selectPawn
        } else if (square.pawn && localGameState.blockedPawnsInfo.has(index)) {
          toast({ title: t('pawnBlocked'), description: t('pawnBlockedDescription'), variant: "destructive" });
        }
      } else {
        if (localGameState.selectedPawnIndex === index) {
          newState = clearSelection(localGameState); // Use clearSelection
        } else if (square.highlight === 'validMove') {
          newState = movePawnLogic(localGameState, localGameState.selectedPawnIndex, index);
        } else if (square.pawn && square.pawn.playerId === localGameState.currentPlayerId && !localGameState.blockedPawnsInfo.has(index)){
          newState = selectPawn(localGameState, index); // Use selectPawn
        } else {
          newState = clearSelection(localGameState); // Use clearSelection
        }
      }
    }
    if (newState) setLocalGameState(newState);
  }, [localGameState, gameMode, isAILoading, toast, t]);

  const handleRemoteSquareClick = useCallback((index: number) => {
    if (!remoteSocketGameState || !remoteLocalPlayerId || remoteSocketGameState.winner || !connectedGameId) return;
    if (remoteSocketGameState.currentPlayerId !== remoteLocalPlayerId) {
      toast({ title: t('notYourTurnTitle'), description: t('notYourTurnDescription') });
      return;
    }
    
    const square = remoteSocketGameState.board[index];
    if (remoteSocketGameState.gamePhase === 'placement') {
      remotePlacePawn(index);
    } else { 
      if (remoteSocketGameState.selectedPawnIndex === null) { 
        if (square.pawn && square.pawn.playerId === remoteLocalPlayerId && !remoteSocketGameState.blockedPawnsInfo.has(index)) {
          const tempState = selectPawn(remoteSocketGameState, index); // Use selectPawn
          useGameStore.getState().setGameState(tempState); 
        } else if (square.pawn && remoteSocketGameState.blockedPawnsInfo.has(index)) {
          toast({ title: t('pawnBlocked'), description: t('pawnBlockedDescription'), variant: "destructive" });
        }
      } else { 
        if (remoteSocketGameState.selectedPawnIndex === index) { 
            const tempState = clearSelection(remoteSocketGameState); // Use clearSelection
            useGameStore.getState().setGameState(tempState);
        } else if (square.highlight === 'validMove') {
            remoteMovePawn(remoteSocketGameState.selectedPawnIndex, index);
        } else if (square.pawn && square.pawn.playerId === remoteLocalPlayerId && !remoteSocketGameState.blockedPawnsInfo.has(index)) {
           const tempState = selectPawn(remoteSocketGameState, index); // Use selectPawn
           useGameStore.getState().setGameState(tempState);
        } else {
           const tempState = clearSelection(remoteSocketGameState); // Use clearSelection
           useGameStore.getState().setGameState(tempState);
        }
      }
    }
  }, [remoteSocketGameState, remoteLocalPlayerId, connectedGameId, remotePlacePawn, remoteMovePawn, toast, t]);

  const handleSquareClick = gameMode === 'remote' ? handleRemoteSquareClick : handleLocalSquareClick;
  
  const resetGameHandler = useCallback(() => {
    if (gameMode === 'remote') {
      toast({ title: t('gameReset'), description: t('featureNotAvailableRemote') });
    } else {
      setLocalGameState(createInitialGameState(PAWNS_PER_PLAYER));
      toast({ title: t('gameReset'), description: t('gameResetDescription') });
    }
  }, [gameMode, toast, t]);

  const handlePawnDragStart = useCallback((pawnIndex: number) => {
    if (!activeGameState || !activeLocalPlayerId || activeGameState.winner) return;
    if (gameMode === 'remote' && activeGameState.currentPlayerId !== remoteLocalPlayerId) return;
    if ((gameMode === 'local' || gameMode === 'ai') && activeGameState.currentPlayerId !== activeLocalPlayerId) return;

    if (activeGameState.gamePhase !== 'movement' || activeGameState.blockedPawnsInfo.has(pawnIndex)) return;
    
    const highlightedState = selectPawn(activeGameState, pawnIndex); // Use selectPawn
    if (gameMode === 'remote' && remoteSocketGameState) useGameStore.getState().setGameState(highlightedState);
    else if (localGameState) setLocalGameState(highlightedState);
  }, [activeGameState, activeLocalPlayerId, remoteLocalPlayerId, gameMode, localGameState, remoteSocketGameState]);

  const handlePawnDrop = useCallback((targetIndex: number) => {
    if (!activeGameState || activeGameState.selectedPawnIndex === null) {
      if(activeGameState) {
        const clearedState = clearSelection(activeGameState); // Use clearSelection
        if (gameMode === 'remote' && remoteSocketGameState) useGameStore.getState().setGameState(clearedState);
        else if (localGameState) setLocalGameState(clearedState);
      }
      return;
    }

    const targetSquare = activeGameState.board[targetIndex];
    if (targetSquare.highlight === 'validMove') {
        if (gameMode === 'remote') {
            remoteMovePawn(activeGameState.selectedPawnIndex, targetIndex);
        } else if (localGameState) {
            const newState = movePawnLogic(localGameState, activeGameState.selectedPawnIndex, targetIndex);
            if (newState) setLocalGameState(newState);
        }
    } else {
        toast({ title: t('invalidDrop'), description: t('invalidDropDescription'), variant: "destructive" });
        const clearedState = clearSelection(activeGameState);  // Use clearSelection
        if (gameMode === 'remote' && remoteSocketGameState) useGameStore.getState().setGameState(clearedState);
        else if (localGameState) setLocalGameState(clearedState);
    }
  }, [activeGameState, gameMode, remoteMovePawn, toast, t, localGameState, remoteSocketGameState]);

  const handleStartGameMode = (mode: GameMode) => {
    resetGameHandler(); 
    if (mode === 'remote') {
        if (!remotePlayerNameInput.trim()) {
            toast({ title: t('errorTitle'), description: t('playerNameRequired'), variant: "destructive"});
            return;
        }
        if (typeof window !== 'undefined') localStorage.setItem('playerName', remotePlayerNameInput.trim());
        
        connectSocketIO().then(() => {
           if(remoteGameIdInput.trim()){ 
              joinRemoteGame(remoteGameIdInput.trim(), remotePlayerNameInput.trim());
           } else { 
              createRemoteGame(remotePlayerNameInput.trim());
           }
        }).catch(err => toast({ title: t('errorTitle'), description: t('connectionFailed'), variant: "destructive" }));
    }
    setGameMode(mode);
  };
  
  useEffect(() => {
    if(gameMode === 'remote' && connectedGameId && !pathParams?.gameId) {
        router.push(`/game/${connectedGameId}?playerName=${encodeURIComponent(remotePlayerNameInput)}`);
    }
  }, [gameMode, connectedGameId, remotePlayerNameInput, router, pathParams]);

  const goBackToMenu = () => {
    if (gameMode === 'remote' && isConnected) {
      disconnectSocketIO();
    }
    setGameMode('select');
    setLocalGameState(createInitialGameState(PAWNS_PER_PLAYER)); // Reset local state when going back
    router.push('/'); 
  };


  if (gameMode === 'select') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4 sm:p-6 md:p-8">
        <Card className="w-full max-w-lg shadow-2xl bg-card rounded-xl overflow-hidden">
          <CardHeader className="text-center p-6 sm:p-8 bg-primary/10">
            <CardTitle className="text-3xl sm:text-4xl font-bold text-primary tracking-tight">{t('diagonalDomination')}</CardTitle>
            <CardDescription className="text-muted-foreground text-sm sm:text-base">{t('chooseHowToPlay')}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-6">
            <Tabs defaultValue="local" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-lg">
                <TabsTrigger value="local" className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md py-2.5 text-sm font-medium"><Users className="mr-2 h-5 w-5 inline-block"/>{t('localTwoPlayer')}</TabsTrigger>
                <TabsTrigger value="ai" className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md py-2.5 text-sm font-medium"><Bot className="mr-2 h-5 w-5 inline-block"/>{t('playVsAI')}</TabsTrigger>
                <TabsTrigger value="remote" className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md py-2.5 text-sm font-medium"><Wifi className="mr-2 h-5 w-5 inline-block"/>{t('gameModeRemote')}</TabsTrigger>
              </TabsList>
              <TabsContent value="local" className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="player1NameLocal" className="text-foreground/80">{t('player1Name')}</Label>
                  <Input id="player1NameLocal" value={player1Name} onChange={(e) => setPlayer1Name(e.target.value)} placeholder={t('player1Name')} className="bg-input focus:ring-primary"/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="player2NameLocal" className="text-foreground/80">{t('player2Name')}</Label>
                  <Input id="player2NameLocal" value={player2Name} onChange={(e) => setPlayer2Name(e.target.value)} placeholder={t('player2Name')} className="bg-input focus:ring-primary"/>
                </div>
                <Button onClick={() => handleStartGameMode('local')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base font-semibold rounded-lg shadow-md transition-transform hover:scale-105">
                  <Users className="mr-2 h-5 w-5"/> {t('startGame')}
                </Button>
              </TabsContent>
              <TabsContent value="ai" className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="playerNameAI" className="text-foreground/80">{t('yourName')}</Label>
                  <Input id="playerNameAI" value={player1Name} onChange={(e) => setPlayer1Name(e.target.value)} placeholder={t('enterYourName')} className="bg-input focus:ring-primary"/>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/80">{t('aiDifficulty')}</Label>
                  <RadioGroup value={aiDifficulty} onValueChange={(v: string) => setAiDifficulty(v as AIDifficulty)} className="flex space-x-2 sm:space-x-4 justify-around p-2 bg-muted rounded-lg">
                    {(['easy', 'medium', 'hard'] as AIDifficulty[]).map(d => (
                      <Label key={d} htmlFor={`diff-${d}`} className="flex items-center space-x-2 p-2 px-3 rounded-md hover:bg-accent cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground transition-colors">
                        <RadioGroupItem value={d} id={`diff-${d}`} className="border-foreground data-[state=checked]:border-primary-foreground"/>
                        <span className="capitalize text-sm">{t(d)}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
                <Button onClick={() => handleStartGameMode('ai')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base font-semibold rounded-lg shadow-md transition-transform hover:scale-105">
                  <Bot className="mr-2 h-5 w-5"/> {t('startGame')}
                </Button>
              </TabsContent>
              <TabsContent value="remote" className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="playerNameRemote" className="text-foreground/80">{t('yourName')}</Label>
                  <Input id="playerNameRemote" value={remotePlayerNameInput} onChange={(e) => setRemotePlayerNameInput(e.target.value)} placeholder={t('enterYourName')} className="bg-input focus:ring-primary"/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gameIdInput" className="text-foreground/80">{t('gameIdLabel')}</Label>
                  <div className="flex gap-2">
                    <Input id="gameIdInput" value={remoteGameIdInput} onChange={(e) => setRemoteGameIdInput(e.target.value)} placeholder={t('enterGameIdToJoinOrCreate')} className="bg-input focus:ring-primary"/>
                    <Button onClick={() => navigator.clipboard.writeText(remoteGameIdInput).then(()=>toast({title: t("linkCopiedTitle")}))} variant="outline" size="icon" disabled={!remoteGameIdInput} className="border-border hover:bg-accent"><Copy className="h-5 w-5"/></Button>
                  </div>
                </div>
                <Button onClick={() => handleStartGameMode('remote')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base font-semibold rounded-lg shadow-md transition-transform hover:scale-105" disabled={isConnecting || !remotePlayerNameInput.trim()}>
                  {isConnecting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> {t('connectingToServer')}</> : (remoteGameIdInput.trim() ? <><LinkIcon className="mr-2 h-5 w-5"/> {t('joinGameButton')}</> :  <><Wifi className="mr-2 h-5 w-5"/>{t('createGameButton')}</>)}
                </Button>
                 {gameConnectionError && <p className="text-xs text-destructive text-center pt-2">{gameConnectionError}</p>}
              </TabsContent>
            </Tabs>
          </CardContent>
           <CardFooter className="p-6 pt-0 text-center">
             <p className="text-xs text-muted-foreground">{t('selectLanguageInfo')}</p>
           </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (gameMode === 'remote' && !isConnected && !gameConnectionError && !isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <span>{t('connectingToServer')}...</span>
        <Button onClick={connectSocketIO} className="mt-4" variant="outline">
          <RefreshCw className="mr-2 h-4 w-4"/> {t('retryConnection')}
        </Button>
      </div>
    );
  }
  if (gameMode === 'remote' && isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4"/>
        <span>{t('connectingToServer')}...</span>
      </div>
    );
  }
  if (gameMode === 'remote' && isWaitingForOpponent && connectedGameId) {
    return <WaitingRoom gameId={connectedGameId} playerName={remotePlayerNameInput || ''} />;
  }
  if (!activeGameState) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-lg text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4"/>
        <span>{t('loadingGame')}...</span>
      </div>
    );
  }

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary text-foreground p-2 sm:p-4 selection:bg-primary selection:text-primary-foreground">
         <Button variant="ghost" onClick={goBackToMenu} className="absolute top-4 left-4 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground px-3 py-1.5 rounded-md z-10">
            <Home className="mr-2 h-4 w-4"/> {t('backToMenu')}
        </Button>
        <div className="w-full max-w-7xl mx-auto">
          <header className="mb-4 sm:mb-6 text-center pt-12 sm:pt-0"> {/* Added padding-top for small screens */}
            <h1 className="text-4xl sm:text-5xl font-bold text-primary tracking-tight">
              {t('diagonalDomination')}
            </h1>
            {gameMode === 'remote' && connectedGameId && 
              <div className="flex items-center justify-center gap-2 mt-2">
                <p className="text-sm text-muted-foreground">{t('gameRoomID')}: <span className="font-semibold text-foreground">{connectedGameId}</span></p>
                <Button variant="outline" size="sm" className="border-border hover:bg-accent h-8 px-2.5" onClick={() => {
                    if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/game/${connectedGameId}`)
                            .then(()=>toast({title: t('linkCopiedTitle'), description: t('linkCopiedDescription')}));
                    }
                }}>
                    <LinkIcon className="mr-1.5 h-3.5 w-3.5"/> {t('copyGameLink')}
                </Button>
              </div>
            }
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
                pawnsPerPlayer={PAWNS_PER_PLAYER} 
                isGameActive={!activeGameState.winner}
                currentLanguage={currentLanguage}
                onSetLanguage={setLanguage}
              />
              <PlayerCard
                playerId={1}
                playerName={p1DisplayName}
                isLocalPlayer={gameMode === 'remote' ? remoteLocalPlayerId === 1 : true}
                gameState={activeGameState}
              />
              <PlayerCard
                playerId={2}
                playerName={p2DisplayName}
                isLocalPlayer={gameMode === 'remote' ? remoteLocalPlayerId === 2 : (gameMode === 'local' ? true : false)}
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
              {gameMode === 'ai' && isAILoading && 
                <div className="mt-3 flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  {t('AIsTurn')}
                </div>
              }
            </div>

            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6 order-3">
               <HistoryCard gameState={activeGameState} />
            </div>
          </div>
        </div>
      </main>
      <Toaster />
      
      <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
        <RulesDialog pawnsPerPlayer={PAWNS_PER_PLAYER}/>
      </Dialog>

      {activeGameState.winner && (
        <WinnerDialog 
            winner={activeGameState.winner}
            winnerName={activeGameState.winner === 1 ? p1DisplayName : p2DisplayName}
            isOpen={!!activeGameState.winner} 
            onOpenChange={(open) => { if (!open && activeGameState.winner) resetGameHandler(); }} 
            onPlayAgain={resetGameHandler}
        />
      )}
    </>
  );
}
    


    