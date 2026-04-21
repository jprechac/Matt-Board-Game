import type { FactionDefinition } from '../../types.js';

export const JAPANESE: FactionDefinition = {
  id: 'japanese',
  name: 'Japanese',
  leaderTypeId: 'oda_nobunaga',
  specialtyTypeIds: ['samurai'],
  units: [
    {
      typeId: 'oda_nobunaga',
      name: 'Oda Nobunaga',
      category: 'leader',
      hp: 9,
      movement: 4,
      attack: { range: 1, damage: 3, toHit: 3 },
      secondaryAttack: {
        range: 2,
        damage: 1,
        toHit: 6,
        critThreshold: 8,
        noProximityPenalty: true,
      },
      abilityId: 'dual_attack',
    },
    {
      typeId: 'samurai',
      name: 'Samurai',
      category: 'specialty',
      hp: 6,
      movement: 3,
      attack: { range: 1, damage: 3, toHit: 4 },
      secondaryAttack: {
        range: 2,
        damage: 1,
        toHit: 6,
        critThreshold: 8,
        noProximityPenalty: true,
      },
      abilityId: 'samurai_adjacency_bonus',
    },
  ],
};
