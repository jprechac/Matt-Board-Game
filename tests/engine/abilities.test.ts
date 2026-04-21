import { describe, it, expect } from 'vitest';
import type { Unit, CubeCoord, GameState } from '../../src/engine/types.js';
import { offsetToCube, hexKey, cubeNeighbors } from '../../src/engine/hex.js';
import { createBoard } from '../../src/engine/board.js';
import {
  registerAllAbilities,
} from '../../src/engine/abilities/handlers.js';
import {
  getAbility,
  getAllAbilityIds,
} from '../../src/engine/abilities/types.js';

// Register abilities at module load time so they're available in describe blocks
registerAllAbilities();

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

const board = createBoard('2p');

function makeCtx(unit: Unit, allUnits: readonly Unit[]) {
  return {
    unit,
    state: {} as GameState,
    allUnits,
  };
}

describe('ability registration', () => {
  it('registers all expected abilities', () => {
    const ids = getAllAbilityIds();
    expect(ids.length).toBeGreaterThanOrEqual(20);

    const expectedIds = [
      'basic_ranged_restricted_movement',
      'itzcoatl_aura', 'jaguar_sacrifice', 'priest_buff',
      'nullify_terrain', 'terrain_hit_bonus',
      'upgrade_unit',
      'attila_tbd',
      'dual_attack', 'samurai_adjacency_bonus',
      'reduced_base_control', 'full_movement_hit_bonus', 'anti_basic_damage',
      'place_tokens', 'streltsy_defense', 'cossack_slow',
      'siege_movement_buff', 'medic_heal', 'janissary_reload',
      'redirect_attack', 'formation_bonus', 'command_attack',
      'lone_wolf_leader', 'lone_wolf_unit',
      'double_attack',
    ];

    for (const id of expectedIds) {
      expect(getAbility(id)).toBeDefined();
    }
  });
});

