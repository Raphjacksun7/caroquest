
"use client";
import { useLanguage } from '@/contexts/LanguageContext';

export const useTranslation = () => {
  const { t, language, setLanguage } = useLanguage();
  return { t, currentLanguage: language, setLanguage };
};
