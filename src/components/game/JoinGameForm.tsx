
"use client";
import type { ReactNode } from 'react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';

interface JoinGameFormProps {
  onCreateGame: (playerName: string, gameId: string) => void;
  onJoinGame: (playerName: string, gameId: string) => void;
}

export const JoinGameForm: React.FC<JoinGameFormProps> = ({ onCreateGame, onJoinGame }) => {
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');
  const { t } = useTranslation();

  const handleCreate = () => {
    if (playerName.trim() && gameId.trim()) {
      onCreateGame(playerName.trim(), gameId.trim());
    } else {
      alert(t('enterPlayerNameAndGameId'));
    }
  };

  const handleJoin = () => {
    if (playerName.trim() && gameId.trim()) {
      onJoinGame(playerName.trim(), gameId.trim());
    } else {
      alert(t('enterPlayerNameAndGameId'));
    }
  };
  
  const generateRandomGameId = () => {
    setGameId(Math.random().toString(36).substring(2, 8).toUpperCase());
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
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
            />
          </div>
          <div className="space-y-2">
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
            <p className="text-xs text-muted-foreground">{t('gameIdHint')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={handleCreate} className="flex-1" disabled={!playerName.trim() || !gameId.trim()}>
              {t('createGameButton')}
            </Button>
            <Button onClick={handleJoin} className="flex-1" variant="secondary" disabled={!playerName.trim() || !gameId.trim()}>
              {t('joinGameButton')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
