
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import en from '@/locales/en.json';
import fr from '@/locales/fr.json';

type Locale = 'en' | 'fr';

interface LanguageContextType {
  language: Locale;
  setLanguage: (language: Locale) => void;
  t: (key: string, options?: Record<string, string | number>) => string;
}

const translations: Record<Locale, Record<string, string>> = {
  en,
  fr,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Locale>('en'); // Default language

  useEffect(() => {
    // You could add logic here to detect user's preferred language from browser settings
    // or load saved preference from localStorage
    const storedLang = localStorage.getItem('diagonal-domination-lang') as Locale | null;
    if (storedLang && (storedLang === 'en' || storedLang === 'fr')) {
      setLanguage(storedLang);
    }
  }, []);

  const handleSetLanguage = (lang: Locale) => {
    setLanguage(lang);
    localStorage.setItem('diagonal-domination-lang', lang);
  };

  const t = useCallback((key: string, options?: Record<string, string | number>): string => {
    let translation = translations[language]?.[key] || translations['en']?.[key] || key;
    if (options) {
      Object.keys(options).forEach((optionKey) => {
        const regex = new RegExp(`{{${optionKey}}}`, 'g');
        translation = translation.replace(regex, String(options[optionKey]));
      });
    }
    return translation;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
