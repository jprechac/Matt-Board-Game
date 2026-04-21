import type { AbilityHandler } from './types.js';
import { registerAbility } from './types.js';
import { cubeDistance, cubeNeighbors, hexKey } from '../hex.js';

// ========== Basic Units ==========

const basicRangedRestrictedMovement: AbilityHandler = {
  id: 'basic_ranged_restricted_movement',
  description: 'Can only move 1 tile on a turn where it attacks (before or after).',
  onMove(ctx) {
    // If the unit has attacked (or will attack), restrict total movement to 1
    // This is enforced at validation time; here we just signal the restriction.
    // The actual enforcement: if unit attacks this turn, max movement = 1 total.
    return {};
  },
};

// ========== Aztecs ==========

const itzcoatlAura: AbilityHandler = {
  id: 'itzcoatl_aura',
  description: 'Allies within 2 hexes have -1 to hit but cannot sacrifice enemies.',
  // This is an aura — applied during combat resolution by checking proximity
  onAttack(ctx, target) {
    return {}; // Leader's own attacks are unmodified
  },
};

const jaguarSacrifice: AbilityHandler = {
  id: 'jaguar_sacrifice',
  description: 'Receives +1 Damage buff after 2 sacrifices.',
  onAttack(ctx) {
    const sacrifices = (ctx.unit.abilityState?.sacrificeCount as number) ?? 0;
    if (sacrifices >= 2) {
      return { damageModifier: 1 };
    }
    return {};
  },
};

const priestBuff: AbilityHandler = {
  id: 'priest_buff',
  description: 'Can reduce enemy to-hit or increase ally damage for a turn.',
  canActivate() {
    return true; // TODO: full implementation
  },
};

// ========== Bulgars ==========

const nullifyTerrain: AbilityHandler = {
  id: 'nullify_terrain',
  description: 'Nullifies enemy terrain bonuses.',
  // Passive — checked during terrain effect resolution
};

const terrainHitBonus: AbilityHandler = {
  id: 'terrain_hit_bonus',
  description: '-1 To Hit if near natural terrain.',
  onAttack(ctx) {
    // TODO: Check if unit is adjacent to natural terrain
    // For now, stub — terrain system not yet implemented
    return {};
  },
};

// ========== English ==========

const upgradeUnit: AbilityHandler = {
  id: 'upgrade_unit',
  description: 'Can upgrade one basic unit to a corresponding specialty unit before it takes damage.',
  canActivate(ctx, params) {
    // TODO: Check if target is a basic unit that hasn't taken damage
    return true;
  },
};

// ========== Huns ==========

const attilaTbd: AbilityHandler = {
  id: 'attila_tbd',
  description: 'Attila ability TBD — placeholder.',
};

// ========== Japanese ==========

const dualAttack: AbilityHandler = {
  id: 'dual_attack',
  description: 'Can use both a melee and samurai ranged attack in one turn.',
  onAttack(ctx) {
    return { extraAttacks: 1 };
  },
};

const samuraiAdjacencyBonus: AbilityHandler = {
  id: 'samurai_adjacency_bonus',
  description: 'Melee To Hit gets -1 bonus if unit is adjacent to 2+ enemies.',
  onAttack(ctx, target) {
    const neighbors = cubeNeighbors(ctx.unit.position);
    const adjacentEnemies = ctx.allUnits.filter(u =>
      u.currentHp > 0 &&
      u.playerId !== ctx.unit.playerId &&
      neighbors.some(n => hexKey(n) === hexKey(u.position)),
    );
    if (adjacentEnemies.length >= 2) {
      return { toHitModifier: -1 };
    }
    return {};
  },
};

// ========== Mongols ==========

const reducedBaseControl: AbilityHandler = {
  id: 'reduced_base_control',
  description: 'Only requires control of opponent\'s base for 2 turns to win.',
  // Passive — checked during win condition evaluation
};

