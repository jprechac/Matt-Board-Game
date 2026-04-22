import React, { useMemo } from 'react';
import type { HexCell as HexCellType } from '../../engine/types.js';
import { hexToPixel, hexPoints } from '../hexLayout.js';
import { getPlayerColors, GRID_COLORS } from '../styles/colors.js';

export interface HexCellProps {
  cell: HexCellType;
  showCoords?: boolean;
  highlight?: string;
  onClick?: (cell: HexCellType) => void;
}

const cachedPoints = hexPoints();

export function HexCell({ cell, showCoords, highlight, onClick }: HexCellProps) {
  const { x, y } = useMemo(() => hexToPixel(cell.coord), [cell.coord]);

  let fill: string = GRID_COLORS.cellDefault;
  if (highlight) {
    fill = highlight;
  } else if (cell.basePlayerId) {
    fill = getPlayerColors(cell.basePlayerId).baseFill;
  } else if (cell.placementZonePlayerId) {
    fill = getPlayerColors(cell.placementZonePlayerId).placement;
  } else if (cell.terrainPlacementZonePlayerId) {
    fill = GRID_COLORS.terrainPlacement;
  }

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => onClick?.(cell)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <polygon
        points={cachedPoints}
        fill={fill}
        stroke={GRID_COLORS.cellStroke}
        strokeWidth={0.8}
      />
      {showCoords && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={5}
          fill={GRID_COLORS.coordLabel}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {cell.coord.q},{cell.coord.r}
        </text>
      )}
    </g>
  );
}
