/**
 * Strategy registry — maps faction IDs to bot factories.
 */
import type { FactionId } from '../../engine/types.js';
import type { Bot, BotConfig } from '../types.js';
import { createGenericBot } from './generic.js';
import { createAztecBot } from './aztecs.js';
import { createBulgarBot } from './bulgars.js';
import { createEnglishBot } from './english.js';
import { createHunBot } from './huns.js';
import { createJapaneseBot } from './japanese.js';
import { createMongolBot } from './mongols.js';
import { createMuscoviteBot } from './muscovites.js';
import { createOttomanBot } from './ottomans.js';
import { createRomanBot } from './romans.js';
import { createVandalBot } from './vandals.js';
import { createVikingBot } from './vikings.js';

type BotFactory = (config: BotConfig) => Bot;

const FACTION_STRATEGIES: Record<FactionId, BotFactory> = {
  aztecs: createAztecBot,
  bulgars: createBulgarBot,
  english: createEnglishBot,
  huns: createHunBot,
  japanese: createJapaneseBot,
  mongols: createMongolBot,
  muscovites: createMuscoviteBot,
  ottomans: createOttomanBot,
  romans: createRomanBot,
  vandals: createVandalBot,
  vikings: createVikingBot,
};

/** Create a bot for a specific faction, or generic if no faction specified. */
export function createBot(config: BotConfig): Bot {
  const factory = config.factionId
    ? FACTION_STRATEGIES[config.factionId]
    : undefined;
  return factory ? factory(config) : createGenericBot(config);
}

/** Get all available faction strategy IDs. */
export function getAvailableStrategies(): FactionId[] {
  return Object.keys(FACTION_STRATEGIES) as FactionId[];
}
