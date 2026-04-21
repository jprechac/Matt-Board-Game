import type { FactionDefinition } from '../../types.js';

export const MONGOLS: FactionDefinition = {
  id: 'mongols',
  name: 'Mongols',
  leaderTypeId: 'genghis_khan',
  specialtyTypeIds: ['kheshig', 'pillager'],
  units: [
    {
      typeId: 'genghis_khan',
      name: 'Genghis Khan',
      category: 'leader',
      hp: 8,
      movement: 4,
      attack: { range: 1, damage: 3, toHit: 3 },
      abilityId: 'reduced_base_control',
    },
    {
      typeId: 'kheshig',
      name: 'Kheshig',
      category: 'specialty',
      hp: 6,
      movement: 3,
      attack: { range: 1, damage: 2, toHit: 4 },
      abilityId: 'full_movement_hit_bonus',
    },
    {
      typeId: 'pillager',
      name: 'Pillager',
      category: 'specialty',
      hp: 7,
      movement: 3,
      attack: { range: 1, damage: 2, toHit: 4 },
      abilityId: 'anti_basic_damage',
    },
  ],
};
