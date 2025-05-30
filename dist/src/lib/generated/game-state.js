// CORRECTED COMPLETE FLATBUFFERS STUB
// @ts-nocheck
export var StrategicPawns;
(function (StrategicPawns) {
    let GamePhase;
    (function (GamePhase) {
        GamePhase[GamePhase["Placement"] = 0] = "Placement";
        GamePhase[GamePhase["Movement"] = 1] = "Movement";
    })(GamePhase = StrategicPawns.GamePhase || (StrategicPawns.GamePhase = {}));
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
        id() {
            const o = this.bb.__offset(this.bb_pos, 4);
            return o ? this.bb.__string(this.bb_pos + o) : null;
        }
        // CRITICAL FIX: Match the write type (Int8) with read type
        playerId() {
            const o = this.bb.__offset(this.bb_pos, 6);
            return o ? this.bb.readInt8(this.bb_pos + o) : 1; // Changed from readUint8 to readInt8, default to 1
        }
        // CRITICAL FIX: Match the write type (Int8) with read type  
        color() {
            const o = this.bb.__offset(this.bb_pos, 8);
            return o ? this.bb.readInt8(this.bb_pos + o) : SquareColor.Light; // Changed from readUint8 to readInt8
        }
        static startPawnBuffer(builder) { builder.startObject(3); }
        static addId(builder, idOffset) { builder.addFieldOffset(0, idOffset, 0); }
        static addPlayerId(builder, playerId) { builder.addFieldInt8(1, playerId, 1); } // Default to 1, not 0
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
        index() {
            const o = this.bb.__offset(this.bb_pos, 4);
            return o ? this.bb.readInt32(this.bb_pos + o) : 0;
        }
        row() {
            const o = this.bb.__offset(this.bb_pos, 6);
            return o ? this.bb.readInt32(this.bb_pos + o) : 0;
        }
        col() {
            const o = this.bb.__offset(this.bb_pos, 8);
            return o ? this.bb.readInt32(this.bb_pos + o) : 0;
        }
        // CRITICAL FIX: Match the write type (Int8) with read type
        boardColor() {
            const o = this.bb.__offset(this.bb_pos, 10);
            return o ? this.bb.readInt8(this.bb_pos + o) : SquareColor.Light; // Changed from readUint8 to readInt8
        }
        pawn(obj) {
            const o = this.bb.__offset(this.bb_pos, 12);
            return o ? (obj || new PawnBuffer()).__init(this.bb.__indirect(this.bb_pos + o), this.bb) : null;
        }
        // CRITICAL FIX: Match the write type (Int8) with read type
        highlight() {
            const o = this.bb.__offset(this.bb_pos, 14);
            return o ? this.bb.readInt8(this.bb_pos + o) : 0; // Changed from readUint8 to readInt8
        }
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
    // CRITICAL: Adding the missing GameStateBuffer class
    class GameStateBuffer {
        constructor() {
            this.bb = null;
            this.bb_pos = 0;
        }
        static getRootAsGameStateBuffer(bb, obj) {
            return (obj || new GameStateBuffer()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        __init(i, bb) {
            this.bb_pos = i;
            this.bb = bb;
            return this;
        }
        board(index, obj) {
            const offset = this.bb.__offset(this.bb_pos, 4);
            return offset ? (obj || new SquareBuffer()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
        }
        boardLength() {
            const offset = this.bb.__offset(this.bb_pos, 4);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        // CRITICAL FIX: Proper offset handling and type consistency
        currentPlayerId() {
            const o = this.bb.__offset(this.bb_pos, 6);
            const value = o ? this.bb.readInt8(this.bb_pos + o) : 1; // Changed to readInt8, default to 1
            console.log('FlatBuffers: Reading currentPlayerId:', value);
            return value;
        }
        // CRITICAL FIX: Proper offset handling and type consistency
        gamePhase() {
            const o = this.bb.__offset(this.bb_pos, 8);
            const value = o ? this.bb.readInt8(this.bb_pos + o) : GamePhase.Placement; // Changed to readInt8
            console.log('FlatBuffers: Reading gamePhase:', value);
            return value;
        }
        pawnsToPlacePlayer1() {
            const o = this.bb.__offset(this.bb_pos, 10);
            return o ? this.bb.readInt32(this.bb_pos + o) : 6;
        }
        pawnsToPlacePlayer2() {
            const o = this.bb.__offset(this.bb_pos, 12);
            return o ? this.bb.readInt32(this.bb_pos + o) : 6;
        }
        pawnsPlacedPlayer1() {
            const o = this.bb.__offset(this.bb_pos, 14);
            return o ? this.bb.readInt32(this.bb_pos + o) : 0;
        }
        pawnsPlacedPlayer2() {
            const o = this.bb.__offset(this.bb_pos, 16);
            return o ? this.bb.readInt32(this.bb_pos + o) : 0;
        }
        selectedPawnIndex() {
            const o = this.bb.__offset(this.bb_pos, 18);
            return o ? this.bb.readInt32(this.bb_pos + o) : -1;
        }
        // CRITICAL FIX: Use readInt8 to match addFieldInt8
        winner() {
            const o = this.bb.__offset(this.bb_pos, 20);
            return o ? this.bb.readInt8(this.bb_pos + o) : 0; // Changed to readInt8
        }
        lastMoveFrom() {
            const o = this.bb.__offset(this.bb_pos, 22);
            return o ? this.bb.readInt32(this.bb_pos + o) : -1;
        }
        lastMoveTo() {
            const o = this.bb.__offset(this.bb_pos, 24);
            return o ? this.bb.readInt32(this.bb_pos + o) : -1;
        }
        seqId() {
            const o = this.bb.__offset(this.bb_pos, 26);
            return o ? this.bb.readInt64(this.bb_pos + o) : BigInt(0);
        }
        timestamp() {
            const o = this.bb.__offset(this.bb_pos, 28);
            return o ? this.bb.readInt64(this.bb_pos + o) : BigInt(0);
        }
        static startGameStateBuffer(builder) { builder.startObject(13); }
        static addBoard(builder, boardOffset) { builder.addFieldOffset(0, boardOffset, 0); }
        static createBoardVector(builder, data) {
            builder.startVector(4, data.length, 4);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addOffset(data[i]);
            }
            return builder.endVector();
        }
        // CRITICAL FIX: Use proper defaults
        static addCurrentPlayerId(builder, currentPlayerId) {
            console.log('FlatBuffers: Writing currentPlayerId:', currentPlayerId);
            builder.addFieldInt8(1, currentPlayerId, 1); // Default to 1, not 0
        }
        static addGamePhase(builder, gamePhase) {
            console.log('FlatBuffers: Writing gamePhase:', gamePhase);
            builder.addFieldInt8(2, gamePhase, GamePhase.Placement);
        }
        static addPawnsToPlacePlayer1(builder, pawnsToPlacePlayer1) { builder.addFieldInt32(3, pawnsToPlacePlayer1, 6); }
        static addPawnsToPlacePlayer2(builder, pawnsToPlacePlayer2) { builder.addFieldInt32(4, pawnsToPlacePlayer2, 6); }
        static addPawnsPlacedPlayer1(builder, pawnsPlacedPlayer1) { builder.addFieldInt32(5, pawnsPlacedPlayer1, 0); }
        static addPawnsPlacedPlayer2(builder, pawnsPlacedPlayer2) { builder.addFieldInt32(6, pawnsPlacedPlayer2, 0); }
        static addSelectedPawnIndex(builder, selectedPawnIndex) { builder.addFieldInt32(7, selectedPawnIndex, -1); }
        static addWinner(builder, winner) { builder.addFieldInt8(8, winner, 0); }
        static addLastMoveFrom(builder, lastMoveFrom) { builder.addFieldInt32(9, lastMoveFrom, -1); }
        static addLastMoveTo(builder, lastMoveTo) { builder.addFieldInt32(10, lastMoveTo, -1); }
        static addSeqId(builder, seqId) { builder.addFieldInt64(11, seqId, BigInt(0)); }
        static addTimestamp(builder, timestamp) { builder.addFieldInt64(12, timestamp, BigInt(0)); }
        static endGameStateBuffer(builder) {
            const offset = builder.endObject();
            return offset;
        }
        static finishGameStateBufferBuffer(builder, offset) { builder.finish(offset); }
    }
    StrategicPawns.GameStateBuffer = GameStateBuffer;
})(StrategicPawns || (StrategicPawns = {}));
