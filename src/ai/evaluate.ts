/**
 * Board evaluation heuristics for AI decision-making.
 *
 * All scores are normalized roughly to [-1, 1] where positive means
 * the evaluated player has an advantage.
 */
import type { GameState, PlayerId, Unit } from '../engine/types.js';
import { BASE_CONTROL_TURNS_TO_WIN, MONGOL_BASE_CONTROL_TURNS_TO_WIN } from '../engine/types.js';
import { hexKey, cubeDistance } from '../engine/hex.js';
import { getBaseCells } from '../engine/board.js';
import type { BoardEvaluation, EvalWeights } from './types.js';
import { DEFAULT_EVAL_WEIGHTS } from './types.js';

// ========== Unit Value Weights ==========

const CATEGORY_WEIGHT: Record<string, number> = {
  leader: 3,
  specialty: 2,
  basic: 1,
};

// ========== Top-Level Evaluation ==========

/** Evaluate the board position for a given player. */
export function evaluateBoard(
  state: GameState,
  playerId: PlayerId,
  weights: EvalWeights = DEFAULT_EVAL_WEIGHTS,
): BoardEvaluation {
  const material = materialScore(state, playerId);
  const position = positionScore(state, playerId);
  const threat = threatScore(state, playerId);
  const leaderSafety = leaderSafetyScore(state, playerId);
  const baseControl = baseControlScore(state, playerId);

  const total =
    weights.material * material +
    weights.position * position +
    weights.threat * threat +
    weights.leaderSafety * leaderSafety +
    weights.baseControl * baseControl;

  return { material, position, threat, leaderSafety, baseControl, total };
}

// ========== Factor Scores ==========

/** Material advantage: weighted HP comparison. Range roughly [-1, 1]. */
export function materialScore(state: GameState, playerId: PlayerId): number {
  let myValue = 0;
  let enemyValue = 0;

  for (const unit of state.units) {
    if (unit.currentHp <= 0) continue;
    const weight = CATEGORY_WEIGHT[unit.category] ?? 1;
    const value = unit.currentHp * weight;
    if (unit.playerId === playerId) {
      myValue += value;
    } else {
      enemyValue += value;
    }
  }

  const total = myValue + enemyValue;
  if (total === 0) return 0;
  return (myValue - enemyValue) / total;
}

/** Positional advantage: forward advancement and base zone presence. Range [-1, 1]. */
export function positionScore(state: GameState, playerId: PlayerId): number {
  const myUnits = getLivingUnits(state, playerId);
  const enemyPlayers = state.players.filter(p => p.id !== playerId).map(p => p.id);

  if (myUnits.length === 0) return -1;

  // Score for units in or near enemy base
  let basePresence = 0;
  for (const enemyId of enemyPlayers) {
    const baseCells = getBaseCells(state.board, enemyId);
    const baseKeys = new Set(baseCells.map(c => hexKey(c.coord)));

    for (const unit of myUnits) {
      if (baseKeys.has(hexKey(unit.position))) {
        basePresence += 2;
      } else {
        // Closer to enemy base = better position
        const minDist = baseCells.reduce(
          (min, cell) => Math.min(min, cubeDistance(unit.position, cell.coord)),
          Infinity,
        );
        if (minDist < Infinity) {
          basePresence += Math.max(0, 1 - minDist / 20);
        }
      }
    }
  }

  // Normalize: max possible ~= 2 * unitCount
  const maxScore = myUnits.length * 2;
  return maxScore > 0 ? Math.min(1, basePresence / maxScore) : 0;
}

/** Threat score: how safe are our units? Negative = more threatened. Range [-1, 1]. */
export function threatScore(state: GameState, playerId: PlayerId): number {
  const myUnits = getLivingUnits(state, playerId);
  const enemyUnits = state.units.filter(u => u.currentHp > 0 && u.playerId !== playerId);

  if (myUnits.length === 0) return -1;

  let threatSum = 0;
  for (const unit of myUnits) {
    const adjacentEnemies = enemyUnits.filter(e => cubeDistance(unit.position, e.position) <= 2);
    const weight = CATEGORY_WEIGHT[unit.category] ?? 1;
    // More adjacent enemies on high-value units = worse
    threatSum += adjacentEnemies.length * weight;
  }

  // Normalize: assume max threat ~= 3 enemies per unit * avg weight 2
  const maxThreat = myUnits.length * 6;
  return maxThreat > 0 ? -Math.min(1, threatSum / maxThreat) : 0;
}

/** Leader safety score. Range [-1, 1]. */
export function leaderSafetyScore(state: GameState, playerId: PlayerId): number {
  const leader = state.units.find(
    u => u.playerId === playerId && u.category === 'leader' && u.currentHp > 0,
  );
  if (!leader) return -1; // Leader is dead — worst case

  const enemyUnits = state.units.filter(u => u.currentHp > 0 && u.playerId !== playerId);
  const friendlyUnits = state.units.filter(
    u => u.currentHp > 0 && u.playerId === playerId && u.id !== leader.id,
  );

  // HP factor: higher HP = safer
  const hpFactor = leader.currentHp / leader.maxHp;

  // Enemies near leader (within 2 hexes)
  const nearbyEnemies = enemyUnits.filter(e => cubeDistance(leader.position, e.position) <= 2).length;
  const enemyFactor = Math.max(-1, -nearbyEnemies / 3);

  // Friendly units near leader (within 2 hexes) — protectors
  const nearbyFriends = friendlyUnits.filter(f => cubeDistance(leader.position, f.position) <= 2).length;
  const friendFactor = Math.min(1, nearbyFriends / 3);

  return (hpFactor * 0.4 + enemyFactor * 0.3 + friendFactor * 0.3);
}

/** Base control urgency. Positive = we're closer to winning, negative = enemy is. Range [-1, 1]. */
export function baseControlScore(state: GameState, playerId: PlayerId): number {
  const player = state.players.find(p => p.id === playerId);
  const threshold = player?.factionId === 'mongols'
    ? MONGOL_BASE_CONTROL_TURNS_TO_WIN
    : BASE_CONTROL_TURNS_TO_WIN;

  const myTimer = state.baseControlTimers[playerId] ?? 0;
  const myProgress = myTimer / threshold;

  // Check enemy progress
  let maxEnemyProgress = 0;
  for (const p of state.players) {
    if (p.id === playerId) continue;
    const enemyThreshold = p.factionId === 'mongols'
      ? MONGOL_BASE_CONTROL_TURNS_TO_WIN
      : BASE_CONTROL_TURNS_TO_WIN;
    const enemyTimer = state.baseControlTimers[p.id] ?? 0;
    maxEnemyProgress = Math.max(maxEnemyProgress, enemyTimer / enemyThreshold);
  }

  return myProgress - maxEnemyProgress;
}

// ========== Helpers ==========

function getLivingUnits(state: GameState, playerId: PlayerId): readonly Unit[] {
  return state.units.filter(u => u.currentHp > 0 && u.playerId === playerId);
}
