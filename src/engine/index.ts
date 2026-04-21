// Engine public API — re-exports for convenience

export * from './types.js';
export * from './hex.js';
export { SeededRNG } from './rng.js';
export { BASIC_MELEE, BASIC_RANGED, BASIC_UNITS } from './data/basic-units.js';
export { FACTIONS, getFaction, getUnitDef } from './data/factions/index.js';
export * from './board.js';
export * from './movement.js';
export * from './combat.js';
export { registerAllAbilities, getAbility, getAttackModifiers, getDefenseModifiers, getMovementModifiers } from './abilities/index.js';
export { createGame, applyAction } from './game.js';
export type { GameConfig } from './game.js';
export { validateAction } from './validation.js';
export type { ValidationResult } from './validation.js';
