// PURPOSE: Handles serialization and deserialization of game state using FlatBuffers.

import { Builder as FlatBufferBuilder, ByteBuffer } from "flatbuffers";
import { StrategicPawns as GameStateNS } from "./generated/game-state";
import type {
  GameState,
  SquareState,
  Pawn,
  PlayerId,
  GameOptions,
} from "./types";
import {
  assignPlayerColors,
  PAWNS_PER_PLAYER,
  BOARD_SIZE,
  initializeBoard,
  createInitialGameState,
  updateBlockingStatus,
  updateDeadZones,
  checkWinCondition,
} from "./gameLogic";

const FbGameState = GameStateNS.GameStateBuffer;
const FbSquare = GameStateNS.SquareBuffer;
const FbPawn = GameStateNS.PawnBuffer;
const FbSquareColor = GameStateNS.SquareColor;
const FbGamePhase = GameStateNS.GamePhase;

export function serializeGameState(gameState: GameState): Uint8Array {
  const builder = new FlatBufferBuilder(4096);

  const validCurrentPlayerId =
    gameState.currentPlayerId === 1 || gameState.currentPlayerId === 2
      ? gameState.currentPlayerId
      : 1;

  const squareOffsets = gameState.board.map((square) => {
    let pawnOffset = 0;
    if (square.pawn) {
      const idOffset = builder.createString(square.pawn.id);
      FbPawn.startPawnBuffer(builder);
      FbPawn.addId(builder, idOffset);
      FbPawn.addPlayerId(builder, square.pawn.playerId);
      FbPawn.addColor(
        builder,
        square.pawn.color === "light" ? FbSquareColor.Light : FbSquareColor.Dark
      );
      pawnOffset = FbPawn.endPawnBuffer(builder);
    }

    FbSquare.startSquareBuffer(builder);
    FbSquare.addIndex(builder, square.index);
    FbSquare.addRow(builder, square.row);
    FbSquare.addCol(builder, square.col);
    FbSquare.addBoardColor(
      builder,
      square.boardColor === "light" ? FbSquareColor.Light : FbSquareColor.Dark
    );
    if (square.pawn) {
      FbSquare.addPawn(builder, pawnOffset);
    }
    let highlightValue = 0;
    if (square.highlight) {
      switch (square.highlight) {
        case "selectedPawn":
          highlightValue = 1;
          break;
        case "validMove":
          highlightValue = 2;
          break;
        case "deadZoneIndicator":
          highlightValue = 3;
          break;
      }
    }
    FbSquare.addHighlight(builder, highlightValue);
    return FbSquare.endSquareBuffer(builder);
  });

  const boardVectorOffset = FbGameState.createBoardVector(
    builder,
    squareOffsets
  );

  FbGameState.startGameStateBuffer(builder);
  FbGameState.addBoard(builder, boardVectorOffset);
  FbGameState.addCurrentPlayerId(builder, validCurrentPlayerId);
  const gamePhaseValue =
    gameState.gamePhase === "placement"
      ? FbGamePhase.Placement
      : FbGamePhase.Movement;
  FbGameState.addGamePhase(builder, gamePhaseValue);
  FbGameState.addPawnsToPlacePlayer1(builder, gameState.pawnsToPlace[1] || 0);
  FbGameState.addPawnsToPlacePlayer2(builder, gameState.pawnsToPlace[2] || 0);
  FbGameState.addPawnsPlacedPlayer1(builder, gameState.placedPawns[1] || 0);
  FbGameState.addPawnsPlacedPlayer2(builder, gameState.placedPawns[2] || 0);
  FbGameState.addSelectedPawnIndex(
    builder,
    gameState.selectedPawnIndex !== null ? gameState.selectedPawnIndex : -1
  );
  FbGameState.addWinner(
    builder,
    gameState.winner !== null ? gameState.winner : 0
  );

  if (gameState.lastMove) {
    FbGameState.addLastMoveFrom(
      builder,
      gameState.lastMove.from !== null ? gameState.lastMove.from : -1
    );
    FbGameState.addLastMoveTo(builder, gameState.lastMove.to);
  } else {
    FbGameState.addLastMoveFrom(builder, -1);
    FbGameState.addLastMoveTo(builder, -1);
  }

  FbGameState.addSeqId(builder, BigInt(Date.now()));
  FbGameState.addTimestamp(builder, BigInt(Date.now()));

  const gameStateOffset = FbGameState.endGameStateBuffer(builder);
  builder.finish(gameStateOffset);
  return builder.asUint8Array();
}

