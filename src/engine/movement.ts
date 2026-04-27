import type { Board, CubeCoord, GameState, Unit } from './types.js';
import { POST_ATTACK_MAX_MOVEMENT } from './types.js';
import { hexKey, cubeDistance, bfsReachable, cubeNeighbors } from './hex.js';
import { isOnBoard } from './board.js';

// ========== Occupancy ==========

/** Build a set of hex keys occupied by units */
export function occupiedHexes(units: readonly Unit[]): Set<string> {
  return new Set(
    units.filter(u => u.currentHp > 0).map(u => hexKey(u.position)),
  );
}

/** Check if a hex is occupied by any living unit */
export function isOccupied(units: readonly Unit[], coord: CubeCoord): boolean {
  const key = hexKey(coord);
  return units.some(u => u.currentHp > 0 && hexKey(u.position) === key);
}

/** Get the unit at a given position (if any) */
export function getUnitAt(units: readonly Unit[], coord: CubeCoord): Unit | undefined {
  const key = hexKey(coord);
  return units.find(u => u.currentHp > 0 && hexKey(u.position) === key);
}

// ========== Movement Range ==========

/**
 * Get the maximum movement a unit can use right now.
 * After attacking, a unit can only move 1 additional hex (if it hasn't used all movement).
 * If effectiveMovement is provided (from ability modifiers), it overrides the unit's base movement.
 */
export function getAvailableMovement(unit: Unit, effectiveMovement?: number): number {
  const baseMovement = effectiveMovement ?? unit.movement;

  if (unit.hasAttackedThisTurn) {
    // Cap total post-attack movement to POST_ATTACK_MAX_MOVEMENT
    const postAttackMovement = unit.movementUsedThisTurn - unit.movementUsedAtAttack;
    const baseRemaining = baseMovement - unit.movementUsedThisTurn;
    return Math.max(0, Math.min(baseRemaining, POST_ATTACK_MAX_MOVEMENT - postAttackMovement));
  }

  return Math.max(0, baseMovement - unit.movementUsedThisTurn);
}

/**
 * Compute the effective movement stat for a unit, accounting for ability modifiers.
 * The `unit.movement` field is not on the Unit interface directly — we look it up
 * from the unit definition. For now, this function requires the base movement to be
 * passed in or stored on the unit.
 */

// ========== Reachable Hexes ==========

/**
 * Get all hexes a unit can move to this turn.
 * Accounts for: remaining movement, obstacles (other units, off-board), post-attack restriction.
 */
export function getReachableHexes(
  unit: Unit,
  board: Board,
  units: readonly Unit[],
  movementOverride?: number,
): Map<string, number> {
  const movement = movementOverride ?? getAvailableMovement(unit);
  if (movement <= 0) return new Map([[hexKey(unit.position), 0]]);

  const occupied = occupiedHexes(units.filter(u => u.id !== unit.id));

  return bfsReachable(
    unit.position,
    movement,
    (hex) => !isOnBoard(board, hex) || occupied.has(hexKey(hex)),
  );
}

// ========== Movement Validation ==========

export interface MoveValidation {
  valid: boolean;
  reason?: string;
  distance?: number;
}

/**
 * Validate whether a unit can move to a target hex.
 */
export function validateMove(
  unit: Unit,
  to: CubeCoord,
  board: Board,
  units: readonly Unit[],
  movementOverride?: number,
): MoveValidation {
  // Can't move a dead unit
  if (unit.currentHp <= 0) {
    return { valid: false, reason: 'Unit is dead' };
  }

  // Target must be on the board
  if (!isOnBoard(board, to)) {
    return { valid: false, reason: 'Target hex is off the board' };
  }

  // Target must not be occupied
  if (isOccupied(units, to)) {
    return { valid: false, reason: 'Target hex is occupied' };
  }

  // Check reachability (handles pathing around obstacles)
  const reachable = getReachableHexes(unit, board, units, movementOverride);
  const targetKey = hexKey(to);

  if (!reachable.has(targetKey)) {
    return { valid: false, reason: 'Target hex is not reachable with remaining movement' };
  }

  return { valid: true, distance: reachable.get(targetKey)! };
}

// ========== Apply Movement ==========

/**
 * Apply a movement to a unit, returning the updated unit.
 * Does NOT validate — call validateMove first.
 */
export function applyMove(unit: Unit, to: CubeCoord, distance: number): Unit {
  return {
    ...unit,
    position: to,
    hasMovedThisTurn: true,
    movementUsedThisTurn: unit.movementUsedThisTurn + distance,
  };
}

// ========== Attack Range ==========

/**
 * Check if a target is within attack range of a unit.
 */
export function isInAttackRange(
  attacker: Unit,
  target: Unit,
  range: number,
): boolean {
  return cubeDistance(attacker.position, target.position) <= range;
}

/**
 * Check if target is at melee range (adjacent, distance = 1).
 */
export function isAtMeleeRange(a: CubeCoord, b: CubeCoord): boolean {
  return cubeDistance(a, b) === 1;
}

/**
 * Get all enemy units within attack range of a unit.
 */
export function getTargetsInRange(
  attacker: Unit,
  units: readonly Unit[],
  range: number,
): Unit[] {
  return units.filter(u =>
    u.currentHp > 0 &&
    u.playerId !== attacker.playerId &&
    cubeDistance(attacker.position, u.position) <= range,
  );
}
