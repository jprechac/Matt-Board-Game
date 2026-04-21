import { describe, it, expect } from 'vitest';
import {
  cube,
  hexKey,
  parseHexKey,
  offsetToCube,
  cubeToOffset,
  cubeAdd,
  cubeSubtract,
  cubeScale,
  cubeEquals,
  cubeDistance,
  cubeDirection,
  cubeNeighbor,
  cubeNeighbors,
  hexesInRange,
  hexRing,
  cubeRound,
  hexLineTo,
  hasLineOfSight,
  bfsReachable,
  bfsPath,
} from '../../src/engine/hex.js';

describe('cube()', () => {
  it('creates valid cube coordinates', () => {
    const c = cube(1, -1, 0);
    expect(c).toEqual({ q: 1, r: -1, s: 0 });
  });

  it('throws for invalid coordinates (q+r+s != 0)', () => {
    expect(() => cube(1, 1, 1)).toThrow();
  });
});

describe('hexKey / parseHexKey', () => {
  it('round-trips correctly', () => {
    const c = cube(3, -5, 2);
    expect(parseHexKey(hexKey(c))).toEqual(c);
  });
});

describe('offset ↔ cube conversion', () => {
  it('converts (0,0) correctly', () => {
    const c = offsetToCube(0, 0);
    expect(c).toEqual({ q: 0, r: 0, s: 0 });
    expect(cubeToOffset(c)).toEqual({ col: 0, row: 0 });
  });

  it('round-trips for various coordinates', () => {
    const cases = [
      [0, 0], [1, 0], [0, 1], [5, 3], [2, 4], [10, 10], [0, 7],
    ];
    for (const [col, row] of cases) {
      const c = offsetToCube(col, row);
      const off = cubeToOffset(c);
      expect(off).toEqual({ col, row });
    }
  });

  it('handles odd rows (offset shift)', () => {
    // Row 1 (odd) should shift
    const c1 = offsetToCube(0, 1);
    const c2 = offsetToCube(1, 1);
    expect(cubeDistance(c1, c2)).toBe(1);
  });
});

describe('cubeDistance', () => {
  it('distance to self is 0', () => {
    const c = cube(0, 0, 0);
    expect(cubeDistance(c, c)).toBe(0);
  });

  it('adjacent hexes have distance 1', () => {
    const origin = cube(0, 0, 0);
    for (const neighbor of cubeNeighbors(origin)) {
      expect(cubeDistance(origin, neighbor)).toBe(1);
    }
  });

  it('computes correct distance for non-adjacent hexes', () => {
    expect(cubeDistance(cube(0, 0, 0), cube(3, -3, 0))).toBe(3);
    expect(cubeDistance(cube(0, 0, 0), cube(2, -1, -1))).toBe(2);
    expect(cubeDistance(cube(-2, 3, -1), cube(1, -1, 0))).toBe(4);
  });
});

describe('cubeNeighbors', () => {
  it('returns 6 neighbors', () => {
    const n = cubeNeighbors(cube(0, 0, 0));
    expect(n).toHaveLength(6);
  });

  it('all neighbors are at distance 1', () => {
    const origin = cube(0, 0, 0);
    for (const n of cubeNeighbors(origin)) {
      expect(cubeDistance(origin, n)).toBe(1);
    }
  });

  it('neighbors are all unique', () => {
    const keys = cubeNeighbors(cube(0, 0, 0)).map(hexKey);
    expect(new Set(keys).size).toBe(6);
  });
});

describe('cubeAdd / cubeSubtract / cubeScale', () => {
  it('adds correctly', () => {
    expect(cubeAdd(cube(1, 0, -1), cube(0, -1, 1))).toEqual(cube(1, -1, 0));
  });

  it('subtracts correctly', () => {
    expect(cubeSubtract(cube(3, -2, -1), cube(1, -1, 0))).toEqual(cube(2, -1, -1));
  });

  it('scales correctly', () => {
    expect(cubeScale(cube(1, -1, 0), 3)).toEqual(cube(3, -3, 0));
  });
});

