"use client";

import { useEffect } from 'react';
import type { GameMode } from '@/lib/types';

export function useGameUrlManager(
  gameMode: GameMode,
  connectedGameId: string | null | undefined,
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentPath = window.location.pathname;

    if (gameMode === "remote" && connectedGameId) {
      const expectedPath = `/game/${connectedGameId}`;
      if (currentPath !== expectedPath) {
        console.log(`CLIENT (URLManager): Updating URL to game room: ${expectedPath}`);
        window.history.replaceState(null, "", expectedPath);
      }
    } else if (gameMode === "select" && currentPath !== "/") {
      // Only redirect to root if not already on a game-specific path
      // This handles cases where user navigates directly to /game/[id]
      // and then goes back to menu, URL should become /
      const gameIdFromPathRegex = /^\/game\/([a-zA-Z0-9_-]+)$/;
      if (!gameIdFromPathRegex.test(currentPath)) {
         console.log("CLIENT (URLManager): In select mode, ensuring URL is root.");
         window.history.replaceState(null, "", "/");
      }
    }
  }, [gameMode, connectedGameId]);
}