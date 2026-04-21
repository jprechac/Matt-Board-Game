import type { FactionDefinition } from '../../types.js';

export const MUSCOVITES: FactionDefinition = {
  id: 'muscovites',
  name: 'Muscovites',
  leaderTypeId: 'ivan',
  specialtyTypeIds: ['streltsy', 'cossack_cavalry'],
  units: [
    {
      typeId: 'ivan',
      name: 'Ivan the Terrible',
      category: 'leader',
      hp: 9,
      movement: 4,
      attack: { range: 1, damage: 3, toHit: 3 },
      abilityId: 'place_tokens',
      abilityParams: { tokenCount: 2, buffRange: 2, toHitBonus: -1 },
    },
    {
      typeId: 'streltsy',
      name: 'Streltsy',
      category: 'specialty',
      hp: 5,
      movement: 3,
      attack: { range: 2, damage: 3, toHit: 4 },
      abilityId: 'streltsy_defense',
    },
    {
      typeId: 'cossack_cavalry',
      name: 'Cossack Cavalry',
      category: 'specialty',
      hp: 6,
      movement: 5,
      attack: { range: 2, damage: 2, toHit: 4 },
      abilityId: 'cossack_slow',
      abilityParams: { reducedMovement: 3 },
    },
  ],
};
