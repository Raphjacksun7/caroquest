"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, HelpCircle, Settings2, Languages, Home } from 'lucide-react'; 
import { useTranslation } from '@/hooks/useTranslation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface ControlsCardProps {
  onReset: () => void;
  onOpenRules: () => void;
  pawnsPerPlayer: number; 
  isGameActive: boolean;
  currentLanguage: 'en' | 'fr';
  onSetLanguage: (lang: 'en' | 'fr') => void;
}

export const ControlsCard = ({ 
    onReset, 
    onOpenRules, 
    pawnsPerPlayer, 
    isGameActive,
    currentLanguage,
    onSetLanguage
}: ControlsCardProps) => {
  const { t } = useTranslation();

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <Settings2 size={20} className="text-primary"/>
          {t('gameControls')}
        </CardTitle>
        <CardDescription>{t('manageGameAndViewRules')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">{t('pawnsPerPlayer', { count: pawnsPerPlayer })}</div>
            
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={onReset} variant="outline" className="flex-1 shadow-sm hover:shadow-md transition-shadow">
              <RefreshCw className="mr-2 h-4 w-4" /> {t('resetGame')}
            </Button>
            <Button onClick={onOpenRules} variant="outline" className="flex-1 shadow-sm hover:shadow-md transition-shadow">
              <HelpCircle className="mr-2 h-4 w-4" /> {t('rules')}
            </Button>
          </div>
          <div className="pt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full shadow-sm hover:shadow-md transition-shadow">
                  <Languages className="mr-2 h-4 w-4" /> {t('language')}: {currentLanguage === 'en' ? t('english') : t('french')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuLabel>{t('selectLanguage')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSetLanguage('en')} disabled={currentLanguage === 'en'}>
                  {t('english')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetLanguage('fr')} disabled={currentLanguage === 'fr'}>
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
    