/**
 * Huns AI: Mobile warfare with Mounted Archer/Swordsman.
 *
 * Tactics: All units are fast — use mobility for flanking. Mounted
 * Archers harass from range while Swordsmen close in. Attila ability TBD.
 */
import type { GameState, PlayerId } from '../../engine/types.js';
import { cubeDistance } from '../../engine/hex.js';
import { getBaseCells } from '../../engine/board.js';
import { createGenericBot, type ScoreAdjuster } from './generic.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

const hunAdjuster: ScoreAdjuster = (state, playerId, scored) => {
  const { action } = scored;
  let bonus = 0;

  if (action.type === 'move') {
    const unit = state.units.find(u => u.id === action.unitId);
    if (unit) {
      // Mounted Swordsman: aggressive flanking — reward advancing
      if (unit.typeId === 'mounted_swordsman') {
        const enemyId = state.players.find(p => p.id !== playerId)?.id;
        if (enemyId) {
          const enemyBaseCells = getBaseCells(state.board, enemyId);
          const closestBase = enemyBaseCells.reduce(
            (min, c) => Math.min(min, cubeDistance(action.to, c.coord)),
            Infinity,
          );
          if (closestBase <= 2) bonus += 10; // Rush toward enemy base
        }
      }
      // Mounted Archer: stay at range 2-3, avoid melee
      if (unit.typeId === 'mounted_archer') {
        const enemies = state.units.filter(u => u.playerId !== playerId && u.currentHp > 0);
        const minDist = enemies.reduce(
          (min, e) => Math.min(min, cubeDistance(action.to, e.position)),
          Infinity,
        );
        if (minDist >= 2 && minDist <= 3) bonus += 8;
      }
    }
  }

  if (action.type === 'attack') {
    // Mounted Swordsman: high priority on killing blows
    const attacker = state.units.find(u => u.id === action.unitId);
    if (attacker?.typeId === 'mounted_swordsman') {
      const target = state.units.find(u => u.id === action.targetId);
      if (target && target.currentHp <= 2) bonus += 12;
    }
  }

  return bonus ? { ...scored, score: scored.score + bonus } : scored;
};

export function createHunBot(config: BotConfig): Bot {
  return createGenericBot({ ...config, factionId: 'huns' }, hunAdjuster);
}
