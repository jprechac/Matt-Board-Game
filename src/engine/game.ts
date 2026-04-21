import type {
  GameState, Action, PlayerId, BoardSize, CubeCoord,
  SetupState, PlayerState, Unit, ArmyComposition,
  MoveAction, AttackAction, PlaceUnitAction, EndUnitTurnAction,
  SelectFactionAction, SetArmyCompositionAction, ChoosePriorityAction,
  SurrenderAction, WinCondition, FactionId,
} from './types.js';
import {
  DEFAULT_ARMY_LIMITS, BASE_CONTROL_TURNS_TO_WIN,
  MONGOL_BASE_CONTROL_TURNS_TO_WIN,
} from './types.js';
import { createBoard, getBaseCells } from './board.js';
import { hexKey } from './hex.js';
import { SeededRNG } from './rng.js';
import { validateMove, applyMove, getAvailableMovement } from './movement.js';
import { resolveCombat, validateAttack } from './combat.js';
import { getFaction, getUnitDef } from './data/factions/index.js';
import { BASIC_MELEE, BASIC_RANGED } from './data/basic-units.js';
import { getAttackModifiers, getDefenseModifiers } from './abilities/index.js';

// ========== Game Configuration ==========

export interface GameConfig {
  readonly boardSize: BoardSize;
  readonly playerIds: readonly PlayerId[];
  readonly seed: number;
}

// ========== Game Creation ==========

export function createGame(config: GameConfig): GameState {
  const rng = new SeededRNG(config.seed);
  const board = createBoard(config.boardSize);

  // Auto-resolve roll-off
  const rollResults: Partial<Record<PlayerId, number>> = {};
  let maxRoll = 0;
  let winner: PlayerId | undefined;

  // Roll until no tie
  let resolved = false;
  while (!resolved) {
    for (const pid of config.playerIds) {
      rollResults[pid] = rng.d8();
    }
    maxRoll = Math.max(...Object.values(rollResults) as number[]);
    const winners = config.playerIds.filter(pid => rollResults[pid] === maxRoll);
    if (winners.length === 1) {
      winner = winners[0];
      resolved = true;
    }
    // On tie, re-roll (loop continues)
  }

  const setupState: SetupState = {
    rollResults,
    rollWinner: winner,
    factionSelectionOrder: [],
    moveOrder: [],
    currentStep: 'choosePriority',
    currentPlayerIndex: 0,
    placementCount: 0,
    batchCount: 0,
    unplacedRoster: {},
  };

  const players: PlayerState[] = config.playerIds.map(id => ({ id }));

  return {
    phase: 'setup',
    turnNumber: 0,
    currentPlayerId: winner!,
    players,
    board,
    units: [],
    rngSeed: config.seed,
    rngState: rng.getState(),
    baseControlTimers: Object.fromEntries(config.playerIds.map(pid => [pid, 0])) as Record<PlayerId, number>,
    setupState,
  };
}

// ========== Action Dispatch ==========

export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'choosePriority':
      return applyChoosePriority(state, action);
    case 'selectFaction':
      return applySelectFaction(state, action);
    case 'setArmyComposition':
      return applySetArmyComposition(state, action);
    case 'placeUnit':
      return applyPlaceUnit(state, action);
    case 'move':
      return applyMoveAction(state, action);
    case 'attack':
      return applyAttackAction(state, action);
    case 'endUnitTurn':
      return applyEndUnitTurn(state, action);
    case 'endTurn':
      return applyEndTurn(state);
    case 'surrender':
      return applySurrender(state, action);
    case 'ability':
      throw new Error('Ability actions not yet implemented in game flow');
    case 'placeTerrain':
      throw new Error('Terrain placement not yet implemented');
    default:
      throw new Error(`Unknown action type: ${(action as Action).type}`);
  }
}

// ========== Setup Phase ==========