describe('samurai_adjacency_bonus', () => {
  const ability = getAbility('samurai_adjacency_bonus')!;

  it('gives -1 toHit when adjacent to 2+ enemies', () => {
    const pos = offsetToCube(5, 5);
    const neighbors = cubeNeighbors(pos);
    const samurai = makeUnit({
      id: 'sam',
      position: pos,
      abilityState: { abilityId: 'samurai_adjacency_bonus' },
    });
    const enemy1 = makeUnit({ id: 'e1', position: neighbors[0], playerId: 'player2' });
    const enemy2 = makeUnit({ id: 'e2', position: neighbors[1], playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(samurai, [samurai, enemy1, enemy2]), enemy1);
    expect(mods.toHitModifier).toBe(-1);
  });

  it('gives no bonus with only 1 adjacent enemy', () => {
    const pos = offsetToCube(5, 5);
    const neighbors = cubeNeighbors(pos);
    const samurai = makeUnit({ id: 'sam', position: pos });
    const enemy1 = makeUnit({ id: 'e1', position: neighbors[0], playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(samurai, [samurai, enemy1]), enemy1);
    expect(mods.toHitModifier).toBeUndefined();
  });
});

describe('formation_bonus (Legionnaire)', () => {
  const ability = getAbility('formation_bonus')!;

  it('gives -1 toHit when adjacent to an ally', () => {
    const pos = offsetToCube(5, 5);
    const neighbors = cubeNeighbors(pos);
    const legionnaire = makeUnit({ id: 'leg', position: pos });
    const ally = makeUnit({ id: 'ally', position: neighbors[0] });
    const enemy = makeUnit({ id: 'e', position: neighbors[1], playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(legionnaire, [legionnaire, ally, enemy]), enemy);
    expect(mods.toHitModifier).toBe(-1);
  });

  it('no bonus when alone', () => {
    const pos = offsetToCube(5, 5);
    const neighbors = cubeNeighbors(pos);
    const legionnaire = makeUnit({ id: 'leg', position: pos });
    const enemy = makeUnit({ id: 'e', position: neighbors[0], playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(legionnaire, [legionnaire, enemy]), enemy);
    expect(mods.toHitModifier).toBeUndefined();
  });
});

describe('lone_wolf_leader (Genseric)', () => {
  const ability = getAbility('lone_wolf_leader')!;

  it('gives -1 toHit and +1 damage when adjacent to enemy and no allies', () => {
    const pos = offsetToCube(5, 5);
    const neighbors = cubeNeighbors(pos);
    const leader = makeUnit({ id: 'gen', position: pos });
    const enemy = makeUnit({ id: 'e', position: neighbors[0], playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(leader, [leader, enemy]), enemy);
    expect(mods.toHitModifier).toBe(-1);
    expect(mods.damageModifier).toBe(1);
  });

  it('no bonus when ally is adjacent', () => {
    const pos = offsetToCube(5, 5);
    const neighbors = cubeNeighbors(pos);
    const leader = makeUnit({ id: 'gen', position: pos });
    const ally = makeUnit({ id: 'ally', position: neighbors[1] });
    const enemy = makeUnit({ id: 'e', position: neighbors[0], playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(leader, [leader, ally, enemy]), enemy);
    expect(mods.toHitModifier).toBeUndefined();
  });
});

describe('lone_wolf_unit (Raider)', () => {
  const ability = getAbility('lone_wolf_unit')!;

  it('gives -1 toHit when no adjacent allies', () => {
    const pos = offsetToCube(5, 5);
    const neighbors = cubeNeighbors(pos);
    const raider = makeUnit({ id: 'raid', position: pos });
    const enemy = makeUnit({ id: 'e', position: neighbors[0], playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(raider, [raider, enemy]), enemy);
    expect(mods.toHitModifier).toBe(-1);
  });

  it('no bonus when ally is adjacent', () => {
    const pos = offsetToCube(5, 5);
    const neighbors = cubeNeighbors(pos);
    const raider = makeUnit({ id: 'raid', position: pos });
    const ally = makeUnit({ id: 'ally', position: neighbors[1] });

    const mods = ability.onAttack!(makeCtx(raider, [raider, ally]), ally);
    expect(mods.toHitModifier).toBeUndefined();
  });
});

describe('anti_basic_damage (Pillager)', () => {
  const ability = getAbility('anti_basic_damage')!;

  it('gives +1 damage vs basic units', () => {
    const pos = offsetToCube(5, 5);
    const neighbors = cubeNeighbors(pos);
    const pillager = makeUnit({ id: 'pill', position: pos });
    const basicMelee = makeUnit({
      id: 'bm', position: neighbors[0], playerId: 'player2', category: 'basic',
    });

    const mods = ability.onAttack!(makeCtx(pillager, [pillager, basicMelee]), basicMelee);
    expect(mods.damageModifier).toBe(1);
  });

  it('no bonus vs specialty units', () => {
    const pos = offsetToCube(5, 5);
    const neighbors = cubeNeighbors(pos);
    const pillager = makeUnit({ id: 'pill', position: pos });
    const specialty = makeUnit({
      id: 'sp', position: neighbors[0], playerId: 'player2', category: 'specialty',
    });

    const mods = ability.onAttack!(makeCtx(pillager, [pillager, specialty]), specialty);
    expect(mods.damageModifier).toBeUndefined();
  });
});

describe('double_attack (Eric the Red)', () => {
  const ability = getAbility('double_attack')!;

  it('grants 1 extra attack', () => {
    const pos = offsetToCube(5, 5);
    const eric = makeUnit({ id: 'eric', position: pos });
    const enemy = makeUnit({ id: 'e', position: offsetToCube(6, 5), playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(eric, [eric, enemy]), enemy);
    expect(mods.extraAttacks).toBe(1);
  });
});

describe('jaguar_sacrifice', () => {
  const ability = getAbility('jaguar_sacrifice')!;

  it('gives +1 damage after 2 sacrifices', () => {
    const pos = offsetToCube(5, 5);
    const jag = makeUnit({
      id: 'jag', position: pos,
      abilityState: { sacrificeCount: 2 },
    });
    const enemy = makeUnit({ id: 'e', position: offsetToCube(6, 5), playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(jag, [jag, enemy]), enemy);
    expect(mods.damageModifier).toBe(1);
  });

  it('no bonus before 2 sacrifices', () => {
    const pos = offsetToCube(5, 5);
    const jag = makeUnit({
      id: 'jag', position: pos,
      abilityState: { sacrificeCount: 1 },
    });
    const enemy = makeUnit({ id: 'e', position: offsetToCube(6, 5), playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(jag, [jag, enemy]), enemy);
    expect(mods.damageModifier).toBeUndefined();
  });
});

describe('full_movement_hit_bonus (Kheshig)', () => {
  const ability = getAbility('full_movement_hit_bonus')!;

  it('gives -1 toHit when full movement used', () => {
    const pos = offsetToCube(5, 5);
    const kheshig = makeUnit({
      id: 'kh', position: pos,
      movementUsedThisTurn: 3,
      abilityState: { baseMovement: 3 },
    });
    const enemy = makeUnit({ id: 'e', position: offsetToCube(6, 5), playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(kheshig, [kheshig, enemy]), enemy);
    expect(mods.toHitModifier).toBe(-1);
  });

  it('no bonus when partial movement used', () => {
    const pos = offsetToCube(5, 5);
    const kheshig = makeUnit({
      id: 'kh', position: pos,
      movementUsedThisTurn: 1,
      abilityState: { baseMovement: 3 },
    });
    const enemy = makeUnit({ id: 'e', position: offsetToCube(6, 5), playerId: 'player2' });

    const mods = ability.onAttack!(makeCtx(kheshig, [kheshig, enemy]), enemy);
    expect(mods.toHitModifier).toBeUndefined();
  });
});

describe('cossack_slow', () => {
  const ability = getAbility('cossack_slow')!;

  it('reduces movement when adjacent to enemy', () => {
    const pos = offsetToCube(5, 5);
    const neighbors = cubeNeighbors(pos);
    const cossack = makeUnit({
      id: 'cos', position: pos,
      abilityState: { reducedMovement: 3 },
    });
    const enemy = makeUnit({ id: 'e', position: neighbors[0], playerId: 'player2' });

    const mods = ability.onMove!(makeCtx(cossack, [cossack, enemy]));
    expect(mods.movementOverride).toBe(3);
  });

  it('no reduction when no adjacent enemies', () => {
    const pos = offsetToCube(5, 5);
    const cossack = makeUnit({
      id: 'cos', position: pos,
      abilityState: { reducedMovement: 3 },
    });

    const mods = ability.onMove!(makeCtx(cossack, [cossack]));
    expect(mods.movementOverride).toBeUndefined();
  });
});

describe('janissary_reload', () => {
  const ability = getAbility('janissary_reload')!;

  it('blocks attack and reduces movement when reloading', () => {
    const pos = offsetToCube(5, 5);
    const jan = makeUnit({
      id: 'jan', position: pos,
      abilityState: { needsReload: true, reloadMovement: 2 },
    });
    const enemy = makeUnit({ id: 'e', position: offsetToCube(6, 5), playerId: 'player2' });

    const attackMods = ability.onAttack!(makeCtx(jan, [jan, enemy]), enemy);
    expect(attackMods.blockAttack).toBe(true);

    const moveMods = ability.onMove!(makeCtx(jan, [jan]));
    expect(moveMods.movementOverride).toBe(2);
  });

  it('no restrictions when not reloading', () => {
    const pos = offsetToCube(5, 5);
    const jan = makeUnit({
      id: 'jan', position: pos,
      abilityState: { needsReload: false },
    });
    const enemy = makeUnit({ id: 'e', position: offsetToCube(6, 5), playerId: 'player2' });

    const attackMods = ability.onAttack!(makeCtx(jan, [jan, enemy]), enemy);
    expect(attackMods.blockAttack).toBeUndefined();

    const moveMods = ability.onMove!(makeCtx(jan, [jan]));
    expect(moveMods.movementOverride).toBeUndefined();
  });
});
