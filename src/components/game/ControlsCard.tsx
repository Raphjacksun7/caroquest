"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, HelpCircle, Minus, Plus, Settings2 } from 'lucide-react';

interface ControlsCardProps {
  pawnsPerPlayer: number;
  onPawnsChange: (count: number) => void;
  onReset: () => void;
  onOpenRules: () => void; 
}

export const ControlsCard = ({ pawnsPerPlayer, onPawnsChange, onReset, onOpenRules }: ControlsCardProps) => {
  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <Settings2 size={20} className="text-[hsl(var(--primary))]"/>
          Game Controls
        </CardTitle>
        <CardDescription>Adjust settings and manage the game.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="pawnsPerPlayer" className="text-sm font-medium">Pawns per player:</Label>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-md"
                onClick={() => onPawnsChange(pawnsPerPlayer - 1)}
                disabled={pawnsPerPlayer <= 3}
                aria-label="Decrease pawns per player"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                id="pawnsPerPlayer"
                value={pawnsPerPlayer}
                onChange={(e) => {
                    const val = parseInt(e.target.value,10);
                    if(!isNaN(val)) onPawnsChange(val);
                }}
                min="3"
                max="10"
                className="w-14 h-8 text-center px-1 rounded-md"
                aria-label="Number of pawns per player"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-md"
                onClick={() => onPawnsChange(pawnsPerPlayer + 1)}
                disabled={pawnsPerPlayer >= 10}
                aria-label="Increase pawns per player"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