function applyChoosePriority(state: GameState, action: ChoosePriorityAction): GameState {
  const setup = requireSetup(state, 'choosePriority');
  if (action.playerId !== setup.rollWinner) {
    throw new Error(`Only the roll winner (${setup.rollWinner}) can choose priority`);
  }

  const otherPlayers = state.players.filter(p => p.id !== action.playerId).map(p => p.id);

  let factionSelectionOrder: PlayerId[];
  let moveOrder: PlayerId[];

  if (action.choice === 'pickFactionFirst') {
    factionSelectionOrder = [action.playerId, ...otherPlayers];
    // Other player gets to decide move order — for simplicity, they move first
    moveOrder = [...otherPlayers, action.playerId];
  } else {
    // Winner chose to move first; other player picks faction first
    moveOrder = [action.playerId, ...otherPlayers];
    factionSelectionOrder = [...otherPlayers, action.playerId];
  }

  return {
    ...state,
    setupState: {
      ...setup,
      factionSelectionOrder,
      moveOrder,
      currentStep: 'factionSelection',
      currentPlayerIndex: 0,
    },
    currentPlayerId: factionSelectionOrder[0],
  };
}

function applySelectFaction(state: GameState, action: SelectFactionAction): GameState {
  const setup = requireSetup(state, 'factionSelection');
  const expectedPlayer = setup.factionSelectionOrder[setup.currentPlayerIndex];
  if (action.playerId !== expectedPlayer) {
    throw new Error(`Not ${action.playerId}'s turn to select faction`);
  }

  // Check faction not already taken
  const takenFactions = state.players.filter(p => p.factionId).map(p => p.factionId);
  if (takenFactions.includes(action.factionId)) {
    throw new Error(`Faction ${action.factionId} is already taken`);
  }

  // Validate faction exists
  getFaction(action.factionId);

  const updatedPlayers = state.players.map(p =>
    p.id === action.playerId ? { ...p, factionId: action.factionId } : p,
  );

  const nextIndex = setup.currentPlayerIndex + 1;
  const allSelected = nextIndex >= setup.factionSelectionOrder.length;

  return {
    ...state,
    players: updatedPlayers,
    setupState: {
      ...setup,
      currentStep: allSelected ? 'armyComposition' : 'factionSelection',
      currentPlayerIndex: allSelected ? 0 : nextIndex,
    },
    currentPlayerId: allSelected
      ? setup.factionSelectionOrder[0] // Any player can submit army comp
      : setup.factionSelectionOrder[nextIndex],
  };
}

function applySetArmyComposition(state: GameState, action: SetArmyCompositionAction): GameState {
  const setup = requireSetup(state, 'armyComposition');

  // Check this player hasn't already submitted
  const player = state.players.find(p => p.id === action.playerId);
  if (!player) throw new Error(`Unknown player: ${action.playerId}`);
  if (player.armyComposition) {
    throw new Error(`${action.playerId} has already set army composition`);
  }
  if (!player.factionId) {
    throw new Error(`${action.playerId} has not selected a faction`);
  }

  // Validate composition
  validateArmyComposition(action.composition, player.factionId);

  const updatedPlayers = state.players.map(p =>
    p.id === action.playerId ? { ...p, armyComposition: action.composition } : p,
  );

  const allSubmitted = updatedPlayers.every(p => p.armyComposition);

  if (allSubmitted) {
    // Build rosters and advance to placement (skip terrain — TBD)
    const unplacedRoster: Partial<Record<PlayerId, readonly string[]>> = {};
    for (const p of updatedPlayers) {
      unplacedRoster[p.id] = buildRoster(p.armyComposition!, p.factionId!);
    }

    return {
      ...state,
      players: updatedPlayers,
      setupState: {
        ...setup,
        currentStep: 'unitPlacement',
        currentPlayerIndex: 0,
        placementCount: 0,
        batchCount: 0,
        unplacedRoster,
      },
      phase: 'placement',
      currentPlayerId: setup.moveOrder[0], // Player who moves first places first
    };
  }

  return {
    ...state,
    players: updatedPlayers,
    setupState: setup,
  };
}

