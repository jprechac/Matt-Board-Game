import { describe, it, expect } from 'vitest';
import { ALL_FACTION_IDS } from '../../../src/engine/types.js';
import { FACTIONS, getFaction, getUnitDef } from '../../../src/engine/data/factions/index.js';
import { BASIC_UNITS, BASIC_MELEE, BASIC_RANGED } from '../../../src/engine/data/basic-units.js';

describe('faction data completeness', () => {
  it('defines all 11 factions', () => {
    expect(Object.keys(FACTIONS)).toHaveLength(11);
    for (const id of ALL_FACTION_IDS) {
      expect(FACTIONS[id]).toBeDefined();
    }
  });

  it('each faction has matching id and name', () => {
    for (const id of ALL_FACTION_IDS) {
      const faction = getFaction(id);
      expect(faction.id).toBe(id);
      expect(faction.name.length).toBeGreaterThan(0);
    }
  });

  it('each faction has exactly 1 leader', () => {
    for (const id of ALL_FACTION_IDS) {
      const leaders = getFaction(id).units.filter(u => u.category === 'leader');
      expect(leaders).toHaveLength(1);
    }
  });

  it('each faction leader typeId matches leaderTypeId', () => {
    for (const id of ALL_FACTION_IDS) {
      const faction = getFaction(id);
      const leader = faction.units.find(u => u.category === 'leader');
      expect(leader).toBeDefined();
      expect(leader!.typeId).toBe(faction.leaderTypeId);
    }
  });

  it('each faction has at least 1 specialty unit type', () => {
    for (const id of ALL_FACTION_IDS) {
      const faction = getFaction(id);
      expect(faction.specialtyTypeIds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all specialtyTypeIds reference defined units', () => {
    for (const id of ALL_FACTION_IDS) {
      const faction = getFaction(id);
      for (const typeId of faction.specialtyTypeIds) {
        const unit = faction.units.find(u => u.typeId === typeId);
        expect(unit).toBeDefined();
        expect(unit!.category).toBe('specialty');
      }
    }
  });

  it('getUnitDef finds units correctly', () => {
    expect(getUnitDef('vikings', 'eric_the_red')).toBeDefined();
    expect(getUnitDef('vikings', 'nonexistent')).toBeUndefined();
  });
});

describe('unit stat validity', () => {
  const allUnits = ALL_FACTION_IDS.flatMap(id => {
    const faction = getFaction(id);
    return faction.units.map(u => ({ factionId: id, unit: u }));
  });

  it('all units have positive HP', () => {
    for (const { unit } of allUnits) {
      // Huns' Attila has placeholder stats — still should be > 0
      expect(unit.hp).toBeGreaterThan(0);
    }
  });

  it('all units have non-negative movement', () => {
    for (const { unit } of allUnits) {
      expect(unit.movement).toBeGreaterThanOrEqual(0);
    }
  });

  it('all units have valid attack range (>= 1)', () => {
    for (const { unit } of allUnits) {
      expect(unit.attack.range).toBeGreaterThanOrEqual(1);
    }
  });

  it('all units have non-negative damage', () => {
    for (const { unit } of allUnits) {
      expect(unit.attack.damage).toBeGreaterThanOrEqual(0);
    }
  });

  it('toHit is between 1 and 9', () => {
    for (const { unit } of allUnits) {
      expect(unit.attack.toHit).toBeGreaterThanOrEqual(1);
      expect(unit.attack.toHit).toBeLessThanOrEqual(9);
    }
  });

  it('critThreshold (if set) is >= toHit', () => {
    for (const { unit } of allUnits) {
      if (unit.attack.critThreshold !== undefined) {
        expect(unit.attack.critThreshold).toBeGreaterThanOrEqual(unit.attack.toHit);
      }
    }
  });

  it('leaders have toHit 3 and movement 4', () => {
    for (const { unit } of allUnits) {
      if (unit.category === 'leader') {
        expect(unit.attack.toHit).toBe(3);
        expect(unit.movement).toBe(4);
      }
    }
  });
});

describe('basic units', () => {
  it('defines melee and ranged', () => {
    expect(BASIC_UNITS).toHaveLength(2);
    expect(BASIC_MELEE.typeId).toBe('basic_melee');
    expect(BASIC_RANGED.typeId).toBe('basic_ranged');
  });

  it('both are category basic', () => {
    expect(BASIC_MELEE.category).toBe('basic');
    expect(BASIC_RANGED.category).toBe('basic');
  });

  it('melee has correct stats', () => {
    expect(BASIC_MELEE.hp).toBe(5);
    expect(BASIC_MELEE.movement).toBe(2);
    expect(BASIC_MELEE.attack.range).toBe(1);
    expect(BASIC_MELEE.attack.damage).toBe(2);
    expect(BASIC_MELEE.attack.toHit).toBe(4);
  });

  it('ranged has correct stats', () => {
    expect(BASIC_RANGED.hp).toBe(4);
    expect(BASIC_RANGED.movement).toBe(2);
    expect(BASIC_RANGED.attack.range).toBe(4);
    expect(BASIC_RANGED.attack.damage).toBe(1);
    expect(BASIC_RANGED.attack.toHit).toBe(5);
    expect(BASIC_RANGED.attack.critThreshold).toBe(7);
  });

  it('ranged has movement restriction ability', () => {
    expect(BASIC_RANGED.abilityId).toBe('basic_ranged_restricted_movement');
  });
});
