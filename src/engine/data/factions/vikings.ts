import type { FactionDefinition } from '../../types.js';

export const VIKINGS: FactionDefinition = {
  id: 'vikings',
  name: 'Vikings',
  leaderTypeId: 'eric_the_red',
  specialtyTypeIds: ['axe_thrower', 'berserker'],
  units: [
    {
      typeId: 'eric_the_red',
      name: 'Eric the Red',
      category: 'leader',
      hp: 7,
      movement: 4,
      attack: { range: 1, damage: 3, toHit: 3 },
      abilityId: 'double_attack',
    },
    {
      typeId: 'axe_thrower',
      name: 'Axe Thrower',
      category: 'specialty',
      hp: 6,
      movement: 3,
      attack: { range: 3, damage: 2, toHit: 4, noProximityPenalty: true },
    },
    {
      typeId: 'berserker',
      name: 'Berserker',
      category: 'specialty',
      hp: 6,
      movement: 3,
      attack: { range: 1, damage: 3, toHit: 3 },
    },
  ],
};
