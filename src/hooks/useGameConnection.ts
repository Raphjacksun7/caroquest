// FILE: src/hooks/useGameConnection.ts

"use client";
import { useEffect, useCallback, useRef, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import type { GameState, PlayerId, StoredPlayer, GameOptions } from "@/lib/types";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { deserializeGameState } from "@/lib/serialization";
import { applyDeltaUpdatesToGameState } from "@/lib/clientUtils";
import { createInitialGameState, PAWNS_PER_PLAYER, assignPlayerColors, BOARD_SIZE, initializeBoard } from "@/lib/gameLogic";
import { decompress } from "@/lib/compression"; 

export type { StoredPlayer };

export interface GameStoreState {
  gameState: GameState | null;
  localPlayerId: PlayerId | null;
  opponentName: string | null;
  gameId: string | null;
  error: string | null;
  errorType: "GAME_NOT_FOUND" | "GAME_FULL" | "JOIN_FAILED" | "SERVER_ERROR" | "INVALID_MOVE" | null; 
  isConnected: boolean;
  isConnecting: boolean;
  isWaitingForOpponent: boolean;
  pingLatency: number;
  players: StoredPlayer[];
}

export interface GameStoreActions {
  setGameState: (state: GameState | null) => void;
  setError: (error: string | null, errorType?: GameStoreState["errorType"]) => void;
  applyDeltaUpdates: (updates: any[], seqId?: number) => void;
  setPlayers: (players: StoredPlayer[]) => void;
  setGameId: (gameId: string | null) => void;
  setLocalPlayerId: (playerId: PlayerId | null) => void;
  setOpponentName: (name: string | null) => void;
  setIsConnected: (connected: boolean) => void;
  setIsConnecting: (connecting: boolean) => void;
  setIsWaitingForOpponent: (waiting: boolean) => void;
  setPingLatency: (latency: number) => void;
  clearStore: () => void;
  resetForNewGame: (options?: GameOptions) => void;
  requestFullState: () => void; 
  _internalSocketRef?: React.MutableRefObject<Socket | null>; // For internal use by actions
}

export type FullGameStore = GameStoreState & GameStoreActions;

const initialStoreState: GameStoreState = {
  gameState: null, localPlayerId: null, opponentName: null, gameId: null,
  error: null, errorType: null, isConnected: false, isConnecting: false,
  isWaitingForOpponent: false, pingLatency: 0, players: [],
};

function createSafeFallbackGameState(options?: GameOptions): GameState {
  return createInitialGameState(options); 
}

function sanitizeClientGameState(gameState: GameState | null): GameState | null {
  if (!gameState) return null;
  let validBoard = gameState.board;
  if (!validBoard || validBoard.length !== BOARD_SIZE * BOARD_SIZE) {
    console.warn('CLIENT: Sanitizing - Invalid board detected, creating new board.');
    validBoard = initializeBoard();
  }
  const defaultOptions: GameOptions = { pawnsPerPlayer: PAWNS_PER_PLAYER, isPublic: false, isMatchmaking: false, isRanked: false };
  return {
    ...gameState,
    board: validBoard,
    currentPlayerId: (gameState.currentPlayerId === 1 || gameState.currentPlayerId === 2) ? gameState.currentPlayerId : 1,
    playerColors: gameState.playerColors || assignPlayerColors(),
    options: { ...defaultOptions, ...gameState.options },
    blockedPawnsInfo: new Set(Array.from(gameState.blockedPawnsInfo || [])),
    blockingPawnsInfo: new Set(Array.from(gameState.blockingPawnsInfo || [])),
    deadZoneSquares: new Map( gameState.deadZoneSquares instanceof Map ? gameState.deadZoneSquares : Object.entries(gameState.deadZoneSquares || {}) .map(([k, v]) => [Number(k), v as PlayerId]) ),
    deadZoneCreatorPawnsInfo: new Set(Array.from(gameState.deadZoneCreatorPawnsInfo || [])),
  };
}

export const gameStore = createStore<FullGameStore>()((set, get) => ({
  ...initialStoreState,
  setGameState: (gameState) => {
    const sanitizedState = sanitizeClientGameState(gameState);
    set({ gameState: sanitizedState, error: null, errorType: null }); 
  },
  setError: (error, errorType = "SERVER_ERROR") => {
    console.warn("CLIENT STORE: setError called:", { error, errorType });
    set({ error, errorType, isConnecting: false }); 
  },
  applyDeltaUpdates: (updates, seqId) => {
    const currentState = get().gameState;
    if (!currentState) {
      console.warn("CLIENT STORE: applyDeltaUpdates called but no current game state. Requesting full state.");
      get().requestFullState();
      return;
    }
    const newState = applyDeltaUpdatesToGameState(currentState, updates, seqId);
    const sanitizedState = sanitizeClientGameState(newState);
    set({ gameState: sanitizedState });
  },
  setPlayers: (players) => set({ players }),
  setGameId: (gameId) => set({ gameId }),
  setLocalPlayerId: (playerId) => set({ localPlayerId: playerId }),
  setOpponentName: (name) => set({ opponentName: name }),
  setIsConnected: (connected) => {
    set((state) => ({ 
        isConnected: connected, 
        isConnecting: state.isConnecting && connected ? false : state.isConnecting, 
        error: connected ? null : state.error, 
        errorType: connected ? null : state.errorType,
    }));
  },
  setIsConnecting: (connecting) => set({ isConnecting: connecting }),
  setIsWaitingForOpponent: (waiting) => set({ isWaitingForOpponent: waiting }),
  setPingLatency: (latency) => set({ pingLatency: latency }),
  clearStore: () => {
    console.log("CLIENT STORE: Clearing store to initial state.");
    set({ ...initialStoreState });
  },
  resetForNewGame: (options) => {
    console.log("CLIENT STORE: Resetting for new game.");
    set(() => ({ ...initialStoreState, gameState: createSafeFallbackGameState(options) }));
  },
  requestFullState: () => { 
    const currentSocket = get()._internalSocketRef?.current; 
    const currentLobbyId = get().gameId;
    if (currentSocket?.connected && currentLobbyId) {
        console.log("CLIENT STORE: Requesting full state from server for game:", currentLobbyId);
        currentSocket.emit("request_full_state", { gameId: currentLobbyId });
    } else {
        console.warn("CLIENT STORE: Cannot request full state - not connected or no game ID.");
    }
  },
  _internalSocketRef: { current: null } as React.MutableRefObject<Socket | null>, 
}));

export function useGameStore<T>(selector: (state: FullGameStore) => T): T {
  return useStore(gameStore, selector);
}

export function useGameConnection() {
  const socketRef = useRef<Socket | null>(null);
  const lastPingSent = useRef<number | null>(null);
  const serverTimeOffset = useRef<number>(0);
  const connectionPromiseRef = useRef<Promise<Socket> | null>(null);

  useEffect(() => {
    gameStore.setState({ _internalSocketRef: socketRef } as Partial<FullGameStore>);
  }, []);


  const {
    setGameState, setError, applyDeltaUpdates: storeApplyDeltaUpdates, setPlayers,
    setGameId, setLocalPlayerId, setOpponentName, setIsConnected,
    setIsConnecting, setIsWaitingForOpponent, setPingLatency, clearStore,
  } = gameStore.getState();

  const gameId = useGameStore((state) => state.gameId);
  const isConnectedState = useGameStore((state) => state.isConnected);


  const socketUrl = useMemo(() => process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== "undefined" ? window.location.origin : ""), []);

  const syncTime = useCallback(() => {
    if (socketRef.current?.connected) {
      lastPingSent.current = Date.now();
      socketRef.current.emit("ping_time");
    }
  }, []);

   const setupEventHandlers = useCallback((socket: Socket) => {
      console.log("CLIENT: Setting up socket event handlers for socket ID:", socket.id);

      const handlePongTime = (serverTime: number) => {
        if (lastPingSent.current) {
          const rtt = Date.now() - lastPingSent.current;
          setPingLatency(rtt);
          serverTimeOffset.current = serverTime - (Date.now() - rtt / 2);
        }
        setTimeout(syncTime, 30000); 
      };

      const handleAndDeserializeState = (compressedBinaryData: ArrayBuffer | Uint8Array | number[], origin: string): GameState | null => {
        console.log(`CLIENT: Received state from '${origin}'. Compressed size: ${compressedBinaryData instanceof ArrayBuffer ? compressedBinaryData.byteLength : compressedBinaryData.length}`);
        try {
          let dataToDecompress: Uint8Array;
          if (compressedBinaryData instanceof Uint8Array) dataToDecompress = compressedBinaryData;
          else if (compressedBinaryData instanceof ArrayBuffer) dataToDecompress = new Uint8Array(compressedBinaryData);
          else if (Array.isArray(compressedBinaryData)) dataToDecompress = new Uint8Array(compressedBinaryData);
          else throw new Error(`Invalid data format: ${typeof compressedBinaryData}`);

          if (dataToDecompress.length === 0) {
            console.warn(`CLIENT: Received empty state from ${origin}.`);
            return createSafeFallbackGameState();
          }
          const decompressed = decompress(dataToDecompress);
          console.log(`CLIENT: Decompressed state from ${origin}. Original size: ${decompressed.length}`);
          const deserialized = deserializeGameState(decompressed);
          if (!deserialized.board || deserialized.board.length !== BOARD_SIZE * BOARD_SIZE) {
            console.error(`CLIENT: Deserialized state from ${origin} has invalid board. Board size: ${deserialized.board?.length}`);
            return createSafeFallbackGameState(deserialized.options);
          }
          console.log(`CLIENT: Successfully processed state from ${origin}. Current turn: P${deserialized.currentPlayerId}, Phase: ${deserialized.gamePhase}`);
          return deserialized;
        } catch (err: any) {
          console.error(`CLIENT: Error processing state from ${origin}:`, err.message, err.stack);
          setError(`Failed to process game state: ${err.message}`, "SERVER_ERROR");
          return createSafeFallbackGameState();
        }
      };

      socket.on("game_created", ({ gameId: newGameId, playerId, gameState: compressedState, players: newPlayers, options }) => {
        console.log("CLIENT: Event 'game_created'", { newGameId, playerId, playersCount: newPlayers?.length, options });
        const decodedState = handleAndDeserializeState(compressedState, "game_created");
        if (decodedState) {
          setGameId(newGameId); setLocalPlayerId(playerId); setGameState({...decodedState, options }); 
          setPlayers(newPlayers || []); setIsWaitingForOpponent(true);
          console.log(`CLIENT: Game ${newGameId} created. You are Player ${playerId}. Waiting for opponent.`);
        }
      });
      socket.on("game_joined", ({ gameId: joinedGameId, playerId, gameState: compressedState, players: joinedPlayers, opponentName: joinedOpponentName, waiting, options }) => {
        console.log("CLIENT: Event 'game_joined'", { joinedGameId, playerId, opponentName: joinedOpponentName, waiting, options });
        const decodedState = handleAndDeserializeState(compressedState, "game_joined");
        if (decodedState) {
          setGameId(joinedGameId); setLocalPlayerId(playerId); setGameState({...decodedState, options });
          setPlayers(joinedPlayers || []); setOpponentName(joinedOpponentName);
          setIsWaitingForOpponent(!!waiting);
          console.log(`CLIENT: Joined game ${joinedGameId} as Player ${playerId}. Opponent: ${joinedOpponentName}. Waiting: ${waiting}`);
        }
      });
      socket.on("opponent_joined", ({ opponentName: newOpponentName, players: updatedPlayers }) => {
        console.log("CLIENT: Event 'opponent_joined'", { newOpponentName, playersCount: updatedPlayers?.length });
        setOpponentName(newOpponentName); setPlayers(updatedPlayers || []);
        const connectedCount = (updatedPlayers || []).filter((p: StoredPlayer) => p.isConnected).length;
        setIsWaitingForOpponent(connectedCount < 2);
        if (connectedCount >= 2) console.log("CLIENT: Opponent joined. Both players ready.");
      });
      socket.on("game_start", ({ gameState: compressedState, players: gameStartPlayers, options }) => {
        console.log("CLIENT: Event 'game_start'. Players:", gameStartPlayers?.map((p: StoredPlayer) => p.name), "Options:", options);
        const decodedState = handleAndDeserializeState(compressedState, "game_start");
        if (decodedState) {
          setGameState({...decodedState, options}); setPlayers(gameStartPlayers || []); setIsWaitingForOpponent(false);
          console.log(`CLIENT: Game started. Current turn: P${decodedState.currentPlayerId}`);
        }
      });
      socket.on("game_updated", ({ gameState: compressedState, options, fullUpdate }) => {
        const decodedState = handleAndDeserializeState(compressedState, "game_updated");
        if (decodedState) {
          setGameState({...decodedState, options: options || gameStore.getState().gameState?.options }); 
          console.log(`CLIENT: Game state fully updated. Current turn: P${decodedState.currentPlayerId}`);
        }
      });
      socket.on("game_delta", ({ updates, seqId }) => {
        try { storeApplyDeltaUpdates(updates, seqId); } 
        catch (err: any) { setError(`Delta update error: ${err.message}`, "SERVER_ERROR"); }
      });
      socket.on("opponent_disconnected", ({ playerName, playerId: disconnectedPlayerId, remainingPlayers }) => {
        console.log("CLIENT: Event 'opponent_disconnected'", { playerName });
        setError(`${playerName} disconnected. Waiting for rejoin.`, null);
        setPlayers(remainingPlayers || []);
        if (gameStore.getState().localPlayerId !== disconnectedPlayerId) setOpponentName(null);
        setIsWaitingForOpponent(true);
      });
      socket.on("game_error", ({ message, errorType: serverErrorType, gameId: errorGameId }) => {
        console.warn("CLIENT: Event 'game_error'", { message, serverErrorType, errorGameId });
        setError(message, serverErrorType || "SERVER_ERROR");
        if (serverErrorType === "GAME_NOT_FOUND" && errorGameId === gameStore.getState().gameId) {
          setGameState(null); setGameId(null); setLocalPlayerId(null); setPlayers([]); setIsWaitingForOpponent(false);
        }
      });
      socket.on("match_found", ({ gameId: newGameId, opponentName: newOpponentName, assignedPlayerId, options }) => {
        console.log("CLIENT: Event 'match_found'", { newGameId, newOpponentName, assignedPlayerId, options });
        if (assignedPlayerId !== 1 && assignedPlayerId !== 2) {
          setError("Invalid player assignment from matchmaking", "SERVER_ERROR"); return;
        }
        setGameId(newGameId); setLocalPlayerId(assignedPlayerId); setOpponentName(newOpponentName);
        setGameState(createInitialGameState(options || { pawnsPerPlayer: PAWNS_PER_PLAYER }));
        setIsWaitingForOpponent(false); 
        console.log(`CLIENT: Match found! Game: ${newGameId}. You are P${assignedPlayerId} vs ${newOpponentName}.`);
      });
      socket.on("pong_time", handlePongTime);
      socket.on("matchmaking_joined", ({ message }) => console.log("CLIENT: Matchmaking joined:", message));
      socket.on("matchmaking_left", ({ message }) => console.log("CLIENT: Matchmaking left:", message));

      console.log("CLIENT: All socket event handlers registered for socket ID:", socket.id);
    },
    [ setGameId, setGameState, setLocalPlayerId, setOpponentName, setPlayers, setError, setIsWaitingForOpponent, storeApplyDeltaUpdates, syncTime, setPingLatency] 
  );

  const connectSocketIO = useCallback((): Promise<Socket> => {
    if (connectionPromiseRef.current) return connectionPromiseRef.current;
    if (socketRef.current?.connected) return Promise.resolve(socketRef.current);

    const promise = new Promise<Socket>((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Socket.IO only in browser."));
        return;
      }
      console.log("CLIENT: Attempting socket connection to:", socketUrl);
      if (socketRef.current) {
        socketRef.current.removeAllListeners(); 
        socketRef.current.disconnect();
      }
      const newSocket = io(socketUrl, {
        transports: ["websocket", "polling"], reconnectionAttempts: 3, reconnectionDelay: 1500,
        timeout: 10000, path: "/api/socketio/", autoConnect: false, forceNew: true,
      });
      socketRef.current = newSocket;
      gameStore.setState({ _internalSocketRef: socketRef } as Partial<FullGameStore>); 

      setIsConnecting(true); setError(null, null);
      setupEventHandlers(newSocket); 

      const connTimeout = setTimeout(() => {
        console.error("CLIENT: Connection attempt timed out.");
        setError("Connection timeout.", "SERVER_ERROR");
        newSocket.disconnect();
        connectionPromiseRef.current = null;
        reject(new Error("Connection timeout"));
      }, 10000);

      newSocket.on("connect", () => {
        clearTimeout(connTimeout);
        console.log("CLIENT: Socket connected. ID:", newSocket.id);
        setIsConnected(true); syncTime();
        connectionPromiseRef.current = null; resolve(newSocket);
      });
      newSocket.on("connect_error", (err) => {
        clearTimeout(connTimeout);
        console.error("CLIENT: Socket connection error:", err.message);
        setError(`Connection failed: ${err.message}`, "SERVER_ERROR");
        setIsConnected(false); setIsConnecting(false); 
        connectionPromiseRef.current = null; reject(err);
      });
      newSocket.on("disconnect", (reason) => {
        clearTimeout(connTimeout);
        console.log("CLIENT: Socket disconnected. Reason:", reason);
        setIsConnected(false); setIsConnecting(false);
        connectionPromiseRef.current = null;
      });
      newSocket.connect();
    });
    connectionPromiseRef.current = promise;
    return promise;
  }, [socketUrl, setIsConnecting, setError, setIsConnected, syncTime, setupEventHandlers]); 
  
  const getAdjustedTime = useCallback(() => Date.now() + serverTimeOffset.current, []);
  
  const createGame = useCallback(async (playerName: string, options: GameOptions = { pawnsPerPlayer: PAWNS_PER_PLAYER }) => {
    console.log("CLIENT: createGame action called by UI. Player:", playerName);
    try {
      const socket = await connectSocketIO(); 
      setError(null, null); setIsWaitingForOpponent(true); 
      socket.emit("create_game", { playerName, options, clientTimestamp: getAdjustedTime() });
    } catch (err:any) { setError(`Create game failed: ${err.message}`, "SERVER_ERROR"); setIsWaitingForOpponent(false); }
  }, [connectSocketIO, getAdjustedTime, setError, setIsWaitingForOpponent]);

  const joinGame = useCallback(async (gameIdToJoin: string, playerName: string, options?: GameOptions) => {
    console.log("CLIENT: joinGame action called by UI. Game:", gameIdToJoin, "Player:", playerName);
    if (gameId === gameIdToJoin && isConnectedState) {
        console.log("CLIENT: Already in game", gameIdToJoin);
        const currentPlayers = gameStore.getState().players;
        if (currentPlayers.filter(p => p.isConnected).length < 2) {
            setIsWaitingForOpponent(true);
        }
        return;
    }
    try {
      const socket = await connectSocketIO();
      setError(null, null); setIsWaitingForOpponent(true); 
      socket.emit("join_game", { gameId: gameIdToJoin, playerName, options, clientTimestamp: getAdjustedTime() });
    } catch (err:any) { setError(`Join game failed: ${err.message}`, "SERVER_ERROR"); setIsWaitingForOpponent(false); }
  }, [connectSocketIO, getAdjustedTime, setError, setIsWaitingForOpponent, gameId, isConnectedState]);

  const placePawnAction = useCallback((squareIndex: number) => {
    const currentSocket = socketRef.current;
    const currentLobbyId = gameStore.getState().gameId; 
    if (!currentSocket?.connected || !currentLobbyId) {
      setError("Not connected to game server.", "SERVER_ERROR"); return;
    }
    console.log(`CLIENT: Emitting 'place_pawn' for square ${squareIndex} in game ${currentLobbyId}`);
    currentSocket.emit("place_pawn", { gameId: currentLobbyId, squareIndex, clientTimestamp: getAdjustedTime() });
  }, [getAdjustedTime, setError]);

  const movePawnAction = useCallback((fromIndex: number, toIndex: number) => {
    const currentSocket = socketRef.current;
    const currentLobbyId = gameStore.getState().gameId;
    if (!currentSocket?.connected || !currentLobbyId) {
      setError("Not connected to game server.", "SERVER_ERROR"); return;
    }
    console.log(`CLIENT: Emitting 'move_pawn' from ${fromIndex} to ${toIndex} in game ${currentLobbyId}`);
    currentSocket.emit("move_pawn", { gameId: currentLobbyId, fromIndex, toIndex, clientTimestamp: getAdjustedTime() });
  }, [getAdjustedTime, setError]);

  const clearError = useCallback(() => setError(null, null), [setError]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log("CLIENT: Manually disconnecting socket and clearing store.");
      socketRef.current.disconnect(); 
      clearStore(); 
    }
  }, [clearStore]);
  
  const joinMatchmakingQueue = useCallback(async (playerName: string, rating?: number) => {
    console.log("CLIENT: joinMatchmakingQueue action. Player:", playerName);
    try {
      if (!playerName?.trim()) { setError("Player name is required.", "JOIN_FAILED"); return; }
      const socket = await connectSocketIO();
      socket.emit("join_matchmaking", { playerName, rating, clientTimestamp: getAdjustedTime() });
    } catch (err:any) { setError(`Matchmaking join failed: ${err.message}`, "SERVER_ERROR");}
  }, [connectSocketIO, getAdjustedTime, setError]);

  const leaveMatchmakingQueue = useCallback(async () => {
    console.log("CLIENT: leaveMatchmakingQueue action.");
    const currentSocket = socketRef.current;
    if (!currentSocket?.connected) { setError("Not connected.", "SERVER_ERROR"); return; }
    currentSocket.emit("leave_matchmaking", { clientTimestamp: getAdjustedTime() });
  }, [getAdjustedTime, setError]);

  useEffect(() => {
    return () => {
      console.log("CLIENT: useGameConnection unmounting. Disconnecting socket if it exists.");
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    gameState: useGameStore((state) => state.gameState),
    localPlayerId: useGameStore((state) => state.localPlayerId),
    opponentName: useGameStore((state) => state.opponentName),
    gameId: useGameStore((state) => state.gameId),
    error: useGameStore((state) => state.error),
    errorType: useGameStore((state) => state.errorType),
    isConnected: useGameStore((state) => state.isConnected),
    isConnecting: useGameStore((state) => state.isConnecting),
    isWaitingForOpponent: useGameStore((state) => state.isWaitingForOpponent),
    pingLatency: useGameStore((state) => state.pingLatency),
    players: useGameStore((state) => state.players),
    createGame, joinGame, placePawnAction, movePawnAction, clearError,
    disconnect, connectSocketIO, joinMatchmakingQueue, leaveMatchmakingQueue,
  };
}
