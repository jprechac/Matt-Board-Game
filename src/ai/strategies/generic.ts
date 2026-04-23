/**
 * Generic medium-difficulty AI strategy.
 *
 * Works for any faction by scoring legal actions using board evaluation
 * heuristics. Faction-specific strategies extend this by providing a
 * ScoreAdjuster that tweaks scores based on faction abilities.
 */
import type {
  GameState, Action, PlayerId, FactionId,
  MoveAction, AttackAction, HealAction,
} from '../../engine/types.js';
import { ALL_FACTION_IDS } from '../../engine/types.js';
import { cubeDistance, hexKey, cubeNeighbors } from '../../engine/hex.js';
import { getBaseCells } from '../../engine/board.js';
import { getAllLegalActions, getUnitActions } from '../../engine/actions.js';
import { getUnitDef } from '../../engine/data/factions/index.js';
import { evaluateBoard } from '../evaluate.js';
import { getDefaultComposition, choosePlacementPosition } from '../placement.js';
import type { Bot, BotConfig, ScoredAction } from '../types.js';

// ========== Types ==========

/** Adjusts action scores based on faction-specific tactics. */
export type ScoreAdjuster = (
  state: GameState,
  playerId: PlayerId,
  scored: ScoredAction,
) => ScoredAction;

// ========== Bot Factory ==========

/** Create a generic bot, optionally with a faction-specific score adjuster. */
export function createGenericBot(config: BotConfig, adjuster?: ScoreAdjuster): Bot {
  return {
    chooseAction(state: GameState, playerId: PlayerId): Action {
      switch (state.phase) {
        case 'setup':
          return chooseSetupAction(state, playerId, config);
        case 'placement':
          return choosePlacementAction(state, playerId);
        case 'gameplay':
          return chooseGameplayAction(state, playerId, adjuster);
        default:
          return { type: 'surrender', playerId };
      }
    },
  };
}

// ========== Setup Phase ==========

function chooseSetupAction(state: GameState, playerId: PlayerId, config: BotConfig): Action {
  const setup = state.setupState!;

  switch (setup.currentStep) {
    case 'choosePriority': {
      return {
        type: 'choosePriority',
        playerId: setup.rollWinner!,
        orderToControl: 'factionOrder',
        position: 'first',
      };
    }
    case 'loserChoosePriority': {
      const loserId = state.players.find(p => p.id !== setup.rollWinner)!.id;
      return { type: 'choosePriority', playerId: loserId, position: 'first' };
    }
    case 'factionSelection': {
      const currentPlayer = setup.factionSelectionOrder[setup.currentPlayerIndex];
      const takenFactions = new Set(state.players.filter(p => p.factionId).map(p => p.factionId));
      const targetFaction = config.factionId && !takenFactions.has(config.factionId)
        ? config.factionId
        : ALL_FACTION_IDS.find(f => !takenFactions.has(f))!;
      return { type: 'selectFaction', playerId: currentPlayer, factionId: targetFaction };
    }
    case 'armyComposition': {
      // Find a player who hasn't submitted yet
      const unsubmitted = state.players.find(p => p.factionId && !p.armyComposition);
      if (!unsubmitted) return { type: 'surrender', playerId };
      const comp = getDefaultComposition(unsubmitted.factionId!);
      return { type: 'setArmyComposition', playerId: unsubmitted.id, composition: comp };
    }
    default:
      return { type: 'surrender', playerId };
  }
}

// ========== Placement Phase ==========

function choosePlacementAction(state: GameState, playerId: PlayerId): Action {
  const roster = state.setupState!.unplacedRoster[playerId] ?? [];
  if (roster.length === 0) {
    // Nothing left to place — shouldn't happen but handle gracefully
    return { type: 'endTurn' };
  }

  // Choose unit type to place (prefer leader first, then specialty, then basic)
  const player = state.players.find(p => p.id === playerId)!;
  const unitPriority = prioritizeUnitTypes(roster, player.factionId!);
  const unitTypeId = unitPriority[0];

  const position = choosePlacementPosition(state, playerId, unitTypeId);
  return { type: 'placeUnit', playerId, unitTypeId, position };
}

