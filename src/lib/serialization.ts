
import { Builder as FlatBufferBuilder, ByteBuffer } from 'flatbuffers';
import { StrategicPawns as GameStateNS } from './generated/game-state';
import { StrategicPawns as SquareNS } from './generated/square';
import type { GameState, SquareState, Pawn, PlayerId } from './types';

// Alias for generated types
const GameStateBuffer = GameStateNS.GameStateBuffer;
const FBSquareBuffer = SquareNS.SquareBuffer; // Renamed to avoid conflict with SquareState
const FBPawnBuffer = SquareNS.PawnBuffer;
const FBSquareColor = SquareNS.SquareColor;
const FBGamePhase = GameStateNS.GamePhase;


export function serializeGameState(gameState: GameState): Uint8Array {
  const builder = new FlatBufferBuilder(1024);
  
  const squareOffsets = gameState.board.map(square => {
    let pawnOffset = 0;
    if (square.pawn) {
      const idOffset = builder.createString(square.pawn.id);
      FBPawnBuffer.startPawnBuffer(builder);
      FBPawnBuffer.addId(builder, idOffset);
      FBPawnBuffer.addPlayerId(builder, square.pawn.playerId);
      FBPawnBuffer.addColor(builder, square.pawn.color === 'light' ? FBSquareColor.Light : FBSquareColor.Dark);
      pawnOffset = FBPawnBuffer.endPawnBuffer(builder);
    }
    
    FBSquareBuffer.startSquareBuffer(builder);
    FBSquareBuffer.addIndex(builder, square.index);
    FBSquareBuffer.addRow(builder, square.row);
    FBSquareBuffer.addCol(builder, square.col);
    FBSquareBuffer.addBoardColor(builder, square.boardColor === 'light' ? FBSquareColor.Light : FBSquareColor.Dark);
    if (square.pawn) {
      FBSquareBuffer.addPawn(builder, pawnOffset);
    }
    
    let highlightValue = 0; // 0 for none
    if (square.highlight) {
      switch (square.highlight) {
        case 'selectedPawn': highlightValue = 1; break;
        case 'validMove': highlightValue = 2; break;
        case 'deadZoneIndicator': highlightValue = 3; break;
      }
    }
    FBSquareBuffer.addHighlight(builder, highlightValue);
    return FBSquareBuffer.endSquareBuffer(builder);
  });
  
  const boardVectorOffset = GameStateBuffer.createBoardVector(builder, squareOffsets);
  
  GameStateBuffer.startGameStateBuffer(builder);
  GameStateBuffer.addBoard(builder, boardVectorOffset);
  GameStateBuffer.addCurrentPlayerId(builder, gameState.currentPlayerId);
  GameStateBuffer.addGamePhase(builder, gameState.gamePhase === 'placement' ? FBGamePhase.Placement : FBGamePhase.Movement);
  GameStateBuffer.addPawnsToPlacePlayer1(builder, gameState.pawnsToPlace[1]);
  GameStateBuffer.addPawnsToPlacePlayer2(builder, gameState.pawnsToPlace[2]);
  GameStateBuffer.addPawnsPlacedPlayer1(builder, gameState.placedPawns[1]);
  GameStateBuffer.addPawnsPlacedPlayer2(builder, gameState.placedPawns[2]);
  
  if (gameState.selectedPawnIndex !== null) {
    GameStateBuffer.addSelectedPawnIndex(builder, gameState.selectedPawnIndex);
  }
  if (gameState.winner !== null) {
    GameStateBuffer.addWinner(builder, gameState.winner);
  }
  if (gameState.lastMove) {
    if (gameState.lastMove.from !== null) {
      GameStateBuffer.addLastMoveFrom(builder, gameState.lastMove.from);
    }
    GameStateBuffer.addLastMoveTo(builder, gameState.lastMove.to);
  }
  
  GameStateBuffer.addSeqId(builder, BigInt(Date.now())); // Using timestamp as seqId for simplicity
  GameStateBuffer.addTimestamp(builder, BigInt(Date.now()));
  
  const gameStateOffset = GameStateBuffer.endGameStateBuffer(builder);
  builder.finish(gameStateOffset);
  
  return builder.asUint8Array();
}

