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
export { createGame, applyAction, applyActionDetailed } from './game.js';
export type { GameConfig } from './game.js';
export { validateAction } from './validation.js';
export type { ValidationResult } from './validation.js';
export * from './events.js';
export { createRecordedGame, applyRecordedAction, getEventsByType } from './recorder.js';
export type { GameRecording, RecordedGame } from './recorder.js';
export {
  createReplay, stepForward, stepBackward, goToAction, goToTurn, goToEvent,
  getCurrentState, getEventsUpTo, getActionCount, getEventCount, isAtEnd, isAtStart,
} from './replay.js';
export type { ReplayState } from './replay.js';
export { serializeRecording, deserializeRecording, SCHEMA_VERSION } from './serialization.js';
