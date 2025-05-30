// FILE: src/lib/matchmaking.ts
// PURPOSE: Handles the automated matchmaking queue and process.
import { PAWNS_PER_PLAYER } from './gameLogic';
const matchmakingQueue = [];
let matchmakingIntervalId = null;
/**
 * Starts the matchmaking interval to periodically process the queue.
 * @param io The main Socket.IO server instance.
 * @param gameStore The game store instance for creating and managing games.
 * @returns A cleanup function to stop the matchmaking interval.
 */
export function startMatchmakingProcessor(io, gameStore) {
    console.log('Matchmaking: Starting matchmaking processor.');
    if (matchmakingIntervalId)
        clearInterval(matchmakingIntervalId);
    matchmakingIntervalId = setInterval(async () => {
        if (matchmakingQueue.length < 2)
            return;
        matchmakingQueue.sort((a, b) => a.joinTime - b.joinTime);
        const player1Entry = matchmakingQueue.shift();
        const player2Entry = matchmakingQueue.shift();
        if (!player1Entry || !player2Entry) {
            console.error("Matchmaking: Error dequeuing players.");
            if (player1Entry)
                matchmakingQueue.unshift(player1Entry);
            if (player2Entry)
                matchmakingQueue.unshift(player2Entry);
            return;
        }
        console.log(`Matchmaking: Attempting to match ${player1Entry.name} with ${player2Entry.name}`);
        try {
            const gameOptions = {
                isMatchmaking: true,
                isPublic: false,
                isRanked: true,
                pawnsPerPlayer: PAWNS_PER_PLAYER
            };
            const gameId = await gameStore.createGame(player1Entry.socketId, player1Entry.name, gameOptions);
            console.log(`Matchmaking: Game ${gameId} created for ${player1Entry.name}. Attempting to add ${player2Entry.name}.`);
            const joinResult = await gameStore.addPlayerToGame(gameId, player2Entry.socketId, player2Entry.name);
            if (joinResult.success && joinResult.assignedPlayerId === 2 && joinResult.existingPlayers) {
                console.log(`Matchmaking: Successfully matched ${player1Entry.name} (P1) vs ${player2Entry.name} (P2) in game ${gameId}`);
                const player1Data = joinResult.existingPlayers.find(p => p.id === player1Entry.socketId);
                const player2Data = joinResult.existingPlayers.find(p => p.id === player2Entry.socketId);
                if (!player1Data || !player2Data) {
                    console.error("Matchmaking: Could not find player data after successful join. Re-queuing.");
                    matchmakingQueue.unshift(player1Entry, player2Entry);
                    return;
                }
                player1Entry.socket.emit('match_found', {
                    gameId,
                    opponentName: player2Entry.name,
                    assignedPlayerId: player1Data.playerId,
                    timestamp: Date.now(),
                    options: gameOptions
                });
                player2Entry.socket.emit('match_found', {
                    gameId,
                    opponentName: player1Entry.name,
                    assignedPlayerId: player2Data.playerId,
                    timestamp: Date.now(),
                    options: gameOptions
                });
            }
            else {
                console.error(`Matchmaking: Failed to join ${player2Entry.name} to game ${gameId}. Error: ${joinResult.error}. Re-queuing players.`);
                matchmakingQueue.unshift(player1Entry, player2Entry);
            }
        }
        catch (error) {
            console.error('Matchmaking: Critical error during game creation/join for matched players. Re-queuing.', error);
            if (player1Entry)
                matchmakingQueue.unshift(player1Entry);
            if (player2Entry)
                matchmakingQueue.unshift(player2Entry);
        }
    }, 5000);
    return () => {
        if (matchmakingIntervalId)
            clearInterval(matchmakingIntervalId);
        matchmakingIntervalId = null;
        matchmakingQueue.length = 0;
        console.log('Matchmaking: Processor stopped and queue cleared.');
    };
}
export function addToMatchmakingQueue(socket, playerName, rating = 1000) {
    if (matchmakingQueue.some(p => p.socketId === socket.id)) {
        socket.emit('matchmaking_error', { message: 'You are already in the matchmaking queue.' });
        return;
    }
    const player = {
        socketId: socket.id,
        name: playerName,
        rating,
        joinTime: Date.now(),
        socket
    };
    matchmakingQueue.push(player);
    socket.emit('matchmaking_joined', {
        message: 'Successfully added to matchmaking queue.',
        position: matchmakingQueue.length,
        timestamp: Date.now()
    });
    console.log(`Matchmaking: ${playerName} (Socket: ${socket.id}, Rating: ${rating}) added to queue. Queue size: ${matchmakingQueue.length}`);
}
export function removeFromMatchmakingQueue(socketId) {
    const index = matchmakingQueue.findIndex(p => p.socketId === socketId);
    if (index > -1) {
        const removedPlayer = matchmakingQueue.splice(index, 1)[0];
        console.log(`Matchmaking: Player ${socketId} (${removedPlayer === null || removedPlayer === void 0 ? void 0 : removedPlayer.name}) removed from queue. Queue size: ${matchmakingQueue.length}`);
        return true;
    }
    return false;
}
