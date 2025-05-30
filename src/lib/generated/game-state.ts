// CORRECTED COMPLETE FLATBUFFERS STUB
// @ts-nocheck

import type { flatbuffers } from 'flatbuffers';

export namespace StrategicPawns {
  export enum GamePhase {
    Placement = 0,
    Movement = 1
  }

  export enum SquareColor {
    Light = 0,
    Dark = 1
  }

  export class PawnBuffer {
    bb: flatbuffers.ByteBuffer|null = null;
    bb_pos = 0;

    __init(i: number, bb: flatbuffers.ByteBuffer): PawnBuffer {
      this.bb_pos = i;
      this.bb = bb;
      return this;
    }

    static getRootAsPawnBuffer(bb: flatbuffers.ByteBuffer, obj?: PawnBuffer): PawnBuffer {
      return (obj || new PawnBuffer()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }

    id(): string|null { 
      const o = this.bb!.__offset(this.bb_pos, 4); 
      return o ? this.bb!.__string(this.bb_pos + o) : null; 
    }
    
    // CRITICAL FIX: Match the write type (Int8) with read type
    playerId(): number { 
      const o = this.bb!.__offset(this.bb_pos, 6); 
      return o ? this.bb!.readInt8(this.bb_pos + o) : 1; // Changed from readUint8 to readInt8, default to 1
    }
    
    // CRITICAL FIX: Match the write type (Int8) with read type  
    color(): SquareColor { 
      const o = this.bb!.__offset(this.bb_pos, 8); 
      return o ? this.bb!.readInt8(this.bb_pos + o) : SquareColor.Light; // Changed from readUint8 to readInt8
    }

    static startPawnBuffer(builder: flatbuffers.Builder) { builder.startObject(3); }
    static addId(builder: flatbuffers.Builder, idOffset: flatbuffers.Offset) { builder.addFieldOffset(0, idOffset, 0); }
    static addPlayerId(builder: flatbuffers.Builder, playerId: number) { builder.addFieldInt8(1, playerId, 1); } // Default to 1, not 0
    static addColor(builder: flatbuffers.Builder, color: SquareColor) { builder.addFieldInt8(2, color, SquareColor.Light); }
    static endPawnBuffer(builder: flatbuffers.Builder): flatbuffers.Offset { return builder.endObject(); }
  }

  export class SquareBuffer {
    bb: flatbuffers.ByteBuffer|null = null;
    bb_pos = 0;

    __init(i: number, bb: flatbuffers.ByteBuffer): SquareBuffer {
      this.bb_pos = i;
      this.bb = bb;
      return this;
    }

    static getRootAsSquareBuffer(bb: flatbuffers.ByteBuffer, obj?: SquareBuffer): SquareBuffer {
      return (obj || new SquareBuffer()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }

    index(): number { 
      const o = this.bb!.__offset(this.bb_pos, 4); 
      return o ? this.bb!.readInt32(this.bb_pos + o) : 0; 
    }
    
    row(): number { 
      const o = this.bb!.__offset(this.bb_pos, 6); 
      return o ? this.bb!.readInt32(this.bb_pos + o) : 0; 
    }
    
    col(): number { 
      const o = this.bb!.__offset(this.bb_pos, 8); 
      return o ? this.bb!.readInt32(this.bb_pos + o) : 0; 
    }
    
    // CRITICAL FIX: Match the write type (Int8) with read type
    boardColor(): SquareColor { 
      const o = this.bb!.__offset(this.bb_pos, 10); 
      return o ? this.bb!.readInt8(this.bb_pos + o) : SquareColor.Light; // Changed from readUint8 to readInt8
    }
    
    pawn(obj?: PawnBuffer): PawnBuffer|null {
      const o = this.bb!.__offset(this.bb_pos, 12);
      return o ? (obj || new PawnBuffer()).__init(this.bb!.__indirect(this.bb_pos + o), this.bb!) : null;
    }
    
    // CRITICAL FIX: Match the write type (Int8) with read type
    highlight(): number { 
      const o = this.bb!.__offset(this.bb_pos, 14); 
      return o ? this.bb!.readInt8(this.bb_pos + o) : 0; // Changed from readUint8 to readInt8
    }

    static startSquareBuffer(builder: flatbuffers.Builder) { builder.startObject(6); }
    static addIndex(builder: flatbuffers.Builder, index: number) { builder.addFieldInt32(0, index, 0); }
    static addRow(builder: flatbuffers.Builder, row: number) { builder.addFieldInt32(1, row, 0); }
    static addCol(builder: flatbuffers.Builder, col: number) { builder.addFieldInt32(2, col, 0); }
    static addBoardColor(builder: flatbuffers.Builder, boardColor: SquareColor) { builder.addFieldInt8(3, boardColor, SquareColor.Light); }
    static addPawn(builder: flatbuffers.Builder, pawnOffset: flatbuffers.Offset) { builder.addFieldOffset(4, pawnOffset, 0); }
    static addHighlight(builder: flatbuffers.Builder, highlight: number) { builder.addFieldInt8(5, highlight, 0); }
    static endSquareBuffer(builder: flatbuffers.Builder): flatbuffers.Offset { return builder.endObject(); }
  }

