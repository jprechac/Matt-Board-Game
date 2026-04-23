/**
 * English AI: Arthur upgrade timing + Longbowman range exploitation.
 *
 * Tactics: Use King Arthur's upgrade ability on basic units before they
 * take damage. Longbowmen stay at max range (5) for safe harassment.
 * Knights push forward as melee tanks.
 */
import type { GameState, PlayerId } from '../../engine/types.js';
import { cubeDistance } from '../../engine/hex.js';
import { createGenericBot, type ScoreAdjuster } from './generic.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

const englishAdjuster: ScoreAdjuster = (state, playerId, scored) => {
  const { action } = scored;
  let bonus = 0;

  if (action.type === 'attack') {
    const attacker = state.units.find(u => u.id === action.unitId);
    const target = state.units.find(u => u.id === action.targetId);
    // Longbowmen: prefer attacking from max range
    if (attacker?.typeId === 'longbowman' && target) {
      const dist = cubeDistance(attacker.position, target.position);
      if (dist >= 4) bonus += 10; // Safe sniping range
    }
    // Knights: prefer attacking leaders and specialty units
    if (attacker?.typeId === 'knight' && target) {
      if (target.category === 'leader') bonus += 12;
      if (target.category === 'specialty') bonus += 6;
    }
  }

  if (action.type === 'move') {
    const unit = state.units.find(u => u.id === action.unitId);
    if (unit?.typeId === 'longbowman') {
      // Longbowmen: stay back, avoid melee range
      const enemies = state.units.filter(u => u.playerId !== playerId && u.currentHp > 0);
      const minEnemyDist = enemies.reduce(
        (min, e) => Math.min(min, cubeDistance(action.to, e.position)),
        Infinity,
      );
      if (minEnemyDist >= 3) bonus += 8; // Maintain safe distance
      if (minEnemyDist <= 1) bonus -= 15; // Don't walk into melee range
    }
  }

  return bonus ? { ...scored, score: scored.score + bonus } : scored;
};

export function createEnglishBot(config: BotConfig): Bot {
  return createGenericBot({ ...config, factionId: 'english' }, englishAdjuster);
}
