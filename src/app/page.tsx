
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Use next/navigation for App Router
import { JoinGameForm } from '@/components/game/JoinGameForm';
import { useGameConnection } from '@/hooks/useGameConnection'; // Import the hook
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { Toaster } from '@/components/ui/toaster';

export default function HomePage() {
  const router = useRouter();
  const { createGame, joinGame, gameId, error } // Removed gameState, localPlayerId, players, isConnected as they are for an active game session
    = useGameConnection(); // Initialize the hook, but we'll primarily use create/join actions here
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  // Effect to navigate when gameId is set (meaning game created or joined successfully)
  React.useEffect(() => {
    if (gameId) {
      setIsLoading(false);
      router.push(`/game/${gameId}`);
    }
  }, [gameId, router]);

  // Effect to show errors from the game connection
  React.useEffect(() => {
    if (error) {
      toast({
        title: t('errorTitle'),
        description: error,
        variant: "destructive",
      });
      setIsLoading(false); 
    }
  }, [error, toast, t]);

  const handleCreateGame = (playerName: string, requestedGameId: string) => {
    if (!playerName.trim() || !requestedGameId.trim()) {
      toast({ title: t('errorTitle'), description: t('enterPlayerNameAndGameId'), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    createGame(playerName, requestedGameId);
    // Navigation will be handled by the useEffect watching `gameId`
  };

  const handleJoinGame = (playerName: string, gameIdToJoin: string) => {
    if (!playerName.trim() || !gameIdToJoin.trim()) {
      toast({ title: t('errorTitle'), description: t('enterPlayerNameAndGameId'), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    joinGame(playerName, gameIdToJoin);
    // Navigation will be handled by the useEffect watching `gameId`
  };

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
          <p className="text-muted-foreground">{t('connectingToServer')}</p>
        </div>
      ) : (
        <JoinGameForm onCreateGame={handleCreateGame} onJoinGame={handleJoinGame} />
      )}
      <Toaster />
    </main>
  );
}
