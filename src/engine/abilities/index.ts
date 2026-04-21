export type {
  AbilityHandler,
  AbilityContext,
  CombatModifiers,
  MovementModifiers,
} from './types.js';

export {
  registerAbility,
  getAbility,
  getAllAbilityIds,
  getAttackModifiers,
  getDefenseModifiers,
  getMovementModifiers,
} from './types.js';

export { registerAllAbilities } from './handlers.js';
