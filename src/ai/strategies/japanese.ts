/**
 * Japanese AI: Samurai adjacency engagement + Nobunaga dual-attack.
 *
 * Tactics: Move samurai to be adjacent to 2+ enemies for hit bonus.
 * Nobunaga uses dual attack (melee + ranged) for burst damage.
 */
import type { GameState, PlayerId } from '../../engine/types.js';
import { createGenericBot, countAdjacentEnemies, type ScoreAdjuster } from './generic.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

const japaneseAdjuster: ScoreAdjuster = (state, playerId, scored) => {
  const { action } = scored;
  let bonus = 0;

  if (action.type === 'move') {
    const unit = state.units.find(u => u.id === action.unitId);
    if (unit?.typeId === 'samurai') {
      // Samurai want to be adjacent to 2+ enemies for adjacency bonus
      const adjEnemies = countAdjacentEnemies(state, playerId, action.to);
      if (adjEnemies >= 2) {
        bonus += 20; // Strong bonus for adjacency ability activation
      } else if (adjEnemies === 1) {
        bonus += 5; // Partial engagement
      }
    }
  }

  if (action.type === 'attack') {
    const attacker = state.units.find(u => u.id === action.unitId);
    // Nobunaga: dual attacks make every attack more valuable
    if (attacker?.category === 'leader') {
      bonus += 8; // Leader attacks worth more due to extra attack ability
    }
    // Samurai near multiple enemies: boost attack priority
    if (attacker?.typeId === 'samurai') {
      const adjEnemies = countAdjacentEnemies(state, playerId, attacker.position);
      if (adjEnemies >= 2) bonus += 10;
    }
  }

  return bonus ? { ...scored, score: scored.score + bonus } : scored;
};

export function createJapaneseBot(config: BotConfig): Bot {
  return createGenericBot({ ...config, factionId: 'japanese' }, japaneseAdjuster);
}
