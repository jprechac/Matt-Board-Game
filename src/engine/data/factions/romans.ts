import type { FactionDefinition } from '../../types.js';

export const ROMANS: FactionDefinition = {
  id: 'romans',
  name: 'Romans',
  leaderTypeId: 'julius_caesar',
  specialtyTypeIds: ['legionnaire', 'centurion'],
  units: [
    {
      typeId: 'julius_caesar',
      name: 'Julius Caesar',
      category: 'leader',
      hp: 9,
      movement: 4,
      attack: { range: 1, damage: 3, toHit: 3 },
      abilityId: 'redirect_attack',
    },
    {
      typeId: 'legionnaire',
      name: 'Legionnaire',
      category: 'specialty',
      hp: 7,
      movement: 3,
      attack: { range: 1, damage: 2, toHit: 4 },
      abilityId: 'formation_bonus',
    },
    {
      typeId: 'centurion',
      name: 'Centurion',
      category: 'specialty',
      hp: 6,
      movement: 3,
      attack: { range: 1, damage: 2, toHit: 4 },
      abilityId: 'command_attack',
    },
  ],
};
