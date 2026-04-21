import type { FactionDefinition } from '../../types.js';

export const VANDALS: FactionDefinition = {
  id: 'vandals',
  name: 'Vandals',
  leaderTypeId: 'genseric',
  specialtyTypeIds: ['vandal_heavy_cavalry', 'raider'],
  units: [
    {
      typeId: 'genseric',
      name: 'Genseric',
      category: 'leader',
      hp: 9,
      movement: 4,
      attack: { range: 1, damage: 3, toHit: 3 },
      abilityId: 'lone_wolf_leader',
    },
    {
      typeId: 'vandal_heavy_cavalry',
      name: 'Heavy Cavalry',
      category: 'specialty',
      hp: 7,
      movement: 4,
      attack: { range: 2, damage: 2, toHit: 4 },
      // Standard ranged proximity penalty applies at melee range
    },
    {
      typeId: 'raider',
      name: 'Raider',
      category: 'specialty',
      hp: 6,
      movement: 3,
      attack: { range: 1, damage: 3, toHit: 4 },
      abilityId: 'lone_wolf_unit',
    },
  ],
};
