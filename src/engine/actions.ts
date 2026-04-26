import type {
  GameState, Action, PlayerId, CubeCoord, Unit,
  MoveAction, AttackAction, EndUnitTurnAction, EndTurnAction, SurrenderAction,
  PlaceUnitAction, FactionId,
} from './types.js';
import { ALL_FACTION_IDS } from './types.js';
import { hexKey, parseHexKey, cubeDistance, cubeNeighbors } from './hex.js';
import { getReachableHexes, getTargetsInRange, getAvailableMovement } from './movement.js';
import { getUnitDef } from './data/factions/index.js';
import { getPlacementZoneCells } from './board.js';
import { getAbility } from './abilities/index.js';

// ========== Unit-Level Action Queries ==========

/** Actions available for a specific unit in gameplay phase. */
export interface UnitActions {
  readonly moves: readonly CubeCoord[];
  readonly attackTargets: readonly Unit[];
  readonly healTargets: readonly Unit[];
  readonly upgradeTargets: readonly Unit[];
  readonly canEndUnitTurn: boolean;
}

/** Get all legal actions for a specific unit. Only valid in gameplay phase. */
export function getUnitActions(state: GameState, unitId: string): UnitActions {
  const empty: UnitActions = { moves: [], attackTargets: [], healTargets: [], upgradeTargets: [], canEndUnitTurn: false };
  if (state.phase !== 'gameplay' || state.winner) return empty;

  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.currentHp <= 0) return empty;
  if (unit.playerId !== state.currentPlayerId) return empty;
  if (unit.activatedThisTurn) return empty;
  if (state.activeUnitId && state.activeUnitId !== unitId) return empty;

  // Moves: all reachable hexes (excluding current position)
  const reachable = getReachableHexes(unit, state.board, state.units);
  const currentKey = hexKey(unit.position);
  const moves = [...reachable.keys()]
    .filter(k => k !== currentKey)
    .map(k => parseHexKey(k));

  // Attack targets: enemies in range
  const player = state.players.find(p => p.id === unit.playerId)!;
  const unitDef = getUnitDef(player.factionId!, unit.typeId);
  const range = unitDef?.attack.range ?? 1;
  const attackTargets = unit.hasAttackedThisTurn
    ? []
    : getTargetsInRange(unit, state.units, range);

  // Heal targets: adjacent friendly units below max HP (for medic units)
  let healTargets: Unit[] = [];
  if (unitDef?.abilityId === 'medic_heal' && !unit.hasAttackedThisTurn && !unit.hasUsedAbilityThisTurn) {
    healTargets = state.units.filter(u =>
      u.currentHp > 0 &&
      u.playerId === unit.playerId &&
      u.id !== unit.id &&
      u.currentHp < u.maxHp &&
      cubeDistance(unit.position, u.position) === 1,
    );
  }

  // Upgrade targets: adjacent basic units at full HP (for King Arthur)
  let upgradeTargets: Unit[] = [];
  if (unitDef?.abilityId === 'upgrade_unit' && !unit.hasUsedAbilityThisTurn) {
    const handler = getAbility('upgrade_unit');
    const ctx = { unit, state, allUnits: state.units };
    if (handler?.canActivate?.(ctx)) {
      upgradeTargets = state.units.filter(u =>
        u.currentHp > 0 &&
        u.playerId === unit.playerId &&
        u.id !== unit.id &&
        u.category === 'basic' &&
        u.currentHp >= u.maxHp &&
        cubeDistance(unit.position, u.position) === 1,
      );
    }
  }

  return {
    moves,
    attackTargets,
    healTargets,
    upgradeTargets,
    canEndUnitTurn: true,
  };
}

// ========== Full Action Enumeration ==========

/** Get all legal actions for the current player in the current game state.
 *  Useful for AI bots and validation. */
