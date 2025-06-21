"use client";

import { useState, useCallback, useRef } from "react";
import type { InfoBoxData, InfoType, UseInfoSystemReturn } from "@/lib/types";

export const useInfoSystem = (): UseInfoSystemReturn => {
  const [infos, setInfos] = useState<InfoBoxData[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addInfo = useCallback((info: Omit<InfoBoxData, "id">): string => {
    const id = `info-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newInfo: InfoBoxData = { 
      ...info, 
      id,
      priority: info.priority ?? 0 
    };
    
    setInfos(prev => {
      // Handle special replacement logic for certain types
      let filteredInfos = prev;
      
      if (info.type === "turn") {
        // Replace existing turn info
        filteredInfos = prev.filter(i => i.type !== "turn");
      } else if (info.type === "winner") {
        // Replace existing winner info and remove turn info
        filteredInfos = prev.filter(i => i.type !== "winner" && i.type !== "turn");
      } else if (info.type === "connection") {
        // Replace existing connection info
        filteredInfos = prev.filter(i => i.type !== "connection");
      } else if (info.type === "waiting") {
        // Replace existing waiting info
        filteredInfos = prev.filter(i => i.type !== "waiting");
      }

      // Add new info and sort by priority (higher priority first)
      const newInfos = [...filteredInfos, newInfo].sort((a, b) => (b.priority || 0) - (a.priority || 0));
      return newInfos;
    });

    // Handle auto-dismiss
    if (info.duration && !info.persistent) {
      const timeoutId = setTimeout(() => {
        removeInfo(id);
      }, info.duration);
      timeoutRefs.current.set(id, timeoutId);
    }

    return id;
  }, []);

  const removeInfo = useCallback((id: string) => {
    // Clear any associated timeout
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }

    setInfos(prev => prev.filter(info => info.id !== id));
  }, []);

  const clearInfos = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRefs.current.clear();
    
    setInfos([]);
  }, []);

  const clearInfosByType = useCallback((type: InfoType) => {
    setInfos(prev => {
      const toRemove = prev.filter(info => info.type === type);
      
      // Clear timeouts for removed infos
      toRemove.forEach(info => {
        const timeoutId = timeoutRefs.current.get(info.id);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutRefs.current.delete(info.id);
        }
      });

      return prev.filter(info => info.type !== type);
    });
  }, []);

  const updateInfo = useCallback((id: string, updates: Partial<InfoBoxData>) => {
    setInfos(prev => prev.map(info => 
      info.id === id ? { ...info, ...updates } : info
    ));
  }, []);

  const hasInfoOfType = useCallback((type: InfoType): boolean => {
    return infos.some(info => info.type === type);
  }, [infos]);

  const getInfosByType = useCallback((type: InfoType): InfoBoxData[] => {
    return infos.filter(info => info.type === type);
  }, [infos]);

  const getInfoById = useCallback((id: string): InfoBoxData | undefined => {
    return infos.find(info => info.id === id);
  }, [infos]);

  const replaceInfo = useCallback((type: InfoType, info: Omit<InfoBoxData, "id">): string => {
    clearInfosByType(type);
    return addInfo(info);
  }, [clearInfosByType, addInfo]);

  const addTemporaryInfo = useCallback((info: Omit<InfoBoxData, "id" | "duration">, duration: number): string => {
    return addInfo({
      ...info,
      duration,
      dismissible: true,
      onDismiss: () => clearInfosByType(info.type)
    });
  }, [addInfo, clearInfosByType]);

  return {
    infos,
    addInfo,
    removeInfo,
    clearInfos,
    clearInfosByType,
    updateInfo,
    hasInfoOfType,
    getInfosByType,
    getInfoById,
    replaceInfo,
    addTemporaryInfo,
  };
};