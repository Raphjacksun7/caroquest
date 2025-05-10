"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, PlayerId } from '@/lib/gameLogic';
import { 
  createInitialGameState, 
  placePawn, 
  movePawn, 
  highlightValidMoves, 
  clearHighlights as clearSelectionLogic,
  PAWNS_PER_PLAYER
} from '@/lib/gameLogic';
import type { AIAction } from '@/lib/ai/mcts';

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
import { useGameConnection, type PlayerInfo as RemotePlayerInfo, useGameStore } from '@/hooks/useGameConnection';
import { useAI } from '@/hooks/useAI';
import { WaitingRoom } from '@/components/game/WaitingRoom';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, Users, Wifi, Copy, LinkIcon, Home } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


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
  const [remotePlayerName, setRemotePlayerName] = useState(''); 
  const [remoteGameIdInput, setRemoteGameIdInput] = useState('');
  
  const {
    gameState: remoteSocketGameState,
    localPlayerId: remoteLocalPlayerId,
    players: remotePlayers,
    isConnected,
    error: gameConnectionError,
    gameId: connectedGameId,
    isWaitingForOpponent,
    createGame: createRemoteGame,
    joinGame: joinRemoteGame,
    placePawnAction: remotePlacePawn,
    movePawnAction: remoteMovePawn,
    clearError: clearRemoteError,
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
      if (nameFromQuery) {
        setRemotePlayerName(nameFromQuery);
        if(isConnected && !connectedGameId) joinRemoteGame(gameIdFromPath, nameFromQuery);
      } else {
        const storedName = typeof window !== 'undefined' ? localStorage.getItem('playerName') : null;
        if (storedName) {
            setRemotePlayerName(storedName);
            if(isConnected && !connectedGameId) joinRemoteGame(gameIdFromPath, storedName);
        }
      }
    }
  }, [pathParams, gameMode, searchParams, isConnected, connectedGameId, joinRemoteGame]);


  const activeGameState = gameMode === 'remote' ? remoteSocketGameState : localGameState;
  const activeLocalPlayerId = gameMode === 'remote' ? remoteLocalPlayerId : activeGameState?.currentPlayerId;
  
  const p1DisplayName = gameMode === 'remote' ? remotePlayers.find(p => p.playerId === 1)?.name || t('player', { id: 1 }) : player1Name;
  const p2DisplayName = gameMode === 'remote' ? remotePlayers.find(p => p.playerId === 2)?.name || t('player', { id: 2 }) : (gameMode === 'ai' ? t('aiOpponent') : player2Name);

  useEffect(() => {
    if (gameMode === 'ai' && localGameState?.currentPlayerId === 2 && !localGameState?.winner && !isAILoading) {
      const makeAIMove = async () => {
        if(!localGameState) return; // Ensure localGameState is not null
        const clonedState = structuredClone(localGameState);
        const aiAction = await calculateBestMove(clonedState);
        
        if (aiAction && localGameState) { // Re-check localGameState in case it became null
          let nextState: GameState | null = null;
          if (aiAction.type === 'place' && aiAction.squareIndex !== undefined) {
            nextState = placePawn(localGameState, aiAction.squareIndex);
          } else if (aiAction.type === 'move' && aiAction.fromIndex !== undefined && aiAction.toIndex !== undefined) {
            nextState = movePawn(localGameState, aiAction.fromIndex, aiAction.toIndex);
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
      newState = placePawn(localGameState, index);
      if (!newState) toast({ title: t('invalidPlacement'), description: t('invalidPlacementDescription'), variant: "destructive" });
    } else { 
      if (localGameState.selectedPawnIndex === null) {
        if (square.pawn && square.pawn.playerId === localGameState.currentPlayerId && !localGameState.blockedPawnsInfo.has(index)) {
          newState = highlightValidMoves(localGameState, index);
        } else if (square.pawn && localGameState.blockedPawnsInfo.has(index)) {
          toast({ title: t('pawnBlocked'), description: t('pawnBlockedDescription'), variant: "destructive" });
        }
      } else {
        if (localGameState.selectedPawnIndex === index) {
          newState = clearSelectionLogic(localGameState);
        } else if (square.highlight === 'validMove') {
          newState = movePawn(localGameState, localGameState.selectedPawnIndex, index);
        } else if (square.pawn && square.pawn.playerId === localGameState.currentPlayerId && !localGameState.blockedPawnsInfo.has(index)){
          newState = highlightValidMoves(localGameState, index);
        } else {
          newState = clearSelectionLogic(localGameState);
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
          const tempState = highlightValidMoves(remoteSocketGameState, index);
          useGameStore.getState().setGameState(tempState); 
        } else if (square.pawn && remoteSocketGameState.blockedPawnsInfo.has(index)) {
          toast({ title: t('pawnBlocked'), description: t('pawnBlockedDescription'), variant: "destructive" });
        }
      } else { 
        if (remoteSocketGameState.selectedPawnIndex === index) { 
            const tempState = clearSelectionLogic(remoteSocketGameState);
            useGameStore.getState().setGameState(tempState);
        } else if (square.highlight === 'validMove') {
            remoteMovePawn(remoteSocketGameState.selectedPawnIndex, index);
        } else if (square.pawn && square.pawn.playerId === remoteLocalPlayerId && !remoteSocketGameState.blockedPawnsInfo.has(index)) {
           const tempState = highlightValidMoves(remoteSocketGameState, index);
           useGameStore.getState().setGameState(tempState);
        } else {
           const tempState = clearSelectionLogic(remoteSocketGameState);
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
    
    const highlightedState = highlightValidMoves(activeGameState, pawnIndex);
    if (gameMode === 'remote' && remoteSocketGameState) useGameStore.getState().setGameState(highlightedState);
    else if (localGameState) setLocalGameState(highlightedState);
  }, [activeGameState, activeLocalPlayerId, remoteLocalPlayerId, gameMode, localGameState, remoteSocketGameState]);

  const handlePawnDrop = useCallback((targetIndex: number) => {
    if (!activeGameState || activeGameState.selectedPawnIndex === null) {
      if(activeGameState) {
        const clearedState = clearSelectionLogic(activeGameState);
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
            const newState = movePawn(localGameState, activeGameState.selectedPawnIndex, targetIndex);
            if (newState) setLocalGameState(newState);
        }
    } else {
        toast({ title: t('invalidDrop'), description: t('invalidDropDescription'), variant: "destructive" });
        const clearedState = clearSelectionLogic(activeGameState); 
        if (gameMode === 'remote' && remoteSocketGameState) useGameStore.getState().setGameState(clearedState);
        else if (localGameState) setLocalGameState(clearedState);
    }
  }, [activeGameState, gameMode, remoteMovePawn, toast, t, localGameState, remoteSocketGameState]);

  const handleStartGameMode = (mode: GameMode) => {
    resetGameHandler(); 
    if (mode === 'remote') {
        if (!remotePlayerName.trim()) {
            toast({ title: t('errorTitle'), description: t('playerNameRequired'), variant: "destructive"});
            return;
        }
        if (typeof window !== 'undefined') localStorage.setItem('playerName', remotePlayerName.trim());
        
        if(remoteGameIdInput.trim()){ 
            if (isConnected) joinRemoteGame(remoteGameIdInput.trim(), remotePlayerName.trim());
            else toast({title: t('errorTitle'), description: "Not connected to server.", variant: "destructive"});
        } else { 
            if (isConnected) createRemoteGame(remotePlayerName.trim());
            else toast({title: t('errorTitle'), description: "Not connected to server.", variant: "destructive"});
        }
    }
    setGameMode(mode);
  };
  
  useEffect(() => {
    if(gameMode === 'remote' && connectedGameId && !pathParams?.gameId) {
        router.push(`/game/${connectedGameId}?playerName=${encodeURIComponent(remotePlayerName)}`);
    }
  }, [gameMode, connectedGameId, remotePlayerName, router, pathParams]);

  if (gameMode === 'select') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl text-center text-primary">{t('diagonalDomination')}</CardTitle>
            <CardDescription className="text-center">{t('chooseHowToPlay')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="local" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="local"><Users className="mr-2 h-4 w-4"/>{t('localTwoPlayer')}</TabsTrigger>
                <TabsTrigger value="ai"><Bot className="mr-2 h-4 w-4"/>{t('playVsAI')}</TabsTrigger>
                <TabsTrigger value="remote"><Wifi className="mr-2 h-4 w-4"/>{t('gameModeRemote')}</TabsTrigger>
              </TabsList>
              <TabsContent value="local" className="pt-6 space-y-4">
                <Label htmlFor="player1NameLocal">{t('player1Name')}</Label>
                <Input id="player1NameLocal" value={player1Name} onChange={(e) => setPlayer1Name(e.target.value)} placeholder={t('player1Name')} />
                <Label htmlFor="player2NameLocal">{t('player2Name')}</Label>
                <Input id="player2NameLocal" value={player2Name} onChange={(e) => setPlayer2Name(e.target.value)} placeholder={t('player2Name')} />
                <Button onClick={() => handleStartGameMode('local')} className="w-full">{t('startGame')}</Button>
              </TabsContent>
              <TabsContent value="ai" className="pt-6 space-y-4">
                <Label htmlFor="playerNameAI">{t('yourName')}</Label>
                <Input id="playerNameAI" value={player1Name} onChange={(e) => setPlayer1Name(e.target.value)} placeholder={t('enterYourName')} />
                <Label>{t('aiDifficulty')}</Label>
                <RadioGroup value={aiDifficulty} onValueChange={(v: string) => setAiDifficulty(v as AIDifficulty)} className="flex space-x-4">
                  {(['easy', 'medium', 'hard'] as AIDifficulty[]).map(d => (
                    <div key={d} className="flex items-center space-x-2">
                      <RadioGroupItem value={d} id={`diff-${d}`} />
                      <Label htmlFor={`diff-${d}`} className="capitalize cursor-pointer">{t(d)}</Label>
                    </div>
                  ))}
                </RadioGroup>
                <Button onClick={() => handleStartGameMode('ai')} className="w-full">{t('startGame')}</Button>
              </TabsContent>
              <TabsContent value="remote" className="pt-6 space-y-4">
                <Label htmlFor="playerNameRemote">{t('yourName')}</Label>
                <Input id="playerNameRemote" value={remotePlayerName} onChange={(e) => setRemotePlayerName(e.target.value)} placeholder={t('enterYourName')} />
                <Label htmlFor="gameIdInput">{t('gameIdLabel')}</Label>
                <div className="flex gap-2">
                <Input id="gameIdInput" value={remoteGameIdInput} onChange={(e) => setRemoteGameIdInput(e.target.value)} placeholder={t('enterGameIdToJoinOrCreate')} />
                 <Button onClick={() => navigator.clipboard.writeText(remoteGameIdInput).then(()=>toast({title: "Game ID Copied!"}))} variant="outline" size="icon" disabled={!remoteGameIdInput}><Copy className="h-4 w-4"/></Button>
                </div>
                <Button onClick={() => handleStartGameMode('remote')} className="w-full" disabled={!isConnected || !remotePlayerName.trim()}>
                  {remoteGameIdInput.trim() ? t('joinGameButton') : t('createGameButton')}
                </Button>
                 {!isConnected && <p className="text-xs text-destructive text-center">{t('connectingToServer')}</p>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (gameMode === 'remote' && !isConnected && !gameConnectionError) {
    return <div className="flex items-center justify-center min-h-screen text-lg">{t('connectingToServer')}</div>;
  }
  if (gameMode === 'remote' && isWaitingForOpponent && connectedGameId) {
    return <WaitingRoom gameId={connectedGameId} playerName={remotePlayerName || ''} />;
  }
  if (!activeGameState) {
    return <div className="flex items-center justify-center min-h-screen text-lg">{t('loadingGame')}</div>;
  }

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-2 sm:p-4 selection:bg-primary selection:text-primary-foreground">
         <Button variant="ghost" onClick={() => setGameMode('select')} className="absolute top-4 left-4 text-sm">
            <Home className="mr-2 h-4 w-4"/> {t('backToMenu')}
        </Button>
        <div className="w-full max-w-7xl mx-auto">
          <header className="mb-4 sm:mb-6 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-primary tracking-tight">
              {t('diagonalDomination')}
            </h1>
            {gameMode === 'remote' && connectedGameId && 
              <div className="flex items-center justify-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground">{t('gameRoomID')}: {connectedGameId}</p>
                <Button variant="outline" size="sm" onClick={() => {
                    if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/game/${connectedGameId}`)
                            .then(()=>toast({title: t('linkCopiedTitle')}));
                    }
                }}>
                    <LinkIcon className="mr-1 h-3 w-3"/> {t('copyGameLink')}
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
            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
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

            <div className="flex flex-col items-center justify-center">
              <GameBoard
                gameState={activeGameState}
                onSquareClick={handleSquareClick}
                onPawnDragStart={handlePawnDragStart}
                onPawnDrop={handlePawnDrop}
              />
              {gameMode === 'ai' && isAILoading && <p className="mt-2 text-sm text-muted-foreground animate-pulse">{t('AIsTurn')}</p>}
            </div>

            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
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
    
