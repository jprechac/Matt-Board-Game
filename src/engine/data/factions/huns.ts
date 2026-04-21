import type { FactionDefinition } from '../../types.js';

/**
 * Huns faction — Attila's stats are TBD.
 * Placeholder stats based on typical leader profile.
 */
export const HUNS: FactionDefinition = {
  id: 'huns',
  name: 'Huns',
  leaderTypeId: 'attila',
  specialtyTypeIds: ['mounted_archer', 'mounted_swordsman'],
  units: [
    {
      typeId: 'attila',
      name: 'Attila the Hun',
      category: 'leader',
      hp: 9,      // placeholder
      movement: 4, // placeholder
      attack: { range: 1, damage: 3, toHit: 3 }, // placeholder
      abilityId: 'attila_tbd',
    },
    {
      typeId: 'mounted_archer',
      name: 'Mounted Archer',
      category: 'specialty',
      hp: 5,
      movement: 3,
      attack: { range: 3, damage: 1, toHit: 4, critThreshold: 7 },
    },
    {
      typeId: 'mounted_swordsman',
      name: 'Mounted Swordsman',
      category: 'specialty',
      hp: 6,
      movement: 4,
      attack: { range: 1, damage: 2, toHit: 4 },
    },
  ],
};
