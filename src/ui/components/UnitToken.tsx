import React, { useMemo } from 'react';
import type { Unit } from '../../engine/types.js';
import { hexToPixel, HEX_SIZE } from '../hexLayout.js';
import { getPlayerColors } from '../styles/colors.js';

export interface UnitTokenProps {
  unit: Unit;
  selected?: boolean;
  flipped?: boolean;
  onClick?: (unit: Unit) => void;
}

const TYPE_LABELS: Record<string, string> = {
  basic_melee: 'M',
  basic_ranged: 'R',
  legionnaire: 'LG',
  berserker: 'BK',
  longbowman: 'LB',
  samurai: 'SM',
  janissary: 'JN',
  streltsy: 'ST',
  heavy_cavalry: 'HC',
  war_elephant: 'WE',
  mongol_horse_archer: 'HA',
  conquistador: 'CQ',
  hwarang: 'HW',
};

function getTypeLabel(typeId: string): string {
  return TYPE_LABELS[typeId] ?? typeId.slice(0, 2).toUpperCase();
}

export function UnitToken({ unit, selected, flipped, onClick }: UnitTokenProps) {
  const { x, y } = useMemo(() => hexToPixel(unit.position), [unit.position]);
  const colors = getPlayerColors(unit.playerId);
  const radius = HEX_SIZE * 0.55;
  const hpPct = unit.currentHp / unit.maxHp;
  const exhausted = unit.activatedThisTurn;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={e => { e.stopPropagation(); onClick?.(unit); }}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      data-testid={`unit-${unit.id}`}
    >
      {/* Selection glow */}
      {selected && (
        <circle
          r={radius + 3}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={2}
          opacity={0.8}
        />
      )}

      {/* Unit circle */}
      <circle
        r={radius}
        fill={colors.unit}
        stroke={exhausted ? '#666' : '#fff'}
        strokeWidth={1.2}
        opacity={exhausted ? 0.5 : 1}
      />

      {/* Counter-rotate text/bars when board is flipped */}
      <g transform={flipped ? 'rotate(180)' : undefined}>
        {/* Type label */}
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={7}
          fontWeight="bold"
          fill="#fff"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          dy={-1}
        >
          {getTypeLabel(unit.typeId)}
        </text>

        {/* HP bar background */}
        <rect
          x={-radius * 0.8}
          y={radius * 0.55}
          width={radius * 1.6}
          height={3}
          rx={1}
          fill="rgba(0,0,0,0.5)"
        />
        {/* HP bar fill */}
        <rect
          x={-radius * 0.8}
          y={radius * 0.55}
          width={radius * 1.6 * hpPct}
          height={3}
          rx={1}
          fill={hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444'}
        />
      </g>
    </g>
  );
}