function prioritizeUnitTypes(roster: readonly string[], factionId: FactionId): string[] {
  const sorted = [...roster].sort((a, b) => {
    const defA = getUnitDef(factionId, a);
    const defB = getUnitDef(factionId, b);
    const catOrder: Record<string, number> = { leader: 0, specialty: 1, basic: 2 };
    const orderA = catOrder[defA?.category ?? 'basic'] ?? 2;
    const orderB = catOrder[defB?.category ?? 'basic'] ?? 2;
    return orderA - orderB;
  });
  return sorted;
}

// ========== Gameplay Phase ==========

function chooseGameplayAction(state: GameState, playerId: PlayerId, adjuster?: ScoreAdjuster): Action {
  const legalActions = getAllLegalActions(state);
  if (legalActions.length === 0) {
    return { type: 'endTurn' };
  }

  // Score each action, apply faction adjustments
  const scored: ScoredAction[] = [];
  for (const action of legalActions) {
    let sa = scoreAction(state, playerId, action);
    if (adjuster) {
      sa = adjuster(state, playerId, sa);
    }
    scored.push(sa);
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored[0].action;
}

function scoreAction(
  state: GameState,
  playerId: PlayerId,
  action: Action,
): ScoredAction {
  switch (action.type) {
    case 'attack':
      return scoreAttack(state, playerId, action);
    case 'heal':
      return scoreHeal(state, playerId, action);
    case 'move':
      return scoreMove(state, playerId, action);
    case 'endUnitTurn':
      return { action, score: 1, reason: 'end unit turn' };
    case 'endTurn':
      return scoreEndTurn(state, playerId, action);
    case 'surrender':
      return { action, score: -1000, reason: 'surrender' };
    default:
      return { action, score: 0, reason: 'unknown action' };
  }
}

// ========== Exported Utilities for Faction Strategies ==========

/** Count allied units adjacent to a given position. */
export function countAdjacentAllies(state: GameState, playerId: PlayerId, pos: { q: number; r: number; s: number }): number {
  const neighbors = cubeNeighbors(pos);
  return state.units.filter(u =>
    u.playerId === playerId && u.currentHp > 0 &&
    neighbors.some(n => hexKey(n) === hexKey(u.position)),
  ).length;
}

/** Count enemy units adjacent to a given position. */
export function countAdjacentEnemies(state: GameState, playerId: PlayerId, pos: { q: number; r: number; s: number }): number {
  const neighbors = cubeNeighbors(pos);
  return state.units.filter(u =>
    u.playerId !== playerId && u.currentHp > 0 &&
    neighbors.some(n => hexKey(n) === hexKey(u.position)),
  ).length;
}

/** Check if a unit is within range hexes of a reference position. */
export function isWithinRange(pos1: { q: number; r: number; s: number }, pos2: { q: number; r: number; s: number }, range: number): boolean {
  return cubeDistance(pos1, pos2) <= range;
}

// ========== Action Scoring ==========

function scoreAttack(
  state: GameState,
  playerId: PlayerId,
  action: AttackAction,
): ScoredAction {
  const target = state.units.find(u => u.id === action.targetId);
  if (!target) return { action, score: 0, reason: 'no target' };

  const attacker = state.units.find(u => u.id === action.unitId);
  if (!attacker) return { action, score: 0, reason: 'no attacker' };

  const player = state.players.find(p => p.id === playerId)!;
  const attackerDef = getUnitDef(player.factionId!, attacker.typeId);
  const damage = attackerDef?.attack.damage ?? 2;

  let score = 50; // Base score for attacking

  // Prioritize low-HP targets (potential kill)
  if (target.currentHp <= damage) {
    score += 30;
  }

  // Prioritize high-value targets
  const targetValue = target.category === 'leader' ? 20 : target.category === 'specialty' ? 10 : 5;
  score += targetValue;

  // Prioritize targets in our base
  const baseCells = getBaseCells(state.board, playerId);
  const baseKeys = new Set(baseCells.map(c => hexKey(c.coord)));
  if (baseKeys.has(hexKey(target.position))) {
    score += 25;
  }

  return { action, score, reason: `attack ${target.typeId} (HP: ${target.currentHp})` };
}

function scoreHeal(
  state: GameState,
  playerId: PlayerId,
  action: HealAction,
): ScoredAction {
  const target = state.units.find(u => u.id === action.targetId);
  if (!target) return { action, score: 0, reason: 'no target' };

  let score = 40; // Base heal score

  // Prioritize healing low-HP units
  const hpRatio = target.currentHp / target.maxHp;
  score += (1 - hpRatio) * 30;

  // Prioritize healing leaders
  if (target.category === 'leader') score += 20;

  return { action, score, reason: `heal ${target.typeId} (HP: ${target.currentHp}/${target.maxHp})` };
}

function scoreMove(
  state: GameState,
  playerId: PlayerId,
  action: MoveAction,
): ScoredAction {
  const unit = state.units.find(u => u.id === action.unitId);
  if (!unit) return { action, score: 0, reason: 'no unit' };

  const enemyId = state.players.find(p => p.id !== playerId)?.id;
  if (!enemyId) return { action, score: 5, reason: 'move' };

  // Get enemy base center for approach scoring
  const enemyBaseCells = getBaseCells(state.board, enemyId);
  if (enemyBaseCells.length === 0) return { action, score: 5, reason: 'move' };

  const closestBaseDist = enemyBaseCells.reduce(
    (min, cell) => Math.min(min, cubeDistance(action.to, cell.coord)),
    Infinity,
  );
  const currentBaseDist = enemyBaseCells.reduce(
    (min, cell) => Math.min(min, cubeDistance(unit.position, cell.coord)),
    Infinity,
  );

  let score = 10; // Base move score

  // Moving toward enemy base
  const advancement = currentBaseDist - closestBaseDist;
  score += advancement * 5;

  // Wounded units: prefer retreat (move away from enemies)
  if (unit.currentHp <= unit.maxHp * 0.3) {
    const enemies = state.units.filter(u => u.currentHp > 0 && u.playerId !== playerId);
    const closestEnemy = enemies.reduce(
      (min, e) => Math.min(min, cubeDistance(action.to, e.position)),
      Infinity,
    );
    if (closestEnemy > 2) score += 10; // Moving away from enemies when wounded
  }

  // If unit has already attacked and can move 1 more hex, slight bonus for retreating
  if (unit.hasAttackedThisTurn) {
    const enemies = state.units.filter(u => u.currentHp > 0 && u.playerId !== playerId);
    const currentMinEnemyDist = enemies.reduce(
      (min, e) => Math.min(min, cubeDistance(unit.position, e.position)),
      Infinity,
    );
    const newMinEnemyDist = enemies.reduce(
      (min, e) => Math.min(min, cubeDistance(action.to, e.position)),
      Infinity,
    );
    if (newMinEnemyDist > currentMinEnemyDist) {
      score += 8; // Retreat after attacking
    }
  }

  // Check if move puts us in attack range of an enemy
  const unitActions = getUnitActions(state, unit.id);
  if (unitActions.attackTargets.length === 0) {
    // Currently can't attack; moving to get in range is valuable
    const enemies = state.units.filter(u => u.currentHp > 0 && u.playerId !== playerId);
    for (const enemy of enemies) {
      const dist = cubeDistance(action.to, enemy.position);
      const player = state.players.find(p => p.id === playerId)!;
      const unitDef = getUnitDef(player.factionId!, unit.typeId);
      const range = unitDef?.attack.range ?? 1;
      if (dist <= range) {
        score += 15; // Move into attack range
        break;
      }
    }
  }

  return { action, score, reason: `move ${unit.typeId} (advance: ${advancement})` };
}

function scoreEndTurn(
  state: GameState,
  playerId: PlayerId,
  action: Action,
): ScoredAction {
  // Only end turn when no better options
  const myUnits = state.units.filter(
    u => u.playerId === playerId && u.currentHp > 0 && !u.activatedThisTurn,
  );

  // If there's an active unit that hasn't been deactivated, prefer endUnitTurn first
  if (state.activeUnitId) {
    return { action, score: -5, reason: 'end turn with active unit' };
  }

  // If all units are activated, end turn is natural
  if (myUnits.length === 0) {
    return { action, score: 100, reason: 'all units done' };
  }

  return { action, score: 0, reason: 'end turn early' };
}
