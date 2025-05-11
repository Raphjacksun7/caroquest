
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { GameStore } from './gameStore'; 
import type { PlayerId, StoredPlayer, GameOptions } from './types'; 

interface MatchmakingPlayer {
  socketId: string;
  name: string;
  rating: number; 
  joinTime: number;
  socket: Socket; 
}

const matchmakingQueue: MatchmakingPlayer[] = [];
let matchmakingInterval: NodeJS.Timeout | null = null;

export function setupMatchmaking(io: SocketIOServer, gameStore: GameStore) {
  console.log('Matchmaking: Initialized with in-memory queue.');

  if (matchmakingInterval) {
    clearInterval(matchmakingInterval);
  }

  matchmakingInterval = setInterval(async () => {
    if (matchmakingQueue.length >= 2) {
      matchmakingQueue.sort((a, b) => {
        return a.joinTime - b.joinTime; // Simple FIFO
      });
      
      const player1Entry = matchmakingQueue.shift();
      const player2Entry = matchmakingQueue.shift();

      if (player1Entry && player2Entry) {
        try {
          const gameOptions: GameOptions = { 
            isMatchmaking: true, 
            isPublic: false, 
            isRanked: true 
          };
          
          const gameId = await gameStore.createGame(player1Entry.socketId, player1Entry.name, gameOptions);
          const joinResult = await gameStore.addPlayerToGame(gameId, player2Entry.socketId, player2Entry.name);

          if (joinResult.success && joinResult.assignedPlayerId !== undefined) {
            console.log(`Matchmaking: Matched ${player1Entry.name} vs ${player2Entry.name} in game ${gameId}`);
            
            const finalGameData = await gameStore.getGame(gameId);
            if (!finalGameData) {
                console.error("Matchmaking: Failed to retrieve game data after match creation for P1.");
                matchmakingQueue.unshift(player1Entry);
                matchmakingQueue.unshift(player2Entry);
                return;
            }

            const assignedP1Id = finalGameData.players.find(p => p.id === player1Entry.socketId)?.playerId;
            const assignedP2Id = finalGameData.players.find(p => p.id === player2Entry.socketId)?.playerId;

            if (assignedP1Id) {
              player1Entry.socket.emit('match_found', { 
                  gameId, 
                  opponentName: player2Entry.name, 
                  assignedPlayerId: assignedP1Id,
                  timestamp: Date.now()
              });
            }
            if (assignedP2Id) {
                player2Entry.socket.emit('match_found', { 
                    gameId, 
                    opponentName: player1Entry.name, 
                    assignedPlayerId: assignedP2Id,
                    timestamp: Date.now()
                });
            }
          } else {
            console.error(`Matchmaking: Failed to join player ${player2Entry.name} to game ${gameId}. Error: ${joinResult.error}. Re-queuing.`);
            matchmakingQueue.unshift(player1Entry); 
            matchmakingQueue.unshift(player2Entry);
          }
        } catch (error) {
          console.error('Matchmaking: Error creating or joining game for matched players:', error);
          matchmakingQueue.unshift(player1Entry);
          matchmakingQueue.unshift(player2Entry);
        }
      }
    }
  }, 5000); 

  return () => {
    if (matchmakingInterval) {
      clearInterval(matchmakingInterval);
      matchmakingInterval = null;
    }
    matchmakingQueue.length = 0; 
    console.log('Matchmaking: Stopped and cleared in-memory queue.');
  };
}

export function addToMatchmakingQueue(socket: Socket, playerName: string, rating: number = 1000) {
  if (matchmakingQueue.some(p => p.socketId === socket.id)) {
    socket.emit('matchmaking_error', { message: 'Already in queue.' });
    return;
  }
  
  const player: MatchmakingPlayer = { 
    socketId: socket.id, 
    name: playerName, 
    rating, 
    joinTime: Date.now(), 
    socket 
  };
  matchmakingQueue.push(player);
  socket.emit('matchmaking_joined', { 
    message: 'Added to matchmaking queue.', 
    position: matchmakingQueue.length,
    timestamp: Date.now() 
  });
  console.log(`Matchmaking: ${playerName} (ID: ${socket.id}) added to queue. Queue size: ${matchmakingQueue.length}`);
}

export function removeFromMatchmakingQueue(socketId: string): boolean {
  const index = matchmakingQueue.findIndex(p => p.socketId === socketId);
  if (index > -1) {
    const removedPlayer = matchmakingQueue.splice(index, 1)[0];
    if (removedPlayer && removedPlayer.socket && removedPlayer.socket.connected) {
        removedPlayer.socket.emit('matchmaking_left', { 
          message: 'Removed from queue by server or disconnect.',
          timestamp: Date.now()
        });
    }
    console.log(`Matchmaking: Player ${socketId} removed from queue. Queue size: ${matchmakingQueue.length}`);
    return true;
  }
  return false;
}

export function getMatchmakingQueueSize(): number {
    return matchmakingQueue.length;
}
