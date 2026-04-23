/**
 * Bulgar AI: Terrain exploitation + Khan Krum anti-terrain.
 *
 * Tactics: Move cavalry near natural terrain for hit bonus.
 * Khan Krum nullifies enemy terrain advantages.
 */
import type { GameState, PlayerId } from '../../engine/types.js';
import { createGenericBot, type ScoreAdjuster } from './generic.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

const bulgarAdjuster: ScoreAdjuster = (state, playerId, scored) => {
  const { action } = scored;
  let bonus = 0;

  if (action.type === 'move') {
    const unit = state.units.find(u => u.id === action.unitId);
    // Cavalry units benefit from terrain adjacency — bonus already handled by ability
    // AI should prefer positions near natural terrain features
    if (unit && (unit.typeId === 'light_cavalry' || unit.typeId === 'heavy_cavalry')) {
      // Prefer advancing aggressively — cavalry are mobile strikers
      bonus += 3;
    }
  }

  if (action.type === 'attack') {
    const attacker = state.units.find(u => u.id === action.unitId);
    // Light cavalry: fast flanker, prioritize isolated targets
    if (attacker?.typeId === 'light_cavalry') {
      bonus += 5;
    }
    // Heavy cavalry: durable tank, prioritize high-value targets
    if (attacker?.typeId === 'heavy_cavalry') {
      const target = state.units.find(u => u.id === action.targetId);
      if (target?.category === 'leader') bonus += 10;
    }
  }

  return bonus ? { ...scored, score: scored.score + bonus } : scored;
};

export function createBulgarBot(config: BotConfig): Bot {
  return createGenericBot({ ...config, factionId: 'bulgars' }, bulgarAdjuster);
}
