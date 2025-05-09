
"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, HelpCircle, Settings2 } from 'lucide-react';

interface ControlsCardProps {
  onReset: () => void;
  onOpenRules: () => void;
  pawnsPerPlayer: number; // Keep for display if needed, but not for changing
  onPawnsChange: (count: number) => void; // Keep for prop consistency, but will be no-op
  isGameActive: boolean;
}

export const ControlsCard = ({ onReset, onOpenRules, pawnsPerPlayer, isGameActive }: ControlsCardProps) => {
  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <Settings2 size={20} className="text-[hsl(var(--primary))]"/>
          Game Controls
        </CardTitle>
        <CardDescription>Manage the game and view rules.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            <div className="text-sm font-medium">Pawns per player: {pawnsPerPlayer}</div>
             {/* Pawns per player adjustment UI removed as it's fixed by gameLogic.ts */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button onClick={onReset} variant="outline" className="flex-1 shadow-sm hover:shadow-md transition-shadow">
              <RefreshCw className="mr-2 h-4 w-4" /> Reset Game
            </Button>
            <Button onClick={onOpenRules} variant="outline" className="flex-1 shadow-sm hover:shadow-md transition-shadow">
              <HelpCircle className="mr-2 h-4 w-4" /> Rules
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
