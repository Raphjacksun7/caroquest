import { useCallback, useState, useEffect } from 'react';

export function usePersistence() {
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for client-side hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Save data
  const save = useCallback((key: string, value: any) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to save:', key);
    }
  }, []);

  // Load data (only after hydration)
  const load = useCallback(<T>(key: string, defaultValue: T): T => {
    try {
      if (!isHydrated) return defaultValue;
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn('Failed to load:', key);
      return defaultValue;
    }
  }, [isHydrated]);

  // Remove data
  const remove = useCallback((key: string) => {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn('Failed to remove:', key);
    }
  }, []);

  // Safe load that waits for hydration
  const loadSafe = useCallback(<T>(key: string, defaultValue: T): T => {
    if (!isHydrated) return defaultValue;
    return load(key, defaultValue);
  }, [isHydrated, load]);

  return { save, load, remove, loadSafe, isHydrated };
}