export function getAllLegalActions(state: GameState): Action[] {
  if (state.winner) return [];

  switch (state.phase) {
    case 'setup':
      return getSetupActions(state);
    case 'placement':
      return getPlacementActions(state);
    case 'gameplay':
      return getGameplayActions(state);
    default:
      return [];
  }
}

function getSetupActions(state: GameState): Action[] {
  const setup = state.setupState;
  if (!setup) return [];

  switch (setup.currentStep) {
    case 'choosePriority': {
      const winner = setup.rollWinner!;
      return [
        { type: 'choosePriority', playerId: winner, orderToControl: 'factionOrder', position: 'first' },
        { type: 'choosePriority', playerId: winner, orderToControl: 'factionOrder', position: 'second' },
        { type: 'choosePriority', playerId: winner, orderToControl: 'moveOrder', position: 'first' },
        { type: 'choosePriority', playerId: winner, orderToControl: 'moveOrder', position: 'second' },
      ] as Action[];
    }
    case 'loserChoosePriority': {
      const loser = state.players.find(p => p.id !== setup.rollWinner)!.id;
      return [
        { type: 'choosePriority', playerId: loser, position: 'first' },
        { type: 'choosePriority', playerId: loser, position: 'second' },
      ] as Action[];
    }
    case 'factionSelection': {
      const player = setup.factionSelectionOrder[setup.currentPlayerIndex];
      const takenFactions = new Set(state.players.filter(p => p.factionId).map(p => p.factionId));
      return ALL_FACTION_IDS
        .filter(f => !takenFactions.has(f))
        .map(factionId => ({
          type: 'selectFaction' as const,
          playerId: player,
          factionId,
        }));
    }
    // Army composition has too many combinations to enumerate meaningfully
    default:
      return [];
  }
}

function getPlacementActions(state: GameState): Action[] {
  const setup = state.setupState;
  if (!setup || setup.currentStep !== 'unitPlacement') return [];

  const placer = setup.moveOrder[setup.currentPlayerIndex];
  const roster = setup.unplacedRoster[placer] ?? [];
  const uniqueTypes = [...new Set(roster)];

  const placementCells = getPlacementZoneCells(state.board, placer);
  const occupiedKeys = new Set(state.units.map(u => hexKey(u.position)));
  const emptyPlacements = placementCells.filter(c => !occupiedKeys.has(hexKey(c.coord)));

  const actions: PlaceUnitAction[] = [];
  for (const typeId of uniqueTypes) {
    for (const cell of emptyPlacements) {
      actions.push({
        type: 'placeUnit',
        playerId: placer,
        unitTypeId: typeId,
        position: cell.coord,
      });
    }
  }
  return actions;
}

function getGameplayActions(state: GameState): Action[] {
  const actions: Action[] = [];
  const currentPlayer = state.currentPlayerId;

  // Per-unit actions
  const playerUnits = state.units.filter(u =>
    u.playerId === currentPlayer && u.currentHp > 0 && !u.activatedThisTurn,
  );

  for (const unit of playerUnits) {
    // Skip if another unit is active
    if (state.activeUnitId && state.activeUnitId !== unit.id) continue;

    const unitActions = getUnitActions(state, unit.id);

    for (const to of unitActions.moves) {
      actions.push({ type: 'move', unitId: unit.id, to });
    }

    for (const target of unitActions.attackTargets) {
      actions.push({ type: 'attack', unitId: unit.id, targetId: target.id });
    }

    for (const target of unitActions.healTargets) {
      actions.push({ type: 'heal', unitId: unit.id, targetId: target.id });
    }

    for (const target of unitActions.upgradeTargets) {
      actions.push({
        type: 'ability',
        unitId: unit.id,
        abilityId: 'upgrade_unit',
        params: { targetId: target.id },
      });
    }

    if (unitActions.canEndUnitTurn) {
      actions.push({ type: 'endUnitTurn', unitId: unit.id });
    }
  }

  // Global actions
  actions.push({ type: 'endTurn' });
  actions.push({ type: 'surrender', playerId: currentPlayer });

  return actions;
}
