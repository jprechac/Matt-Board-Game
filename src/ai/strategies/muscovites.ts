/**
 * Muscovite AI: Token placement zone control + Streltsy defensive anchor.
 *
 * Tactics: Ivan places tokens to buff allies within 2 hexes.
 * Streltsy hold ground (can't move + attack). Cossacks hit-and-run.
 */
import type { GameState, PlayerId } from '../../engine/types.js';
import { cubeDistance } from '../../engine/hex.js';
import { createGenericBot, countAdjacentEnemies, isWithinRange, type ScoreAdjuster } from './generic.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

const muscoviteAdjuster: ScoreAdjuster = (state, playerId, scored) => {
  const { action } = scored;
  let bonus = 0;

  const leader = state.units.find(u => u.playerId === playerId && u.category === 'leader' && u.currentHp > 0);

  if (action.type === 'move') {
    const unit = state.units.find(u => u.id === action.unitId);
    if (unit) {
      // Streltsy: prefer NOT moving (they can't move + attack)
      if (unit.typeId === 'streltsy') {
        bonus -= 10; // Discourage movement — hold position and attack
      }
      // Cossack Cavalry: hit-and-run, stay mobile, avoid staying adjacent to enemies
      if (unit.typeId === 'cossack_cavalry') {
        const adjEnemies = countAdjacentEnemies(state, playerId, action.to);
        if (adjEnemies === 0 && unit.hasAttackedThisTurn) {
          bonus += 12; // Retreat after attacking
        }
      }
      // Stay near Ivan for token buff range
      if (leader && unit.id !== leader.id && isWithinRange(action.to, leader.position, 2)) {
        bonus += 6;
      }
    }
  }

  if (action.type === 'attack') {
    const attacker = state.units.find(u => u.id === action.unitId);
    // Streltsy: stationary attacks are their strength
    if (attacker?.typeId === 'streltsy' && !attacker.hasMovedThisTurn) {
      bonus += 10;
    }
    // Cossack: ranged harassment
    if (attacker?.typeId === 'cossack_cavalry') {
      bonus += 5;
    }
  }

  return bonus ? { ...scored, score: scored.score + bonus } : scored;
};

export function createMuscoviteBot(config: BotConfig): Bot {
  return createGenericBot({ ...config, factionId: 'muscovites' }, muscoviteAdjuster);
}
