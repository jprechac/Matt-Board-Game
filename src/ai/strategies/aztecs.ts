/**
 * Aztec AI: Itzcoatl aura clustering + Jaguar sacrifice tracking.
 *
 * Tactics: Keep allies within 2 hexes of Itzcoatl for aura buff.
 * Jaguar Warriors prioritize finishing wounded targets to build sacrifices.
 */
import type { GameState, PlayerId } from '../../engine/types.js';
import { createGenericBot, countAdjacentAllies, isWithinRange, type ScoreAdjuster } from './generic.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

const aztecAdjuster: ScoreAdjuster = (state, playerId, scored) => {
  const { action } = scored;
  let bonus = 0;

  const leader = state.units.find(u => u.playerId === playerId && u.category === 'leader' && u.currentHp > 0);

  if (action.type === 'move') {
    const unit = state.units.find(u => u.id === action.unitId);
    if (unit && leader && unit.id !== leader.id) {
      // Bonus for staying within Itzcoatl's 2-hex aura range
      if (isWithinRange(action.to, leader.position, 2)) {
        bonus += 12;
      }
    }
  }

  if (action.type === 'attack') {
    const attacker = state.units.find(u => u.id === action.unitId);
    const target = state.units.find(u => u.id === action.targetId);
    if (attacker?.typeId === 'jaguar_warrior' && target) {
      // Jaguars want kills to build sacrifice count
      if (target.currentHp <= 2) {
        bonus += 15;
      }
      // Extra bonus for attacking when near Itzcoatl aura
      if (leader && isWithinRange(attacker.position, leader.position, 2)) {
        bonus += 8;
      }
    }
  }

  return bonus ? { ...scored, score: scored.score + bonus } : scored;
};

export function createAztecBot(config: BotConfig): Bot {
  return createGenericBot({ ...config, factionId: 'aztecs' }, aztecAdjuster);
}
