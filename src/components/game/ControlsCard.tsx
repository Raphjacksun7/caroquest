
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, HelpCircle, Minus, Plus } from 'lucide-react';

interface ControlsCardProps {
  pawnsPerPlayer: number;
  onPawnsChange: (count: number) => void;
  onReset: () => void;
  onOpenRules: () => void; // To trigger dialog
}

export const ControlsCard = ({ pawnsPerPlayer, onPawnsChange, onReset, onOpenRules }: ControlsCardProps) => {
  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Game Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="pawnsPerPlayer" className="text-sm font-medium">Pawns per player:</Label>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPawnsChange(pawnsPerPlayer - 1)}
                disabled={pawnsPerPlayer <= 3}
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
                className="w-16 h-8 text-center px-1"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPawnsChange(pawnsPerPlayer + 1)}
                disabled={pawnsPerPlayer >= 10}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={onReset} variant="outline" className="flex-1 shadow-sm hover:shadow-md">
              <RefreshCw className="mr-2 h-4 w-4" /> Reset Game
            </Button>
            <Button onClick={onOpenRules} variant="outline" className="flex-1 shadow-sm hover:shadow-md">
              <HelpCircle className="mr-2 h-4 w-4" /> Rules
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
