import type { Unit, AttackProfile, CubeCoord } from './types.js';
import { RANGED_PROXIMITY_PENALTY, D8_SIDES } from './types.js';
import { cubeDistance } from './hex.js';
import { SeededRNG } from './rng.js';

// ========== Combat Result Types ==========

export interface AttackResult {
  readonly roll: number;
  readonly effectiveToHit: number;
  readonly hit: boolean;
  readonly crit: boolean;
  readonly damage: number;
  readonly targetId: string;
  readonly attackerId: string;
}

export interface CombatResolution {
  readonly attack: AttackResult;
  readonly updatedTarget: Unit;
  readonly targetKilled: boolean;
  readonly updatedAttacker: Unit;
}

// ========== To-Hit Calculation ==========

/**
 * Calculate the effective to-hit threshold for an attack.
 * Accounts for ranged proximity penalty (ranged attacks at melee range).
 */
export function getEffectiveToHit(
  profile: AttackProfile,
  attackerPos: CubeCoord,
  targetPos: CubeCoord,
): number {
  let toHit = profile.toHit;

  // Ranged proximity penalty: ranged attacks at adjacent range get +1 to hit
  if (profile.range > 1 && !profile.noProximityPenalty) {
    const dist = cubeDistance(attackerPos, targetPos);
    if (dist === 1) {
      toHit += RANGED_PROXIMITY_PENALTY;
    }
  }

  return toHit;
}

// ========== Attack Resolution ==========

/**
 * Resolve a single attack roll.
 * Returns the roll result and whether it hit/crit, plus damage dealt.
 */
export function resolveAttack(
  profile: AttackProfile,
  attackerPos: CubeCoord,
  targetPos: CubeCoord,
  rng: SeededRNG,
  toHitModifier: number = 0,
  damageModifier: number = 0,
): AttackResult & { roll: number } {
  const roll = rng.d8();
  const effectiveToHit = getEffectiveToHit(profile, attackerPos, targetPos) + toHitModifier;

  const hit = roll >= effectiveToHit;
  const crit = hit && profile.critThreshold !== undefined && roll >= profile.critThreshold;
  const baseDamage = profile.damage + damageModifier;
  const damage = hit
    ? crit
      ? (profile.critDamage ?? baseDamage + 1)
      : baseDamage
    : 0;

  return {
    roll,
    effectiveToHit,
    hit,
    crit,
    damage,
    targetId: '',
    attackerId: '',
  };
}

/**
 * Full combat resolution: roll attack, apply damage to target, mark attacker as having attacked.
 */
export function resolveCombat(
  attacker: Unit,
  target: Unit,
  profile: AttackProfile,
  rng: SeededRNG,
  toHitModifier: number = 0,
  damageModifier: number = 0,
): CombatResolution {
  const result = resolveAttack(
    profile,
    attacker.position,
    target.position,
    rng,
    toHitModifier,
    damageModifier,
  );

  const attackResult: AttackResult = {
    ...result,
    targetId: target.id,
    attackerId: attacker.id,
  };

  const newHp = Math.max(0, target.currentHp - attackResult.damage);
  const updatedTarget: Unit = {
    ...target,
    currentHp: newHp,
  };

  const updatedAttacker: Unit = {
    ...attacker,
    hasAttackedThisTurn: true,
  };

  return {
    attack: attackResult,
    updatedTarget,
    targetKilled: newHp <= 0,
    updatedAttacker,
  };
}

// ========== Attack Validation ==========

export interface AttackValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Validate whether an attack is legal.
 */
export function validateAttack(
  attacker: Unit,
  target: Unit,
  profile: AttackProfile,
): AttackValidation {
  if (attacker.currentHp <= 0) {
    return { valid: false, reason: 'Attacker is dead' };
  }

  if (target.currentHp <= 0) {
    return { valid: false, reason: 'Target is dead' };
  }

  if (attacker.playerId === target.playerId) {
    return { valid: false, reason: 'Cannot attack friendly units' };
  }

  if (attacker.hasAttackedThisTurn) {
    return { valid: false, reason: 'Unit has already attacked this turn' };
  }

  const distance = cubeDistance(attacker.position, target.position);
  if (distance > profile.range) {
    return { valid: false, reason: 'Target is out of range' };
  }

  if (distance === 0) {
    return { valid: false, reason: 'Cannot attack unit on same hex' };
  }

  return { valid: true };
}

// ========== Healing (Ottomans Medic) ==========

export interface HealResult {
  readonly roll: number;
  readonly healed: boolean;
  readonly healAmount: number;
}

/**
 * Resolve a healing action (Medic ability).
 */
export function resolveHeal(
  healThreshold: number,
  enhancedThreshold: number,
  healAmount: number,
  enhancedHealAmount: number,
  target: Unit,
  rng: SeededRNG,
): HealResult {
  const roll = rng.d8();
  let amount = 0;

  if (roll >= enhancedThreshold) {
    amount = enhancedHealAmount;
  } else if (roll >= healThreshold) {
    amount = healAmount;
  }

  // Can't heal above max HP
  amount = Math.min(amount, target.maxHp - target.currentHp);

  return {
    roll,
    healed: amount > 0,
    healAmount: amount,
  };
}