// ========== Placement Phase ==========

function applyPlaceUnit(state: GameState, action: PlaceUnitAction): GameState {
  if (state.phase !== 'placement') {
    throw new Error('Can only place units during placement phase');
  }
  const setup = state.setupState!;
  if (setup.currentStep !== 'unitPlacement') {
    throw new Error('Not in unit placement step');
  }

  const currentPlacer = setup.moveOrder[setup.currentPlayerIndex];
  if (action.playerId !== currentPlacer) {
    throw new Error(`Not ${action.playerId}'s turn to place units`);
  }

  // Check unit type is in unplaced roster
  const roster = [...(setup.unplacedRoster[action.playerId] ?? [])];
  const typeIndex = roster.indexOf(action.unitTypeId);
  if (typeIndex === -1) {
    throw new Error(`${action.unitTypeId} not in unplaced roster`);
  }

  // Check position is in placement zone
  const cellKey = hexKey(action.position);
  const cell = state.board.cells[cellKey];
  if (!cell) throw new Error('Position is off the board');
  if (cell.placementZonePlayerId !== action.playerId) {
    throw new Error('Position is not in your placement zone');
  }

  // Check position is not occupied
  if (state.units.some(u => hexKey(u.position) === cellKey)) {
    throw new Error('Position is already occupied');
  }

  // Create the unit
  const player = state.players.find(p => p.id === action.playerId)!;
  const unitDef = lookupUnitDef(action.unitTypeId, player.factionId!);
  const unit = createUnit(
    `${action.playerId}_${action.unitTypeId}_${setup.placementCount}`,
    unitDef,
    action.playerId,
    player.factionId!,
    action.position,
  );

  // Remove from roster
  roster.splice(typeIndex, 1);
  const updatedRoster = {
    ...setup.unplacedRoster,
    [action.playerId]: roster,
  };

  const newBatchCount = setup.batchCount + 1;
  const totalPlaced = setup.placementCount + 1;

  // Check if all units placed
  const allRostersEmpty = Object.values(updatedRoster).every(
    r => (r as string[]).length === 0,
  );

  if (allRostersEmpty) {
    // Advance to gameplay
    return {
      ...state,
      units: [...state.units, unit],
      phase: 'gameplay',
      turnNumber: 1,
      currentPlayerId: setup.moveOrder[0],
      setupState: {
        ...setup,
        unplacedRoster: updatedRoster,
        placementCount: totalPlaced,
        batchCount: 0,
      },
    };
  }

  // Check if current player's roster is now empty, or batch of 2 complete — switch to other player
  let nextPlayerIndex = setup.currentPlayerIndex;
  let nextBatchCount = newBatchCount;
  const currentRosterEmpty = roster.length === 0;
  if (newBatchCount >= 2 || currentRosterEmpty) {
    nextPlayerIndex = (setup.currentPlayerIndex + 1) % setup.moveOrder.length;
    nextBatchCount = 0;
    // Skip players with empty rosters
    while ((updatedRoster[setup.moveOrder[nextPlayerIndex]] as string[]).length === 0) {
      nextPlayerIndex = (nextPlayerIndex + 1) % setup.moveOrder.length;
    }
  }

  return {
    ...state,
    units: [...state.units, unit],
    setupState: {
      ...setup,
      placementCount: totalPlaced,
      batchCount: nextBatchCount,
      currentPlayerIndex: nextPlayerIndex,
      unplacedRoster: updatedRoster,
    },
    currentPlayerId: setup.moveOrder[nextPlayerIndex],
  };
}

// ========== Gameplay Phase ==========