export function deserializeGameState(data: Uint8Array): GameState {
  const buf = new ByteBuffer(data);
  const gameStateBuf = GameStateBuffer.getRootAsGameStateBuffer(buf);
  
  const board: SquareState[] = [];
  for (let i = 0; i < gameStateBuf.boardLength(); i++) {
    const squareBuf = gameStateBuf.board(i)!;
    let pawn: Pawn | null = null;
    
    const fbPawn = squareBuf.pawn();
    if (fbPawn) {
      pawn = {
        id: fbPawn.id() || `p${fbPawn.playerId()}_${i}`, // Fallback id
        playerId: fbPawn.playerId() as PlayerId,
        color: fbPawn.color() === FBSquareColor.Light ? 'light' : 'dark'
      };
    }
    
    let highlight: SquareState['highlight'] = undefined;
    const highlightVal = squareBuf.highlight();
    if (highlightVal) {
      switch (highlightVal) {
        case 1: highlight = 'selectedPawn'; break;
        case 2: highlight = 'validMove'; break;
        case 3: highlight = 'deadZoneIndicator'; break;
      }
    }
    
    board.push({
      index: squareBuf.index(),
      row: squareBuf.row(),
      col: squareBuf.col(),
      boardColor: squareBuf.boardColor() === FBSquareColor.Light ? 'light' : 'dark',
      pawn,
      highlight
    });
  }
  
  const selectedPawnIndex = gameStateBuf.selectedPawnIndex();
  const winner = gameStateBuf.winner();
  const lastMoveTo = gameStateBuf.lastMoveTo();
  const lastMoveFrom = gameStateBuf.lastMoveFrom();

  return {
    board,
    currentPlayerId: gameStateBuf.currentPlayerId() as PlayerId,
    playerColors: { 1: 'light', 2: 'dark'}, // This should ideally come from gameState or be reconstructed
    gamePhase: gameStateBuf.gamePhase() === FBGamePhase.Placement ? 'placement' : 'movement',
    pawnsToPlace: {
      1: gameStateBuf.pawnsToPlacePlayer1(),
      2: gameStateBuf.pawnsToPlacePlayer2()
    },
    placedPawns: {
      1: gameStateBuf.pawnsPlacedPlayer1(),
      2: gameStateBuf.pawnsPlacedPlayer2()
    },
    selectedPawnIndex: selectedPawnIndex === -1 ? null : selectedPawnIndex,
    blockedPawnsInfo: new Set<number>(), 
    blockingPawnsInfo: new Set<number>(),
    deadZoneSquares: new Map<number, PlayerId>(),
    deadZoneCreatorPawnsInfo: new Set<number>(),
    winner: winner === 0 ? null : winner as PlayerId,
    lastMove: lastMoveTo === -1 ? null : {
      from: lastMoveFrom === -1 ? null : lastMoveFrom,
      to: lastMoveTo
    },
    winningLine: null, 
  };
}

export function createDeltaUpdate(
  previousState: GameState, 
  currentState: GameState
): { type: string, changes: any }[] {
  const updates = [];
  
  if (previousState.currentPlayerId !== currentState.currentPlayerId) {
    updates.push({
      type: 'player_turn',
      changes: { currentPlayerId: currentState.currentPlayerId }
    });
  }
  
  if (previousState.gamePhase !== currentState.gamePhase) {
    updates.push({
      type: 'game_phase',
      changes: { gamePhase: currentState.gamePhase }
    });
  }
  
  const boardChanges: { index: number, pawn: Pawn | null, highlight?: SquareState['highlight'] }[] = [];
  for (let i = 0; i < currentState.board.length; i++) {
    const prevSquare = previousState.board[i];
    const currSquare = currentState.board[i];
    
    const prevPawnId = prevSquare.pawn?.id;
    const currPawnId = currSquare.pawn?.id;
    const prevHighlight = prevSquare.highlight;
    const currHighlight = currSquare.highlight;

    if (prevPawnId !== currPawnId || prevHighlight !== currHighlight) {
      boardChanges.push({
        index: i,
        pawn: currSquare.pawn,
        highlight: currSquare.highlight
      });
    }
  }
  
  if (boardChanges.length > 0) {
    updates.push({
      type: 'board_update',
      changes: { squares: boardChanges }
    });
  }
  
  if (previousState.winner !== currentState.winner && currentState.winner !== null) {
    updates.push({
      type: 'game_over',
      changes: { 
        winner: currentState.winner,
        winningLine: currentState.winningLine // Assuming winningLine is populated in currentState
      }
    });
  }

  // Add other state changes if necessary (e.g., pawnsToPlace, selectedPawnIndex)
  if(previousState.pawnsToPlace[1] !== currentState.pawnsToPlace[1] || previousState.pawnsToPlace[2] !== currentState.pawnsToPlace[2]) {
    updates.push({ type: 'pawns_to_place_update', changes: currentState.pawnsToPlace });
  }
  if(previousState.selectedPawnIndex !== currentState.selectedPawnIndex) {
    updates.push({ type: 'selection_update', changes: { selectedPawnIndex: currentState.selectedPawnIndex } });
  }

  return updates;
}