const fullMovementHitBonus: AbilityHandler = {
  id: 'full_movement_hit_bonus',
  description: 'If the Kheshig uses its full movement before attacking, receives -1 bonus To Hit.',
  onAttack(ctx) {
    // Check if unit used all its movement before attacking
    const baseMoveParam = ctx.unit.abilityState?.baseMovement as number | undefined;
    const baseMove = baseMoveParam ?? 3; // Kheshig base movement
    if (ctx.unit.movementUsedThisTurn >= baseMove) {
      return { toHitModifier: -1 };
    }
    return {};
  },
};

const antiBasicDamage: AbilityHandler = {
  id: 'anti_basic_damage',
  description: 'Deals an additional 1 damage to Basic units.',
  onAttack(ctx, target) {
    if (target.category === 'basic') {
      return { damageModifier: 1 };
    }
    return {};
  },
};

// ========== Muscovites ==========

const placeTokens: AbilityHandler = {
  id: 'place_tokens',
  description: 'Can place 2 tokens to buff allies within 2 hexes with -1 To Hit.',
  canActivate(ctx) {
    const tokensPlaced = (ctx.unit.abilityState?.tokensPlaced as number) ?? 0;
    const maxTokens = (ctx.unit.abilityState?.tokenCount as number) ?? 2;
    return tokensPlaced < maxTokens;
  },
};

const strelstyDefense: AbilityHandler = {
  id: 'streltsy_defense',
  description: 'Can\'t be attacked by 1-range move-and-attack units; can\'t move and attack.',
  onDefend(ctx, attacker) {
    // If attacker has range 1 and moved this turn, block the attack
    if (attacker.hasMovedThisTurn) {
      // We check the attacker's attack range at validation time
      return { blockAttack: true };
    }
    return {};
  },
  onMove(ctx) {
    // If this unit wants to attack, it cannot also move (and vice versa)
    // This is enforced: if moved, can't attack; if attacked, can't have moved
    return {};
  },
};

const cossackSlow: AbilityHandler = {
  id: 'cossack_slow',
  description: 'Movement reduced to 3 when starting turn adjacent to an enemy.',
  onMove(ctx) {
    const neighbors = cubeNeighbors(ctx.unit.position);
    const adjacentEnemy = ctx.allUnits.some(u =>
      u.currentHp > 0 &&
      u.playerId !== ctx.unit.playerId &&
      neighbors.some(n => hexKey(n) === hexKey(u.position)),
    );
    if (adjacentEnemy) {
      const reducedMovement = (ctx.unit.abilityState?.reducedMovement as number) ?? 3;
      return { movementOverride: reducedMovement };
    }
    return {};
  },
};

// ========== Ottomans ==========

const siegeMovementBuff: AbilityHandler = {
  id: 'siege_movement_buff',
  description: 'Siege units within 3 hexes of Suleiman gain +1 movement.',
  // Passive aura — checked during movement calculation for nearby siege units
};

const medicHeal: AbilityHandler = {
  id: 'medic_heal',
  description: 'Heals allied units rather than attacking enemy units.',
  // Healing is resolved through combat.ts resolveHeal()
};

const janissaryReload: AbilityHandler = {
  id: 'janissary_reload',
  description: 'Must skip turn to reload. Movement reduced to 2 on reload turns.',
  onMove(ctx) {
    const needsReload = (ctx.unit.abilityState?.needsReload as boolean) ?? false;
    if (needsReload) {
      const reloadMovement = (ctx.unit.abilityState?.reloadMovement as number) ?? 2;
      return { movementOverride: reloadMovement };
    }
    return {};
  },
  onAttack(ctx) {
    const needsReload = (ctx.unit.abilityState?.needsReload as boolean) ?? false;
    if (needsReload) {
      return { blockAttack: true };
    }
    return {};
  },
};

// ========== Romans ==========

const redirectAttack: AbilityHandler = {
  id: 'redirect_attack',
  description: 'Redirect one enemy attack per turn to any unit adjacent to the target.',
  // Active/reactive ability — triggered during opponent's attack resolution
  canActivate(ctx) {
    const used = (ctx.unit.abilityState?.redirectUsedThisTurn as boolean) ?? false;
    return !used;
  },
};