function applyMoveAction(state: GameState, action: MoveAction): GameState {
  requireGameplay(state);
  const unit = getUnit(state, action.unitId);
  requireCurrentPlayer(state, unit.playerId);
  requireActivatable(state, unit);

  const validation = validateMove(unit, action.to, state.board, state.units);
  if (!validation.valid) throw new Error(validation.reason!);

  const movedUnit = applyMove(unit, action.to, validation.distance!);
  const updatedUnit = ensureActivated(movedUnit);

  return {
    ...state,
    units: replaceUnit(state.units, updatedUnit),
    activeUnitId: updatedUnit.id,
  };
}

function applyAttackAction(state: GameState, action: AttackAction): GameState {
  requireGameplay(state);
  const attacker = getUnit(state, action.unitId);
  const target = getUnit(state, action.targetId);
  requireCurrentPlayer(state, attacker.playerId);
  requireActivatable(state, attacker);

  // Get unit definition for attack profile
  const player = state.players.find(p => p.id === attacker.playerId)!;
  const attackerDef = lookupUnitDef(attacker.typeId, player.factionId!);
  const profile = attackerDef.attack;

  const attackValidation = validateAttack(attacker, target, profile);
  if (!attackValidation.valid) throw new Error(attackValidation.reason!);

  // Get ability modifiers
  const attackCtx = { unit: attacker, state, allUnits: state.units };
  const defenseCtx = { unit: target, state, allUnits: state.units };
  const attackMods = getAttackModifiers(attackCtx, target);
  const defenseMods = getDefenseModifiers(defenseCtx, attacker);

  if (defenseMods.blockAttack) {
    throw new Error('Attack blocked by target ability');
  }
  if (attackMods.blockAttack) {
    throw new Error('Attack blocked by attacker ability');
  }

  const rng = SeededRNG.fromState(state.rngSeed, state.rngState);
  const effectiveProfile = attackMods.overrideProfile ?? profile;
  const toHitMod = (attackMods.toHitModifier ?? 0) + (defenseMods.toHitModifier ?? 0);
  const damageMod = (attackMods.damageModifier ?? 0) + (defenseMods.damageModifier ?? 0);

  const combat = resolveCombat(attacker, target, effectiveProfile, rng, toHitMod, damageMod);

  let updatedAttacker = ensureActivated(combat.updatedAttacker);
  const updatedTarget = combat.updatedTarget;

  let units = replaceUnit(state.units, updatedAttacker);
  units = replaceUnit(units, updatedTarget);

  let newState: GameState = {
    ...state,
    units,
    rngState: rng.getState(),
    activeUnitId: updatedAttacker.id,
  };

  // Check immediate win: all enemy units defeated
  if (combat.targetKilled) {
    const winCheck = checkAllUnitsDefeated(newState);
    if (winCheck) {
      return { ...newState, ...winCheck };
    }
  }

  return newState;
}

function applyEndUnitTurn(state: GameState, action: EndUnitTurnAction): GameState {
  requireGameplay(state);
  const unit = getUnit(state, action.unitId);
  requireCurrentPlayer(state, unit.playerId);

  if (unit.activatedThisTurn) {
    throw new Error('Unit has already been activated this turn');
  }

  if (state.activeUnitId && state.activeUnitId !== action.unitId) {
    throw new Error(`Cannot end turn for ${action.unitId} while ${state.activeUnitId} is active`);
  }

  const updatedUnit: Unit = {
    ...unit,
    activatedThisTurn: true,
    hasMovedThisTurn: true,
    hasAttackedThisTurn: true,
    hasUsedAbilityThisTurn: true,
  };

  return {
    ...state,
    units: replaceUnit(state.units, updatedUnit),
    activeUnitId: undefined,
  };
}