describe('cubeEquals', () => {
  it('equal coordinates return true', () => {
    expect(cubeEquals(cube(1, -1, 0), cube(1, -1, 0))).toBe(true);
  });

  it('different coordinates return false', () => {
    expect(cubeEquals(cube(1, -1, 0), cube(0, -1, 1))).toBe(false);
  });
});

describe('hexesInRange', () => {
  it('range 0 returns only center', () => {
    const result = hexesInRange(cube(0, 0, 0), 0);
    expect(result).toHaveLength(1);
    expect(cubeEquals(result[0], cube(0, 0, 0))).toBe(true);
  });

  it('range 1 returns 7 hexes', () => {
    expect(hexesInRange(cube(0, 0, 0), 1)).toHaveLength(7);
  });

  it('range 2 returns 19 hexes', () => {
    expect(hexesInRange(cube(0, 0, 0), 2)).toHaveLength(19);
  });

  it('all results are within range', () => {
    const center = cube(3, -2, -1);
    const range = 3;
    for (const hex of hexesInRange(center, range)) {
      expect(cubeDistance(center, hex)).toBeLessThanOrEqual(range);
    }
  });

  // Formula: 1 + 3*n*(n+1)
  it('count matches formula 1 + 3n(n+1)', () => {
    for (let n = 0; n <= 5; n++) {
      const expected = 1 + 3 * n * (n + 1);
      expect(hexesInRange(cube(0, 0, 0), n)).toHaveLength(expected);
    }
  });
});

describe('hexRing', () => {
  it('ring 0 returns center', () => {
    const result = hexRing(cube(0, 0, 0), 0);
    expect(result).toHaveLength(1);
  });

  it('ring 1 returns 6 hexes', () => {
    expect(hexRing(cube(0, 0, 0), 1)).toHaveLength(6);
  });

  it('ring N returns 6*N hexes', () => {
    for (let n = 1; n <= 4; n++) {
      expect(hexRing(cube(0, 0, 0), n)).toHaveLength(6 * n);
    }
  });

  it('all ring hexes are at exact distance', () => {
    const center = cube(1, -1, 0);
    const radius = 3;
    for (const hex of hexRing(center, radius)) {
      expect(cubeDistance(center, hex)).toBe(radius);
    }
  });
});

describe('cubeRound', () => {
  it('rounds fractional coords to nearest hex', () => {
    expect(cubeRound(0.1, -0.4, 0.3)).toEqual(cube(0, 0, 0));
    expect(cubeRound(0.9, -0.5, -0.4)).toEqual(cube(1, -1, 0));
  });
});

describe('hexLineTo', () => {
  it('same point returns single hex', () => {
    const a = cube(0, 0, 0);
    expect(hexLineTo(a, a)).toEqual([a]);
  });

  it('adjacent hexes return 2-element path', () => {
    const a = cube(0, 0, 0);
    const b = cube(1, 0, -1);
    const line = hexLineTo(a, b);
    expect(line).toHaveLength(2);
    expect(cubeEquals(line[0], a)).toBe(true);
    expect(cubeEquals(line[1], b)).toBe(true);
  });

  it('line length equals distance + 1', () => {
    const a = cube(0, 0, 0);
    const b = cube(3, -3, 0);
    expect(hexLineTo(a, b)).toHaveLength(4);
  });

  it('each consecutive pair in line is distance 1', () => {
    const a = cube(-2, 0, 2);
    const b = cube(2, -3, 1);
    const line = hexLineTo(a, b);
    for (let i = 1; i < line.length; i++) {
      expect(cubeDistance(line[i - 1], line[i])).toBe(1);
    }
  });
});

