
import { Builder as FlatBufferBuilder, ByteBuffer } from 'flatbuffers';
import { StrategicPawns as GameStateNS } from './generated/game-state';
import { StrategicPawns as SquareNS } from './generated/square';
import type { GameState, SquareState, Pawn, PlayerId, SquareColor, GamePhase as AppGamePhase } from './types'; // Use AppGamePhase alias
import { assignPlayerColors } from './gameLogic'; // Import assignPlayerColors

// Alias for generated types
const GameStateBuffer = GameStateNS.GameStateBuffer;
const FBSquareBuffer = SquareNS.SquareBuffer; 
const FBPawnBuffer = SquareNS.PawnBuffer;
const FBSquareColor = SquareNS.SquareColor;
const FBGamePhase = GameStateNS.GamePhase;


export function serializeGameState(gameState: GameState): Uint8Array {
  const builder = new FlatBufferBuilder(2048); // Increased buffer size
  
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
    FBSquareBuffer.addRow(builder, square.row); // Assuming row/col are part of SquareState in types.ts
    FBSquareBuffer.addCol(builder, square.col);   // Assuming row/col are part of SquareState in types.ts
    FBSquareBuffer.addBoardColor(builder, square.boardColor === 'light' ? FBSquareColor.Light : FBSquareColor.Dark);
    if (square.pawn) {
      FBSquareBuffer.addPawn(builder, pawnOffset);
    }
    
    let highlightValue = 0; 
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
  } else {
     GameStateBuffer.addSelectedPawnIndex(builder, -1); // Use -1 to represent null
  }
  if (gameState.winner !== null) {
    GameStateBuffer.addWinner(builder, gameState.winner);
  } else {
     GameStateBuffer.addWinner(builder, 0); // Use 0 to represent null for winner
  }

  if (gameState.lastMove) {
    GameStateBuffer.addLastMoveFrom(builder, gameState.lastMove.from !== null ? gameState.lastMove.from : -1);
    GameStateBuffer.addLastMoveTo(builder, gameState.lastMove.to);
  } else {
    GameStateBuffer.addLastMoveFrom(builder, -1);
    GameStateBuffer.addLastMoveTo(builder, -1);
  }
  
  GameStateBuffer.addSeqId(builder, BigInt(Date.now())); 
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
        id: fbPawn.id() || `p${fbPawn.playerId()}_sq${squareBuf.index()}`, // Ensure unique ID if FB ID is null
        playerId: fbPawn.playerId() as PlayerId,
        color: fbPawn.color() === FBSquareColor.Light ? 'light' : 'dark'
      };
    }
    
    let highlight: SquareState['highlight'] = undefined;
    const highlightVal = squareBuf.highlight();
    if (highlightVal !== 0) { // 0 is default "no highlight"
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
  
  const selectedPawnIndexRaw = gameStateBuf.selectedPawnIndex();
  const winnerRaw = gameStateBuf.winner();
  const lastMoveToRaw = gameStateBuf.lastMoveTo();
  const lastMoveFromRaw = gameStateBuf.lastMoveFrom();

  return {
    board,
    currentPlayerId: gameStateBuf.currentPlayerId() as PlayerId,
    playerColors: assignPlayerColors(), // Re-assign standard colors
    gamePhase: gameStateBuf.gamePhase() === FBGamePhase.Placement ? 'placement' : 'movement',
    pawnsToPlace: {
      1: gameStateBuf.pawnsToPlacePlayer1(),
      2: gameStateBuf.pawnsToPlacePlayer2()
    },
    placedPawns: {
      1: gameStateBuf.pawnsPlacedPlayer1(),
      2: gameStateBuf.pawnsPlacedPlayer2()
    },
    selectedPawnIndex: selectedPawnIndexRaw === -1 ? null : selectedPawnIndexRaw,
    blockedPawnsInfo: new Set<number>(), 
    blockingPawnsInfo: new Set<number>(),
    deadZoneSquares: new Map<number, PlayerId>(),
    deadZoneCreatorPawnsInfo: new Set<number>(),
    winner: winnerRaw === 0 ? null : winnerRaw as PlayerId,
    lastMove: lastMoveToRaw === -1 ? null : {
      from: lastMoveFromRaw === -1 ? null : lastMoveFromRaw,
      to: lastMoveToRaw
    },
    winningLine: null, 
    highlightedValidMoves: [],
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
      changes: { playerId: currentState.currentPlayerId }
    });
  }
  
  if (previousState.gamePhase !== currentState.gamePhase) {
    updates.push({
      type: 'game_phase',
      changes: { phase: currentState.gamePhase }
    });
  }
  
  const boardChanges: { index: number, pawn: Pawn | null, highlight?: SquareState['highlight'] }[] = [];
  for (let i = 0; i < currentState.board.length; i++) {
    const prevSquare = previousState.board[i];
    const currSquare = currentState.board[i];
    
    const prevPawnId = prevSquare.pawn?.id;
    const currPawnId = currSquare.pawn?.id;
    const prevPawnPlayer = prevSquare.pawn?.playerId;
    const currPawnPlayer = currSquare.pawn?.playerId;
    const prevHighlight = prevSquare.highlight;
    const currHighlight = currSquare.highlight;

    if (prevPawnId !== currPawnId || 
        prevPawnPlayer !== currPawnPlayer ||
        prevHighlight !== currHighlight) {
      boardChanges.push({
        index: i,
        pawn: currSquare.pawn, // Send full pawn object or null
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
  
  if (previousState.winner !== currentState.winner) { // Update if winner changes (null -> PlayerId or vice-versa if game resets)
    updates.push({
      type: 'game_over',
      changes: { 
        winner: currentState.winner,
        winningLine: currentState.winningLine 
      }
    });
  }

  if(JSON.stringify(previousState.pawnsToPlace) !== JSON.stringify(currentState.pawnsToPlace)) {
    updates.push({ type: 'pawns_to_place_update', changes: currentState.pawnsToPlace });
  }
  if(JSON.stringify(previousState.placedPawns) !== JSON.stringify(currentState.placedPawns)) {
    updates.push({ type: 'placed_pawns_update', changes: currentState.placedPawns });
  }
  if(previousState.selectedPawnIndex !== currentState.selectedPawnIndex) {
    updates.push({ type: 'selection_update', changes: { selectedPawnIndex: currentState.selectedPawnIndex } });
  }
  if (JSON.stringify(previousState.lastMove) !== JSON.stringify(currentState.lastMove)) {
     updates.push({ type: 'last_move_update', changes: currentState.lastMove });
  }
  // Note: blockedPawnsInfo, blockingPawnsInfo, deadZoneSquares, deadZoneCreatorPawnsInfo, winningLine, highlightedValidMoves
  // are often recalculated client-side based on the board state. If they need to be synced explicitly, add checks here.

  return updates;
}