function applyEndTurn(state: GameState): GameState {
  requireGameplay(state);

  // Reset all current player's units for next activation
  const currentPlayer = state.currentPlayerId;
  const nextPlayerIndex = getNextPlayerIndex(state);
  const nextPlayer = state.players[nextPlayerIndex].id;

  // Reset next player's unit flags (they're about to take their turn)
  const units = state.units.map(u => {
    if (u.playerId === nextPlayer && u.currentHp > 0) {
      return {
        ...u,
        hasMovedThisTurn: false,
        hasAttackedThisTurn: false,
        hasUsedAbilityThisTurn: false,
        movementUsedThisTurn: 0,
        activatedThisTurn: false,
      };
    }
    return u;
  });

  const nextTurnNumber = state.turnNumber + (nextPlayerIndex === 0 ? 1 : 0);

  let newState: GameState = {
    ...state,
    units,
    currentPlayerId: nextPlayer,
    turnNumber: nextTurnNumber,
    activeUnitId: undefined,
  };

  // Check base control at start of new player's turn
  newState = checkBaseControl(newState);

  if (newState.winner) return newState;

  return newState;
}

function applySurrender(state: GameState, action: SurrenderAction): GameState {
  const otherPlayers = state.players.filter(p => p.id !== action.playerId);
  if (otherPlayers.length !== 1) {
    throw new Error('Surrender only supported in 2-player games');
  }

  return {
    ...state,
    phase: 'victory',
    winner: otherPlayers[0].id,
    winCondition: 'surrender',
  };
}

// ========== Win Condition Checks ==========

function checkAllUnitsDefeated(state: GameState): { phase: 'victory'; winner: PlayerId; winCondition: WinCondition } | null {
  for (const player of state.players) {
    const aliveUnits = state.units.filter(u => u.playerId === player.id && u.currentHp > 0);
    if (aliveUnits.length === 0) {
      // This player lost — find the winner (the other player in 2p)
      const winner = state.players.find(p => p.id !== player.id)!;
      return { phase: 'victory', winner: winner.id, winCondition: 'all_units_defeated' };
    }
  }
  return null;
}

function checkBaseControl(state: GameState): GameState {
  const updatedTimers = { ...state.baseControlTimers };

  for (const player of state.players) {
    // Check if current player controls any opponent's base
    if (player.id !== state.currentPlayerId) continue;

    for (const opponent of state.players) {
      if (opponent.id === player.id) continue;

      const baseCells = getBaseCells(state.board, opponent.id);
      const baseKeys = new Set(baseCells.map(c => hexKey(c.coord)));

      const attackersInBase = state.units.filter(u =>
        u.currentHp > 0 && u.playerId === player.id && baseKeys.has(hexKey(u.position)),
      );
      const defendersInBase = state.units.filter(u =>
        u.currentHp > 0 && u.playerId === opponent.id && baseKeys.has(hexKey(u.position)),
      );

      if (attackersInBase.length > 0 && defendersInBase.length === 0) {
        // Attacker controls — increment timer
        updatedTimers[player.id] = (updatedTimers[player.id] ?? 0) + 1;

        // Check win threshold
        const threshold = player.factionId === 'mongols'
          ? MONGOL_BASE_CONTROL_TURNS_TO_WIN
          : BASE_CONTROL_TURNS_TO_WIN;

        if (updatedTimers[player.id] >= threshold) {
          return {
            ...state,
            phase: 'victory',
            winner: player.id,
            winCondition: 'base_control',
            baseControlTimers: updatedTimers,
          };
        }
      } else if (attackersInBase.length === 0) {
        // No attackers — reset timer
        updatedTimers[player.id] = 0;
      }
      // If defenders present but attackers too — timer pauses (no change)
    }
  }

  return { ...state, baseControlTimers: updatedTimers };
}

// ========== Helpers ==========

function requireSetup(state: GameState, step: string): SetupState {
  if (state.phase !== 'setup') throw new Error('Not in setup phase');
  if (!state.setupState) throw new Error('No setup state');
  if (state.setupState.currentStep !== step) {
    throw new Error(`Expected step ${step}, got ${state.setupState.currentStep}`);
  }
  return state.setupState;
}

