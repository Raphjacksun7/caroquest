
// THIS IS A MANUAL STUB FOR FLATBUFFERS GENERATED CODE
// @ts-nocheck

import type { flatbuffers } from 'flatbuffers';

export namespace StrategicPawns { // Must match the namespace in game-state.fbs
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
    id(): string|null { const o = this.bb!.__offset(this.bb_pos, 4); return o ? this.bb!.__string(this.bb_pos + o) : null; }
    playerId(): number { const o = this.bb!.__offset(this.bb_pos, 6); return o ? this.bb!.readUint8(this.bb_pos + o) : 0; }
    color(): SquareColor { const o = this.bb!.__offset(this.bb_pos, 8); return o ? this.bb!.readUint8(this.bb_pos + o) : SquareColor.Light; }

    static startPawnBuffer(builder: flatbuffers.Builder) { builder.startObject(3); }
    static addId(builder: flatbuffers.Builder, idOffset: flatbuffers.Offset) { builder.addFieldOffset(0, idOffset, 0); }
    static addPlayerId(builder: flatbuffers.Builder, playerId: number) { builder.addFieldInt8(1, playerId, 0); }
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
    index(): number { const o = this.bb!.__offset(this.bb_pos, 4); return o ? this.bb!.readInt32(this.bb_pos + o) : 0; }
    row(): number { const o = this.bb!.__offset(this.bb_pos, 6); return o ? this.bb!.readInt32(this.bb_pos + o) : 0; }
    col(): number { const o = this.bb!.__offset(this.bb_pos, 8); return o ? this.bb!.readInt32(this.bb_pos + o) : 0; }
    boardColor(): SquareColor { const o = this.bb!.__offset(this.bb_pos, 10); return o ? this.bb!.readUint8(this.bb_pos + o) : SquareColor.Light; }
    pawn(obj?: PawnBuffer): PawnBuffer|null {
      const o = this.bb!.__offset(this.bb_pos, 12);
      return o ? (obj || new PawnBuffer()).__init(this.bb!.__indirect(this.bb_pos + o), this.bb!) : null;
    }
    highlight(): number { const o = this.bb!.__offset(this.bb_pos, 14); return o ? this.bb!.readUint8(this.bb_pos + o) : 0; }


    static startSquareBuffer(builder: flatbuffers.Builder) { builder.startObject(6); }
    static addIndex(builder: flatbuffers.Builder, index: number) { builder.addFieldInt32(0, index, 0); }
    static addRow(builder: flatbuffers.Builder, row: number) { builder.addFieldInt32(1, row, 0); }
    static addCol(builder: flatbuffers.Builder, col: number) { builder.addFieldInt32(2, col, 0); }
    static addBoardColor(builder: flatbuffers.Builder, boardColor: SquareColor) { builder.addFieldInt8(3, boardColor, SquareColor.Light); }
    static addPawn(builder: flatbuffers.Builder, pawnOffset: flatbuffers.Offset) { builder.addFieldOffset(4, pawnOffset, 0); }
    static addHighlight(builder: flatbuffers.Builder, highlight: number) { builder.addFieldInt8(5, highlight, 0); }
    static endSquareBuffer(builder: flatbuffers.Builder): flatbuffers.Offset { return builder.endObject(); }
  }
}