describe('hasLineOfSight', () => {
  it('returns true with no obstacles', () => {
    const a = cube(0, 0, 0);
    const b = cube(3, -3, 0);
    expect(hasLineOfSight(a, b, () => false)).toBe(true);
  });

  it('returns false when obstacle blocks path', () => {
    const a = cube(0, 0, 0);
    const b = cube(3, 0, -3);
    const blocker = cube(1, 0, -1);
    expect(hasLineOfSight(a, b, h => cubeEquals(h, blocker))).toBe(false);
  });

  it('does not check start or end hex for opacity', () => {
    const a = cube(0, 0, 0);
    const b = cube(1, 0, -1);
    // Both endpoints are "opaque" but should be ignored
    expect(hasLineOfSight(a, b, h => cubeEquals(h, a) || cubeEquals(h, b))).toBe(true);
  });
});

describe('bfsReachable', () => {
  it('range 0 returns only start', () => {
    const start = cube(0, 0, 0);
    const result = bfsReachable(start, 0, () => false);
    expect(result.size).toBe(1);
    expect(result.get(hexKey(start))).toBe(0);
  });

  it('range 1 open field returns 7 hexes', () => {
    const result = bfsReachable(cube(0, 0, 0), 1, () => false);
    expect(result.size).toBe(7);
  });

  it('range 2 open field returns 19 hexes', () => {
    const result = bfsReachable(cube(0, 0, 0), 2, () => false);
    expect(result.size).toBe(19);
  });

  it('respects blocked hexes', () => {
    const start = cube(0, 0, 0);
    // Block all east neighbors
    const blocked = new Set([hexKey(cube(1, 0, -1))]);
    const result = bfsReachable(start, 2, h => blocked.has(hexKey(h)));
    expect(result.has(hexKey(cube(1, 0, -1)))).toBe(false);
    // Can still reach hexes via other paths
    expect(result.has(hexKey(cube(0, -1, 1)))).toBe(true);
  });

  it('assigns correct costs', () => {
    const start = cube(0, 0, 0);
    const result = bfsReachable(start, 3, () => false);
    expect(result.get(hexKey(start))).toBe(0);
    // Any neighbor should have cost 1
    for (const n of cubeNeighbors(start)) {
      expect(result.get(hexKey(n))).toBe(1);
    }
  });
});

describe('bfsPath', () => {
  it('path to self is [self]', () => {
    const start = cube(0, 0, 0);
    expect(bfsPath(start, start, () => false)).toEqual([start]);
  });

  it('finds shortest path in open field', () => {
    const start = cube(0, 0, 0);
    const end = cube(2, -2, 0);
    const path = bfsPath(start, end, () => false);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3); // distance 2 => 3 hexes in path
    expect(cubeEquals(path![0], start)).toBe(true);
    expect(cubeEquals(path![path!.length - 1], end)).toBe(true);
  });

  it('navigates around obstacles', () => {
    const start = cube(0, 0, 0);
    const end = cube(2, 0, -2);
    // Block the direct path
    const blocker = cube(1, 0, -1);
    const path = bfsPath(start, end, h => cubeEquals(h, blocker));
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(3); // Must detour
    // Blocker should not be in path
    expect(path!.some(h => cubeEquals(h, blocker))).toBe(false);
  });

  it('returns null if destination is blocked', () => {
    const start = cube(0, 0, 0);
    const end = cube(1, 0, -1);
    expect(bfsPath(start, end, h => cubeEquals(h, end))).toBeNull();
  });

  it('returns null if completely surrounded', () => {
    const start = cube(0, 0, 0);
    const end = cube(3, 0, -3);
    // Block all neighbors of start
    const blockedSet = new Set(cubeNeighbors(start).map(hexKey));
    expect(bfsPath(start, end, h => blockedSet.has(hexKey(h)))).toBeNull();
  });

  it('respects maxSteps', () => {
    const start = cube(0, 0, 0);
    const end = cube(5, -5, 0); // distance 5
    expect(bfsPath(start, end, () => false, 3)).toBeNull();
    expect(bfsPath(start, end, () => false, 5)).not.toBeNull();
  });
});
