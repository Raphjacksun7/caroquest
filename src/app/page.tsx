
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { JoinGameForm } from '@/components/game/JoinGameForm';
import { useGameConnection } from '@/hooks/useGameConnection';
import { useToast } from '@/hooks/use-toast'; // Correct import for toast
import { useTranslation } from '@/hooks/useTranslation';
import { Toaster } from '@/components/ui/toaster'; // Correct import for Toaster
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';


export default function HomePage() {
  const router = useRouter();
  const { 
    createGame, 
    joinGame, 
    joinMatchmaking,
    leaveMatchmaking,
    gameId: connectedGameId, // Renamed from gameId to avoid conflict with local state gameId
    error: gameConnectionError, 
    clearError,
    isConnected,
    localPlayerId, // Useful to know if we are player 1 or 2 after joining/creating
  } = useGameConnection();
  
  const { toast } } from useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [playerName, setPlayerName] = useState(''); // Store player name locally

  // Effect to navigate when gameId is set (meaning game created or joined successfully)
  useEffect(() => {
    if (connectedGameId && localPlayerId) { // Ensure both gameId and playerId are set
      setIsLoading(false);
      setIsMatchmaking(false); // Stop matchmaking if a game starts
      router.push(`/game/${connectedGameId}`);
    }
  }, [connectedGameId, localPlayerId, router]);

  // Effect to show errors from the game connection
  useEffect(() => {
    if (gameConnectionError) {
      toast({
        title: t('errorTitle'),
        description: gameConnectionError,
        variant: "destructive",
      });
      setIsLoading(false); 
      setIsMatchmaking(false); // Stop matchmaking on error
      clearError(); // Clear error after showing
    }
  }, [gameConnectionError, toast, t, clearError]);

  const handleCreateGame = (pName: string, requestedGameId: string) => {
    if (!pName.trim()) {
      toast({ title: t('errorTitle'), description: t('playerNameRequired'), variant: "destructive" });
      return;
    }
    if (!requestedGameId.trim()) {
        toast({ title: t('errorTitle'), description: t('gameIdRequired'), variant: "destructive" });
        return;
    }
    setPlayerName(pName); // Store for potential use if needed across sessions/rejoins
    setIsLoading(true);
    createGame(pName, { isPublic: false }); // Example: create private game by default
  };

  const handleJoinGame = (pName: string, gameIdToJoin: string) => {
    if (!pName.trim() || !gameIdToJoin.trim()) {
      toast({ title: t('errorTitle'), description: t('enterPlayerNameAndGameId'), variant: "destructive" });
      return;
    }
    setPlayerName(pName);
    setIsLoading(true);
    joinGame(pName, gameIdToJoin);
  };

  const handleJoinMatchmaking = (pName: string) => {
    if(!pName.trim()){
        toast({ title: t('errorTitle'), description: t('playerNameRequired'), variant: "destructive" });
        return;
    }
    setPlayerName(pName);
    setIsLoading(true); // Or a specific matchmaking loading state
    setIsMatchmaking(true);
    joinMatchmaking(pName); // Optional: add rating e.g., joinMatchmaking(pName, 1200)
  };

  const handleCancelMatchmaking = () => {
    leaveMatchmaking();
    setIsMatchmaking(false);
    setIsLoading(false);
  }

  if (!isConnected && !gameConnectionError) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(var(--primary))]"></div>
        <p className="text-muted-foreground mt-2">{t('connectingToServer')}</p>
        <Toaster />
      </main>
    );
  }
  
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-[hsl(var(--primary))]">
          {t('diagonalDomination')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('pageDescription')}</p>
      </header>
      
      {isLoading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(var(--primary))]"></div>
          <p className="text-muted-foreground">
            {isMatchmaking ? t('searchingForOpponent') : t('connectingToServer')}
          </p>
          {isMatchmaking && (
            <Button variant="outline" onClick={handleCancelMatchmaking} className="mt-4">
              {t('cancelMatchmaking')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <JoinGameForm 
            onCreateGame={handleCreateGame} 
            onJoinGame={handleJoinGame} 
            onJoinMatchmaking={handleJoinMatchmaking}
          />
          {/* Display a message if connection failed but isConnected is false */}
          {gameConnectionError && !isConnected && (
            <Card className="mt-4 w-full max-w-md border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">{t('connectionFailed')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{gameConnectionError}</p>
                <Button onClick={() => window.location.reload()} className="mt-2">
                  {t('retryConnection')}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
      <Toaster />
    </main>
  );
}

// Add these new translation keys to en.json and fr.json
// "playerNameRequired": "Player name is required."
// "gameIdRequired": "Game ID is required."
// "searchingForOpponent": "Searching for an opponent..."
// "cancelMatchmaking": "Cancel Matchmaking"
// "connectionFailed": "Connection Failed"
// "retryConnection": "Retry Connection"
