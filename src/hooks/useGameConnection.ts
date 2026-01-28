"use client";
import { useEffect, useCallback, useRef, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  GameState,
  PlayerId,
  StoredPlayer,
  GameOptions,
} from "@/lib/types";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { deserializeGameState } from "@/lib/serialization";
import { applyDeltaUpdatesToGameState } from "@/lib/clientUtils";
import {
  createInitialGameState,
  PAWNS_PER_PLAYER,
  assignPlayerColors,
  BOARD_SIZE,
  initializeBoard,
} from "@/lib/gameLogic";
import { decompress } from "@/lib/compression";
import { sessionManager } from "@/lib/sessionManager";

export type { StoredPlayer };

interface ServerToClientEvents {
  game_created: (data: {
    gameId: string;
    playerId: PlayerId;
    sessionToken: string;
    gameState: ArrayBuffer;
    players: StoredPlayer[];
    options: GameOptions;
  }) => void;
  game_joined: (data: {
    gameId: string;
    playerId: PlayerId;
    sessionToken: string;
    gameState: ArrayBuffer;
    players: StoredPlayer[];
    opponentName: string | null;
    waiting: boolean;
    options: GameOptions;
    reconnection?: boolean;
  }) => void;
  opponent_joined: (data: {
    opponentName: string;
    players: StoredPlayer[];
  }) => void;
  opponent_reconnected: (data: {
    playerName: string;
    playerId: PlayerId;
    players: StoredPlayer[];
  }) => void;
  game_start: (data: {
    gameState: ArrayBuffer;
    players: StoredPlayer[];
    options: GameOptions;
  }) => void;
  game_updated: (data: {
    gameState: ArrayBuffer;
    options?: GameOptions;
    fullUpdate?: boolean;
  }) => void;
  game_delta: (data: { updates: any[]; seqId?: number }) => void;
  opponent_disconnected: (data: {
    playerName: string;
    playerId: PlayerId;
    remainingPlayers: StoredPlayer[];
    temporary?: boolean;
  }) => void;
  game_error: (data: {
    message: string;
    errorType?: GameStoreState["errorType"];
    gameId?: string;
  }) => void;
  match_found: (data: {
    gameId: string;
    opponentName: string;
    assignedPlayerId: PlayerId;
    options?: GameOptions;
  }) => void;
  pong_time: (serverTime: number) => void;
  matchmaking_joined: (data: { message: string }) => void;
  matchmaking_left: (data: { message: string }) => void;
  rematch_requested: (data: {
    requestedBy: string;
    playerName: string;
  }) => void;
  rematch_started: (data: {
    gameState: ArrayBuffer;
    options: GameOptions;
  }) => void;
  rematch_declined: (data: { declinedBy: string; playerName: string }) => void;
  // Undo events
  undo_requested: (data: {
    requestedBy: string;
    playerName: string;
    movesToUndo: number;
    requesterId: PlayerId;
  }) => void;
  undo_applied: (data: {
    gameState: ArrayBuffer;
    options: GameOptions;
    undoneByPlayer: PlayerId;
  }) => void;
  undo_declined: (data: { declinedBy: string; playerName: string }) => void;
  connect: () => void;
  connect_error: (err: Error) => void;
  disconnect: (reason: Socket.DisconnectReason) => void;
}

interface ClientToServerEvents {
  ping_time: () => void;
  request_full_state: (data: { gameId: string }) => void;
  create_game: (data: {
    playerName: string;
    options: GameOptions;
    clientTimestamp: number;
  }) => void;
  join_game: (data: {
    gameId: string;
    playerName: string;
    options?: GameOptions;
    clientTimestamp: number;
  }) => void;
  place_pawn: (data: {
    gameId: string;
    squareIndex: number;
    clientTimestamp: number;
  }) => void;
  move_pawn: (data: {
    gameId: string;
    fromIndex: number;
    toIndex: number;
    clientTimestamp: number;
  }) => void;
  join_matchmaking: (data: {
    playerName: string;
    rating?: number;
    clientTimestamp: number;
  }) => void;
  leave_matchmaking: (data: { clientTimestamp: number }) => void;
  reconnect_session: (data: { gameId: string; sessionToken: string }) => void;
  request_rematch: (data: { gameId: string; clientTimestamp: number }) => void;
  respond_rematch: (data: {
    gameId: string;
    accepted: boolean;
    clientTimestamp: number;
  }) => void;
  // Undo events
  request_undo: (data: { gameId: string; clientTimestamp: number }) => void;
  respond_undo: (data: {
    gameId: string;
    accepted: boolean;
    movesToUndo: number;
    clientTimestamp: number;
  }) => void;
}

export interface GameStoreState {
  gameState: GameState | null;
  localPlayerId: PlayerId | null;
  opponentName: string | null;
  gameId: string | null;
  error: string | null;
  errorType:
    | "GAME_NOT_FOUND"
    | "GAME_FULL"
    | "JOIN_FAILED"
    | "SERVER_ERROR"
    | "INVALID_MOVE"
    | null;
  isConnected: boolean;
  isConnecting: boolean;
  isWaitingForOpponent: boolean;
  pingLatency: number;
  players: StoredPlayer[];
}

export interface GameStoreActions {
  setGameState: (state: GameState | null) => void;
  setError: (
    error: string | null,
    errorType?: GameStoreState["errorType"]
  ) => void;
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
  _internalSocketRef?: React.MutableRefObject<Socket | null>;
}