export function deserializeGameState(data: Uint8Array): GameState {
  try {
    const buf = new ByteBuffer(data);
    const fbState = FbGameState.getRootAsGameStateBuffer(buf);

    const rawCurrentPlayerId = fbState.currentPlayerId();
    const currentPlayerId =
      rawCurrentPlayerId === 1 || rawCurrentPlayerId === 2
        ? (rawCurrentPlayerId as PlayerId)
        : (1 as PlayerId);

    const rawGamePhase = fbState.gamePhase();
    const gamePhase =
      rawGamePhase === FbGamePhase.Placement ? "placement" : "movement";

    const board: SquareState[] = [];
    const boardLength = fbState.boardLength();

    if (boardLength !== BOARD_SIZE * BOARD_SIZE) {
      console.error(
        `DESERIALIZATION: Expected ${
          BOARD_SIZE * BOARD_SIZE
        } squares, got ${boardLength}. Data likely corrupted.`
      );
      return createInitialGameState();
    }

    for (let i = 0; i < boardLength; i++) {
      const fbSq = fbState.board(i);
      if (!fbSq) {
        console.error(`DESERIALIZATION: Missing square buffer at index ${i}.`);
        const defaultRow = Math.floor(i / BOARD_SIZE);
        const defaultCol = i % BOARD_SIZE;
        board.push({
          index: i,
          row: defaultRow,
          col: defaultCol,
          boardColor: (defaultRow + defaultCol) % 2 === 0 ? "light" : "dark",
          pawn: null,
          highlight: undefined,
        });
        continue;
      }

      let pawn: Pawn | null = null;
      const fbP = fbSq.pawn();
      if (fbP) {
        const pawnPlayerIdRaw = fbP.playerId();
        const validPawnPlayerId =
          pawnPlayerIdRaw === 1 || pawnPlayerIdRaw === 2
            ? (pawnPlayerIdRaw as PlayerId)
            : (1 as PlayerId);
        pawn = {
          id: fbP.id() || `p${validPawnPlayerId}_${i}`,
          playerId: validPawnPlayerId,
          color: fbP.color() === FbSquareColor.Light ? "light" : "dark",
        };
      }

      let highlight: SquareState["highlight"] = undefined;
      const highlightVal = fbSq.highlight();
      if (highlightVal !== 0) {
        switch (highlightVal) {
          case 1:
            highlight = "selectedPawn";
            break;
          case 2:
            highlight = "validMove";
            break;
          case 3:
            highlight = "deadZoneIndicator";
            break;
        }
      }
      board.push({
        index: fbSq.index(),
        row: fbSq.row(),
        col: fbSq.col(),
        boardColor:
          fbSq.boardColor() === FbSquareColor.Light ? "light" : "dark",
        pawn,
        highlight,
      });
    }

    const winnerRaw = fbState.winner();
    const winner =
      winnerRaw === 1 || winnerRaw === 2 ? (winnerRaw as PlayerId) : null;

    const lastMoveTo = fbState.lastMoveTo();
    const lastMoveFrom = fbState.lastMoveFrom();
    const lastMove =
      lastMoveTo !== -1
        ? { from: lastMoveFrom === -1 ? null : lastMoveFrom, to: lastMoveTo }
        : null;

    const defaultOptions: GameOptions = {
      pawnsPerPlayer: PAWNS_PER_PLAYER,
      isPublic: false,
      isMatchmaking: false,
      isRanked: false,
    };

    const deserialized: GameState = {
      board,
      currentPlayerId,
      playerColors: assignPlayerColors(),
      gamePhase,
      pawnsToPlace: {
        1: fbState.pawnsToPlacePlayer1(),
        2: fbState.pawnsToPlacePlayer2(),
      },
      placedPawns: {
        1: fbState.pawnsPlacedPlayer1(),
        2: fbState.pawnsPlacedPlayer2(),
      },
      selectedPawnIndex:
        fbState.selectedPawnIndex() === -1 ? null : fbState.selectedPawnIndex(),
      winner,
      lastMove,
      winningLine: null,
      blockedPawnsInfo: new Set<number>(),
      blockingPawnsInfo: new Set<number>(),
      deadZoneSquares: new Map<number, PlayerId>(),
      deadZoneCreatorPawnsInfo: new Set<number>(),
      highlightedValidMoves: [],
      options: defaultOptions,
    };

    const { blockedPawns, blockingPawns } = updateBlockingStatus(
      deserialized.board
    );
    deserialized.blockedPawnsInfo = blockedPawns;
    deserialized.blockingPawnsInfo = blockingPawns;
    const { deadZones, deadZoneCreatorPawns } = updateDeadZones(
      deserialized.board,
      deserialized.playerColors
    );
    deserialized.deadZoneSquares = deadZones;
    deserialized.deadZoneCreatorPawnsInfo = deadZoneCreatorPawns;

    if (deserialized.winner) {
      const winCheck = checkWinCondition(deserialized);
      deserialized.winningLine = winCheck.winningLine;
    }

    return deserialized;
  } catch (error) {
    console.error("DESERIALIZATION CRITICAL ERROR:", error);
    if (error instanceof Error)
      console.error("DESERIALIZATION ERROR STACK:", error.stack);
    return createInitialGameState();
  }
}

