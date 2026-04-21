import type { CubeCoord, OffsetCoord } from './types.js';

// ========== Construction ==========

/** Create cube coordinates (validates q + r + s = 0) */
export function cube(q: number, r: number, s: number): CubeCoord {
  if (Math.round(q + r + s) !== 0) {
    throw new Error(`Invalid cube coordinates: q=${q} r=${r} s=${s} (q+r+s must equal 0)`);
  }
  return { q, r, s };
}

/** String key for using a CubeCoord as a map key */
export function hexKey(hex: CubeCoord): string {
  return `${hex.q},${hex.r},${hex.s}`;
}

/** Parse a hex key back to a CubeCoord */
export function parseHexKey(key: string): CubeCoord {
  const [q, r, s] = key.split(',').map(Number);
  return { q, r, s };
}

// ========== Coordinate Conversion (odd-r offset) ==========

/** Convert offset coordinates (col, row) to cube coordinates (odd-r layout) */
export function offsetToCube(col: number, row: number): CubeCoord {
  const q = col - Math.floor((row - (row & 1)) / 2);
  const r = row;
  const s = (-q - r) || 0; // avoid -0
  return { q, r, s };
}

/** Convert cube coordinates to offset coordinates (odd-r layout) */
export function cubeToOffset(hex: CubeCoord): OffsetCoord {
  const col = hex.q + Math.floor((hex.r - (hex.r & 1)) / 2);
  const row = hex.r;
  return { col, row };
}

// ========== Arithmetic ==========

export function cubeAdd(a: CubeCoord, b: CubeCoord): CubeCoord {
  return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s };
}

export function cubeSubtract(a: CubeCoord, b: CubeCoord): CubeCoord {
  return { q: a.q - b.q, r: a.r - b.r, s: a.s - b.s };
}

export function cubeScale(hex: CubeCoord, factor: number): CubeCoord {
  return { q: hex.q * factor, r: hex.r * factor, s: hex.s * factor };
}

export function cubeEquals(a: CubeCoord, b: CubeCoord): boolean {
  return a.q === b.q && a.r === b.r && a.s === b.s;
}

// ========== Distance ==========

/** Manhattan distance between two hexes in cube coordinates */
export function cubeDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.s - b.s),
  );
}

// ========== Directions & Neighbors ==========

/** The 6 hex directions in cube coordinates (pointy-top) */
const CUBE_DIRECTIONS: readonly CubeCoord[] = [
  { q: 1, r: 0, s: -1 },  // E
  { q: 1, r: -1, s: 0 },  // NE
  { q: 0, r: -1, s: 1 },  // NW
  { q: -1, r: 0, s: 1 },  // W
  { q: -1, r: 1, s: 0 },  // SW
  { q: 0, r: 1, s: -1 },  // SE
];

/** Get direction vector by index (0–5, wraps) */
export function cubeDirection(direction: number): CubeCoord {
  return CUBE_DIRECTIONS[((direction % 6) + 6) % 6];
}

/** Get the neighbor in a specific direction */
export function cubeNeighbor(hex: CubeCoord, direction: number): CubeCoord {
  return cubeAdd(hex, cubeDirection(direction));
}

/** Get all 6 neighbors of a hex */
export function cubeNeighbors(hex: CubeCoord): CubeCoord[] {
  return CUBE_DIRECTIONS.map(d => cubeAdd(hex, d));
}

// ========== Ranges ==========

/** All hexes within `range` distance of `center` (inclusive of center) */
export function hexesInRange(center: CubeCoord, range: number): CubeCoord[] {
  const results: CubeCoord[] = [];
  for (let q = -range; q <= range; q++) {
    for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
      const s = -q - r;
      results.push(cubeAdd(center, { q, r, s }));
    }
  }
  return results;
}

/** All hexes at exactly `radius` distance from `center` */
export function hexRing(center: CubeCoord, radius: number): CubeCoord[] {
  if (radius === 0) return [center];
  const results: CubeCoord[] = [];
  let hex = cubeAdd(center, cubeScale(cubeDirection(4), radius));
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push(hex);
      hex = cubeNeighbor(hex, side);
    }
  }
  return results;
}

// ========== Line of Sight ==========

