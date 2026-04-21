import type { FactionDefinition } from '../../types.js';

export const BULGARS: FactionDefinition = {
  id: 'bulgars',
  name: 'Bulgars',
  leaderTypeId: 'khan_krum',
  specialtyTypeIds: ['light_cavalry', 'heavy_cavalry'],
  units: [
    {
      typeId: 'khan_krum',
      name: 'Khan Krum',
      category: 'leader',
      hp: 10,
      movement: 4,
      attack: { range: 1, damage: 3, toHit: 3 },
      abilityId: 'nullify_terrain',
    },
    {
      typeId: 'light_cavalry',
      name: 'Light Cavalry',
      category: 'specialty',
      hp: 6,
      movement: 5,
      attack: { range: 1, damage: 2, toHit: 4 },
      abilityId: 'terrain_hit_bonus',
    },
    {
      typeId: 'heavy_cavalry',
      name: 'Heavy Cavalry',
      category: 'specialty',
      hp: 8,
      movement: 4,
      attack: { range: 1, damage: 2, toHit: 4 },
      abilityId: 'terrain_hit_bonus',
    },
  ],
};