export type FullGameStore = GameStoreState & GameStoreActions;

const initialStoreState: GameStoreState = {
  gameState: null,
  localPlayerId: null,
  opponentName: null,
  gameId: null,
  error: null,
  errorType: null,
  isConnected: false,
  isConnecting: false,
  isWaitingForOpponent: false,
  pingLatency: 0,
  players: [],
};

function createSafeFallbackGameState(options?: GameOptions): GameState {
  return createInitialGameState(options);
}

function sanitizeClientGameState(
  gameState: GameState | null
): GameState | null {
  if (!gameState) return null;
  let validBoard = gameState.board;
  if (!validBoard || validBoard.length !== BOARD_SIZE * BOARD_SIZE) {
    console.warn(
      "CLIENT: Sanitizing - Invalid board detected, creating new board."
    );
    validBoard = initializeBoard();
  }
  const defaultOptions: GameOptions = {
    pawnsPerPlayer: PAWNS_PER_PLAYER,
    isPublic: false,
    isMatchmaking: false,
    isRanked: false,
  };
  return {
    ...gameState,
    board: validBoard,
    currentPlayerId:
      gameState.currentPlayerId === 1 || gameState.currentPlayerId === 2
        ? gameState.currentPlayerId
        : 1,
    playerColors: gameState.playerColors || assignPlayerColors(),
    options: { ...defaultOptions, ...gameState.options },
    blockedPawnsInfo: new Set(Array.from(gameState.blockedPawnsInfo || [])),
    blockingPawnsInfo: new Set(Array.from(gameState.blockingPawnsInfo || [])),
    deadZoneSquares: new Map(
      gameState.deadZoneSquares instanceof Map
        ? gameState.deadZoneSquares
        : Object.entries(gameState.deadZoneSquares || {}).map(([k, v]) => [
            Number(k),
            v as PlayerId,
          ])
    ),
    deadZoneCreatorPawnsInfo: new Set(
      Array.from(gameState.deadZoneCreatorPawnsInfo || [])
    ),
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
      console.warn(
        "CLIENT STORE: applyDeltaUpdates called but no current game state. Requesting full state."
      );
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
      isConnecting:
        state.isConnecting && connected ? false : state.isConnecting,
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
    set(() => ({
      ...initialStoreState,
      gameState: createSafeFallbackGameState(options),
    }));
  },
  requestFullState: () => {
    const currentSocket = get()._internalSocketRef?.current;
    const currentLobbyId = get().gameId;
    if (currentSocket?.connected && currentLobbyId) {
      console.log(
        "CLIENT STORE: Requesting full state from server for game:",
        currentLobbyId
      );
      currentSocket.emit("request_full_state", { gameId: currentLobbyId });
    } else {
      console.warn(
        "CLIENT STORE: Cannot request full state - not connected or no game ID."
      );
    }
  },
  _internalSocketRef: {
    current: null,
  } as React.MutableRefObject<Socket | null>,
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
    gameStore.setState({
      _internalSocketRef: socketRef,
    } as Partial<FullGameStore>);
  }, []);

  const {
    setGameState,
    setError,
    applyDeltaUpdates: storeApplyDeltaUpdates,
    setPlayers,
    setGameId,
    setLocalPlayerId,
    setOpponentName,
    setIsConnected,
    setIsConnecting,
    setIsWaitingForOpponent,
    setPingLatency,
    clearStore,
  } = gameStore.getState();

  const gameId = useGameStore((state) => state.gameId);
  const isConnectedState = useGameStore((state) => state.isConnected);

  const socketServerUrl = useMemo(() => {
    const serverUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    if (serverUrl) return serverUrl;
    return process.env.NODE_ENV === "production"
      ? "wss://node-server-adul.onrender.com"
      : "ws://localhost:3001";
  }, []);

  const syncTime = useCallback(() => {
    if (socketRef.current?.connected) {
      lastPingSent.current = Date.now();
      socketRef.current.emit("ping_time");
    }
  }, []);

  const [persistedSocket, setPersistedSocket] = useState<Socket | null>(null);

  const setupEventHandlers = useCallback(
    (socket: Socket) => {
      console.log(
        "CLIENT: Setting up socket event handlers for socket ID:",
        socket.id
      );

      // Store socket in multiple places immediately
      socketRef.current = socket;
      setPersistedSocket(socket);
      (window as any).globalSocket = socket;
      (window as any).persistedSocket = socket;

      // Update store
      gameStore.setState({
        _internalSocketRef: socketRef,
      } as Partial<FullGameStore>);

      const handlePongTime = (serverTime: number) => {
        if (lastPingSent.current) {
          const rtt = Date.now() - lastPingSent.current;
          setPingLatency(rtt);
          serverTimeOffset.current = serverTime - (Date.now() - rtt / 2);
        }
        setTimeout(syncTime, 30000);
      };

      const handleAndDeserializeState = (
        compressedBinaryData: ArrayBuffer | Uint8Array | number[],
        origin: string
      ): GameState | null => {
        console.log(
          `CLIENT: Received state from '${origin}'. Compressed size: ${
            compressedBinaryData instanceof ArrayBuffer
              ? compressedBinaryData.byteLength
              : compressedBinaryData.length
          }`
        );
        try {
          let dataToDecompress: Uint8Array;
          if (compressedBinaryData instanceof Uint8Array)
            dataToDecompress = compressedBinaryData;
          else if (compressedBinaryData instanceof ArrayBuffer)
            dataToDecompress = new Uint8Array(compressedBinaryData);
          else if (Array.isArray(compressedBinaryData))
            dataToDecompress = new Uint8Array(compressedBinaryData);
          else
            throw new Error(
              `Invalid data format: ${typeof compressedBinaryData}`
            );

          if (dataToDecompress.length === 0) {
            console.warn(`CLIENT: Received empty state from ${origin}.`);
            return createSafeFallbackGameState();
          }
          const decompressed = decompress(dataToDecompress);
          console.log(
            `CLIENT: Decompressed state from ${origin}. Original size: ${decompressed.length}`
          );
          const deserialized = deserializeGameState(decompressed);
          if (
            !deserialized.board ||
            deserialized.board.length !== BOARD_SIZE * BOARD_SIZE
          ) {
            console.error(
              `CLIENT: Deserialized state from ${origin} has invalid board. Board size: ${deserialized.board?.length}`
            );
            return createSafeFallbackGameState(deserialized.options);
          }
          console.log(
            `CLIENT: Successfully processed state from ${origin}. Current turn: P${deserialized.currentPlayerId}, Phase: ${deserialized.gamePhase}`
          );
          return deserialized;
        } catch (err: any) {
          console.error(
            `CLIENT: Error processing state from ${origin}:`,
            err.message,
            err.stack
          );
          setError(
            `Failed to process game state: ${err.message}`,
            "SERVER_ERROR"
          );
          return createSafeFallbackGameState();
        }
      };

      socket.on(
        "game_created",
        ({
          gameId,
          playerId,
          sessionToken,
          gameState: compressedState,
          players,
          options,
        }) => {
          console.log("CLIENT: Event 'game_created'", { gameId });
          const decodedState = handleAndDeserializeState(
            compressedState,
            "game_created"
          );
          if (decodedState) {
            setGameId(gameId);
            setLocalPlayerId(playerId);
            setGameState({ ...decodedState, options });
            setPlayers(players || []);
            setIsWaitingForOpponent(true);
            const self = players.find(
              (p: StoredPlayer) => p.playerId === playerId
            );
            if (self && sessionToken) {
              sessionManager.saveSession(
                gameId,
                playerId,
                sessionToken,
                self.name
              );
            }
          }
        }
      );

      socket.on(
        "game_joined",
        ({
          gameId,
          playerId,
          sessionToken,
          gameState: compressedState,
          players,
          opponentName,
          waiting,
          options,
          reconnection,
        }) => {
          console.log(
            `CLIENT: Event 'game_joined'. Reconnection: ${!!reconnection}`,
            { gameId }
          );
          const decodedState = handleAndDeserializeState(
            compressedState,
            "game_joined"
          );
          if (decodedState) {
            setGameId(gameId);
            setLocalPlayerId(playerId);
            setGameState({ ...decodedState, options });
            setPlayers(players || []);
            setOpponentName(opponentName);
            setIsWaitingForOpponent(!!waiting);
            const self: StoredPlayer | undefined = players.find(
              (p: StoredPlayer) => p.playerId === playerId
            );
            if (self && sessionToken) {
              sessionManager.saveSession(
                gameId,
                playerId,
                sessionToken,
                self.name
              );
            }
          }
        }
      );

      socket.on("opponent_reconnected", ({ playerName, players }) => {
        console.log(`CLIENT: Opponent ${playerName} has reconnected.`);
        setPlayers(players);
        setOpponentName(playerName);
        setIsWaitingForOpponent(false);
      });

      socket.on("opponent_disconnected", ({ playerName, temporary }) => {
        console.log(
          `CLIENT: Event 'opponent_disconnected' (temporary: ${temporary})`,
          { playerName }
        );
        if (temporary) {
          setError(`${playerName} disconnected. Waiting for rejoin.`, null);
        } else {
          setError(`${playerName} has left the game.`, "GAME_NOT_FOUND");
        }
        setIsWaitingForOpponent(true);
      });

      socket.on(
        "opponent_joined",
        ({ opponentName: newOpponentName, players: updatedPlayers }) => {
          console.log("CLIENT: Event 'opponent_joined'", {
            newOpponentName,
            playersCount: updatedPlayers?.length,
          });
          setOpponentName(newOpponentName);
          setPlayers(updatedPlayers || []);
          const connectedCount = (updatedPlayers || []).filter(
            (p: StoredPlayer) => p.isConnected
          ).length;
          setIsWaitingForOpponent(connectedCount < 2);
          if (connectedCount >= 2)
            console.log("CLIENT: Opponent joined. Both players ready.");
        }
      );

      socket.on(
        "game_start",
        ({
          gameState: compressedState,
          players: gameStartPlayers,
          options,
        }) => {
          console.log(
            "CLIENT: Event 'game_start'. Players:",
            gameStartPlayers?.map((p: StoredPlayer) => p.name),
            "Options:",
            options
          );
          const decodedState = handleAndDeserializeState(
            compressedState,
            "game_start"
          );
          if (decodedState) {
            setGameState({ ...decodedState, options });
            setPlayers(gameStartPlayers || []);
            setIsWaitingForOpponent(false);
            console.log(
              `CLIENT: Game started. Current turn: P${decodedState.currentPlayerId}`
            );
          }
        }
      );

      socket.on(
        "game_updated",
        ({ gameState: compressedState, options, fullUpdate }) => {
          console.log("CLIENT: Game updated event received");

          // PRESERVE socket before any processing
          const socketToPreserve = socket;

          const decodedState = handleAndDeserializeState(
            compressedState,
            "game_updated"
          );
          if (decodedState) {
            console.log(
              `CLIENT: Game updated. Winner: ${
                decodedState.winner || "none"
              }, Turn: P${decodedState.currentPlayerId}`
            );

            setGameState({
              ...decodedState,
              options: options || gameStore.getState().gameState?.options,
            });

            // CRITICAL: Always preserve socket after game updates
            socketRef.current = socketToPreserve;
            (window as any).globalSocket = socketToPreserve;
            (window as any).persistedSocket = socketToPreserve;
            (window as any).emergency_socket = socketToPreserve;

            gameStore.setState({
              _internalSocketRef: socketRef,
              isConnected: socketToPreserve.connected,
            } as Partial<FullGameStore>);

            if (decodedState.winner) {
              console.log("CLIENT: Game ended - CRITICAL socket preservation");
              // Extra preservation when game ends
              setTimeout(() => {
                socketRef.current = socketToPreserve;
                (window as any).globalSocket = socketToPreserve;
                (window as any).persistedSocket = socketToPreserve;
                console.log("CLIENT: Post-game socket preservation completed");
              }, 50);
            }
          }
        }
      );

      socket.on("game_delta", ({ updates, seqId }) => {
        try {
          storeApplyDeltaUpdates(updates, seqId);
        } catch (err: any) {
          setError(`Delta update error: ${err.message}`, "SERVER_ERROR");
        }
      });

      socket.on("game_error", ({ message, errorType }) => {
        console.warn("CLIENT: Event 'game_error'", { message, errorType });
        if (errorType === "INVALID_MOVE") {
          setError(message, errorType); // Show error but don't clear state
        } else {
          // For critical errors, clear session and store
          setError(message, errorType || "SERVER_ERROR");
          if (errorType === "GAME_NOT_FOUND") {
            sessionManager.clearSession();
            clearStore();
          }
        }
      });

      socket.on(
        "match_found",
        ({
          gameId: newGameId,
          opponentName: newOpponentName,
          assignedPlayerId,
          options,
        }) => {
          console.log("CLIENT: Event 'match_found'", {
            newGameId,
            newOpponentName,
            assignedPlayerId,
            options,
          });
          if (assignedPlayerId !== 1 && assignedPlayerId !== 2) {
            setError(
              "Invalid player assignment from matchmaking",
              "SERVER_ERROR"
            );
            return;
          }
          setGameId(newGameId);
          setLocalPlayerId(assignedPlayerId);
          setOpponentName(newOpponentName);
          setGameState(
            createInitialGameState(
              options || { pawnsPerPlayer: PAWNS_PER_PLAYER }
            )
          );
          setIsWaitingForOpponent(false);
          console.log(
            `CLIENT: Match found! Game: ${newGameId}. You are P${assignedPlayerId} vs ${newOpponentName}.`
          );
        }
      );

      socket.on("pong_time", handlePongTime);
      socket.on("matchmaking_joined", ({ message }) =>
        console.log("CLIENT: Matchmaking joined:", message)
      );
      socket.on("matchmaking_left", ({ message }) =>
        console.log("CLIENT: Matchmaking left:", message)
      );

      socket.on("rematch_requested", ({ requestedBy, playerName }) => {
        // This is handled by SidePanel
      });

      socket.on("undo_requested", ({ requestedBy, playerName, undoCount }) => {
        // This is handled by SidePanel
        console.log(`CLIENT: Undo requested by ${playerName} (${undoCount} moves available)`);
      });

      socket.on(
        "undo_applied",
        ({ gameState: compressedState, options, undoneByPlayer }) => {
          console.log(
            `CLIENT: Undo applied, restoring state from P${undoneByPlayer}'s turn`
          );

          const decodedState = handleAndDeserializeState(
            compressedState,
            "undo_applied"
          );
          if (decodedState) {
            setGameState({ ...decodedState, options });
            console.log(
              `CLIENT: Undo applied. Current turn: P${decodedState.currentPlayerId}`
            );
          }
        }
      );

      socket.on("undo_declined", ({ declinedBy, playerName }) => {
        // This is handled by SidePanel
        console.log(`CLIENT: Undo declined by ${playerName}`);
      });

      socket.on(
        "rematch_started",
        ({ gameState: compressedState, options }) => {
          console.log(
            "CLIENT: CRITICAL - Rematch started, preserving socket during state update"
          );

          // PRESERVE socket BEFORE processing new state
          const socketToPreserve = socket;
          socketRef.current = socketToPreserve;
          (window as any).globalSocket = socketToPreserve;
          (window as any).persistedSocket = socketToPreserve;
          (window as any).emergency_socket = socketToPreserve;

          const decodedState = handleAndDeserializeState(
            compressedState,
            "rematch_started"
          );
          if (decodedState) {
            console.log("CLIENT: Processing rematch state update...");

            // Update game state
            setGameState({ ...decodedState, options });
            setIsWaitingForOpponent(false);

            // CRITICAL: Immediately re-preserve socket after state update
            setTimeout(() => {
              console.log(
                "CLIENT: Re-preserving socket after rematch state update"
              );
              socketRef.current = socketToPreserve;
              (window as any).globalSocket = socketToPreserve;
              (window as any).persistedSocket = socketToPreserve;
              (window as any).emergency_socket = socketToPreserve;

              // Force update store
              gameStore.setState({
                _internalSocketRef: socketRef,
                isConnected: true,
                isWaitingForOpponent: false,
                error: null,
                errorType: null,
              } as Partial<FullGameStore>);

              console.log(
                `CLIENT: Rematch completed successfully. Socket preserved: ${socketToPreserve.id}`
              );
            }, 100);

            console.log(
              `CLIENT: Rematch started. Current turn: P${decodedState.currentPlayerId}`
            );
          }
        }
      );

      socket.on("rematch_declined", ({ declinedBy, playerName }) => {
        // This is handled by SidePanel
      });

      console.log(
        "CLIENT: All socket event handlers registered for socket ID:",
        socket.id
      );
    },
    [
      setPersistedSocket,
      setGameId,
      setGameState,
      setLocalPlayerId,
      setOpponentName,
      setPlayers,
      setError,
      setIsWaitingForOpponent,
      storeApplyDeltaUpdates,
      syncTime,
      setPingLatency,
      clearStore,
    ]
  );

  // FIXED: Enhanced connectSocketIO with immediate session check
  const connectSocketIO = useCallback((): Promise<Socket> => {
    if (connectionPromiseRef.current) return connectionPromiseRef.current;
    if (socketRef.current?.connected) return Promise.resolve(socketRef.current);

    const promise = new Promise<Socket>((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Socket.IO only in browser."));
        return;
      }
      console.log("CLIENT: Attempting socket connection to:", socketServerUrl);

      let newSocket: Socket<ServerToClientEvents, ClientToServerEvents>;
      if (socketRef.current && !socketRef.current.connected) {
        console.log("CLIENT: Reusing existing disconnected socket instance.");
        newSocket = socketRef.current;
      } else {
        console.log("CLIENT: Creating new socket instance.");
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
        newSocket = io(socketServerUrl, {
          path: "/api/socketio/",
          transports: ["websocket", "polling"],
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          timeout: 20000,
          autoConnect: false,
          forceNew: true,
        });
        socketRef.current = newSocket;
        gameStore.setState({
          _internalSocketRef: socketRef,
        } as Partial<FullGameStore>);
      }

      setIsConnecting(true);
      setError(null, null);

      newSocket.removeAllListeners();
      setupEventHandlers(newSocket);

      const connTimeout = setTimeout(() => {
        console.error("CLIENT: Connection attempt timed out to server.");
        setError("Connection timeout.", "SERVER_ERROR");
        setIsConnecting(false);
        newSocket.disconnect();
        connectionPromiseRef.current = null;
        reject(new Error("Connection timeout"));
      }, 20000);

      newSocket.on("connect", () => {
        clearTimeout(connTimeout);
        console.log("CLIENT: Socket connected successfully. ID:", newSocket.id);

        // Store socket references
        socketRef.current = newSocket;
        (window as any).globalSocket = newSocket;
        (window as any).persistedSocket = newSocket;
        (window as any).emergency_socket = newSocket;
        (window as any).backup_socket = newSocket;

        gameStore.setState({
          _internalSocketRef: socketRef,
          isConnected: true,
          isConnecting: false,
          error: null,
          errorType: null,
        } as Partial<FullGameStore>);

        setIsConnected(true);
        setIsConnecting(false);
        syncTime();

        // CRITICAL FIX: Check for session and attempt reconnection IMMEDIATELY
        const session = sessionManager.getSession();
        console.log("CLIENT: Checking for saved session after connect:", session);
        
        if (session && session.gameId && session.sessionToken) {
          console.log(`CLIENT: Found saved session for game ${session.gameId}. Attempting to reconnect...`);
          
          // Set up temporary listeners for reconnection response
          const reconnectionTimeout = setTimeout(() => {
            console.warn("CLIENT: Reconnection attempt timed out");
            // Don't clear session here - let user manually retry
          }, 10000);

          const handleReconnectionSuccess = (data: any) => {
            clearTimeout(reconnectionTimeout);
            console.log("CLIENT: Reconnection successful:", data);
            newSocket.off("game_error", handleReconnectionError);
          };

          const handleReconnectionError = (error: any) => {
            clearTimeout(reconnectionTimeout);
            console.warn("CLIENT: Reconnection failed:", error);
            
            // Only clear session if it's truly invalid
            if (error.errorType === "GAME_NOT_FOUND") {
              console.log("CLIENT: Clearing invalid session");
              sessionManager.clearSession();
            }
            
            newSocket.off("game_joined", handleReconnectionSuccess);
          };

          // Set up one-time listeners
          newSocket.once("game_joined", handleReconnectionSuccess);
          newSocket.once("game_error", handleReconnectionError);

          // Attempt reconnection
          newSocket.emit("reconnect_session", {
            gameId: session.gameId,
            sessionToken: session.sessionToken,
          });
        } else {
          console.log("CLIENT: No valid session found, ready for new connection");
        }

        connectionPromiseRef.current = null;
        resolve(newSocket);
      });

      newSocket.on("connect_error", (err) => {
        clearTimeout(connTimeout);
        console.error("CLIENT: Socket connection error:", err.message, err.name, err.cause);
        setError(`Connection failed: ${err.message}`, "SERVER_ERROR");
        setIsConnected(false);
        setIsConnecting(false);
        connectionPromiseRef.current = null;
        reject(err);
      });

      newSocket.on("disconnect", (reason) => {
        clearTimeout(connTimeout);
        console.log("CLIENT: Socket disconnected. Reason:", reason);

        setIsConnected(false);
        setIsConnecting(false);

        // Don't clear socket immediately for network disconnects
        if (reason === "io server disconnect" || reason === "io client disconnect") {
          console.log("CLIENT: Intentional disconnect - clearing socket references");
          connectionPromiseRef.current = null;
          setTimeout(() => {
            if (!socketRef.current?.connected) {
              socketRef.current = null;
              delete (window as any).globalSocket;
              delete (window as any).persistedSocket;
            }
          }, 5000);
        } else {
          console.log("CLIENT: Network disconnect - preserving socket for reconnection");
        }
      });

      console.log("CLIENT: Calling newSocket.connect()");
      newSocket.connect();
    });
    
    connectionPromiseRef.current = promise;
    return promise;
  }, [socketServerUrl, setIsConnecting, setError, setIsConnected, syncTime, setupEventHandlers]);

  const getAdjustedTime = useCallback(
    () => Date.now() + serverTimeOffset.current,
    []
  );

  const createGame = useCallback(
    async (
      playerName: string,
      options: GameOptions = { pawnsPerPlayer: PAWNS_PER_PLAYER }
    ) => {
      console.log(
        "CLIENT: createGame action called by UI. Player:",
        playerName
      );
      try {
        const socket = await connectSocketIO();
        setError(null, null);
        setIsWaitingForOpponent(true);
        socket.emit("create_game", {
          playerName,
          options,
          clientTimestamp: getAdjustedTime(),
        });
      } catch (err: any) {
        console.error("CLIENT: Create game failed:", err);
        setError(`Create game failed: ${err.message}`, "SERVER_ERROR");
        setIsWaitingForOpponent(false);
      }
    },
    [connectSocketIO, getAdjustedTime, setError, setIsWaitingForOpponent]
  );

  // IMPROVED: joinGame method with better session handling
  const joinGame = useCallback(
    async (gameIdToJoin: string, playerName: string, options?: GameOptions) => {
      console.log("CLIENT: joinGame action called by UI. Game:", gameIdToJoin, "Player:", playerName);
      
      // Check if we're already in this game
      if (gameId === gameIdToJoin && isConnectedState) {
        console.log("CLIENT: Already in game", gameIdToJoin);
        const currentPlayers = gameStore.getState().players;
        if (currentPlayers.filter((p) => p.isConnected).length < 2) {
          setIsWaitingForOpponent(true);
        }
        return;
      }

      try {
        const socket = await connectSocketIO();
        setError(null, null);
        setIsWaitingForOpponent(true);
        
        // CRITICAL: Check if we have a session for this specific game
        const savedSession = sessionManager.getSession();
        if (savedSession && savedSession.gameId === gameIdToJoin && savedSession.playerName === playerName) {
          console.log("CLIENT: Found matching session for this game, attempting reconnection first");
          
          socket.emit("reconnect_session", {
            gameId: gameIdToJoin,
            sessionToken: savedSession.sessionToken,
          });
        } else {
          console.log("CLIENT: No matching session found, joining as new player");
          
          socket.emit("join_game", {
            gameId: gameIdToJoin,
            playerName,
            options,
            clientTimestamp: getAdjustedTime(),
          });
        }
        
      } catch (err: any) {
        console.error("CLIENT: Join game failed:", err);
        setError(`Join game failed: ${err.message}`, "SERVER_ERROR");
        setIsWaitingForOpponent(false);
      }
    },
    [connectSocketIO, getAdjustedTime, setError, setIsWaitingForOpponent, gameId, isConnectedState]
  );

  const placePawnAction = useCallback(
    (squareIndex: number) => {
      const currentSocket = socketRef.current;
      const currentLobbyId = gameStore.getState().gameId;
      if (!currentSocket?.connected || !currentLobbyId) {
        console.error("CLIENT: Not connected to game server for place pawn");
        setError("Not connected to game server.", "SERVER_ERROR");
        return;
      }
      console.log(
        `CLIENT: Emitting 'place_pawn' for square ${squareIndex} in game ${currentLobbyId}`
      );
      currentSocket.emit("place_pawn", {
        gameId: currentLobbyId,
        squareIndex,
        clientTimestamp: getAdjustedTime(),
      });
    },
    [getAdjustedTime, setError]
  );

  const movePawnAction = useCallback(
    (fromIndex: number, toIndex: number) => {
      const currentSocket = socketRef.current;
      const currentLobbyId = gameStore.getState().gameId;
      if (!currentSocket?.connected || !currentLobbyId) {
        console.error("CLIENT: Not connected to game server for move pawn");
        setError("Not connected to game server.", "SERVER_ERROR");
        return;
      }
      console.log(
        `CLIENT: Emitting 'move_pawn' from ${fromIndex} to ${toIndex} in game ${currentLobbyId}`
      );
      currentSocket.emit("move_pawn", {
        gameId: currentLobbyId,
        fromIndex,
        toIndex,
        clientTimestamp: getAdjustedTime(),
      });
    },
    [getAdjustedTime, setError]
  );

  const clearError = useCallback(() => setError(null, null), [setError]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log("CLIENT: Manually disconnecting socket and clearing store.");
      socketRef.current.disconnect();
      sessionManager.clearSession();
      clearStore();
    }
  }, [clearStore]);

  const joinMatchmakingQueue = useCallback(
    async (playerName: string, rating?: number) => {
      console.log("CLIENT: joinMatchmakingQueue action. Player:", playerName);
      try {
        if (!playerName?.trim()) {
          console.error("CLIENT: Player name is required for matchmaking");
          setError("Player name is required.", "JOIN_FAILED");
          return;
        }
        const socket = await connectSocketIO();
        socket.emit("join_matchmaking", {
          playerName,
          rating,
          clientTimestamp: getAdjustedTime(),
        });
      } catch (err: any) {
        console.error("CLIENT: Matchmaking join failed:", err);
        setError(`Matchmaking join failed: ${err.message}`, "SERVER_ERROR");
      }
    },
    [connectSocketIO, getAdjustedTime, setError]
  );

  const leaveMatchmakingQueue = useCallback(async () => {
    console.log("CLIENT: leaveMatchmakingQueue action.");
    const currentSocket = socketRef.current;
    if (!currentSocket?.connected) {
      console.error("CLIENT: Not connected for leave matchmaking");
      setError("Not connected.", "SERVER_ERROR");
      return;
    }
    currentSocket.emit("leave_matchmaking", {
      clientTimestamp: getAdjustedTime(),
    });
  }, [getAdjustedTime, setError]);

  const requestRematch = useCallback(() => {
    console.log("CLIENT: requestRematch called");

    // Try EVERY possible method to get the socket
    let currentSocket = socketRef.current;

    if (!currentSocket) {
      currentSocket = persistedSocket;
      console.log("CLIENT: Using persisted socket:", currentSocket?.id);
    }

    if (!currentSocket) {
      currentSocket = (window as any).globalSocket;
      console.log("CLIENT: Using global socket:", currentSocket?.id);
    }

    if (!currentSocket) {
      currentSocket = (window as any).persistedSocket;
      console.log(
        "CLIENT: Using additional persisted socket:",
        currentSocket?.id
      );
    }

    if (!currentSocket) {
      currentSocket = gameStore.getState()._internalSocketRef?.current || null;
      console.log("CLIENT: Using store socket:", currentSocket?.id);
    }

    const currentLobbyId = gameStore.getState().gameId;

    console.log("CLIENT: SUPER DETAILED rematch debug:", {
      socketRef: !!socketRef.current,
      persistedSocket: !!persistedSocket,
      globalSocket: !!(window as any).globalSocket,
      additionalPersisted: !!(window as any).persistedSocket,
      storeSocket: !!gameStore.getState()._internalSocketRef?.current,
      finalSocket: !!currentSocket,
      socketConnected: currentSocket?.connected,
      socketId: currentSocket?.id,
      gameId: currentLobbyId,
      isConnected: gameStore.getState().isConnected,
      localPlayerId: gameStore.getState().localPlayerId,
      players: gameStore.getState().players.length,
    });

    if (!currentSocket) {
      console.error("CLIENT: CRITICAL - No socket found in ANY location");
      setError(
        "Socket connection completely lost. Please refresh the page.",
        "SERVER_ERROR"
      );
      return;
    }

    if (!currentSocket.connected) {
      console.error("CLIENT: Socket found but not connected");
      setError("Connection lost. Please refresh the page.", "SERVER_ERROR");
      return;
    }

    if (!currentLobbyId) {
      console.error("CLIENT: No game ID found");
      setError("Game session lost. Please start a new game.", "SERVER_ERROR");
      return;
    }

    console.log(
      `CLIENT: Requesting rematch for game ${currentLobbyId} via socket ${currentSocket.id}`
    );

    try {
      currentSocket.emit("request_rematch", {
        gameId: currentLobbyId,
        clientTimestamp: getAdjustedTime(),
      });
      console.log("CLIENT: Rematch request sent successfully");
    } catch (error: any) {
      console.error("CLIENT: Error sending rematch request:", error);
      setError(
        `Failed to send rematch request: ${error.message}`,
        "SERVER_ERROR"
      );
    }
  }, [getAdjustedTime, setError, persistedSocket]);

  const respondToRematch = useCallback(
    (accepted: boolean) => {
      console.log(`CLIENT: respondToRematch called with: ${accepted}`);

      // Try EVERY possible method to get the socket
      let currentSocket = socketRef.current;

      if (!currentSocket) {
        currentSocket = persistedSocket;
        console.log(
          "CLIENT: Using persisted socket for response:",
          currentSocket?.id
        );
      }

      if (!currentSocket) {
        currentSocket = (window as any).globalSocket;
        console.log(
          "CLIENT: Using global socket for response:",
          currentSocket?.id
        );
      }

      if (!currentSocket) {
        currentSocket = (window as any).persistedSocket;
        console.log(
          "CLIENT: Using additional persisted socket for response:",
          currentSocket?.id
        );
      }

      if (!currentSocket) {
        currentSocket =
          gameStore.getState()._internalSocketRef?.current || null;
        console.log(
          "CLIENT: Using store socket for response:",
          currentSocket?.id
        );
      }

      const currentLobbyId = gameStore.getState().gameId;

      console.log("CLIENT: Respond rematch SUPER debug:", {
        socketRef: !!socketRef.current,
        persistedSocket: !!persistedSocket,
        globalSocket: !!(window as any).globalSocket,
        additionalPersisted: !!(window as any).persistedSocket,
        storeSocket: !!gameStore.getState()._internalSocketRef?.current,
        finalSocket: !!currentSocket,
        socketConnected: currentSocket?.connected,
        socketId: currentSocket?.id,
        gameId: currentLobbyId,
        accepted,
      });

      if (!currentSocket?.connected || !currentLobbyId) {
        console.error(
          "CLIENT: Cannot respond to rematch - connection/game issue"
        );
        setError(
          "Connection issue. Cannot respond to rematch.",
          "SERVER_ERROR"
        );
        return;
      }

      console.log(
        `CLIENT: Responding to rematch request: ${
          accepted ? "accepted" : "declined"
        }`
      );

      try {
        currentSocket.emit("respond_rematch", {
          gameId: currentLobbyId,
          accepted,
          clientTimestamp: getAdjustedTime(),
        });
        console.log("CLIENT: Rematch response sent successfully");
      } catch (error: any) {
        console.error("CLIENT: Error sending rematch response:", error);
        setError(
          `Failed to respond to rematch: ${error.message}`,
          "SERVER_ERROR"
        );
      }
    },
    [getAdjustedTime, setError, persistedSocket]
  );

  const requestUndo = useCallback(() => {
    console.log("CLIENT: requestUndo called");

    // Try EVERY possible method to get the socket (same as rematch)
    let currentSocket = socketRef.current;

    if (!currentSocket) {
      currentSocket = persistedSocket;
    }
    if (!currentSocket) {
      currentSocket = (window as any).globalSocket;
    }
    if (!currentSocket) {
      currentSocket = (window as any).persistedSocket;
    }
    if (!currentSocket) {
      currentSocket = gameStore.getState()._internalSocketRef?.current || null;
    }

    const currentLobbyId = gameStore.getState().gameId;

    console.log("CLIENT: requestUndo debug:", {
      socketConnected: currentSocket?.connected,
      socketId: currentSocket?.id,
      gameId: currentLobbyId,
    });

    if (!currentSocket) {
      console.error("CLIENT: CRITICAL - No socket found for undo request");
      setError(
        "Socket connection lost. Please refresh the page.",
        "SERVER_ERROR"
      );
      return;
    }

    if (!currentSocket.connected) {
      console.error("CLIENT: Socket found but not connected");
      setError("Connection lost. Please refresh the page.", "SERVER_ERROR");
      return;
    }

    if (!currentLobbyId) {
      console.error("CLIENT: No game ID found for undo request");
      setError("Game session lost. Please start a new game.", "SERVER_ERROR");
      return;
    }

    console.log(
      `CLIENT: Requesting undo for game ${currentLobbyId} via socket ${currentSocket.id}`
    );

    try {
      currentSocket.emit("request_undo", {
        gameId: currentLobbyId,
        clientTimestamp: getAdjustedTime(),
      });
      console.log("CLIENT: Undo request sent successfully");
    } catch (error: any) {
      console.error("CLIENT: Error sending undo request:", error);
      setError(
        `Failed to send undo request: ${error.message}`,
        "SERVER_ERROR"
      );
    }
  }, [getAdjustedTime, setError, persistedSocket]);

  const respondToUndo = useCallback(
    (accepted: boolean, movesToUndo: number = 1) => {
      console.log(`CLIENT: respondToUndo called with: ${accepted}, movesToUndo: ${movesToUndo}`);

      // Try EVERY possible method to get the socket (same as rematch)
      let currentSocket = socketRef.current;

      if (!currentSocket) {
        currentSocket = persistedSocket;
      }
      if (!currentSocket) {
        currentSocket = (window as any).globalSocket;
      }
      if (!currentSocket) {
        currentSocket = (window as any).persistedSocket;
      }
      if (!currentSocket) {
        currentSocket =
          gameStore.getState()._internalSocketRef?.current || null;
      }

      const currentLobbyId = gameStore.getState().gameId;

      console.log("CLIENT: respondToUndo debug:", {
        socketConnected: currentSocket?.connected,
        socketId: currentSocket?.id,
        gameId: currentLobbyId,
        accepted,
        movesToUndo,
      });

      if (!currentSocket?.connected || !currentLobbyId) {
        console.error(
          "CLIENT: Cannot respond to undo - connection/game issue"
        );
        setError(
          "Connection issue. Cannot respond to undo request.",
          "SERVER_ERROR"
        );
        return;
      }

      console.log(
        `CLIENT: Responding to undo request: ${
          accepted ? "accepted" : "declined"
        } (${movesToUndo} moves)`
      );

      try {
        currentSocket.emit("respond_undo", {
          gameId: currentLobbyId,
          accepted,
          movesToUndo,
          clientTimestamp: getAdjustedTime(),
        });
        console.log("CLIENT: Undo response sent successfully");
      } catch (error: any) {
        console.error("CLIENT: Error sending undo response:", error);
        setError(
          `Failed to respond to undo: ${error.message}`,
          "SERVER_ERROR"
        );
      }
    },
    [getAdjustedTime, setError, persistedSocket]
  );

  useEffect(() => {
    return () => {
      console.log(
        "CLIENT: useGameConnection unmounting. Disconnecting socket if it exists."
      );
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    // Make sure the socket reference is always available to the store
    if (socketRef.current) {
      gameStore.setState({
        _internalSocketRef: socketRef,
      } as Partial<FullGameStore>);
      console.log(
        "CLIENT: Socket reference updated in store:",
        socketRef.current.id
      );
    }
  }, [socketRef.current?.id]);

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
    createGame,
    joinGame,
    placePawnAction,
    movePawnAction,
    clearError,
    disconnect,
    connectSocketIO,
    joinMatchmakingQueue,
    leaveMatchmakingQueue,
    respondToRematch,
    requestRematch,
    requestUndo,
    respondToUndo,
    _internalSocketRef: socketRef,
  };
}