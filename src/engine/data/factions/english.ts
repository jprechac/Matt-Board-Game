import type { FactionDefinition } from '../../types.js';

export const ENGLISH: FactionDefinition = {
  id: 'english',
  name: 'English',
  leaderTypeId: 'king_arthur',
  specialtyTypeIds: ['longbowman', 'knight'],
  units: [
    {
      typeId: 'king_arthur',
      name: 'King Arthur',
      category: 'leader',
      hp: 9,
      movement: 4,
      attack: { range: 1, damage: 4, toHit: 3 },
      abilityId: 'upgrade_unit',
    },
    {
      typeId: 'longbowman',
      name: 'Longbowman',
      category: 'specialty',
      hp: 4,
      movement: 2,
      attack: { range: 5, damage: 1, toHit: 3, critThreshold: 6 },
    },
    {
      typeId: 'knight',
      name: 'Knight',
      category: 'specialty',
      hp: 7,
      movement: 3,
      attack: { range: 1, damage: 3, toHit: 4 },
    },
  ],
};
