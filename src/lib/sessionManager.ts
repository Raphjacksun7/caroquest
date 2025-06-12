// FILE: src/lib/sessionManager.ts

interface GameSession {
    gameId: string;
    playerId: number;
    sessionToken: string;
    playerName: string;
    lastActiveAt: number;
  }
  
  class SessionManager {
    private readonly SESSION_KEY = 'caroquest_game_session';
    private readonly MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 hours
  
    // Save current game session
    saveSession(gameId: string, playerId: number, sessionToken: string, playerName: string) {
      if (typeof window === 'undefined') return;
      
      const session: GameSession = {
        gameId,
        playerId,
        sessionToken,
        playerName,
        lastActiveAt: Date.now()
      };
  
      try {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        console.log('CLIENT: Game session saved:', { gameId, playerId, playerName, sessionToken: sessionToken.substring(0, 8) + '...' });
      } catch (error) {
        console.warn('CLIENT: Failed to save session:', error);
      }
    }
  
    // Get current session if valid
    getSession(): GameSession | null {
      if (typeof window === 'undefined') return null;
  
      try {
        const sessionData = localStorage.getItem(this.SESSION_KEY);
        if (!sessionData) return null;
  
        const session: GameSession = JSON.parse(sessionData);
        
        // Check if session is too old
        if (Date.now() - session.lastActiveAt > this.MAX_SESSION_AGE) {
          this.clearSession();
          return null;
        }
  
        return session;
      } catch (error) {
        console.warn('CLIENT: Failed to read session:', error);
        this.clearSession();
        return null;
      }
    }
  
    // Update session activity
    updateSessionActivity() {
      const session = this.getSession();
      if (session) {
        session.lastActiveAt = Date.now();
        this.saveSession(session.gameId, session.playerId, session.sessionToken, session.playerName);
      }
    }
  
    // Clear current session
    clearSession() {
      if (typeof window === 'undefined') return;
      
      try {
        localStorage.removeItem(this.SESSION_KEY);
        console.log('CLIENT: Game session cleared');
      } catch (error) {
        console.warn('CLIENT: Failed to clear session:', error);
      }
    }
  
    // Check if we have a session for specific game
    hasSessionForGame(gameId: string): boolean {
      const session = this.getSession();
      return session?.gameId === gameId;
    }
  
    // Get session token for reconnection
    getSessionTokenForGame(gameId: string): string | null {
      const session = this.getSession();
      return session?.gameId === gameId ? session.sessionToken : null;
    }
  }
  
  export const sessionManager = new SessionManager();