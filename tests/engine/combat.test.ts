import { describe, it, expect } from 'vitest';
import type { Unit, AttackProfile, CubeCoord } from '../../src/engine/types.js';
import { SeededRNG } from '../../src/engine/rng.js';
import { offsetToCube } from '../../src/engine/hex.js';
import {
  getEffectiveToHit,
  resolveAttack,
  resolveCombat,
  validateAttack,
  resolveHeal,
} from '../../src/engine/combat.js';
import { RANGED_PROXIMITY_PENALTY } from '../../src/engine/types.js';

function makeUnit(overrides: Partial<Unit> & { id: string; position: CubeCoord }): Unit {
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
    activatedThisTurn: false,
    abilityState: {},
    ...overrides,
  };
}

const meleeProfile: AttackProfile = { range: 1, damage: 2, toHit: 4 };
const rangedProfile: AttackProfile = { range: 4, damage: 1, toHit: 5, critThreshold: 7 };
const noProxProfile: AttackProfile = { range: 3, damage: 2, toHit: 4, noProximityPenalty: true };

describe('getEffectiveToHit', () => {
  it('returns base toHit for melee attacks', () => {
    const pos = offsetToCube(5, 5);
    const target = offsetToCube(6, 5);
    expect(getEffectiveToHit(meleeProfile, pos, target)).toBe(4);
  });

  it('returns base toHit for ranged attacks at range', () => {
    const pos = offsetToCube(5, 5);
    const target = offsetToCube(5, 9);
    expect(getEffectiveToHit(rangedProfile, pos, target)).toBe(5);
  });

  it('adds proximity penalty for ranged attacks at melee range', () => {
    const pos = offsetToCube(5, 5);
    const target = offsetToCube(6, 5);
    expect(getEffectiveToHit(rangedProfile, pos, target)).toBe(5 + RANGED_PROXIMITY_PENALTY);
  });

  it('skips proximity penalty when noProximityPenalty is set', () => {
    const pos = offsetToCube(5, 5);
    const target = offsetToCube(6, 5);
    expect(getEffectiveToHit(noProxProfile, pos, target)).toBe(4);
  });
});

describe('resolveAttack', () => {
  it('produces deterministic results with same seed', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    const pos = offsetToCube(5, 5);
    const target = offsetToCube(6, 5);

    const r1 = resolveAttack(meleeProfile, pos, target, rng1);
    const r2 = resolveAttack(meleeProfile, pos, target, rng2);
    expect(r1.roll).toBe(r2.roll);
    expect(r1.hit).toBe(r2.hit);
    expect(r1.damage).toBe(r2.damage);
  });

  it('hit deals base damage', () => {
    // Find a seed that gives a hit (roll >= 4)
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const pos = offsetToCube(5, 5);
      const target = offsetToCube(6, 5);
      const result = resolveAttack(meleeProfile, pos, target, rng);
      if (result.hit && !result.crit) {
        expect(result.damage).toBe(2);
        return;
      }
    }
  });

  it('miss deals 0 damage', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const pos = offsetToCube(5, 5);
      const target = offsetToCube(6, 5);
      const result = resolveAttack(meleeProfile, pos, target, rng);
      if (!result.hit) {
        expect(result.damage).toBe(0);
        return;
      }
    }
  });

  it('crit deals damage + 1 by default', () => {
    // rangedProfile has critThreshold 7, damage 1 => crit does 2
    for (let seed = 0; seed < 200; seed++) {
      const rng = new SeededRNG(seed);
      const pos = offsetToCube(5, 5);
      const target = offsetToCube(5, 9);
      const result = resolveAttack(rangedProfile, pos, target, rng);
      if (result.crit) {
        expect(result.damage).toBe(2); // 1 + 1
        return;
      }
    }
  });

  it('applies toHitModifier', () => {
    // With a -2 modifier, even low rolls should hit
    const rng = new SeededRNG(1);
    const pos = offsetToCube(5, 5);
    const target = offsetToCube(6, 5);
    const result = resolveAttack(meleeProfile, pos, target, rng, -2);
    // effectiveToHit should be 4 + (-2) = 2
    expect(result.effectiveToHit).toBe(2);
  });

  it('applies damageModifier', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const pos = offsetToCube(5, 5);
      const target = offsetToCube(6, 5);
      const result = resolveAttack(meleeProfile, pos, target, rng, 0, 1);
      if (result.hit && !result.crit) {
        expect(result.damage).toBe(3); // 2 + 1
        return;
      }
    }
  });
});

