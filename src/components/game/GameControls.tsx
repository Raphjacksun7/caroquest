
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface GameControlsProps {
  onReset: () => void;
}

export const GameControls = ({ onReset }: GameControlsProps) => {
  return (
    <div className="mt-6">
      <Button onClick={onReset} variant="outline" className="shadow-md hover:shadow-lg transition-shadow">
        <RotateCcw className="mr-2 h-4 w-4" /> Reset Game
      </Button>
    </div>
  );
};
