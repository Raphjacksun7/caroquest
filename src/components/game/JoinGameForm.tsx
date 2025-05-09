
"use client";
import type { ReactNode } from 'react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';
import { Users, LogIn, PlusCircle } from 'lucide-react';

interface JoinGameFormProps {
  onCreateGame: (playerName: string, gameId: string) => void;
  onJoinGame: (playerName: string, gameId: string) => void;
  onJoinMatchmaking: (playerName: string) => void;
}

export const JoinGameForm: React.FC<JoinGameFormProps> = ({ onCreateGame, onJoinGame, onJoinMatchmaking }) => {
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');
  const { t } = useTranslation();

  const handleCreate = () => {
    if (playerName.trim() && gameId.trim()) {
      onCreateGame(playerName.trim(), gameId.trim());
    } else {
      // Toast will be handled by parent page based on error state or explicit messages
      if (!playerName.trim()) alert(t('playerNameRequired'));
      else if (!gameId.trim()) alert(t('gameIdRequired'));
    }
  };

  const handleJoin = () => {
    if (playerName.trim() && gameId.trim()) {
      onJoinGame(playerName.trim(), gameId.trim());
    } else {
      if (!playerName.trim()) alert(t('playerNameRequired'));
      else if (!gameId.trim()) alert(t('gameIdRequired'));
    }
  };
  
  const handleMatchmaking = () => {
    if (playerName.trim()) {
        onJoinMatchmaking(playerName.trim());
    } else {
        alert(t('playerNameRequired'));
    }
  };

  const generateRandomGameId = () => {
    setGameId(Math.random().toString(36).substring(2, 8).toUpperCase());
  };

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">{t('joinOrCreateGame')}</CardTitle>
        <CardDescription>{t('enterDetailsToPlay')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="playerName">{t('playerNameLabel')}</Label>
          <Input
            id="playerName"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder={t('playerNamePlaceholder')}
            maxLength={20}
            aria-required="true"
          />
        </div>
        <div className="space-y-4">
            <div>
                <Label htmlFor="gameId">{t('gameIdLabel')}</Label>
                <div className="flex gap-2">
                    <Input
                    id="gameId"
                    value={gameId}
                    onChange={(e) => setGameId(e.target.value.toUpperCase())}
                    placeholder={t('gameIdPlaceholder')}
                    maxLength={10}
                    />
                    <Button variant="outline" onClick={generateRandomGameId} className="whitespace-nowrap">{t('generateId')}</Button>
                </div>
                 <p className="text-xs text-muted-foreground mt-1">{t('gameIdHint')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button onClick={handleCreate} className="flex-1" disabled={!playerName.trim() || !gameId.trim()}>
                 <PlusCircle className="mr-2 h-4 w-4" /> {t('createGameButton')}
                </Button>
                <Button onClick={handleJoin} className="flex-1" variant="secondary" disabled={!playerName.trim() || !gameId.trim()}>
                  <LogIn className="mr-2 h-4 w-4" /> {t('joinGameButton')}
                </Button>
            </div>
        </div>
        <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                Or
                </span>
            </div>
        </div>
        <Button onClick={handleMatchmaking} className="w-full" variant="outline" disabled={!playerName.trim()}>
            <Users className="mr-2 h-4 w-4" /> {t('joinMatchmakingButton')}
        </Button>
      </CardContent>
    </Card>
  );
};

// Add new translation keys:
// "playerNameRequired": "Player name is required."
// "gameIdRequired": "Game ID is required."
// "joinMatchmakingButton": "Join Matchmaking"