const formationBonus: AbilityHandler = {
  id: 'formation_bonus',
  description: 'Receives -1 bonus To Hit when adjacent to an allied unit.',
  onAttack(ctx) {
    const neighbors = cubeNeighbors(ctx.unit.position);
    const adjacentAlly = ctx.allUnits.some(u =>
      u.currentHp > 0 &&
      u.id !== ctx.unit.id &&
      u.playerId === ctx.unit.playerId &&
      neighbors.some(n => hexKey(n) === hexKey(u.position)),
    );
    if (adjacentAlly) {
      return { toHitModifier: -1 };
    }
    return {};
  },
};

const commandAttack: AbilityHandler = {
  id: 'command_attack',
  description: 'Can command a Basic Melee unit to attack again.',
  canActivate(ctx) {
    // Check if there's an adjacent basic melee unit that has already attacked
    return true; // TODO: full validation
  },
};

// ========== Vandals ==========

const loneWolfLeader: AbilityHandler = {
  id: 'lone_wolf_leader',
  description: 'If adjacent to an enemy and no allies, receives -1 To Hit and +1 Damage.',
  onAttack(ctx, target) {
    const neighbors = cubeNeighbors(ctx.unit.position);
    const hasAdjacentEnemy = ctx.allUnits.some(u =>
      u.currentHp > 0 &&
      u.playerId !== ctx.unit.playerId &&
      neighbors.some(n => hexKey(n) === hexKey(u.position)),
    );
    const hasAdjacentAlly = ctx.allUnits.some(u =>
      u.currentHp > 0 &&
      u.id !== ctx.unit.id &&
      u.playerId === ctx.unit.playerId &&
      neighbors.some(n => hexKey(n) === hexKey(u.position)),
    );
    if (hasAdjacentEnemy && !hasAdjacentAlly) {
      return { toHitModifier: -1, damageModifier: 1 };
    }
    return {};
  },
};

const loneWolfUnit: AbilityHandler = {
  id: 'lone_wolf_unit',
  description: 'Receives -1 To Hit bonus if the unit has no adjacent allies.',
  onAttack(ctx) {
    const neighbors = cubeNeighbors(ctx.unit.position);
    const hasAdjacentAlly = ctx.allUnits.some(u =>
      u.currentHp > 0 &&
      u.id !== ctx.unit.id &&
      u.playerId === ctx.unit.playerId &&
      neighbors.some(n => hexKey(n) === hexKey(u.position)),
    );
    if (!hasAdjacentAlly) {
      return { toHitModifier: -1 };
    }
    return {};
  },
};

// ========== Vikings ==========

const doubleAttack: AbilityHandler = {
  id: 'double_attack',
  description: 'Can attack twice per turn.',
  onAttack() {
    return { extraAttacks: 1 };
  },
};

// ========== Registration ==========

const ALL_ABILITIES: AbilityHandler[] = [
  // Basic
  basicRangedRestrictedMovement,
  // Aztecs
  itzcoatlAura, jaguarSacrifice, priestBuff,
  // Bulgars
  nullifyTerrain, terrainHitBonus,
  // English
  upgradeUnit,
  // Huns
  attilaTbd,
  // Japanese
  dualAttack, samuraiAdjacencyBonus,
  // Mongols
  reducedBaseControl, fullMovementHitBonus, antiBasicDamage,
  // Muscovites
  placeTokens, strelstyDefense, cossackSlow,
  // Ottomans
  siegeMovementBuff, medicHeal, janissaryReload,
  // Romans
  redirectAttack, formationBonus, commandAttack,
  // Vandals
  loneWolfLeader, loneWolfUnit,
  // Vikings
  doubleAttack,
];

/** Register all built-in abilities. Call once at startup. */
export function registerAllAbilities(): void {
  for (const ability of ALL_ABILITIES) {
    registerAbility(ability);
  }
}
