import React, { useMemo } from 'react';
import type { Board, HexCell as HexCellType, Unit } from '../../engine/types.js';
import { HexCell } from './HexCell.js';
import { UnitToken } from './UnitToken.js';
import { getBoardViewBox } from '../hexLayout.js';
import { GRID_COLORS } from '../styles/colors.js';
import { hexKey } from '../../engine/hex.js';

export interface HexGridProps {
  board: Board;
  units?: readonly Unit[];
  selectedUnitId?: string | null;
  showCoords?: boolean;
  highlights?: Map<string, string>;
  flipped?: boolean;
  onCellClick?: (cell: HexCellType) => void;
  onUnitClick?: (unit: Unit) => void;
}

export function HexGrid({
  board,
  units = [],
  selectedUnitId,
  showCoords = false,
  highlights,
  flipped = false,
  onCellClick,
  onUnitClick,
}: HexGridProps) {
  const cells = useMemo(() => Object.values(board.cells), [board.cells]);

  const unitsByHex = useMemo(() => {
    const map = new Map<string, Unit>();
    for (const unit of units) {
      if (unit.currentHp > 0) {
        map.set(hexKey(unit.position), unit);
      }
    }
    return map;
  }, [units]);

  const viewBoxData = useMemo(() => getBoardViewBox(board.width, board.height), [board.width, board.height]);

  const viewBox = `${viewBoxData.minX} ${viewBoxData.minY} ${viewBoxData.vbWidth} ${viewBoxData.vbHeight}`;

  // Rotation center for 180° flip
  const cx = viewBoxData.minX + viewBoxData.vbWidth / 2;
  const cy = viewBoxData.minY + viewBoxData.vbHeight / 2;

  return (
    <svg
      viewBox={viewBox}
      style={{
        width: '100%',
        height: '100%',
        maxHeight: 'calc(100vh - 180px)',
        background: GRID_COLORS.background,
        borderRadius: '8px',
      }}
      data-testid="hex-grid"
    >
      <g transform={flipped ? `rotate(180, ${cx}, ${cy})` : undefined}>
        {/* Hex cells layer */}
        {cells.map(cell => {
          const key = hexKey(cell.coord);
          return (
            <HexCell
              key={key}
              cell={cell}
              showCoords={showCoords && !unitsByHex.has(key)}
              highlight={highlights?.get(key)}
              onClick={onCellClick}
              flipped={flipped}
            />
          );
        })}

        {/* Unit tokens layer (rendered on top) */}
        {units.filter(u => u.currentHp > 0).map(unit => (
          <UnitToken
            key={unit.id}
            unit={unit}
            selected={unit.id === selectedUnitId}
            onClick={onUnitClick}
            flipped={flipped}
          />
        ))}
      </g>
    </svg>
  );
}
