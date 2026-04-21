import type { UnitDefinition } from '../types.js';

export const BASIC_MELEE: UnitDefinition = {
  typeId: 'basic_melee',
  name: 'Melee',
  category: 'basic',
  hp: 5,
  movement: 2,
  attack: { range: 1, damage: 2, toHit: 4 },
};

export const BASIC_RANGED: UnitDefinition = {
  typeId: 'basic_ranged',
  name: 'Ranged',
  category: 'basic',
  hp: 4,
  movement: 2,
  attack: { range: 4, damage: 1, toHit: 5, critThreshold: 7 },
  abilityId: 'basic_ranged_restricted_movement',
};

export const BASIC_UNITS: readonly UnitDefinition[] = [BASIC_MELEE, BASIC_RANGED];
