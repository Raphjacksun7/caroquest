
import type { PlayerId } from '@/lib/gameLogic';

export interface PlayerInfo {
  id: string; // Socket ID
  name: string;
  playerId: PlayerId;
}
