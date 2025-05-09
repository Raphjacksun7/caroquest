
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameConnection } from '@/hooks/useGameConnection';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Users, Bot, Wifi, Swords, Link as LinkIcon } from 'lucide-react';

type GameMode = 'ai' | 'local' | 'remote';

export default function HomePage() {
  const router = useRouter();
  const { createGame, joinGame, error: gameConnectionError, gameId: connectedGameId, localPlayerId, clearError, isConnected } = useGameConnection();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [playerName1, setPlayerName1] = useState('');
  const [playerName2, setPlayerName2] = useState(''); // For local multiplayer
  const [remoteGameId, setRemoteGameId] = useState('');
  const [isCreatingOrJoining, setIsCreatingOrJoining] = useState(false);
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);

  useEffect(() => {
    // Persist player name
    const storedPlayerName = localStorage.getItem('playerName');
    if (storedPlayerName) {
      setPlayerName1(storedPlayerName);
    }
  }, []);

  useEffect(() => {
    if (gameConnectionError) {
      toast({
        title: t('errorTitle'),
        description: gameConnectionError,
        variant: "destructive",
      });
      setIsCreatingOrJoining(false);
      clearError();
    }
  }, [gameConnectionError, toast, t, clearError]);

  useEffect(() => {
    if (connectedGameId && localPlayerId) { // Successfully created/joined remote game
      setIsCreatingOrJoining(false);
      router.push(`/game/${connectedGameId}`);
    }
  }, [connectedGameId, localPlayerId, router]);


  const handleStartGame = () => {
    if (!playerName1.trim()) {
      toast({ title: t('errorTitle'), description: t('playerNameRequired'), variant: "destructive" });
      return;
    }
    localStorage.setItem('playerName', playerName1.trim());

    if (gameMode === 'ai') {
      router.push(`/game/ai?playerName=${encodeURIComponent(playerName1.trim())}`);
    } else if (gameMode === 'local') {
      if (!playerName2.trim()) {
        toast({ title: t('errorTitle'), description: t('player2NameRequired'), variant: "destructive" });
        return;
      }
      localStorage.setItem('player2Name', playerName2.trim());
      router.push(`/game/local?player1=${encodeURIComponent(playerName1.trim())}&player2=${encodeURIComponent(playerName2.trim())}`);
    }
  };

  const handleCreateRemoteGame = () => {
    if (!playerName1.trim()) {
      toast({ title: t('errorTitle'), description: t('playerNameRequired'), variant: "destructive" });
      return;
    }
    localStorage.setItem('playerName', playerName1.trim());
    setIsCreatingOrJoining(true);
    // Options like isPublic can be passed here if needed later
    createGame(playerName1.trim(), { gameIdToCreate: remoteGameId || undefined }); 
    // The useEffect for connectedGameId will handle navigation
    if (remoteGameId) setCreatedGameId(remoteGameId.toUpperCase());
    else setCreatedGameId("...generating..."); // Placeholder until server responds
  };
  
  // Update createdGameId when connectedGameId from the hook changes
  useEffect(() => {
    if (connectedGameId && isCreatingOrJoining && gameMode === 'remote') {
         // This means a game was successfully created by this client
        if(createdGameId === "...generating..." || createdGameId !== connectedGameId) {
            setCreatedGameId(connectedGameId);
        }
    }
  }, [connectedGameId, isCreatingOrJoining, gameMode, createdGameId]);


  const handleJoinRemoteGame = () => {
    if (!playerName1.trim()) {
      toast({ title: t('errorTitle'), description: t('playerNameRequired'), variant: "destructive" });
      return;
    }
    if (!remoteGameId.trim()) {
      toast({ title: t('errorTitle'), description: t('gameIdRequired'), variant: "destructive" });
      return;
    }
    localStorage.setItem('playerName', playerName1.trim());
    setIsCreatingOrJoining(true);
    joinGame(remoteGameId.trim().toUpperCase(), playerName1.trim());
    // The useEffect for connectedGameId will handle navigation
  };
  
  const generateRandomGameId = () => {
    setRemoteGameId(Math.random().toString(36).substring(2, 8).toUpperCase());
  };

  const copyGameLink = () => {
    if (!createdGameId) return;
    const link = `${window.location.origin}/?joinGameId=${createdGameId}`; // Or direct to /game/[id] if preferred
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: t('linkCopiedTitle'), description: t('linkCopiedDescription') });
    }).catch(err => {
      toast({ title: t('errorTitle'), description: t('failedToCopyLink'), variant: "destructive" });
    });
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('joinGameId');
    if (gameIdFromUrl) {
      setRemoteGameId(gameIdFromUrl);
      setGameMode('remote');
      // Optionally auto-focus the join button or player name field
    }
  }, []);


  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 selection:bg-[hsl(var(--primary))] selection:text-[hsl(var(--primary-foreground))]">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-[hsl(var(--primary))] tracking-tight">
          {t('diagonalDomination')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('pageDescription')}</p>
      </header>

      {!isConnected && gameMode === 'remote' && (
         <div className="flex flex-col items-center gap-2 my-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(var(--primary))]"></div>
          <p className="text-muted-foreground">{t('connectingToServer')}</p>
        </div>
      )}

      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">{t('selectGameMode')}</CardTitle>
          <CardDescription>{t('chooseHowToPlay')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup defaultValue="ai" value={gameMode} onValueChange={(value) => {setGameMode(value as GameMode); setCreatedGameId(null);}}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ai" id="mode-ai" />
              <Label htmlFor="mode-ai" className="flex items-center gap-2 cursor-pointer"><Bot /> {t('playVsAI')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="local" id="mode-local" />
              <Label htmlFor="mode-local" className="flex items-center gap-2 cursor-pointer"><Users /> {t('localTwoPlayer')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="remote" id="mode-remote" />
              <Label htmlFor="mode-remote" className="flex items-center gap-2 cursor-pointer"><Wifi /> {t('remoteMultiplayer')}</Label>
            </div>
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="playerName1">{gameMode === 'local' ? t('player1Name') : t('yourName')}</Label>
            <Input
              id="playerName1"
              value={playerName1}
              onChange={(e) => setPlayerName1(e.target.value)}
              placeholder={t('enterYourName')}
              maxLength={20}
            />
          </div>

          {gameMode === 'local' && (
            <div className="space-y-2">
              <Label htmlFor="playerName2">{t('player2Name')}</Label>
              <Input
                id="playerName2"
                value={playerName2}
                onChange={(e) => setPlayerName2(e.target.value)}
                placeholder={t('enterPlayer2Name')}
                maxLength={20}
              />
            </div>
          )}

          {gameMode === 'remote' && (
            <div className="space-y-4 pt-2 border-t">
                <Label htmlFor="gameIdInput">{t('gameIdLabel')}</Label>
                <div className="flex gap-2">
                    <Input
                    id="gameIdInput"
                    value={remoteGameId}
                    onChange={(e) => setRemoteGameId(e.target.value.toUpperCase())}
                    placeholder={t('enterGameIdToJoinOrCreate')}
                    maxLength={10}
                    />
                    <Button variant="outline" onClick={generateRandomGameId} className="whitespace-nowrap">{t('generateId')}</Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('gameIdHintRemote')}</p>
                 <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={handleCreateRemoteGame} className="flex-1" disabled={!playerName1.trim() || isCreatingOrJoining || !isConnected}>
                        <Swords className="mr-2 h-4 w-4" /> {isCreatingOrJoining && !connectedGameId ? t('creatingGame') : t('createGameButton')}
                    </Button>
                    <Button onClick={handleJoinRemoteGame} className="flex-1" variant="secondary" disabled={!playerName1.trim() || !remoteGameId.trim() || isCreatingOrJoining || !isConnected}>
                        <LinkIcon className="mr-2 h-4 w-4" /> {isCreatingOrJoining && connectedGameId ? t('joiningGame') : t('joinGameButton')}
                    </Button>
                </div>
                {createdGameId && (
                    <div className="p-3 bg-muted rounded-md text-center">
                        <p className="text-sm">{t('gameCreatedShareId')}</p>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <strong className="text-lg font-mono tracking-wider">{createdGameId}</strong>
                            <Button variant="ghost" size="icon" onClick={copyGameLink} aria-label={t('copyGameLink')}>
                                <LinkIcon className="h-4 w-4"/>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
          )}

          {(gameMode === 'ai' || gameMode === 'local') && (
            <Button onClick={handleStartGame} className="w-full mt-4" disabled={isCreatingOrJoining}>
              <Swords className="mr-2 h-4 w-4" /> {t('startGame')}
            </Button>
          )}
        </CardContent>
      </Card>
      <Toaster />
    </main>
  );
}

// New/Updated Translation Keys:
// "selectGameMode": "Select Game Mode"
// "chooseHowToPlay": "Choose how you want to play"
// "playVsAI": "Play vs AI"
// "localTwoPlayer": "Local Two-Player"
// "remoteMultiplayer": "Remote Multiplayer"
// "yourName": "Your Name"
// "enterYourName": "Enter your name"
// "player1Name": "Player 1 Name"
// "player2Name": "Player 2 Name"
// "enterPlayer2Name": "Enter Player 2's name"
// "player2NameRequired": "Player 2 name is required for local multiplayer."
// "enterGameIdToJoinOrCreate": "Enter Game ID (or leave blank to generate)"
// "gameIdHintRemote": "Enter an ID to join, or create a new one. Share it with your friend."
// "creatingGame": "Creating Game..."
// "startGame": "Start Game"
// "gameCreatedShareId": "Game created! Share this ID or link with your friend:"
// "copyGameLink": "Copy Game Link"
// "failedToCopyLink": "Failed to copy game link."
// "connectingToServer": "Connecting to server..."
