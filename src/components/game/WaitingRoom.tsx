"use client";
import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface WaitingRoomProps {
  gameId: string;
  playerName: string;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ gameId, playerName }) => {
  const { t } = useTranslation();
  
  // FIXED: Use /{gameId} format to match your route structure
  const gameLink = typeof window !== 'undefined' ? `${window.location.origin}/${gameId}` : '';

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(gameLink).then(() => {
      console.log('Shareable link copied to clipboard:', gameLink);
    }).catch(err => {
      console.error('Failed to copy link: ', err);
    });
  }, [gameLink]);

  const handleCopyGameId = useCallback(() => {
    navigator.clipboard.writeText(gameId).then(() => {
      console.log('Game ID copied to clipboard:', gameId);
    }).catch(err => {
      console.error('Failed to copy game ID: ', err);
    });
  }, [gameId]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-lg shadow-xl text-center">
        <CardHeader>
          <CardTitle className="text-2xl">{t('waitingForOpponentTitle')}</CardTitle>
          <CardDescription>{t('welcomePlayer', { playerName })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p>{t('shareGameIdOrLink')}</p>
          
          {/* Game ID Section with Copy Button */}
          <div className="space-y-2">
            <Label htmlFor="gameIdDisplay" className="text-sm font-medium">{t('gameIdLabel')}</Label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center justify-center p-3 bg-muted rounded-md">
                <span id="gameIdDisplay" className="text-2xl font-mono tracking-widest">{gameId}</span>
              </div>
              <Button onClick={handleCopyGameId} variant="outline" size="icon" aria-label="Copy Game ID">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Shareable Link Section */}
          <div className="space-y-2">
             <Label htmlFor="gameLinkDisplay" className="text-sm font-medium">{t('shareableLink')}</Label>
            <div className="flex gap-2">
              <Input 
                id="gameLinkDisplay" 
                value={gameLink} 
                readOnly 
                className="text-center font-mono text-sm"
              />
              <Button onClick={handleCopyLink} variant="outline" size="icon" aria-label={t('copyLink')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="animate-pulse text-muted-foreground">
            {t('waitingMessage')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};