import { describe, it, expect } from 'vitest';
import type { Unit, Board } from '../../src/engine/types.js';
import { createBoard } from '../../src/engine/board.js';
import { offsetToCube, hexKey } from '../../src/engine/hex.js';
import {
  occupiedHexes, isOccupied, getUnitAt,
  getAvailableMovement, getReachableHexes,
  validateMove, applyMove,
  isInAttackRange, isAtMeleeRange, getTargetsInRange,
} from '../../src/engine/movement.js';

function makeUnit(overrides: Partial<Unit> & { id: string; position: Unit['position'] }): Unit {
  return {
    typeId: 'test',
    playerId: 'player1',
    factionId: 'vikings',
    category: 'specialty',
    currentHp: 5,
    maxHp: 5,
    movement: 3,
    hasMovedThisTurn: false,
    hasAttackedThisTurn: false,
    hasUsedAbilityThisTurn: false,
    movementUsedThisTurn: 0,
    abilityState: {},
    ...overrides,
  };
}

const board = createBoard('2p');

describe('occupiedHexes', () => {
  it('returns set of occupied hex keys', () => {
    const units = [
      makeUnit({ id: 'u1', position: offsetToCube(0, 0) }),
      makeUnit({ id: 'u2', position: offsetToCube(1, 0) }),
    ];
    const occupied = occupiedHexes(units);
    expect(occupied.size).toBe(2);
    expect(occupied.has(hexKey(offsetToCube(0, 0)))).toBe(true);
    expect(occupied.has(hexKey(offsetToCube(1, 0)))).toBe(true);
  });

  it('excludes dead units', () => {
    const units = [
      makeUnit({ id: 'u1', position: offsetToCube(0, 0), currentHp: 0 }),
    ];
    expect(occupiedHexes(units).size).toBe(0);
  });
});

describe('isOccupied / getUnitAt', () => {
  const units = [
    makeUnit({ id: 'u1', position: offsetToCube(5, 5) }),
  ];

  it('isOccupied returns true for occupied hex', () => {
    expect(isOccupied(units, offsetToCube(5, 5))).toBe(true);
  });

  it('isOccupied returns false for empty hex', () => {
    expect(isOccupied(units, offsetToCube(6, 6))).toBe(false);
  });

  it('getUnitAt returns the unit', () => {
    expect(getUnitAt(units, offsetToCube(5, 5))?.id).toBe('u1');
  });

  it('getUnitAt returns undefined for empty hex', () => {
    expect(getUnitAt(units, offsetToCube(6, 6))).toBeUndefined();
  });
});

describe('getAvailableMovement', () => {
  it('returns full movement for fresh unit', () => {
    const unit = makeUnit({ id: 'u1', position: offsetToCube(5, 5), movement: 3 });
    expect(getAvailableMovement(unit)).toBe(3);
  });

  it('reduces movement after partial use', () => {
    const unit = makeUnit({ id: 'u1', position: offsetToCube(5, 5), movement: 3, movementUsedThisTurn: 1 });
    expect(getAvailableMovement(unit)).toBe(2);
  });

  it('limits to 1 after attacking', () => {
    const unit = makeUnit({
      id: 'u1', position: offsetToCube(5, 5), movement: 3,
      hasAttackedThisTurn: true, movementUsedThisTurn: 1,
    });
    expect(getAvailableMovement(unit)).toBe(1);
  });

  it('returns 0 after attacking if all movement used', () => {
    const unit = makeUnit({
      id: 'u1', position: offsetToCube(5, 5), movement: 3,
      hasAttackedThisTurn: true, movementUsedThisTurn: 3,
    });
    expect(getAvailableMovement(unit)).toBe(0);
  });
});

describe('validateMove', () => {
  it('rejects move for dead unit', () => {
    const unit = makeUnit({ id: 'u1', position: offsetToCube(5, 5), currentHp: 0 });
    const result = validateMove(unit, offsetToCube(5, 6), board, [unit], 3);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('dead');
  });

  it('rejects move to off-board hex', () => {
    const unit = makeUnit({ id: 'u1', position: offsetToCube(0, 0) });
    const result = validateMove(unit, offsetToCube(-1, 0), board, [unit], 3);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('off the board');
  });

  it('rejects move to occupied hex', () => {
    const unit1 = makeUnit({ id: 'u1', position: offsetToCube(5, 5) });
    const unit2 = makeUnit({ id: 'u2', position: offsetToCube(5, 6) });
    const result = validateMove(unit1, offsetToCube(5, 6), board, [unit1, unit2], 3);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('occupied');
  });

  it('accepts valid move to adjacent hex', () => {
    const unit = makeUnit({ id: 'u1', position: offsetToCube(5, 5) });
    // Neighbor of (5,5)
    const target = offsetToCube(6, 5);
    const result = validateMove(unit, target, board, [unit], 3);
    expect(result.valid).toBe(true);
    expect(result.distance).toBe(1);
  });

  it('rejects move beyond range', () => {
    const unit = makeUnit({ id: 'u1', position: offsetToCube(5, 5) });
    const farAway = offsetToCube(5, 15);
    const result = validateMove(unit, farAway, board, [unit], 2);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not reachable');
  });
});

describe('applyMove', () => {
  it('updates position and movement tracking', () => {
    const unit = makeUnit({ id: 'u1', position: offsetToCube(5, 5) });
    const target = offsetToCube(6, 5);
    const moved = applyMove(unit, target, 1);
    expect(moved.position).toEqual(target);
    expect(moved.hasMovedThisTurn).toBe(true);
    expect(moved.movementUsedThisTurn).toBe(1);
  });

  it('accumulates movement', () => {
    const unit = { ...makeUnit({ id: 'u1', position: offsetToCube(5, 5) }), movementUsedThisTurn: 1 };
    const moved = applyMove(unit, offsetToCube(6, 5), 1);
    expect(moved.movementUsedThisTurn).toBe(2);
  });
});

describe('attack range helpers', () => {
  const attacker = makeUnit({ id: 'u1', position: offsetToCube(5, 5) });
  const adjacent = makeUnit({ id: 'u2', position: offsetToCube(6, 5), playerId: 'player2' });
  const far = makeUnit({ id: 'u3', position: offsetToCube(5, 10), playerId: 'player2' });

  it('isInAttackRange for melee', () => {
    expect(isInAttackRange(attacker, adjacent, 1)).toBe(true);
    expect(isInAttackRange(attacker, far, 1)).toBe(false);
  });

  it('isInAttackRange for ranged', () => {
    expect(isInAttackRange(attacker, far, 10)).toBe(true);
  });

  it('isAtMeleeRange', () => {
    expect(isAtMeleeRange(attacker.position, adjacent.position)).toBe(true);
    expect(isAtMeleeRange(attacker.position, far.position)).toBe(false);
  });

  it('getTargetsInRange finds enemy units', () => {
    const units = [attacker, adjacent, far];
    const targets = getTargetsInRange(attacker, units, 1);
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('u2');
  });

  it('getTargetsInRange excludes friendly units', () => {
    const friendly = makeUnit({ id: 'u4', position: offsetToCube(4, 5), playerId: 'player1' });
    const targets = getTargetsInRange(attacker, [attacker, friendly, adjacent], 1);
    expect(targets.every(t => t.playerId !== attacker.playerId)).toBe(true);
  });
});
