/**
 * Roman AI: Formation maintenance + Caesar redirect protection.
 *
 * Tactics: Keep Legionnaires adjacent for -1 ToHit formation bonus.
 * Caesar stays behind front line to redirect attacks. Centurion commands basics.
 */
import type { GameState, PlayerId } from '../../engine/types.js';
import { createGenericBot, countAdjacentAllies, type ScoreAdjuster } from './generic.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

const romanAdjuster: ScoreAdjuster = (state, playerId, scored) => {
  const { action } = scored;
  let bonus = 0;

  if (action.type === 'move') {
    const unit = state.units.find(u => u.id === action.unitId);
    if (unit) {
      // Legionnaires: move to maintain adjacency with allies (formation bonus)
      if (unit.typeId === 'legionnaire') {
        const adjAllies = countAdjacentAllies(state, playerId, action.to);
        if (adjAllies >= 2) bonus += 18; // Strong formation
        else if (adjAllies >= 1) bonus += 10; // Partial formation
        else bonus -= 5; // Isolated legionnaire loses bonus
      }
      // Caesar: stay behind the front line, near allies for redirect
      if (unit.category === 'leader') {
        const adjAllies = countAdjacentAllies(state, playerId, action.to);
        if (adjAllies >= 1) bonus += 10; // Near allies to redirect attacks
      }
      // Centurion: stay near basic melee units to command them
      if (unit.typeId === 'centurion') {
        const adjAllies = countAdjacentAllies(state, playerId, action.to);
        if (adjAllies >= 1) bonus += 8;
      }
    }
  }

  if (action.type === 'attack') {
    const attacker = state.units.find(u => u.id === action.unitId);
    // Legionnaire attacks are stronger in formation (ability handles ToHit)
    if (attacker?.typeId === 'legionnaire') {
      const adjAllies = countAdjacentAllies(state, playerId, attacker.position);
      if (adjAllies >= 1) bonus += 10; // Formation attack bonus
    }
  }

  return bonus ? { ...scored, score: scored.score + bonus } : scored;
};

export function createRomanBot(config: BotConfig): Bot {
  return createGenericBot({ ...config, factionId: 'romans' }, romanAdjuster);
}
