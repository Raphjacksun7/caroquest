
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { JoinGameForm } from '@/components/game/JoinGameForm';
import { useGameConnection, useGameStore } from '@/hooks/useGameConnection'; // Import Zustand store
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } } from '@/components/ui/card';


export default function HomePage() {
  const router = useRouter();
  const { 
    createGame, 
    joinGame, 
    joinMatchmaking,
    leaveMatchmaking,
    clearError,
  } = useGameConnection(); // Actions from the hook

  // Subscribe to Zustand store for reactive state
  const { 
    gameId: connectedGameId, 
    localPlayerId, 
    error: gameConnectionError, 
    isConnected 
  } = useGameStore();

  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  // Player name could be stored in Zustand or local state for forms
  // For simplicity, JoinGameForm will handle its own internal name state.

  useEffect(() => {
    if (connectedGameId && localPlayerId) {
      setIsLoading(false);
      setIsMatchmaking(false);
      router.push(`/game/${connectedGameId}`);
    }
  }, [connectedGameId, localPlayerId, router]);

  useEffect(() => {
    if (gameConnectionError) {
      toast({
        title: t('errorTitle'),
        description: gameConnectionError,
        variant: "destructive",
      });
      setIsLoading(false); 
      setIsMatchmaking(false);
      clearError(); 
    }
  }, [gameConnectionError, toast, t, clearError]);

  const handleCreateGame = (pName: string, requestedGameId: string) => {
    if (!pName.trim()) {
      toast({ title: t('errorTitle'), description: t('playerNameRequired'), variant: "destructive" });
      return;
    }
     if (!requestedGameId.trim()) { // Assuming createGame might take gameId for private games
        toast({ title: t('errorTitle'), description: t('gameIdRequired'), variant: "destructive" });
        return;
    }
    setIsLoading(true);
    // options like isPublic can be passed here
    createGame(pName, { isPublic: false, gameIdToCreate: requestedGameId }); 
  };

  const handleJoinGame = (pName: string, gameIdToJoin: string) => {
    if (!pName.trim() || !gameIdToJoin.trim()) {
      toast({ title: t('errorTitle'), description: t('enterPlayerNameAndGameId'), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    joinGame(gameIdToJoin, pName);
  };

  const handleJoinMatchmaking = (pName: string) => {
    if(!pName.trim()){
        toast({ title: t('errorTitle'), description: t('playerNameRequired'), variant: "destructive" });
        return;
    }
    setIsLoading(true);
    setIsMatchmaking(true);
    joinMatchmaking(pName); 
  };

  const handleCancelMatchmaking = () => {
    leaveMatchmaking();
    setIsMatchmaking(false);
    setIsLoading(false);
  }

  if (!isConnected && !gameConnectionError && typeof window !== 'undefined') { // Check for window to avoid SSR issues with initial connection
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
