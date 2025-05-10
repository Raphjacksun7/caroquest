
import type { Server as SocketIOServer } from 'socket.io';
import type { GameStore } from './gameStore';
import type { PlayerId } from './types';

interface MatchmakingPlayer {
  socketId: string;
  name: string;
  rating: number;
  joinTime: number;
}

const inMemoryMatchmakingQueue: MatchmakingPlayer[] = [];
let matchmakingInterval: NodeJS.Timeout | null = null;

export function setupMatchmaking(gameStore: GameStore, io: SocketIOServer) {
  console.log('Matchmaking: Using in-memory queue.');

  if (matchmakingInterval) {
    clearInterval(matchmakingInterval);
  }

  matchmakingInterval = setInterval(async () => {
    try {
      await matchPlayers(gameStore, io);
    } catch (error) {
      console.error('Error in matchmaking process:', error);
    }
  }, 5000); 

  return () => {
    if (matchmakingInterval) {
      clearInterval(matchmakingInterval);
      matchmakingInterval = null;
    }
  };
}

async function matchPlayers(gameStore: GameStore, io: SocketIOServer) {
  const playersToMatch = [...inMemoryMatchmakingQueue]; // Work with a copy
  playersToMatch.sort((a, b) => a.joinTime - b.joinTime); // FIFO

  while (playersToMatch.length >= 2) {
    const player1 = playersToMatch.shift();
    const player2 = playersToMatch.shift();

    if (player1 && player2) {
      try {
        const gameId = await gameStore.createGame(player1.socketId, player1.name, {
          isMatchmaking: true,
          isRanked: true 
        });
        
        const joinResult = await gameStore.addPlayerToGame(gameId, player2.socketId, player2.name);

        if (joinResult.success && joinResult.assignedPlayerId !== undefined) {
          console.log(`Matchmaking: Matched ${player1.name} vs ${player2.name} in game ${gameId}`);
          
          // Notify players directly via their sockets
          const player1Socket = io.sockets.sockets.get(player1.socketId);
          const player2Socket = io.sockets.sockets.get(player2.socketId);

          if (player1Socket) {
            player1Socket.emit('match_found', { 
              gameId, 
              opponentName: player2.name, 
              assignedPlayerId: 1 as PlayerId 
            });
          }
          if (player2Socket) {
            player2Socket.emit('match_found', { 
              gameId, 
              opponentName: player1.name, 
              assignedPlayerId: joinResult.assignedPlayerId 
            });
          }
          
          // Remove matched players from the original in-memory queue
          removeFromMatchmakingQueueInternal(player1.socketId);
          removeFromMatchmakingQueueInternal(player2.socketId);
          
        } else {
          console.error(`Matchmaking: Failed to join player ${player2.name} to game ${gameId}. Re-queuing.`);
          if (player1) addToMatchmakingQueueInternal(player1); // Re-add if match failed
          if (player2) addToMatchmakingQueueInternal(player2);
          break; 
        }
      } catch (error) {
        console.error('Matchmaking: Error creating or joining game for matched players. Re-queuing.', error);
        if (player1) addToMatchmakingQueueInternal(player1);
        if (player2) addToMatchmakingQueueInternal(player2);
        break;
      }
    }
  }
}

function addToMatchmakingQueueInternal(player: MatchmakingPlayer): void {
  const existingIndex = inMemoryMatchmakingQueue.findIndex(p => p.socketId === player.socketId);
  if (existingIndex > -1) {
    inMemoryMatchmakingQueue.splice(existingIndex, 1); // Remove if already exists to update joinTime/rating
  }
  inMemoryMatchmakingQueue.push(player);
  inMemoryMatchmakingQueue.sort((a, b) => a.joinTime - b.joinTime);
}

function removeFromMatchmakingQueueInternal(socketId: string): boolean {
  const index = inMemoryMatchmakingQueue.findIndex(p => p.socketId === socketId);
  if (index > -1) {
    inMemoryMatchmakingQueue.splice(index, 1);
    return true;
  }
  return false;
}


export async function addToMatchmakingQueue(
  socketId: string,
  playerName: string,
  rating: number = 1000
): Promise<{success: boolean, message?: string, position?: number}> {
  const player: MatchmakingPlayer = { socketId, name: playerName, rating, joinTime: Date.now() };
  addToMatchmakingQueueInternal(player);
  const position = inMemoryMatchmakingQueue.findIndex(p => p.socketId === socketId) + 1;
  console.log(`Matchmaking (in-memory): ${playerName} (ID: ${socketId}) added to queue at position ${position}.`);
  return { success: true, position };
}

export async function removeFromMatchmakingQueue(
  socketId: string
): Promise<boolean> {
  const removed = removeFromMatchmakingQueueInternal(socketId);
  if (removed) {
    console.log(`Matchmaking (in-memory): Player ${socketId} removed from queue.`);
  }
  return removed;
}

export function getMatchmakingQueueSize(): Promise<number> {
    return Promise.resolve(inMemoryMatchmakingQueue.length);
}
