import type {
  GameState, Action, PlayerId,
  MoveAction, AttackAction, PlaceUnitAction,
  SelectFactionAction, SetArmyCompositionAction, ChoosePriorityAction,
  EndUnitTurnAction,
} from './types.js';
import { ALL_FACTION_IDS, DEFAULT_ARMY_LIMITS } from './types.js';
import { hexKey } from './hex.js';
import { validateMove } from './movement.js';
import { validateAttack } from './combat.js';
import { getFaction, getUnitDef } from './data/factions/index.js';
import { BASIC_MELEE, BASIC_RANGED } from './data/basic-units.js';
import { getPlacementZoneCells } from './board.js';

// ========== Validation Result ==========

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

// ========== Main Validator ==========

/**
 * Validate whether an action is legal in the current game state.
 * Optionally specify actingPlayer for simultaneous phases (army composition).
 */
export function validateAction(
  state: GameState,
  action: Action,
  actingPlayer?: PlayerId,
): ValidationResult {
  if (state.winner) {
    return { valid: false, reason: 'Game is already over' };
  }

  switch (action.type) {
    case 'choosePriority':
      return validateChoosePriority(state, action);
    case 'selectFaction':
      return validateSelectFaction(state, action);
    case 'setArmyComposition':
      return validateSetArmyComp(state, action);
    case 'placeUnit':
      return validatePlaceUnitAction(state, action);
    case 'move':
      return validateMoveAction(state, action);
    case 'attack':
      return validateAttackAction(state, action);
    case 'endUnitTurn':
      return validateEndUnitTurn(state, action);
    case 'endTurn':
      return validateEndTurn(state);
    case 'surrender':
      return { valid: true };
    case 'ability':
      return { valid: false, reason: 'Ability actions not yet supported' };
    case 'placeTerrain':
      return { valid: false, reason: 'Terrain placement not yet supported' };
    default:
      return { valid: false, reason: 'Unknown action type' };
  }
}

// ========== Setup Validators ==========

function validateChoosePriority(state: GameState, action: ChoosePriorityAction): ValidationResult {
  if (state.phase !== 'setup') return { valid: false, reason: 'Not in setup phase' };
  if (!state.setupState || state.setupState.currentStep !== 'choosePriority') {
    return { valid: false, reason: 'Not in choosePriority step' };
  }
  if (action.playerId !== state.setupState.rollWinner) {
    return { valid: false, reason: 'Only the roll winner can choose priority' };
  }
  return { valid: true };
}

function validateSelectFaction(state: GameState, action: SelectFactionAction): ValidationResult {
  if (state.phase !== 'setup') return { valid: false, reason: 'Not in setup phase' };
  if (!state.setupState || state.setupState.currentStep !== 'factionSelection') {
    return { valid: false, reason: 'Not in faction selection step' };
  }
  const expected = state.setupState.factionSelectionOrder[state.setupState.currentPlayerIndex];
  if (action.playerId !== expected) {
    return { valid: false, reason: `Not ${action.playerId}'s turn to select` };
  }
  const takenFactions = state.players.filter(p => p.factionId).map(p => p.factionId);
  if (takenFactions.includes(action.factionId)) {
    return { valid: false, reason: `Faction ${action.factionId} is already taken` };
  }
  if (!ALL_FACTION_IDS.includes(action.factionId)) {
    return { valid: false, reason: `Unknown faction: ${action.factionId}` };
  }
  return { valid: true };
}

function validateSetArmyComp(state: GameState, action: SetArmyCompositionAction): ValidationResult {
  if (state.phase !== 'setup') return { valid: false, reason: 'Not in setup phase' };
  if (!state.setupState || state.setupState.currentStep !== 'armyComposition') {
    return { valid: false, reason: 'Not in army composition step' };
  }
  const player = state.players.find(p => p.id === action.playerId);
  if (!player) return { valid: false, reason: 'Unknown player' };
  if (player.armyComposition) {
    return { valid: false, reason: 'Army composition already submitted' };
  }
  if (!player.factionId) {
    return { valid: false, reason: 'Faction not yet selected' };
  }
  const comp = action.composition;
  const totalBasic = comp.basicMelee + comp.basicRanged;
  if (totalBasic !== DEFAULT_ARMY_LIMITS.basic) {
    return { valid: false, reason: `Basic units must total ${DEFAULT_ARMY_LIMITS.basic}` };
  }
  if (comp.specialtyChoices.length !== DEFAULT_ARMY_LIMITS.specialty) {
    return { valid: false, reason: `Must choose ${DEFAULT_ARMY_LIMITS.specialty} specialty units` };
  }
  const faction = getFaction(player.factionId);
  for (const typeId of comp.specialtyChoices) {
    if (!faction.specialtyTypeIds.includes(typeId)) {
      return { valid: false, reason: `${typeId} is not a valid specialty unit for ${player.factionId}` };
    }
  }
  return { valid: true };
}

