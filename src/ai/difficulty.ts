/**
 * Difficulty-based bot factory.
 *
 * Routes bot creation through difficulty levels:
 * - easy: generic bot (placeholder for Phase 8 weakening)
 * - medium: faction-specific strategy
 * - hard: faction-specific strategy (placeholder for Phase 8 strengthening)
 */
import type { Bot, BotConfig } from './types.js';
import { createBot } from './strategies/index.js';
import { createGenericBot } from './strategies/generic.js';

/**
 * Create a bot at the specified difficulty level.
 * Medium uses faction-specific tactics. Easy/Hard are stubs that
 * currently use generic/faction bots respectively — to be tuned in Phase 8.
 */
export function createBotForDifficulty(config: BotConfig): Bot {
  switch (config.difficulty) {
    case 'easy':
      return createGenericBot(config);
    case 'medium':
      return createBot(config);
    case 'hard':
      return createBot(config);
  }
}
