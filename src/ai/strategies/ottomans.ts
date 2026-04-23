/**
 * Ottoman AI: Medic healing priority + Janissary reload management.
 *
 * Tactics: Medics follow wounded frontline units to sustain pressure.
 * Janissaries snipe from range 4 then reload. Suleiman buffs siege mobility.
 */
import type { GameState, PlayerId } from '../../engine/types.js';
import { cubeDistance } from '../../engine/hex.js';
import { createGenericBot, isWithinRange, type ScoreAdjuster } from './generic.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

const ottomanAdjuster: ScoreAdjuster = (state, playerId, scored) => {
  const { action } = scored;
  let bonus = 0;

  const leader = state.units.find(u => u.playerId === playerId && u.category === 'leader' && u.currentHp > 0);

  if (action.type === 'heal') {
    // Medic heal is the core Ottoman mechanic — strong priority
    const target = state.units.find(u => u.id === (action as any).targetId);
    if (target) {
      bonus += 15; // Ottomans value healing highly
      if (target.category === 'leader') bonus += 15;
      const hpRatio = target.currentHp / target.maxHp;
      if (hpRatio < 0.5) bonus += 10;
    }
  }

  if (action.type === 'move') {
    const unit = state.units.find(u => u.id === action.unitId);
    if (unit?.typeId === 'medic') {
      // Medic: move toward wounded allies
      const woundedAllies = state.units.filter(
        u => u.playerId === playerId && u.currentHp < u.maxHp && u.currentHp > 0 && u.id !== unit.id,
      );
      if (woundedAllies.length > 0) {
        const closestWounded = woundedAllies.reduce(
          (min, a) => Math.min(min, cubeDistance(action.to, a.position)),
          Infinity,
        );
        if (closestWounded <= 1) bonus += 15; // Adjacent to wounded = can heal next
        else if (closestWounded <= 2) bonus += 8;
      }
    }
    // Janissary: stay at range, don't advance into melee
    if (unit?.typeId === 'janissary') {
      const enemies = state.units.filter(u => u.playerId !== playerId && u.currentHp > 0);
      const minDist = enemies.reduce(
        (min, e) => Math.min(min, cubeDistance(action.to, e.position)),
        Infinity,
      );
      if (minDist >= 3) bonus += 8; // Safe range for sniping
      if (minDist <= 1) bonus -= 12; // Avoid melee range
    }
    // Stay near Suleiman for siege movement buff
    if (leader && unit && unit.id !== leader.id && isWithinRange(action.to, leader.position, 3)) {
      bonus += 4;
    }
  }

  if (action.type === 'attack') {
    const attacker = state.units.find(u => u.id === action.unitId);
    // Janissary: high value long-range attacks (no proximity penalty)
    if (attacker?.typeId === 'janissary') {
      bonus += 8;
    }
  }

  return bonus ? { ...scored, score: scored.score + bonus } : scored;
};

export function createOttomanBot(config: BotConfig): Bot {
  return createGenericBot({ ...config, factionId: 'ottomans' }, ottomanAdjuster);
}
