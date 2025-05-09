
"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, HelpCircle, Settings2, Languages, User, Users } from 'lucide-react'; // Added User, Users
import { useTranslation } from '@/hooks/useTranslation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from '@/components/ui/switch'; // Added Switch
import { Label } from '@/components/ui/label'; // Added Label


interface ControlsCardProps {
  onReset: () => void;
  onOpenRules: () => void;
  pawnsPerPlayer: number; 
  isGameActive: boolean;
  isSinglePlayer: boolean; // New prop
  onToggleSinglePlayer: () => void; // New prop
}

export const ControlsCard = ({ 
    onReset, 
    onOpenRules, 
    pawnsPerPlayer, 
    isGameActive,
    isSinglePlayer,
    onToggleSinglePlayer
}: ControlsCardProps) => {
  const { t, setLanguage, currentLanguage } = useTranslation();

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <Settings2 size={20} className="text-[hsl(var(--primary))]"/>
          {t('gameControls')}
        </CardTitle>
        <CardDescription>{t('manageGameAndViewRules')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            <div className="text-sm font-medium">{t('pawnsPerPlayer', { count: pawnsPerPlayer })}</div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="single-player-mode" 
                checked={isSinglePlayer}
                onCheckedChange={onToggleSinglePlayer}
                disabled={isGameActive} // Disable if game is active
              />
              <Label htmlFor="single-player-mode" className="flex items-center gap-1.5">
                {isSinglePlayer ? <User size={16} /> : <Users size={16} />}
                {isSinglePlayer ? t('singlePlayerMode') : t('multiplayerMode')}
              </Label>
            </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button onClick={onReset} variant="outline" className="flex-1 shadow-sm hover:shadow-md transition-shadow">
              <RefreshCw className="mr-2 h-4 w-4" /> {t('resetGame')}
            </Button>
            <Button onClick={onOpenRules} variant="outline" className="flex-1 shadow-sm hover:shadow-md transition-shadow">
              <HelpCircle className="mr-2 h-4 w-4" /> {t('rules')}
            </Button>
          </div>
          <div className="pt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full shadow-sm hover:shadow-md transition-shadow">
                  <Languages className="mr-2 h-4 w-4" /> {t('language')}: {currentLanguage === 'en' ? t('english') : t('french')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLanguage('en')} disabled={currentLanguage === 'en'}>
                  {t('english')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('fr')} disabled={currentLanguage === 'fr'}>
                  {t('french')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Add new translation keys:
// "singlePlayerMode": "Single Player Mode"
// "multiplayerMode": "Multiplayer Mode"
