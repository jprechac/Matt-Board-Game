import type {
  Board, BoardSize, HexCell, PlayerId, CubeCoord,
} from './types.js';
import {
  BOARD_2P, BOARD_4P, BASE_BACK_ROW_SIZE, BASE_FRONT_ROW_SIZE,
  PLACEMENT_ZONE_DEPTH, TERRAIN_PLACEMENT_ZONE_DEPTH,
} from './types.js';
import { offsetToCube, hexKey } from './hex.js';

// ========== Board Creation ==========

/**
 * Create a game board with all zones marked.
 *
 * 2-player layout: player1 at row 0 (top), player2 at row height-1 (bottom).
 * 4-player layout (2v2): teams share bases — team1 (player1+player3) at top,
 * team2 (player2+player4) at bottom. Same base layout as 2p, just wider board.
 */
export function createBoard(size: BoardSize): Board {
  const { width, height } = size === '2p' ? BOARD_2P : BOARD_4P;
  const cells: Record<string, HexCell> = {};

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const coord = offsetToCube(col, row);
      const key = hexKey(coord);

      const cell: HexCell = {
        coord,
        basePlayerId: getBasePlayer(col, row, width, height, size),
        placementZonePlayerId: getPlacementZonePlayer(row, height, size),
        terrainPlacementZonePlayerId: getTerrainPlacementZonePlayer(row, height, size),
      };

      cells[key] = cell;
    }
  }

  return { size, width, height, cells };
}

// ========== Zone Calculations ==========

/**
 * Determine if a cell is part of a player's base.
 *
 * Base layout (centered horizontally):
 * - Back row (against board edge): BASE_BACK_ROW_SIZE hexes (4)
 * - Front row (one row inward): BASE_FRONT_ROW_SIZE hexes (3)
 */
function getBasePlayer(
  col: number, row: number, width: number, height: number, size: BoardSize,
): PlayerId | undefined {
  if (size === '2p') {
    // Player 1: rows 0–1 (top)
    if (isInBase(col, row, width, 0)) return 'player1';
    // Player 2: rows height-2 to height-1 (bottom)
    if (isInBase(col, row, width, height - 1)) return 'player2';
  } else {
    // 4-player (2v2): teams share bases, same top/bottom layout as 2p
    // Team 1 (player1+player3) at top, Team 2 (player2+player4) at bottom
    if (isInBase(col, row, width, 0)) return 'player1';
    if (isInBase(col, row, width, height - 1)) return 'player2';
  }
  return undefined;
}

/**
 * Check if a cell belongs to a base anchored at `edgeRow`.
 * edgeRow = 0 means top base; edgeRow = height-1 means bottom base.
 */
function isInBase(col: number, row: number, width: number, edgeRow: number): boolean {
  const isTop = edgeRow === 0;
  const backRow = edgeRow;
  const frontRow = isTop ? edgeRow + 1 : edgeRow - 1;

  // Center the base horizontally
  const backStart = Math.floor((width - BASE_BACK_ROW_SIZE) / 2);
  const frontStart = Math.floor((width - BASE_FRONT_ROW_SIZE) / 2);

  if (row === backRow && col >= backStart && col < backStart + BASE_BACK_ROW_SIZE) {
    return true;
  }
  if (row === frontRow && col >= frontStart && col < frontStart + BASE_FRONT_ROW_SIZE) {
    return true;
  }
  return false;
}

function getPlacementZonePlayer(row: number, height: number, size: BoardSize): PlayerId | undefined {
  // In 4p (2v2), teams share placement zones: team1 top, team2 bottom.
  // Zone returns the "team representative" player (player1/player2). The game
  // engine checks team membership to allow all team members to place here.
  if (row < PLACEMENT_ZONE_DEPTH) return 'player1';
  if (row >= height - PLACEMENT_ZONE_DEPTH) return 'player2';
  return undefined;
}

function getTerrainPlacementZonePlayer(row: number, height: number, size: BoardSize): PlayerId | undefined {
  // Same team-based convention as placement zones
  if (row < TERRAIN_PLACEMENT_ZONE_DEPTH) return 'player1';
  if (row >= height - TERRAIN_PLACEMENT_ZONE_DEPTH) return 'player2';
  return undefined;
}

// ========== Board Queries ==========

/** Get a cell by cube coordinate */
export function getCell(board: Board, coord: CubeCoord): HexCell | undefined {
  return board.cells[hexKey(coord)];
}

/** Get all cells belonging to a player's base */
export function getBaseCells(board: Board, playerId: PlayerId): HexCell[] {
  return Object.values(board.cells).filter(c => c.basePlayerId === playerId);
}

/** Get all cells in a player's placement zone */
export function getPlacementZoneCells(board: Board, playerId: PlayerId): HexCell[] {
  return Object.values(board.cells).filter(c => c.placementZonePlayerId === playerId);
}

/** Get all cells in a player's terrain placement zone */
export function getTerrainPlacementZoneCells(board: Board, playerId: PlayerId): HexCell[] {
  return Object.values(board.cells).filter(c => c.terrainPlacementZonePlayerId === playerId);
}

/** Check if a coordinate is on the board */
export function isOnBoard(board: Board, coord: CubeCoord): boolean {
  return hexKey(coord) in board.cells;
}

/** Get all valid board coordinates */
export function getAllCoords(board: Board): CubeCoord[] {
  return Object.values(board.cells).map(c => c.coord);
}
