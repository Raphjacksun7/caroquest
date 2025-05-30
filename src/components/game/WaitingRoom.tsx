
"use client";
import type { ReactNode } from 'react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface WaitingRoomProps {
  gameId: string;
  playerName: string;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ gameId, playerName }) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const gameLink = typeof window !== 'undefined' ? `${window.location.origin}/?gameId=${gameId}` : '';


  const handleCopyLink = () => {
    navigator.clipboard.writeText(gameLink).then(() => {
      toast({ title: t('linkCopiedTitle'), description: t('linkCopiedDescription') });
    }).catch(err => {
      console.error('Failed to copy link: ', err);
      toast({ title: t('errorTitle'), description: t('failedToCopyLink'), variant: 'destructive' });
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-lg shadow-xl text-center">
        <CardHeader>
          <CardTitle className="text-2xl">{t('waitingForOpponentTitle')}</CardTitle>
          <CardDescription>{t('welcomePlayer', { playerName })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p>{t('shareGameIdOrLink')}</p>
          
          <div className="space-y-2">
            <Label htmlFor="gameIdDisplay" className="text-sm font-medium">{t('gameIdLabel')}</Label>
            <div className="flex items-center justify-center p-3 bg-muted rounded-md">
              <span id="gameIdDisplay" className="text-2xl font-mono tracking-widest">{gameId}</span>
            </div>
          </div>

          <div className="space-y-2">
             <Label htmlFor="gameLinkDisplay" className="text-sm font-medium">{t('shareableLink')}</Label>
            <div className="flex gap-2">
              <Input id="gameLinkDisplay" value={gameLink} readOnly className="text-center"/>
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
