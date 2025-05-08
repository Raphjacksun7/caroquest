import type { SquareColorType } from '@/types/game';

export const getSquareColorType = (row: number, col: number): SquareColorType => {
  return (row + col) % 2 === 0 ? 'light' : 'dark';
};