// ========== Placement Validators ==========

function validatePlaceUnitAction(state: GameState, action: PlaceUnitAction): ValidationResult {
  if (state.phase !== 'placement') return { valid: false, reason: 'Not in placement phase' };
  const setup = state.setupState;
  if (!setup || setup.currentStep !== 'unitPlacement') {
    return { valid: false, reason: 'Not in unit placement step' };
  }
  const currentPlacer = setup.moveOrder[setup.currentPlayerIndex];
  if (action.playerId !== currentPlacer) {
    return { valid: false, reason: `Not ${action.playerId}'s turn to place` };
  }
  const roster = setup.unplacedRoster[action.playerId] ?? [];
  if (!roster.includes(action.unitTypeId)) {
    return { valid: false, reason: `${action.unitTypeId} not in unplaced roster` };
  }
  const cellKey = hexKey(action.position);
  const cell = state.board.cells[cellKey];
  if (!cell) return { valid: false, reason: 'Position is off the board' };
  if (cell.placementZonePlayerId !== action.playerId) {
    return { valid: false, reason: 'Position is not in your placement zone' };
  }
  if (state.units.some(u => hexKey(u.position) === cellKey)) {
    return { valid: false, reason: 'Position is already occupied' };
  }
  return { valid: true };
}

// ========== Gameplay Validators ==========

function validateMoveAction(state: GameState, action: MoveAction): ValidationResult {
  if (state.phase !== 'gameplay') return { valid: false, reason: 'Not in gameplay phase' };
  const unit = state.units.find(u => u.id === action.unitId);
  if (!unit) return { valid: false, reason: 'Unit not found' };
  if (unit.playerId !== state.currentPlayerId) {
    return { valid: false, reason: 'Not your unit' };
  }
  if (unit.currentHp <= 0) return { valid: false, reason: 'Unit is dead' };
  if (unit.activatedThisTurn) return { valid: false, reason: 'Unit already activated this turn' };
  if (state.activeUnitId && state.activeUnitId !== unit.id) {
    return { valid: false, reason: 'Another unit is currently active' };
  }
  return validateMove(unit, action.to, state.board, state.units);
}

function validateAttackAction(state: GameState, action: AttackAction): ValidationResult {
  if (state.phase !== 'gameplay') return { valid: false, reason: 'Not in gameplay phase' };
  const attacker = state.units.find(u => u.id === action.unitId);
  if (!attacker) return { valid: false, reason: 'Attacker not found' };
  if (attacker.playerId !== state.currentPlayerId) {
    return { valid: false, reason: 'Not your unit' };
  }
  if (attacker.currentHp <= 0) return { valid: false, reason: 'Attacker is dead' };
  if (attacker.activatedThisTurn) return { valid: false, reason: 'Unit already activated this turn' };
  if (state.activeUnitId && state.activeUnitId !== attacker.id) {
    return { valid: false, reason: 'Another unit is currently active' };
  }
  const target = state.units.find(u => u.id === action.targetId);
  if (!target) return { valid: false, reason: 'Target not found' };

  const player = state.players.find(p => p.id === attacker.playerId)!;
  const def = lookupDef(attacker.typeId, player.factionId!);
  return validateAttack(attacker, target, def.attack);
}

function validateEndUnitTurn(state: GameState, action: EndUnitTurnAction): ValidationResult {
  if (state.phase !== 'gameplay') return { valid: false, reason: 'Not in gameplay phase' };
  const unit = state.units.find(u => u.id === action.unitId);
  if (!unit) return { valid: false, reason: 'Unit not found' };
  if (unit.playerId !== state.currentPlayerId) {
    return { valid: false, reason: 'Not your unit' };
  }
  if (state.activeUnitId && state.activeUnitId !== action.unitId) {
    return { valid: false, reason: 'Cannot end turn for inactive unit' };
  }
  return { valid: true };
}

function validateEndTurn(state: GameState): ValidationResult {
  if (state.phase !== 'gameplay') return { valid: false, reason: 'Not in gameplay phase' };
  return { valid: true };
}

// ========== Helpers ==========

function lookupDef(typeId: string, factionId: import('./types.js').FactionId) {
  if (typeId === 'basic_melee') return BASIC_MELEE;
  if (typeId === 'basic_ranged') return BASIC_RANGED;
  const def = getUnitDef(factionId, typeId);
  if (!def) throw new Error(`Unknown unit type: ${typeId}`);
  return def;
}