  // CRITICAL: Adding the missing GameStateBuffer class
  export class GameStateBuffer {
    bb: flatbuffers.ByteBuffer|null = null;
    bb_pos = 0;

    static getRootAsGameStateBuffer(bb: flatbuffers.ByteBuffer, obj?: GameStateBuffer): GameStateBuffer {
      return (obj || new GameStateBuffer()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }

    __init(i: number, bb: flatbuffers.ByteBuffer): GameStateBuffer {
      this.bb_pos = i;
      this.bb = bb;
      return this;
    }

    board(index: number, obj?: SquareBuffer): SquareBuffer|null {
      const offset = this.bb!.__offset(this.bb_pos, 4);
      return offset ? (obj || new SquareBuffer()).__init(this.bb!.__indirect(this.bb!.__vector(this.bb_pos + offset) + index * 4), this.bb!) : null;
    }

    boardLength(): number {
      const offset = this.bb!.__offset(this.bb_pos, 4);
      return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
    }
    
    // CRITICAL FIX: Proper offset handling and type consistency
    currentPlayerId(): number { 
      const o = this.bb!.__offset(this.bb_pos, 6);
      const value = o ? this.bb!.readInt8(this.bb_pos + o) : 1; // Changed to readInt8, default to 1
      console.log('FlatBuffers: Reading currentPlayerId:', value);
      return value;
    }
    
    // CRITICAL FIX: Proper offset handling and type consistency
    gamePhase(): GamePhase { 
      const o = this.bb!.__offset(this.bb_pos, 8);
      const value = o ? this.bb!.readInt8(this.bb_pos + o) : GamePhase.Placement; // Changed to readInt8
      console.log('FlatBuffers: Reading gamePhase:', value);
      return value;
    }
    
    pawnsToPlacePlayer1(): number { 
      const o = this.bb!.__offset(this.bb_pos, 10);
      return o ? this.bb!.readInt32(this.bb_pos + o) : 6; 
    }
    
    pawnsToPlacePlayer2(): number { 
      const o = this.bb!.__offset(this.bb_pos, 12);
      return o ? this.bb!.readInt32(this.bb_pos + o) : 6; 
    }
    
    pawnsPlacedPlayer1(): number { 
      const o = this.bb!.__offset(this.bb_pos, 14);
      return o ? this.bb!.readInt32(this.bb_pos + o) : 0; 
    }
    
    pawnsPlacedPlayer2(): number { 
      const o = this.bb!.__offset(this.bb_pos, 16);
      return o ? this.bb!.readInt32(this.bb_pos + o) : 0; 
    }
    
    selectedPawnIndex(): number { 
      const o = this.bb!.__offset(this.bb_pos, 18); 
      return o ? this.bb!.readInt32(this.bb_pos + o) : -1; 
    }
    
    // CRITICAL FIX: Use readInt8 to match addFieldInt8
    winner(): number { 
      const o = this.bb!.__offset(this.bb_pos, 20); 
      return o ? this.bb!.readInt8(this.bb_pos + o) : 0; // Changed to readInt8
    }
    
    lastMoveFrom(): number { 
      const o = this.bb!.__offset(this.bb_pos, 22); 
      return o ? this.bb!.readInt32(this.bb_pos + o) : -1; 
    }
    
    lastMoveTo(): number { 
      const o = this.bb!.__offset(this.bb_pos, 24); 
      return o ? this.bb!.readInt32(this.bb_pos + o) : -1; 
    }
    
    seqId(): bigint { 
      const o = this.bb!.__offset(this.bb_pos, 26); 
      return o ? this.bb!.readInt64(this.bb_pos + o) : BigInt(0); 
    }
    
    timestamp(): bigint { 
      const o = this.bb!.__offset(this.bb_pos, 28); 
      return o ? this.bb!.readInt64(this.bb_pos + o) : BigInt(0); 
    }

    static startGameStateBuffer(builder: flatbuffers.Builder) { builder.startObject(13); }
    static addBoard(builder: flatbuffers.Builder, boardOffset: flatbuffers.Offset) { builder.addFieldOffset(0, boardOffset, 0); }
    static createBoardVector(builder: flatbuffers.Builder, data: flatbuffers.Offset[]): flatbuffers.Offset {
      builder.startVector(4, data.length, 4);
      for (let i = data.length - 1; i >= 0; i--) {
        builder.addOffset(data[i]);
      }
      return builder.endVector();
    }
    
    // CRITICAL FIX: Use proper defaults
    static addCurrentPlayerId(builder: flatbuffers.Builder, currentPlayerId: number) { 
      console.log('FlatBuffers: Writing currentPlayerId:', currentPlayerId);
      builder.addFieldInt8(1, currentPlayerId, 1); // Default to 1, not 0
    }
    
    static addGamePhase(builder: flatbuffers.Builder, gamePhase: GamePhase) { 
      console.log('FlatBuffers: Writing gamePhase:', gamePhase);
      builder.addFieldInt8(2, gamePhase, GamePhase.Placement); 
    }
    
    static addPawnsToPlacePlayer1(builder: flatbuffers.Builder, pawnsToPlacePlayer1: number) { builder.addFieldInt32(3, pawnsToPlacePlayer1, 6); }
    static addPawnsToPlacePlayer2(builder: flatbuffers.Builder, pawnsToPlacePlayer2: number) { builder.addFieldInt32(4, pawnsToPlacePlayer2, 6); }
    static addPawnsPlacedPlayer1(builder: flatbuffers.Builder, pawnsPlacedPlayer1: number) { builder.addFieldInt32(5, pawnsPlacedPlayer1, 0); }
    static addPawnsPlacedPlayer2(builder: flatbuffers.Builder, pawnsPlacedPlayer2: number) { builder.addFieldInt32(6, pawnsPlacedPlayer2, 0); }
    static addSelectedPawnIndex(builder: flatbuffers.Builder, selectedPawnIndex: number) { builder.addFieldInt32(7, selectedPawnIndex, -1); }
    static addWinner(builder: flatbuffers.Builder, winner: number) { builder.addFieldInt8(8, winner, 0); }
    static addLastMoveFrom(builder: flatbuffers.Builder, lastMoveFrom: number) { builder.addFieldInt32(9, lastMoveFrom, -1); }
    static addLastMoveTo(builder: flatbuffers.Builder, lastMoveTo: number) { builder.addFieldInt32(10, lastMoveTo, -1); }
    static addSeqId(builder: flatbuffers.Builder, seqId: bigint) { builder.addFieldInt64(11, seqId, BigInt(0)); }
    static addTimestamp(builder: flatbuffers.Builder, timestamp: bigint) { builder.addFieldInt64(12, timestamp, BigInt(0)); }

    static endGameStateBuffer(builder: flatbuffers.Builder): flatbuffers.Offset {
      const offset = builder.endObject();
      return offset;
    }
    static finishGameStateBufferBuffer(builder:flatbuffers.Builder, offset:flatbuffers.Offset) { builder.finish(offset); }
  }
}