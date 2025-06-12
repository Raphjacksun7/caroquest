"use client";

import { Button } from "@/components/ui/button";
import { Home, RotateCcw, BookOpen, Settings, Languages } from "lucide-react"; // Added Languages icon
import { useTranslation } from "@/hooks/useTranslation";
import type { Locale } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// FIX: Added onSetLanguage and currentLanguage to the props interface
interface IconToolbarProps {
  onResetGame: () => void;
  onOpenRules: () => void;
  onGoBackToMenu: () => void;
  onSetLanguage: (lang: Locale) => void;
  currentLanguage: Locale;
}

const TooltipButton = ({ label, children, onClick }: { label: string, children: React.ReactNode, onClick?: () => void }) => (
    <div className="relative flex flex-col items-center group">
        <Button onClick={onClick} variant="ghost" size="lg" className="rounded-full h-14 w-14 text-muted-foreground hover:bg-primary/10 hover:text-primary">
            {children}
        </Button>
        <div className="absolute left-full ml-4 w-auto p-2 bg-background text-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
            {label}
        </div>
    </div>
);


export const IconToolbar: React.FC<IconToolbarProps> = ({ 
    onResetGame, 
    onOpenRules, 
    onGoBackToMenu,
    onSetLanguage, // FIX: Destructure the new prop
    currentLanguage, // FIX: Destructure the new prop
}) => {
  const { t } = useTranslation();

  // Example handler for switching language
  const handleLanguageSwitch = () => {
    const nextLanguage = currentLanguage === 'en' ? 'fr' : 'en'; // Simple toggle example
    onSetLanguage(nextLanguage);
  };

  return (
    <div className="flex flex-col items-center justify-between h-full">
        <div className="flex flex-col items-center gap-2">
            <Avatar className="h-12 w-12 mb-4">
                <AvatarImage src="/logo.png" alt="CaroQuest Logo"/>
                <AvatarFallback>CQ</AvatarFallback>
            </Avatar>
            <TooltipButton label={t('home')} onClick={onGoBackToMenu}>
                <Home className="h-6 w-6" />
            </TooltipButton>
            <TooltipButton label={t('rules')} onClick={onOpenRules}>
                <BookOpen className="h-6 w-6" />
            </TooltipButton>
             <TooltipButton label={t('resetGame')} onClick={onResetGame}>
                <RotateCcw className="h-6 w-6" />
            </TooltipButton>
            {/* FIX: Language button is now functional */}
            <TooltipButton label={t('language')} onClick={handleLanguageSwitch}>
                <Languages className="h-6 w-6" />
            </TooltipButton>
        </div>
        <div className="flex flex-col items-center gap-2">
            <TooltipButton label={t('settings')} onClick={() => alert('Settings clicked!')}>
                <Settings className="h-6 w-6" />
            </TooltipButton>
        </div>
    </div>
  );
};