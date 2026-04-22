// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { createBoard } from '../../src/engine/board.js';
import { HexGrid } from '../../src/ui/components/HexGrid.js';
import { HexCell } from '../../src/ui/components/HexCell.js';
import { hexToPixel, hexPoints, getBoardViewBox } from '../../src/ui/hexLayout.js';
import { offsetToCube } from '../../src/engine/hex.js';

// ========== hexLayout unit tests ==========

describe('hexLayout', () => {
  it('hexToPixel returns numeric x/y for origin', () => {
    const coord = offsetToCube(0, 0);
    const { x, y } = hexToPixel(coord);
    expect(typeof x).toBe('number');
    expect(typeof y).toBe('number');
    expect(x).toBeCloseTo(0, 0);
    expect(y).toBeCloseTo(0, 0);
  });

  it('hexToPixel offsets correctly for adjacent cells', () => {
    const a = hexToPixel(offsetToCube(0, 0));
    const b = hexToPixel(offsetToCube(1, 0));
    // Same row, next column — should be offset in x
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeCloseTo(a.y);
  });

  it('hexToPixel shifts odd rows right', () => {
    const evenRow = hexToPixel(offsetToCube(0, 0));
    const oddRow = hexToPixel(offsetToCube(0, 1));
    // Odd row should be shifted right
    expect(oddRow.x).toBeGreaterThan(evenRow.x);
    expect(oddRow.y).toBeGreaterThan(evenRow.y);
  });

  it('hexPoints returns 6 vertices', () => {
    const pts = hexPoints();
    const vertices = pts.split(' ');
    expect(vertices).toHaveLength(6);
  });

  it('getBoardViewBox returns positive dimensions', () => {
    const vb = getBoardViewBox(18, 19);
    expect(vb.vbWidth).toBeGreaterThan(0);
    expect(vb.vbHeight).toBeGreaterThan(0);
  });
});

// ========== Component render tests ==========

describe('HexGrid component', () => {
  it('renders correct hex count for 2p board', () => {
    const board = createBoard('2p');
    const { container } = render(<HexGrid board={board} />);
    const polygons = container.querySelectorAll('polygon');
    expect(polygons).toHaveLength(Object.keys(board.cells).length);
  });

  it('renders correct hex count for 4p board', () => {
    const board = createBoard('4p');
    const { container } = render(<HexGrid board={board} />);
    const polygons = container.querySelectorAll('polygon');
    expect(polygons).toHaveLength(Object.keys(board.cells).length);
  });

  it('renders SVG element with data-testid', () => {
    const board = createBoard('2p');
    const { container } = render(<HexGrid board={board} />);
    expect(container.querySelector('[data-testid="hex-grid"]')).toBeTruthy();
  });

  it('shows coordinate labels when showCoords is true', () => {
    const board = createBoard('2p');
    const { container } = render(<HexGrid board={board} showCoords />);
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(Object.keys(board.cells).length);
  });

  it('hides coordinate labels when showCoords is false', () => {
    const board = createBoard('2p');
    const { container } = render(<HexGrid board={board} showCoords={false} />);
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(0);
  });

  it('fires onCellClick when a hex is clicked', () => {
    const board = createBoard('2p');
    const clicked: string[] = [];
    const { container } = render(
      <HexGrid board={board} onCellClick={cell => clicked.push(`${cell.coord.q},${cell.coord.r}`)} />,
    );
    const firstGroup = container.querySelector('g');
    if (firstGroup) fireEvent.click(firstGroup);
    expect(clicked).toHaveLength(1);
  });
});
