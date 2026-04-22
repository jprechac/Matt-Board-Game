// Player & zone colors for the hex grid

export const PLAYER_COLORS = {
  player1: {
    base: '#2563eb',       // blue
    baseFill: 'rgba(37, 99, 235, 0.35)',
    placement: 'rgba(37, 99, 235, 0.15)',
    unit: '#3b82f6',
    text: '#93c5fd',
  },
  player2: {
    base: '#dc2626',       // red
    baseFill: 'rgba(220, 38, 38, 0.35)',
    placement: 'rgba(220, 38, 38, 0.15)',
    unit: '#ef4444',
    text: '#fca5a5',
  },
  player3: {
    base: '#16a34a',       // green (for 4p)
    baseFill: 'rgba(22, 163, 74, 0.35)',
    placement: 'rgba(22, 163, 74, 0.15)',
    unit: '#22c55e',
    text: '#86efac',
  },
  player4: {
    base: '#d97706',       // amber (for 4p)
    baseFill: 'rgba(217, 119, 6, 0.35)',
    placement: 'rgba(217, 119, 6, 0.15)',
    unit: '#f59e0b',
    text: '#fcd34d',
  },
} as const;

export const GRID_COLORS = {
  cellDefault: '#1e293b',   // slate-800
  cellStroke: '#475569',    // slate-600
  cellHover: '#334155',     // slate-700
  background: '#0f172a',    // slate-900
  coordLabel: '#94a3b8',    // slate-400
  terrainPlacement: 'rgba(168, 162, 158, 0.12)',
} as const;

export type PlayerId = 'player1' | 'player2' | 'player3' | 'player4';

export function getPlayerColors(playerId: string) {
  return PLAYER_COLORS[playerId as PlayerId] ?? PLAYER_COLORS.player1;
}