/** Round fractional cube coordinates to the nearest hex */
export function cubeRound(q: number, r: number, s: number): CubeCoord {
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = (-rr - rs) || 0;
  } else if (dr > ds) {
    rr = (-rq - rs) || 0;
  } else {
    rs = (-rq - rr) || 0;
  }

  return { q: rq || 0, r: rr || 0, s: rs || 0 };
}

/** All hexes on the line from `a` to `b` (inclusive). Uses nudge to avoid edge ambiguity. */
export function hexLineTo(a: CubeCoord, b: CubeCoord): CubeCoord[] {
  const dist = cubeDistance(a, b);
  if (dist === 0) return [a];

  // Nudge start slightly to break ties when the line passes through an edge
  const aQ = a.q + 1e-6;
  const aR = a.r + 1e-6;
  const aS = a.s - 2e-6;

  const results: CubeCoord[] = [];
  for (let i = 0; i <= dist; i++) {
    const t = i / dist;
    results.push(cubeRound(
      aQ + (b.q - aQ) * t,
      aR + (b.r - aR) * t,
      aS + (b.s - aS) * t,
    ));
  }
  return results;
}

/**
 * Check line of sight between two hexes.
 * `isOpaque` returns true for hexes that block sight (walls, tall terrain, etc).
 * Start and end hexes are not checked for opacity.
 */
export function hasLineOfSight(
  a: CubeCoord,
  b: CubeCoord,
  isOpaque: (hex: CubeCoord) => boolean,
): boolean {
  const line = hexLineTo(a, b);
  // Skip start (index 0) and end (last index)
  for (let i = 1; i < line.length - 1; i++) {
    if (isOpaque(line[i])) return false;
  }
  return true;
}

// ========== Pathfinding ==========

/**
 * BFS: find all hexes reachable from `start` within `maxSteps`.
 * `isBlocked` returns true for hexes that cannot be entered or passed through.
 * Returns a Map of hexKey → cost (steps to reach). Includes the start hex with cost 0.
 */
export function bfsReachable(
  start: CubeCoord,
  maxSteps: number,
  isBlocked: (hex: CubeCoord) => boolean,
): Map<string, number> {
  const visited = new Map<string, number>();
  visited.set(hexKey(start), 0);

  let frontier: CubeCoord[] = [start];

  for (let step = 0; step < maxSteps; step++) {
    const nextFrontier: CubeCoord[] = [];
    for (const current of frontier) {
      for (const neighbor of cubeNeighbors(current)) {
        const key = hexKey(neighbor);
        if (!visited.has(key) && !isBlocked(neighbor)) {
          visited.set(key, step + 1);
          nextFrontier.push(neighbor);
        }
      }
    }
    frontier = nextFrontier;
  }

  return visited;
}

/**
 * BFS: find shortest path from `start` to `end`.
 * Returns the path (including start and end), or null if unreachable.
 */
export function bfsPath(
  start: CubeCoord,
  end: CubeCoord,
  isBlocked: (hex: CubeCoord) => boolean,
  maxSteps?: number,
): CubeCoord[] | null {
  const startKey = hexKey(start);
  const endKey = hexKey(end);
  if (startKey === endKey) return [start];
  if (isBlocked(end)) return null;

  const cameFrom = new Map<string, string | null>();
  cameFrom.set(startKey, null);

  let frontier: CubeCoord[] = [start];
  let steps = 0;

  while (frontier.length > 0) {
    if (maxSteps !== undefined && steps >= maxSteps) break;
    const nextFrontier: CubeCoord[] = [];

    for (const current of frontier) {
      for (const neighbor of cubeNeighbors(current)) {
        const key = hexKey(neighbor);
        if (key === endKey) {
          // Reconstruct path
          const path: CubeCoord[] = [neighbor];
          let parentKey: string | null = hexKey(current);
          while (parentKey !== null) {
            path.push(parseHexKey(parentKey));
            parentKey = cameFrom.get(parentKey) ?? null;
          }
          return path.reverse();
        }
        if (!cameFrom.has(key) && !isBlocked(neighbor)) {
          cameFrom.set(key, hexKey(current));
          nextFrontier.push(neighbor);
        }
      }
    }

    frontier = nextFrontier;
    steps++;
  }

  return null;
}
