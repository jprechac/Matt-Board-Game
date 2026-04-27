import type { Unit, GameState, CubeCoord, AttackProfile } from '../types.js';
import { cubeDistance } from '../hex.js';

// ========== Ability Handler Interface ==========

/**
 * Context passed to ability handlers for evaluating/applying effects.
 */
export interface AbilityContext {
  readonly unit: Unit;
  readonly state: GameState;
  readonly allUnits: readonly Unit[];
}

/**
 * Modifiers that an ability can apply to combat.
 */
export interface CombatModifiers {
  readonly toHitModifier?: number;       // Added to the to-hit threshold (negative = easier)
  readonly damageModifier?: number;      // Added to damage on hit
  readonly extraAttacks?: number;        // Additional attacks this unit can make
  readonly blockAttack?: boolean;        // Prevent this attack entirely
  readonly overrideProfile?: AttackProfile; // Replace the attack profile
}

/**
 * Modifiers that an ability can apply to movement.
 */
export interface MovementModifiers {
  readonly movementOverride?: number;    // Replace base movement value
  readonly canMoveAfterAttack?: boolean; // Override post-attack movement restriction
  readonly blockMovement?: boolean;      // Prevent movement entirely
}

/**
 * Ability handler — each ability implements the hooks it needs.
 * All hooks are optional; unimplemented hooks have no effect.
 */
export interface AbilityHandler {
  /** Unique ability identifier (matches abilityId in unit data) */
  readonly id: string;

  /** Human-readable description */
  readonly description: string;

  /**
   * Modify this unit's outgoing attack.
   * Called when the unit with this ability attacks.
   */
  onAttack?(ctx: AbilityContext, target: Unit): CombatModifiers;

  /**
   * Modify incoming attack against this unit.
   * Called when the unit with this ability is attacked.
   */
  onDefend?(ctx: AbilityContext, attacker: Unit): CombatModifiers;

  /**
   * Modify this unit's movement.
   * Called when calculating available movement.
   */
  onMove?(ctx: AbilityContext): MovementModifiers;

  /**
   * Check if this ability can be activated (for active abilities).
   */
  canActivate?(ctx: AbilityContext, params?: Record<string, unknown>): boolean;

  /**
   * Apply the active ability effect. Returns updated game state.
   */
  activate?(ctx: AbilityContext, params?: Record<string, unknown>): GameState;

  /**
   * Aura range — if set, this ability has an aura that affects allies within this distance.
   */
  readonly auraRange?: number;

  /**
   * Modify an allied unit's outgoing attack when this unit's aura is in range.
   * Called on the aura owner when a nearby ally attacks.
   */
  onAllyAttack?(auraUnit: Unit, attackerCtx: AbilityContext, target: Unit): CombatModifiers;
}

// ========== Ability Registry ==========

const abilityRegistry = new Map<string, AbilityHandler>();

/** Register an ability handler */
export function registerAbility(handler: AbilityHandler): void {
  abilityRegistry.set(handler.id, handler);
}

/** Get an ability handler by ID */
export function getAbility(id: string): AbilityHandler | undefined {
  return abilityRegistry.get(id);
}

/** Get all registered ability IDs */
export function getAllAbilityIds(): string[] {
  return Array.from(abilityRegistry.keys());
}

// ========== Helper: Get Modifiers ==========

/** Get attack modifiers for a unit's ability (if any), including aura effects from allies */
export function getAttackModifiers(
  ctx: AbilityContext,
  target: Unit,
): CombatModifiers {
  const ability = ctx.unit.abilityState?.abilityId
    ? getAbility(ctx.unit.abilityState.abilityId as string)
    : undefined;

  // Try the unit's data-defined abilityId
  const handler = getAbilityForUnit(ctx.unit);
  let mods: CombatModifiers = {};
  if (handler?.onAttack) {
    mods = handler.onAttack(ctx, target);
  }

  // Check for aura effects from nearby allied units
  const auraMods = getExternalAttackModifiers(ctx, target);
  if (auraMods.toHitModifier || auraMods.damageModifier) {
    mods = {
      ...mods,
      toHitModifier: (mods.toHitModifier ?? 0) + (auraMods.toHitModifier ?? 0) || undefined,
      damageModifier: (mods.damageModifier ?? 0) + (auraMods.damageModifier ?? 0) || undefined,
    };
  }
  if (auraMods.blockAttack) {
    mods = { ...mods, blockAttack: true };
  }

  return mods;
}

/** Get defense modifiers for a unit's ability (if any) */
export function getDefenseModifiers(
  ctx: AbilityContext,
  attacker: Unit,
): CombatModifiers {
  const handler = getAbilityForUnit(ctx.unit);
  if (handler?.onDefend) {
    return handler.onDefend(ctx, attacker);
  }
  return {};
}

/** Get movement modifiers for a unit's ability (if any) */
export function getMovementModifiers(ctx: AbilityContext): MovementModifiers {
  const handler = getAbilityForUnit(ctx.unit);
  if (handler?.onMove) {
    return handler.onMove(ctx);
  }
  return {};
}

/** Look up the ability handler for a unit based on its data definition */
function getAbilityForUnit(unit: Unit): AbilityHandler | undefined {
  // abilityId is stored in the unit's data definition; we need to look it up.
  // For live units, we store it in abilityState.abilityId at creation time.
  const abilityId = unit.abilityState?.abilityId as string | undefined;
  return abilityId ? getAbility(abilityId) : undefined;
}

/**
 * Get attack modifiers from external sources (auras from nearby allied units).
 * Scans all living allies for aura abilities within range and aggregates their modifiers.
 */
export function getExternalAttackModifiers(
  attackerCtx: AbilityContext,
  target: Unit,
): CombatModifiers {
  let totalToHit = 0;
  let totalDamage = 0;

  for (const ally of attackerCtx.allUnits) {
    // Skip self, dead units, and enemies
    if (ally.id === attackerCtx.unit.id) continue;
    if (ally.currentHp <= 0) continue;
    if (ally.playerId !== attackerCtx.unit.playerId) continue;

    const handler = getAbilityForUnit(ally);
    if (!handler?.auraRange || !handler.onAllyAttack) continue;

    // Check if the attacker is within the aura range
    const dist = cubeDistance(ally.position, attackerCtx.unit.position);
    if (dist <= handler.auraRange) {
      const mods = handler.onAllyAttack(ally, attackerCtx, target);
      totalToHit += mods.toHitModifier ?? 0;
      totalDamage += mods.damageModifier ?? 0;
    }
  }

  return {
    ...(totalToHit !== 0 ? { toHitModifier: totalToHit } : {}),
    ...(totalDamage !== 0 ? { damageModifier: totalDamage } : {}),
  };
}
