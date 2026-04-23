/**
 * Viking AI: Eric double-attack aggression + Berserker high damage.
 *
 * Tactics: Eric the Red uses double attack for burst damage — prioritize
 * leader attacks. Berserkers push forward aggressively. Axe Throwers
 * harass from range 3 with no proximity penalty.
 */
import type { GameState, PlayerId } from '../../engine/types.js';
import { cubeDistance } from '../../engine/hex.js';
import { createGenericBot, type ScoreAdjuster } from './generic.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

const vikingAdjuster: ScoreAdjuster = (state, playerId, scored) => {
  const { action } = scored;
  let bonus = 0;

  if (action.type === 'attack') {
    const attacker = state.units.find(u => u.id === action.unitId);
    const target = state.units.find(u => u.id === action.targetId);

    // Eric: double attack makes every attack twice as valuable
    if (attacker?.category === 'leader') {
      bonus += 15; // Strong attack priority for leader
      if (target && target.currentHp <= 3) {
        bonus += 10; // Potential double-tap kill
      }
    }
    // Berserker: high damage (3) — prioritize finishing targets
    if (attacker?.typeId === 'berserker') {
      bonus += 8;
      if (target && target.currentHp <= 3) bonus += 12;
    }
    // Axe Thrower: no proximity penalty, always effective
    if (attacker?.typeId === 'axe_thrower') {
      bonus += 5;
    }
  }

  if (action.type === 'move') {
    const unit = state.units.find(u => u.id === action.unitId);
    // Berserker: aggressive advance
    if (unit?.typeId === 'berserker') {
      const enemies = state.units.filter(u => u.playerId !== playerId && u.currentHp > 0);
      const closestEnemy = enemies.reduce(
        (min, e) => Math.min(min, cubeDistance(action.to, e.position)),
        Infinity,
      );
      if (closestEnemy <= 1) bonus += 10; // Get into melee range
    }
    // Axe Thrower: maintain range 2-3
    if (unit?.typeId === 'axe_thrower') {
      const enemies = state.units.filter(u => u.playerId !== playerId && u.currentHp > 0);
      const minDist = enemies.reduce(
        (min, e) => Math.min(min, cubeDistance(action.to, e.position)),
        Infinity,
      );
      if (minDist >= 2 && minDist <= 3) bonus += 8;
      if (minDist <= 1) bonus -= 10; // Avoid melee
    }
  }

  return bonus ? { ...scored, score: scored.score + bonus } : scored;
};

export function createVikingBot(config: BotConfig): Bot {
  return createGenericBot({ ...config, factionId: 'vikings' }, vikingAdjuster);
}