describe('resolveCombat', () => {
  it('reduces target HP on hit', () => {
    const attacker = makeUnit({ id: 'a', position: offsetToCube(5, 5) });
    const target = makeUnit({ id: 't', position: offsetToCube(6, 5), playerId: 'player2', currentHp: 5 });

    // Find a seed that produces a hit
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const result = resolveCombat(attacker, target, meleeProfile, rng);
      if (result.attack.hit) {
        expect(result.updatedTarget.currentHp).toBeLessThan(target.currentHp);
        expect(result.updatedAttacker.hasAttackedThisTurn).toBe(true);
        expect(result.attack.attackerId).toBe('a');
        expect(result.attack.targetId).toBe('t');
        return;
      }
    }
  });

  it('marks target killed when HP reaches 0', () => {
    const attacker = makeUnit({ id: 'a', position: offsetToCube(5, 5) });
    const target = makeUnit({ id: 't', position: offsetToCube(6, 5), playerId: 'player2', currentHp: 1 });

    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const result = resolveCombat(attacker, target, meleeProfile, rng);
      if (result.attack.hit) {
        expect(result.updatedTarget.currentHp).toBe(0);
        expect(result.targetKilled).toBe(true);
        return;
      }
    }
  });

  it('does not reduce HP below 0', () => {
    const attacker = makeUnit({ id: 'a', position: offsetToCube(5, 5) });
    const target = makeUnit({ id: 't', position: offsetToCube(6, 5), playerId: 'player2', currentHp: 1 });

    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const result = resolveCombat(attacker, target, meleeProfile, rng);
      if (result.attack.hit) {
        expect(result.updatedTarget.currentHp).toBeGreaterThanOrEqual(0);
        return;
      }
    }
  });
});

describe('validateAttack', () => {
  it('rejects attack from dead attacker', () => {
    const attacker = makeUnit({ id: 'a', position: offsetToCube(5, 5), currentHp: 0 });
    const target = makeUnit({ id: 't', position: offsetToCube(6, 5), playerId: 'player2' });
    expect(validateAttack(attacker, target, meleeProfile).valid).toBe(false);
  });

  it('rejects attack on dead target', () => {
    const attacker = makeUnit({ id: 'a', position: offsetToCube(5, 5) });
    const target = makeUnit({ id: 't', position: offsetToCube(6, 5), playerId: 'player2', currentHp: 0 });
    expect(validateAttack(attacker, target, meleeProfile).valid).toBe(false);
  });

  it('rejects friendly fire', () => {
    const attacker = makeUnit({ id: 'a', position: offsetToCube(5, 5), playerId: 'player1' });
    const target = makeUnit({ id: 't', position: offsetToCube(6, 5), playerId: 'player1' });
    expect(validateAttack(attacker, target, meleeProfile).valid).toBe(false);
  });

  it('rejects if already attacked this turn', () => {
    const attacker = makeUnit({ id: 'a', position: offsetToCube(5, 5), hasAttackedThisTurn: true });
    const target = makeUnit({ id: 't', position: offsetToCube(6, 5), playerId: 'player2' });
    expect(validateAttack(attacker, target, meleeProfile).valid).toBe(false);
  });

  it('rejects out-of-range attack', () => {
    const attacker = makeUnit({ id: 'a', position: offsetToCube(5, 5) });
    const target = makeUnit({ id: 't', position: offsetToCube(5, 10), playerId: 'player2' });
    expect(validateAttack(attacker, target, meleeProfile).valid).toBe(false);
  });

  it('accepts valid melee attack', () => {
    const attacker = makeUnit({ id: 'a', position: offsetToCube(5, 5) });
    const target = makeUnit({ id: 't', position: offsetToCube(6, 5), playerId: 'player2' });
    expect(validateAttack(attacker, target, meleeProfile).valid).toBe(true);
  });

  it('accepts valid ranged attack', () => {
    const attacker = makeUnit({ id: 'a', position: offsetToCube(5, 5) });
    const target = makeUnit({ id: 't', position: offsetToCube(5, 8), playerId: 'player2' });
    expect(validateAttack(attacker, target, rangedProfile).valid).toBe(true);
  });
});

describe('resolveHeal', () => {
  it('heals on successful roll', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const target = makeUnit({ id: 't', position: offsetToCube(5, 5), currentHp: 3, maxHp: 5 });
      const result = resolveHeal(4, 6, 1, 2, target, rng);
      if (result.roll >= 4) {
        expect(result.healed).toBe(true);
        expect(result.healAmount).toBeGreaterThan(0);
        return;
      }
    }
  });

  it('enhanced heal on high roll', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = new SeededRNG(seed);
      const target = makeUnit({ id: 't', position: offsetToCube(5, 5), currentHp: 2, maxHp: 5 });
      const result = resolveHeal(4, 6, 1, 2, target, rng);
      if (result.roll >= 6) {
        expect(result.healAmount).toBe(2);
        return;
      }
    }
  });

  it('does not heal above max HP', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = new SeededRNG(seed);
      const target = makeUnit({ id: 't', position: offsetToCube(5, 5), currentHp: 5, maxHp: 5 });
      const result = resolveHeal(4, 6, 1, 2, target, rng);
      expect(result.healAmount).toBe(0);
    }
  });

  it('no heal on low roll', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const target = makeUnit({ id: 't', position: offsetToCube(5, 5), currentHp: 3, maxHp: 5 });
      const result = resolveHeal(4, 6, 1, 2, target, rng);
      if (result.roll < 4) {
        expect(result.healed).toBe(false);
        expect(result.healAmount).toBe(0);
        return;
      }
    }
  });
});
