import React, { useMemo } from 'react';
import type { Board, HexCell as HexCellType } from '../../engine/types.js';
import { HexCell } from './HexCell.js';
import { getBoardViewBox } from '../hexLayout.js';
import { GRID_COLORS } from '../styles/colors.js';

export interface HexGridProps {
  board: Board;
  showCoords?: boolean;
  highlights?: Map<string, string>;
  onCellClick?: (cell: HexCellType) => void;
}

export function HexGrid({ board, showCoords = false, highlights, onCellClick }: HexGridProps) {
  const cells = useMemo(() => Object.values(board.cells), [board.cells]);

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
      {cells.map(cell => {
        const key = `${cell.coord.q},${cell.coord.r},${cell.coord.s}`;
        return (
          <HexCell
            key={key}
            cell={cell}
            showCoords={showCoords}
            highlight={highlights?.get(key)}
            onClick={onCellClick}
          />
        );
      })}
    </svg>
  );
}
