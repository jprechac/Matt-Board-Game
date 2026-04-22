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
  onCellClick?: (cell: HexCellType) => void;
  onUnitClick?: (unit: Unit) => void;
}

export function HexGrid({
  board,
  units = [],
  selectedUnitId,
  showCoords = false,
  highlights,
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

  const viewBox = useMemo(() => {
    const vb = getBoardViewBox(board.width, board.height);
    return `${vb.minX} ${vb.minY} ${vb.vbWidth} ${vb.vbHeight}`;
  }, [board.width, board.height]);

  return (
    <svg
      viewBox={viewBox}
      style={{
        width: '100%',
        maxWidth: '1200px',
        height: 'auto',
        background: GRID_COLORS.background,
        borderRadius: '8px',
      }}
      data-testid="hex-grid"
    >
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
        />
      ))}
    </svg>
  );
}
