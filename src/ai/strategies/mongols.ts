/**
 * Mongol AI: Rush strategy exploiting 2-turn base capture.
 *
 * Tactics: Aggressively push units toward enemy base for fast win.
 * Kheshig uses full movement before attacking for hit bonus.
 * Pillagers prioritize basic enemy units for bonus damage.
 */
import type { GameState, PlayerId } from '../../engine/types.js';
import { cubeDistance, hexKey } from '../../engine/hex.js';
import { getBaseCells } from '../../engine/board.js';
import { createGenericBot, type ScoreAdjuster } from './generic.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

const mongolAdjuster: ScoreAdjuster = (state, playerId, scored) => {
  const { action } = scored;
  let bonus = 0;

  const enemyId = state.players.find(p => p.id !== playerId)?.id;
  const enemyBaseCells = enemyId ? getBaseCells(state.board, enemyId) : [];
  const baseKeys = new Set(enemyBaseCells.map(c => hexKey(c.coord)));

  if (action.type === 'move') {
    const unit = state.units.find(u => u.id === action.unitId);
    if (unit) {
      // All units: strong incentive to rush enemy base (2-turn win)
      const closestBase = enemyBaseCells.reduce(
        (min, c) => Math.min(min, cubeDistance(action.to, c.coord)),
        Infinity,
      );
      if (closestBase === 0) bonus += 30; // In enemy base!
      else if (closestBase <= 2) bonus += 15; // Near base

      // Kheshig: use full movement for hit bonus
      if (unit.typeId === 'kheshig') {
        bonus += 5; // Prefer moving (to trigger full_movement_hit_bonus)
      }
    }
  }

  if (action.type === 'attack') {
    const attacker = state.units.find(u => u.id === action.unitId);
    const target = state.units.find(u => u.id === action.targetId);
    if (target) {
      // Pillagers: prioritize basic units for +1 damage
      if (attacker?.typeId === 'pillager' && target.category === 'basic') {
        bonus += 15;
      }
      // Bonus for attacking units blocking base entry
      if (baseKeys.has(hexKey(target.position))) {
        bonus += 12;
      }
    }
  }

  // End turn is less desirable — keep pushing
  if (action.type === 'endTurn') {
    bonus -= 5;
  }

  return bonus ? { ...scored, score: scored.score + bonus } : scored;
};

export function createMongolBot(config: BotConfig): Bot {
  return createGenericBot({ ...config, factionId: 'mongols' }, mongolAdjuster);
}
