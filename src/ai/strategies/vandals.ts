/**
 * Vandal AI: Lone-wolf isolation tactics.
 *
 * Tactics: Genseric and Raiders fight alone — keep them away from allies
 * to activate lone wolf bonuses. Heavy Cavalry flanks independently.
 */
import type { GameState, PlayerId } from '../../engine/types.js';
import { createGenericBot, countAdjacentAllies, countAdjacentEnemies, type ScoreAdjuster } from './generic.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

const vandalAdjuster: ScoreAdjuster = (state, playerId, scored) => {
  const { action } = scored;
  let bonus = 0;

  if (action.type === 'move') {
    const unit = state.units.find(u => u.id === action.unitId);
    if (unit) {
      const adjAllies = countAdjacentAllies(state, playerId, action.to);
      const adjEnemies = countAdjacentEnemies(state, playerId, action.to);

      // Genseric: needs enemy adjacent but NO allies for full bonus
      if (unit.category === 'leader') {
        if (adjAllies === 0 && adjEnemies >= 1) {
          bonus += 20; // Perfect lone wolf positioning
        } else if (adjAllies === 0) {
          bonus += 8; // Isolated but no enemies yet
        } else {
          bonus -= 5; // Allies nearby = no bonus
        }
      }

      // Raider: no adjacent allies = bonus
      if (unit.typeId === 'raider') {
        if (adjAllies === 0) {
          bonus += 15; // Lone wolf active
        } else {
          bonus -= 8; // Clustered = lost bonus
        }
      }

      // Heavy Cavalry: independent flanker, spread out
      if (unit.typeId === 'heavy_cavalry') {
        if (adjAllies === 0) bonus += 5; // Spread out
      }
    }
  }

  if (action.type === 'attack') {
    const attacker = state.units.find(u => u.id === action.unitId);
    if (attacker) {
      const adjAllies = countAdjacentAllies(state, playerId, attacker.position);
      // Lone wolf units attack better when isolated
      if ((attacker.category === 'leader' || attacker.typeId === 'raider') && adjAllies === 0) {
        bonus += 12;
      }
    }
  }

  return bonus ? { ...scored, score: scored.score + bonus } : scored;
};

export function createVandalBot(config: BotConfig): Bot {
  return createGenericBot({ ...config, factionId: 'vandals' }, vandalAdjuster);
}
