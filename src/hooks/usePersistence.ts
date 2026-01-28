import { useCallback, useState, useEffect } from 'react';

export function usePersistence() {
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for client-side hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Save data with optional TTL (time to live in days)
  const save = useCallback((key: string, value: any, ttlDays: number = 7) => {
    try {
      const item = {
        value,
        expiry: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
      console.warn('Failed to save:', key);
    }
  }, []);

  // Load data (only after hydration) - checks expiry
  const load = useCallback(<T>(key: string, defaultValue: T): T => {
    try {
      if (!isHydrated) return defaultValue;
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return defaultValue;
      
      const item = JSON.parse(itemStr);
      
      // Check if this is the new format with expiry
      if (item && typeof item === 'object' && 'value' in item && 'expiry' in item) {
        if (Date.now() > item.expiry) {
          localStorage.removeItem(key);
          return defaultValue;
        }
        return item.value;
      }
      
      // Legacy format (no expiry wrapper) - return as-is
      return item;
    } catch (e) {
      console.warn('Failed to load:', key);
      return defaultValue;
    }
  }, [isHydrated]);

  // Remove data
  const remove = useCallback((key: string) => {
    try {
      localStorage.removeItem(key);
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