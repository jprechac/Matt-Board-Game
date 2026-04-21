import { describe, it, expect } from 'vitest';
import { createBoard, getCell, getBaseCells, getPlacementZoneCells, getTerrainPlacementZoneCells, isOnBoard } from '../../src/engine/board.js';
import { offsetToCube, hexKey, cubeToOffset } from '../../src/engine/hex.js';
import { BOARD_2P, BOARD_4P, BASE_BACK_ROW_SIZE, BASE_FRONT_ROW_SIZE, PLACEMENT_ZONE_DEPTH, TERRAIN_PLACEMENT_ZONE_DEPTH } from '../../src/engine/types.js';

describe('createBoard', () => {
  describe('2-player board', () => {
    const board = createBoard('2p');

    it('has correct dimensions', () => {
      expect(board.width).toBe(BOARD_2P.width);
      expect(board.height).toBe(BOARD_2P.height);
      expect(board.size).toBe('2p');
    });

    it('has width * height cells', () => {
      expect(Object.keys(board.cells)).toHaveLength(BOARD_2P.width * BOARD_2P.height);
    });

    it('all cells have valid coordinates that are on the board', () => {
      for (const cell of Object.values(board.cells)) {
        expect(isOnBoard(board, cell.coord)).toBe(true);
      }
    });

    it('player1 base has 7 cells (4 back + 3 front)', () => {
      const baseCells = getBaseCells(board, 'player1');
      expect(baseCells).toHaveLength(BASE_BACK_ROW_SIZE + BASE_FRONT_ROW_SIZE);
    });

    it('player2 base has 7 cells (4 back + 3 front)', () => {
      const baseCells = getBaseCells(board, 'player2');
      expect(baseCells).toHaveLength(BASE_BACK_ROW_SIZE + BASE_FRONT_ROW_SIZE);
    });

    it('player1 base is at top of board (rows 0-1)', () => {
      const baseCells = getBaseCells(board, 'player1');
      for (const cell of baseCells) {
        const off = cubeToOffset(cell.coord);
        expect(off.row).toBeLessThanOrEqual(1);
      }
    });

    it('player2 base is at bottom of board (rows 17-18)', () => {
      const baseCells = getBaseCells(board, 'player2');
      for (const cell of baseCells) {
        const off = cubeToOffset(cell.coord);
        expect(off.row).toBeGreaterThanOrEqual(BOARD_2P.height - 2);
      }
    });

    it('bases are centered horizontally', () => {
      const p1Base = getBaseCells(board, 'player1');
      const p1BackRow = p1Base.filter(c => cubeToOffset(c.coord).row === 0);
      const cols = p1BackRow.map(c => cubeToOffset(c.coord).col).sort((a, b) => a - b);
      const expectedStart = Math.floor((BOARD_2P.width - BASE_BACK_ROW_SIZE) / 2);
      expect(cols[0]).toBe(expectedStart);
      expect(cols[cols.length - 1]).toBe(expectedStart + BASE_BACK_ROW_SIZE - 1);
    });

    it('player1 placement zone covers first 3 rows', () => {
      const zoneCells = getPlacementZoneCells(board, 'player1');
      for (const cell of zoneCells) {
        const off = cubeToOffset(cell.coord);
        expect(off.row).toBeLessThan(PLACEMENT_ZONE_DEPTH);
      }
      // Should be 3 rows × width
      expect(zoneCells).toHaveLength(PLACEMENT_ZONE_DEPTH * BOARD_2P.width);
    });

    it('player2 placement zone covers last 3 rows', () => {
      const zoneCells = getPlacementZoneCells(board, 'player2');
      for (const cell of zoneCells) {
        const off = cubeToOffset(cell.coord);
        expect(off.row).toBeGreaterThanOrEqual(BOARD_2P.height - PLACEMENT_ZONE_DEPTH);
      }
      expect(zoneCells).toHaveLength(PLACEMENT_ZONE_DEPTH * BOARD_2P.width);
    });

    it('terrain placement zones cover first/last 5 rows', () => {
      const p1Terrain = getTerrainPlacementZoneCells(board, 'player1');
      const p2Terrain = getTerrainPlacementZoneCells(board, 'player2');
      expect(p1Terrain).toHaveLength(TERRAIN_PLACEMENT_ZONE_DEPTH * BOARD_2P.width);
      expect(p2Terrain).toHaveLength(TERRAIN_PLACEMENT_ZONE_DEPTH * BOARD_2P.width);
    });

    it('no base overlap between players', () => {
      const p1Keys = getBaseCells(board, 'player1').map(c => hexKey(c.coord));
      const p2Keys = getBaseCells(board, 'player2').map(c => hexKey(c.coord));
      const overlap = p1Keys.filter(k => p2Keys.includes(k));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('4-player board', () => {
    const board = createBoard('4p');

    it('has correct dimensions', () => {
      expect(board.width).toBe(BOARD_4P.width);
      expect(board.height).toBe(BOARD_4P.height);
    });

    it('has width * height cells', () => {
      expect(Object.keys(board.cells)).toHaveLength(BOARD_4P.width * BOARD_4P.height);
    });

    it('has same base layout as 2p (teams share top/bottom bases)', () => {
      const p1Bases = getBaseCells(board, 'player1');
      const p2Bases = getBaseCells(board, 'player2');

      // Same 7-cell base structure (4 back + 3 front)
      expect(p1Bases).toHaveLength(BASE_BACK_ROW_SIZE + BASE_FRONT_ROW_SIZE);
      expect(p2Bases).toHaveLength(BASE_BACK_ROW_SIZE + BASE_FRONT_ROW_SIZE);

      // Bases are at top and bottom, centered on wider board
      const p1Rows = new Set(p1Bases.map(c => cubeToOffset(c.coord).row));
      const p2Rows = new Set(p2Bases.map(c => cubeToOffset(c.coord).row));
      expect(p1Rows).toEqual(new Set([0, 1])); // top
      expect(p2Rows).toEqual(new Set([BOARD_4P.height - 2, BOARD_4P.height - 1])); // bottom
    });

    it('has placement zones on top/bottom (shared by teams)', () => {
      const topZone = getPlacementZoneCells(board, 'player1');
      const bottomZone = getPlacementZoneCells(board, 'player2');

      expect(topZone.length).toBe(BOARD_4P.width * PLACEMENT_ZONE_DEPTH);
      expect(bottomZone.length).toBe(BOARD_4P.width * PLACEMENT_ZONE_DEPTH);

      // All top zone cells are in first 3 rows
      for (const cell of topZone) {
        const { row } = cubeToOffset(cell.coord);
        expect(row).toBeLessThan(PLACEMENT_ZONE_DEPTH);
      }
    });
  });
});

describe('getCell', () => {
  const board = createBoard('2p');

  it('returns cell for valid coordinate', () => {
    const coord = offsetToCube(0, 0);
    const cell = getCell(board, coord);
    expect(cell).toBeDefined();
    expect(cell!.coord).toEqual(coord);
  });

  it('returns undefined for off-board coordinate', () => {
    const coord = offsetToCube(100, 100);
    expect(getCell(board, coord)).toBeUndefined();
  });
});

describe('isOnBoard', () => {
  const board = createBoard('2p');

  it('returns true for valid coordinates', () => {
    expect(isOnBoard(board, offsetToCube(0, 0))).toBe(true);
    expect(isOnBoard(board, offsetToCube(9, 9))).toBe(true);
  });

  it('returns false for off-board coordinates', () => {
    expect(isOnBoard(board, offsetToCube(-1, 0))).toBe(false);
    expect(isOnBoard(board, offsetToCube(0, 19))).toBe(false);
    expect(isOnBoard(board, offsetToCube(18, 0))).toBe(false);
  });
});