export function createDeltaUpdate(
  previousState: GameState,
  currentState: GameState
): { type: string; changes: any }[] {
  const updates = [];

  if (previousState.currentPlayerId !== currentState.currentPlayerId) {
    updates.push({
      type: "player_turn",
      changes: { playerId: currentState.currentPlayerId },
    });
  }
  if (previousState.gamePhase !== currentState.gamePhase) {
    updates.push({
      type: "game_phase",
      changes: { phase: currentState.gamePhase },
    });
  }

  const boardChanges: {
    index: number;
    pawn: Pawn | null;
    highlight?: SquareState["highlight"];
  }[] = [];
  for (let i = 0; i < currentState.board.length; i++) {
    const prevSq = previousState.board[i];
    const currSq = currentState.board[i];
    const pawnChanged =
      JSON.stringify(prevSq.pawn) !== JSON.stringify(currSq.pawn);
    const highlightChanged = prevSq.highlight !== currSq.highlight;

    if (pawnChanged || highlightChanged) {
      boardChanges.push({
        index: i,
        pawn: currSq.pawn,
        highlight: currSq.highlight,
      });
    }
  }
  if (boardChanges.length > 0) {
    updates.push({ type: "board_update", changes: { squares: boardChanges } });
  }

  if (
    previousState.winner !== currentState.winner ||
    JSON.stringify(previousState.winningLine) !==
      JSON.stringify(currentState.winningLine)
  ) {
    updates.push({
      type: "game_over",
      changes: {
        winner: currentState.winner,
        winningLine: currentState.winningLine,
      },
    });
  }
  if (
    JSON.stringify(previousState.pawnsToPlace) !==
    JSON.stringify(currentState.pawnsToPlace)
  ) {
    updates.push({
      type: "pawns_to_place_update",
      changes: currentState.pawnsToPlace,
    });
  }
  if (
    JSON.stringify(previousState.placedPawns) !==
    JSON.stringify(currentState.placedPawns)
  ) {
    updates.push({
      type: "placed_pawns_update",
      changes: currentState.placedPawns,
    });
  }
  if (previousState.selectedPawnIndex !== currentState.selectedPawnIndex) {
    updates.push({
      type: "selection_update",
      changes: { selectedPawnIndex: currentState.selectedPawnIndex },
    });
  }
  if (
    JSON.stringify(previousState.lastMove) !==
    JSON.stringify(currentState.lastMove)
  ) {
    updates.push({ type: "last_move_update", changes: currentState.lastMove });
  }
  if (
    JSON.stringify(previousState.options) !==
    JSON.stringify(currentState.options)
  ) {
    updates.push({ type: "options_update", changes: currentState.options });
  }

  return updates;
}
