
// THIS IS A MANUAL STUB FOR FLATBUFFERS GENERATED CODE
// Actual flatc generated code would be more comprehensive.
// @ts-nocheck

import type { flatbuffers } from 'flatbuffers';
import type * as SquareBufferNS from './square'; // Assuming SquareBuffer is in its own file

export namespace StrategicPawns {
  export enum GamePhase {
    Placement = 0,
    Movement = 1
  }

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

    board(index: number, obj?: SquareBufferNS.StrategicPawns.SquareBuffer): SquareBufferNS.StrategicPawns.SquareBuffer|null {
      const offset = this.bb!.__offset(this.bb_pos, 4);
      return offset ? (obj || new SquareBufferNS.StrategicPawns.SquareBuffer()).__init(this.bb!.__indirect(this.bb!.__vector(this.bb_pos + offset) + index * 4), this.bb!) : null;
    }

    boardLength(): number {
      const offset = this.bb!.__offset(this.bb_pos, 4);
      return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
    }
    
    currentPlayerId(): number { return this.bb!.readUint8(this.bb_pos + this.bb!.__offset(this.bb_pos, 6)); }
    gamePhase(): GamePhase { return this.bb!.readUint8(this.bb_pos + this.bb!.__offset(this.bb_pos, 8)); }
    pawnsToPlacePlayer1(): number { return this.bb!.readInt32(this.bb_pos + this.bb!.__offset(this.bb_pos, 10)); }
    pawnsToPlacePlayer2(): number { return this.bb!.readInt32(this.bb_pos + this.bb!.__offset(this.bb_pos, 12)); }
    pawnsPlacedPlayer1(): number { return this.bb!.readInt32(this.bb_pos + this.bb!.__offset(this.bb_pos, 14)); }
    pawnsPlacedPlayer2(): number { return this.bb!.readInt32(this.bb_pos + this.bb!.__offset(this.bb_pos, 16)); }
    selectedPawnIndex(): number { const o = this.bb!.__offset(this.bb_pos, 18); return o ? this.bb!.readInt32(this.bb_pos + o) : -1; }
    winner(): number { const o = this.bb!.__offset(this.bb_pos, 20); return o ? this.bb!.readUint8(this.bb_pos + o) : 0; }
    lastMoveFrom(): number { const o = this.bb!.__offset(this.bb_pos, 22); return o ? this.bb!.readInt32(this.bb_pos + o) : -1; }
    lastMoveTo(): number { const o = this.bb!.__offset(this.bb_pos, 24); return o ? this.bb!.readInt32(this.bb_pos + o) : -1; }
    seqId(): bigint { const o = this.bb!.__offset(this.bb_pos, 26); return o ? this.bb!.readInt64(this.bb_pos + o) : BigInt(0); }
    timestamp(): bigint { const o = this.bb!.__offset(this.bb_pos, 28); return o ? this.bb!.readInt64(this.bb_pos + o) : BigInt(0); }


    static startGameStateBuffer(builder: flatbuffers.Builder) { builder.startObject(13); } // Number of fields
    static addBoard(builder: flatbuffers.Builder, boardOffset: flatbuffers.Offset) { builder.addFieldOffset(0, boardOffset, 0); }
    static createBoardVector(builder: flatbuffers.Builder, data: flatbuffers.Offset[]): flatbuffers.Offset {
      builder.startVector(4, data.length, 4);
      for (let i = data.length - 1; i >= 0; i--) {
        builder.addOffset(data[i]);
      }
      return builder.endVector();
    }
    static addCurrentPlayerId(builder: flatbuffers.Builder, currentPlayerId: number) { builder.addFieldInt8(1, currentPlayerId, 0); }
    static addGamePhase(builder: flatbuffers.Builder, gamePhase: GamePhase) { builder.addFieldInt8(2, gamePhase, 0); }
    static addPawnsToPlacePlayer1(builder: flatbuffers.Builder, pawnsToPlacePlayer1: number) { builder.addFieldInt32(3, pawnsToPlacePlayer1, 0); }
    static addPawnsToPlacePlayer2(builder: flatbuffers.Builder, pawnsToPlacePlayer2: number) { builder.addFieldInt32(4, pawnsToPlacePlayer2, 0); }
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
