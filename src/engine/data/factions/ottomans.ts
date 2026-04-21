import type { FactionDefinition } from '../../types.js';

export const OTTOMANS: FactionDefinition = {
  id: 'ottomans',
  name: 'Ottomans',
  leaderTypeId: 'suleiman',
  specialtyTypeIds: ['medic', 'janissary'],
  units: [
    {
      typeId: 'suleiman',
      name: 'Suleiman the Magnificent',
      category: 'leader',
      hp: 10,
      movement: 4,
      attack: { range: 1, damage: 3, toHit: 3 },
      abilityId: 'siege_movement_buff',
      abilityParams: { buffRange: 3, movementBonus: 1 },
    },
    {
      typeId: 'medic',
      name: 'Medic',
      category: 'specialty',
      hp: 5,
      movement: 3,
      attack: { range: 1, damage: 0, toHit: 4 }, // "attacks" heal allies
      abilityId: 'medic_heal',
      abilityParams: { healAmount: 1, enhancedThreshold: 6, enhancedHealAmount: 2 },
    },
    {
      typeId: 'janissary',
      name: 'Janissary',
      category: 'specialty',
      hp: 6,
      movement: 3,
      attack: {
        range: 4,
        damage: 2,
        toHit: 4,
        critThreshold: 8,
        critDamage: 3,
        noProximityPenalty: true,
      },
      abilityId: 'janissary_reload',
      abilityParams: { reloadMovement: 2 },
    },
  ],
};
