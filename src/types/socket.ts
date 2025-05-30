import { PlayerId } from "@/lib/types";
export interface PlayerInfo {
  id: string; // Socket ID for remote, or a local unique ID ('local1', 'local2')
  name: string;
  playerId: PlayerId; // 1 or 2
}
