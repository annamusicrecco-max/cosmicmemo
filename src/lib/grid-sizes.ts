import type { CSSProperties } from "react";

export type GridSize = {
  label: string;
  rows: number;
  cols: number;
  total: number;
};

export const GRID_SIZES: GridSize[] = [
  { label: "2x2", rows: 2, cols: 2, total: 4 },
  { label: "2x3", rows: 2, cols: 3, total: 6 },
  { label: "3x4", rows: 3, cols: 4, total: 12 },
  { label: "4x4", rows: 4, cols: 4, total: 16 },
  { label: "4x5", rows: 4, cols: 5, total: 20 },
  { label: "5x6", rows: 5, cols: 6, total: 30 },
  { label: "6x6", rows: 6, cols: 6, total: 36 },
];

export const DEFAULT_GRID = "4x4";

export function getGrid(label: string): GridSize {
  return GRID_SIZES.find((g) => g.label === label) ?? GRID_SIZES[3];
}

export function gridColsClass(cols: number): string {
  // Use inline grid-template-columns via style for arbitrary col counts to avoid Tailwind purge issues.
  return `grid gap-2 sm:gap-3 w-full max-w-[min(92vw,90vh)]`;
}

export function gridStyle(cols: number): CSSProperties {
  return { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
}
