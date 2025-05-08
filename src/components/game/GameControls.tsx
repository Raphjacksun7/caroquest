
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface GameControlsProps {
  onReset: () => void;
  pawnsPerPlayer: number;
  onPawnsChange: (count: number) => void;
}

export const GameControls = ({ onReset, pawnsPerPlayer, onPawnsChange }: GameControlsProps) => {
  return (
    <div className="mt-6 flex flex-col items-center gap-4 md:flex-row md:justify-center">
      <div className="flex items-center gap-2">
        <Label htmlFor="pawnsPerPlayer" className="text-sm">Pawns/Player:</Label>
        <Input
          type="number"
          id="pawnsPerPlayer"
          value={pawnsPerPlayer}
          onChange={(e) => onPawnsChange(parseInt(e.target.value, 10))}
          min="3"
          max="10"
          className="w-20 h-9 text-sm"
        />
      </div>
      <Button onClick={onReset} variant="outline" className="shadow-md hover:shadow-lg transition-shadow">
        <RotateCcw className="mr-2 h-4 w-4" /> Reset Game
      </Button>
    </div>
  );
};
