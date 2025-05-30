// THIS IS A MANUAL STUB FOR FLATBUFFERS GENERATED CODE
// @ts-nocheck
export var StrategicPawns;
(function (StrategicPawns) {
    let SquareColor;
    (function (SquareColor) {
        SquareColor[SquareColor["Light"] = 0] = "Light";
        SquareColor[SquareColor["Dark"] = 1] = "Dark";
    })(SquareColor = StrategicPawns.SquareColor || (StrategicPawns.SquareColor = {}));
    class PawnBuffer {
        constructor() {
            this.bb = null;
            this.bb_pos = 0;
        }
        __init(i, bb) {
            this.bb_pos = i;
            this.bb = bb;
            return this;
        }
        static getRootAsPawnBuffer(bb, obj) {
            return (obj || new PawnBuffer()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        id() { const o = this.bb.__offset(this.bb_pos, 4); return o ? this.bb.__string(this.bb_pos + o) : null; }
        playerId() { const o = this.bb.__offset(this.bb_pos, 6); return o ? this.bb.readUint8(this.bb_pos + o) : 0; }
        color() { const o = this.bb.__offset(this.bb_pos, 8); return o ? this.bb.readUint8(this.bb_pos + o) : SquareColor.Light; }
        static startPawnBuffer(builder) { builder.startObject(3); }
        static addId(builder, idOffset) { builder.addFieldOffset(0, idOffset, 0); }
        static addPlayerId(builder, playerId) { builder.addFieldInt8(1, playerId, 0); }
        static addColor(builder, color) { builder.addFieldInt8(2, color, SquareColor.Light); }
        static endPawnBuffer(builder) { return builder.endObject(); }
    }
    StrategicPawns.PawnBuffer = PawnBuffer;
    class SquareBuffer {
        constructor() {
            this.bb = null;
            this.bb_pos = 0;
        }
        __init(i, bb) {
            this.bb_pos = i;
            this.bb = bb;
            return this;
        }
        static getRootAsSquareBuffer(bb, obj) {
            return (obj || new SquareBuffer()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        index() { const o = this.bb.__offset(this.bb_pos, 4); return o ? this.bb.readInt32(this.bb_pos + o) : 0; }
        row() { const o = this.bb.__offset(this.bb_pos, 6); return o ? this.bb.readInt32(this.bb_pos + o) : 0; }
        col() { const o = this.bb.__offset(this.bb_pos, 8); return o ? this.bb.readInt32(this.bb_pos + o) : 0; }
        boardColor() { const o = this.bb.__offset(this.bb_pos, 10); return o ? this.bb.readUint8(this.bb_pos + o) : SquareColor.Light; }
        pawn(obj) {
            const o = this.bb.__offset(this.bb_pos, 12);
            return o ? (obj || new PawnBuffer()).__init(this.bb.__indirect(this.bb_pos + o), this.bb) : null;
        }
        highlight() { const o = this.bb.__offset(this.bb_pos, 14); return o ? this.bb.readUint8(this.bb_pos + o) : 0; }
        static startSquareBuffer(builder) { builder.startObject(6); }
        static addIndex(builder, index) { builder.addFieldInt32(0, index, 0); }
        static addRow(builder, row) { builder.addFieldInt32(1, row, 0); }
        static addCol(builder, col) { builder.addFieldInt32(2, col, 0); }
        static addBoardColor(builder, boardColor) { builder.addFieldInt8(3, boardColor, SquareColor.Light); }
        static addPawn(builder, pawnOffset) { builder.addFieldOffset(4, pawnOffset, 0); }
        static addHighlight(builder, highlight) { builder.addFieldInt8(5, highlight, 0); }
        static endSquareBuffer(builder) { return builder.endObject(); }
    }
    StrategicPawns.SquareBuffer = SquareBuffer;
})(StrategicPawns || (StrategicPawns = {}));
