import type { FactionDefinition } from '../../types.js';

export const AZTECS: FactionDefinition = {
  id: 'aztecs',
  name: 'Aztecs',
  leaderTypeId: 'itzcoatl',
  specialtyTypeIds: ['jaguar_warrior', 'priest'],
  units: [
    {
      typeId: 'itzcoatl',
      name: 'Itzcoatl',
      category: 'leader',
      hp: 9,
      movement: 4,
      attack: { range: 1, damage: 3, toHit: 3 },
      abilityId: 'itzcoatl_aura',
    },
    {
      typeId: 'jaguar_warrior',
      name: 'Jaguar Warrior',
      category: 'specialty',
      hp: 6,
      movement: 3,
      attack: { range: 1, damage: 2, toHit: 4 },
      abilityId: 'jaguar_sacrifice',
    },
    {
      typeId: 'priest',
      name: 'Priest',
      category: 'specialty',
      hp: 4,
      movement: 3,
      attack: { range: 3, damage: 0, toHit: 9 }, // cannot attack; range used by ability
      abilityId: 'priest_buff',
    },
  ],
};