function requireGameplay(state: GameState): void {
  if (state.phase !== 'gameplay') throw new Error('Not in gameplay phase');
  if (state.winner) throw new Error('Game is already over');
}

function requireCurrentPlayer(state: GameState, playerId: PlayerId): void {
  if (playerId !== state.currentPlayerId) {
    throw new Error(`Not ${playerId}'s turn`);
  }
}

function requireActivatable(state: GameState, unit: Unit): void {
  if (unit.currentHp <= 0) throw new Error('Unit is dead');
  if (unit.activatedThisTurn) throw new Error('Unit has already been activated this turn');
  if (state.activeUnitId && state.activeUnitId !== unit.id) {
    throw new Error(`Another unit (${state.activeUnitId}) is currently active`);
  }
}

function getUnit(state: GameState, unitId: string): Unit {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit) throw new Error(`Unit not found: ${unitId}`);
  return unit;
}

function replaceUnit(units: readonly Unit[], updated: Unit): Unit[] {
  return units.map(u => u.id === updated.id ? updated : u);
}

function ensureActivated(unit: Unit): Unit {
  return unit.activatedThisTurn ? unit : { ...unit, activatedThisTurn: false };
}

function getNextPlayerIndex(state: GameState): number {
  const currentIndex = state.players.findIndex(p => p.id === state.currentPlayerId);
  return (currentIndex + 1) % state.players.length;
}

function validateArmyComposition(comp: ArmyComposition, factionId: FactionId): void {
  const totalBasic = comp.basicMelee + comp.basicRanged;
  if (totalBasic !== DEFAULT_ARMY_LIMITS.basic) {
    throw new Error(`Basic units must total ${DEFAULT_ARMY_LIMITS.basic}, got ${totalBasic}`);
  }
  if (comp.specialtyChoices.length !== DEFAULT_ARMY_LIMITS.specialty) {
    throw new Error(`Must choose ${DEFAULT_ARMY_LIMITS.specialty} specialty units, got ${comp.specialtyChoices.length}`);
  }
  // Validate specialty choices are valid for faction
  const faction = getFaction(factionId);
  for (const typeId of comp.specialtyChoices) {
    if (!faction.specialtyTypeIds.includes(typeId)) {
      throw new Error(`${typeId} is not a valid specialty unit for ${factionId}`);
    }
  }
}

function buildRoster(comp: ArmyComposition, factionId: FactionId): string[] {
  const roster: string[] = [];
  for (let i = 0; i < comp.basicMelee; i++) roster.push('basic_melee');
  for (let i = 0; i < comp.basicRanged; i++) roster.push('basic_ranged');
  for (const typeId of comp.specialtyChoices) roster.push(typeId);
  // Leader is always included
  const faction = getFaction(factionId);
  roster.push(faction.leaderTypeId);
  return roster;
}

function lookupUnitDef(typeId: string, factionId: FactionId) {
  if (typeId === 'basic_melee') return BASIC_MELEE;
  if (typeId === 'basic_ranged') return BASIC_RANGED;
  const def = getUnitDef(factionId, typeId);
  if (!def) throw new Error(`Unknown unit type: ${typeId} for faction ${factionId}`);
  return def;
}

function createUnit(
  id: string,
  def: { typeId: string; hp: number; movement: number; category: import('./types.js').UnitCategory; abilityId?: string },
  playerId: PlayerId,
  factionId: FactionId,
  position: CubeCoord,
): Unit {
  return {
    id,
    typeId: def.typeId,
    playerId,
    factionId,
    category: def.category,
    position,
    currentHp: def.hp,
    maxHp: def.hp,
    movement: def.movement,
    hasMovedThisTurn: false,
    hasAttackedThisTurn: false,
    hasUsedAbilityThisTurn: false,
    movementUsedThisTurn: 0,
    activatedThisTurn: false,
    abilityState: def.abilityId ? { abilityId: def.abilityId } : {},
  };
}
