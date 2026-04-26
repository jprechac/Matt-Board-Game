import type {
  GameState, Action, PlayerId, BoardSize, CubeCoord,
  SetupState, PlayerState, Unit, ArmyComposition,
  MoveAction, AttackAction, PlaceUnitAction, EndUnitTurnAction,
  SelectFactionAction, SetArmyCompositionAction, ChoosePriorityAction,
  SurrenderAction, WinCondition, FactionId, HealAction, AbilityAction,
} from './types.js';
import {
  DEFAULT_ARMY_LIMITS, BASE_CONTROL_TURNS_TO_WIN,
  MONGOL_BASE_CONTROL_TURNS_TO_WIN,
} from './types.js';
import type { GameEvent } from './events.js';
import { createBoard, getBaseCells } from './board.js';
import { hexKey, cubeDistance, cubeNeighbors } from './hex.js';
import { SeededRNG } from './rng.js';
import { validateMove, applyMove, getAvailableMovement } from './movement.js';
import { resolveCombat, resolveAttack, validateAttack, resolveHeal } from './combat.js';
import { getFaction, getUnitDef } from './data/factions/index.js';
import { BASIC_MELEE, BASIC_RANGED } from './data/basic-units.js';
import { getAttackModifiers, getDefenseModifiers, getAbility } from './abilities/index.js';

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

// ========== Internal Result Type ==========

interface ActionResult {
  readonly state: GameState;
  readonly events: GameEvent[];
}

// ========== Action Dispatch ==========

/** Apply an action and return only the new state (existing public API). */
export function applyAction(state: GameState, action: Action): GameState {
  return applyActionDetailed(state, action).state;
}

/** Apply an action and return both the new state and emitted events. */
export function applyActionDetailed(state: GameState, action: Action): ActionResult {
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
    case 'heal':
      return applyHealAction(state, action);
    case 'endUnitTurn':
      return applyEndUnitTurn(state, action);
    case 'endTurn':
      return applyEndTurn(state);
    case 'surrender':
      return applySurrender(state, action);
    case 'ability':
      return applyAbilityAction(state, action);
    case 'placeTerrain':
      throw new Error('Terrain placement not yet implemented');
    default:
      throw new Error(`Unknown action type: ${(action as Action).type}`);
  }
}

// ========== Setup Phase ==========

function applyChoosePriority(state: GameState, action: ChoosePriorityAction): ActionResult {
  const setup = state.setupState!;

  if (setup.currentStep === 'choosePriority') {
    // Winner's turn: choose which order to control and their position in it
    if (action.playerId !== setup.rollWinner) {
      throw new Error(`Only the roll winner (${setup.rollWinner}) can choose priority`);
    }
    if (!action.orderToControl) {
      throw new Error('Winner must specify orderToControl');
    }

    const otherPlayer = state.players.find(p => p.id !== action.playerId)!.id;

    const newState: GameState = {
      ...state,
      currentPlayerId: otherPlayer,
      setupState: {
        ...setup,
        currentStep: 'loserChoosePriority',
        winnerOrderChoice: action.orderToControl,
        winnerPosition: action.position,
      },
    };

    return {
      state: newState,
      events: [{
        type: 'priorityChosen',
        turnNumber: 0,
        playerId: action.playerId,
        orderControlled: action.orderToControl,
        position: action.position,
      }],
    };
  } else if (setup.currentStep === 'loserChoosePriority') {
    // Loser's turn: choose their position in the remaining order
    if (action.playerId === setup.rollWinner) {
      throw new Error('Only the loser can choose priority in this step');
    }

    const winnerId = setup.rollWinner!;
    const loserId = action.playerId;
    const winnerOrder = setup.winnerOrderChoice!;
    const winnerPos = setup.winnerPosition!;
    const loserPos = action.position;

    // Build the two orders
    const winnerOrderArr = winnerPos === 'first' ? [winnerId, loserId] : [loserId, winnerId];
    const loserOrderArr = loserPos === 'first' ? [loserId, winnerId] : [winnerId, loserId];

    let factionSelectionOrder: PlayerId[];
    let moveOrder: PlayerId[];

    if (winnerOrder === 'factionOrder') {
      factionSelectionOrder = winnerOrderArr;
      moveOrder = loserOrderArr;
    } else {
      moveOrder = winnerOrderArr;
      factionSelectionOrder = loserOrderArr;
    }

    const remainingOrder: 'factionOrder' | 'moveOrder' =
      winnerOrder === 'factionOrder' ? 'moveOrder' : 'factionOrder';

    const newState: GameState = {
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

    return {
      state: newState,
      events: [{
        type: 'priorityChosen',
        turnNumber: 0,
        playerId: action.playerId,
        orderControlled: remainingOrder,
        position: action.position,
      }],
    };
  }

  throw new Error(`Not in a choosePriority step (current: ${setup.currentStep})`);
}

function applySelectFaction(state: GameState, action: SelectFactionAction): ActionResult {
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

  const newState: GameState = {
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

  return {
    state: newState,
    events: [{
      type: 'factionSelected',
      turnNumber: 0,
      playerId: action.playerId,
      factionId: action.factionId,
    }],
  };
}

function applySetArmyComposition(state: GameState, action: SetArmyCompositionAction): ActionResult {
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

  const events: GameEvent[] = [{
    type: 'armyCompositionSet',
    turnNumber: 0,
    playerId: action.playerId,
    composition: action.composition,
  }];

  const allSubmitted = updatedPlayers.every(p => p.armyComposition);

  if (allSubmitted) {
    // Build rosters and advance to placement (skip terrain — TBD)
    const unplacedRoster: Partial<Record<PlayerId, readonly string[]>> = {};
    for (const p of updatedPlayers) {
      unplacedRoster[p.id] = buildRoster(p.armyComposition!, p.factionId!);
    }

    return {
      state: {
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
      },
      events,
    };
  }

  return {
    state: {
      ...state,
      players: updatedPlayers,
      setupState: setup,
    },
    events,
  };
}

// ========== Placement Phase ==========

function applyPlaceUnit(state: GameState, action: PlaceUnitAction): ActionResult {
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

  const events: GameEvent[] = [{
    type: 'unitPlaced',
    turnNumber: 0,
    playerId: action.playerId,
    unitId: unit.id,
    unitTypeId: action.unitTypeId,
    position: action.position,
  }];

  // Check if all units placed
  const allRostersEmpty = Object.values(updatedRoster).every(
    r => (r as string[]).length === 0,
  );

  if (allRostersEmpty) {
    events.push({ type: 'placementComplete', turnNumber: 0 });
    events.push({
      type: 'turnStarted',
      turnNumber: 1,
      playerId: setup.moveOrder[0],
    });

    return {
      state: {
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
      },
      events,
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
    state: {
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
    },
    events,
  };
}

// ========== Gameplay Phase ==========

function applyMoveAction(state: GameState, action: MoveAction): ActionResult {
  requireGameplay(state);
  const unit = getUnit(state, action.unitId);
  requireCurrentPlayer(state, unit.playerId);
  requireActivatable(state, unit);

  const validation = validateMove(unit, action.to, state.board, state.units);
  if (!validation.valid) throw new Error(validation.reason!);

  const from = unit.position;
  const movedUnit = applyMove(unit, action.to, validation.distance!);
  const updatedUnit = ensureActivated(movedUnit);

  return {
    state: {
      ...state,
      units: replaceUnit(state.units, updatedUnit),
      activeUnitId: updatedUnit.id,
    },
    events: [{
      type: 'unitMoved',
      turnNumber: state.turnNumber,
      playerId: unit.playerId,
      unitId: unit.id,
      from,
      to: action.to,
      distance: validation.distance!,
    }],
  };
}

function applyAttackAction(state: GameState, action: AttackAction): ActionResult {
  requireGameplay(state);
  const attacker = getUnit(state, action.unitId);
  const originalTarget = getUnit(state, action.targetId);
  requireCurrentPlayer(state, attacker.playerId);
  requireActivatable(state, attacker);

  // Get unit definition for attack profile
  const player = state.players.find(p => p.id === attacker.playerId)!;
  const attackerDef = lookupUnitDef(attacker.typeId, player.factionId!);
  const profile = attackerDef.attack;

  const attackValidation = validateAttack(attacker, originalTarget, profile);
  if (!attackValidation.valid) throw new Error(attackValidation.reason!);

  // Get ability modifiers
  const attackCtx = { unit: attacker, state, allUnits: state.units };
  const defenseCtx = { unit: originalTarget, state, allUnits: state.units };
  const attackMods = getAttackModifiers(attackCtx, originalTarget);
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

  // Roll the attack (separate from applying damage, to allow redirect)
  const rollResult = resolveAttack(effectiveProfile, attacker.position, originalTarget.position, rng, toHitMod, damageMod);

  // Check for Caesar's redirect_attack ability
  const redirectResult = tryRedirectAttack(state, attacker, originalTarget, profile.range);
  let actualTarget = originalTarget;
  const events: GameEvent[] = [];

  if (redirectResult && rollResult.hit) {
    actualTarget = redirectResult.newTarget;
    events.push({
      type: 'attackRedirected',
      turnNumber: state.turnNumber,
      playerId: originalTarget.playerId,
      redirectedBy: redirectResult.caesarId,
      originalTargetId: originalTarget.id,
      newTargetId: actualTarget.id,
      attackerId: attacker.id,
    });
  }

  // Apply damage to the actual target
  const newTargetHp = Math.max(0, actualTarget.currentHp - rollResult.damage);
  const updatedTarget: Unit = { ...actualTarget, currentHp: newTargetHp };
  const targetKilled = newTargetHp <= 0;

  let updatedAttacker = ensureActivated({
    ...attacker,
    hasAttackedThisTurn: true,
    movementUsedAtAttack: attacker.movementUsedThisTurn,
  });

  let units = replaceUnit(state.units, updatedAttacker);
  units = replaceUnit(units, updatedTarget);

  // Mark Caesar's redirect as used this turn
  if (redirectResult && rollResult.hit) {
    const caesar = units.find(u => u.id === redirectResult.caesarId)!;
    const updatedCaesar: Unit = {
      ...caesar,
      abilityState: { ...caesar.abilityState, redirectUsedThisTurn: true },
    };
    units = replaceUnit(units, updatedCaesar);
  }

  let newState: GameState = {
    ...state,
    units,
    rngState: rng.getState(),
    activeUnitId: updatedAttacker.id,
  };

  events.push({
    type: 'attackResolved',
    turnNumber: state.turnNumber,
    playerId: attacker.playerId,
    attackerId: attacker.id,
    targetId: actualTarget.id,
    roll: rollResult.roll,
    effectiveToHit: rollResult.effectiveToHit,
    hit: rollResult.hit,
    crit: rollResult.crit,
    damage: rollResult.damage,
    targetHpAfter: updatedTarget.currentHp,
    targetKilled,
  });

  if (targetKilled) {
    events.push({
      type: 'unitKilled',
      turnNumber: state.turnNumber,
      playerId: actualTarget.playerId,
      unitId: actualTarget.id,
      killedBy: attacker.id,
    });
  }

  // Check immediate win: all enemy units defeated
  if (targetKilled) {
    const winCheck = checkAllUnitsDefeated(newState);
    if (winCheck) {
      newState = { ...newState, ...winCheck };
      events.push({
        type: 'gameWon',
        turnNumber: state.turnNumber,
        winner: winCheck.winner,
        winCondition: winCheck.winCondition,
      });
    }
  }

  return { state: newState, events };
}

/**
 * Check if the defending player has a living Caesar with unused redirect.
 * Returns the redirect target if applicable, null otherwise.
 * Melee attacks: Roman-favorable heuristic (highest HP ally adjacent to target).
 * Ranged attacks: Attacker-favorable heuristic (lowest HP ally adjacent to target).
 */
function tryRedirectAttack(
  state: GameState,
  attacker: Unit,
  target: Unit,
  attackRange: number,
): { newTarget: Unit; caesarId: string } | null {
  // Find a living Caesar on the defending side with unused redirect
  const caesar = state.units.find(u =>
    u.playerId === target.playerId &&
    u.currentHp > 0 &&
    (u.abilityState?.abilityId as string) === 'redirect_attack' &&
    !(u.abilityState?.redirectUsedThisTurn as boolean),
  );
  if (!caesar) return null;

  // Check canActivate
  const handler = getAbility('redirect_attack');
  if (!handler?.canActivate) return null;
  const ctx = { unit: caesar, state, allUnits: state.units };
  if (!handler.canActivate(ctx)) return null;

  // Find valid redirect targets: allies adjacent to the original target (not the target itself)
  const targetNeighbors = cubeNeighbors(target.position);
  const adjacentAllies = state.units.filter(u =>
    u.currentHp > 0 &&
    u.playerId === target.playerId &&
    u.id !== target.id &&
    targetNeighbors.some(n => hexKey(n) === hexKey(u.position)),
  );
  if (adjacentAllies.length === 0) return null;

  // Select redirect target based on attack type
  let redirectTarget: Unit;
  if (attackRange <= 1) {
    // Melee: Roman player chooses → highest HP ally (minimize risk)
    redirectTarget = adjacentAllies.reduce((best, u) =>
      u.currentHp > best.currentHp ? u : best,
    );
  } else {
    // Ranged: attacking player chooses → lowest HP ally (maximize damage)
    redirectTarget = adjacentAllies.reduce((best, u) =>
      u.currentHp < best.currentHp ? u : best,
    );
  }

  return { newTarget: redirectTarget, caesarId: caesar.id };
}

function applyHealAction(state: GameState, action: HealAction): ActionResult {
  requireGameplay(state);
  const healer = getUnit(state, action.unitId);
  const target = getUnit(state, action.targetId);
  requireCurrentPlayer(state, healer.playerId);
  requireActivatable(state, healer);

  // Validate healer has medic_heal ability
  const player = state.players.find(p => p.id === healer.playerId)!;
  const healerDef = lookupUnitDef(healer.typeId, player.factionId!);
  if (healerDef.abilityId !== 'medic_heal') {
    throw new Error('Unit cannot heal');
  }
  if (healer.hasAttackedThisTurn) throw new Error('Unit has already attacked this turn');
  if (healer.hasUsedAbilityThisTurn) throw new Error('Unit has already used ability this turn');

  // Validate target
  if (target.currentHp <= 0) throw new Error('Target is dead');
  if (target.playerId !== healer.playerId) throw new Error('Can only heal friendly units');
  if (target.currentHp >= target.maxHp) throw new Error('Target is at full health');
  if (cubeDistance(healer.position, target.position) !== 1) throw new Error('Target must be adjacent');

  const params = healerDef.abilityParams ?? {};
  const healThreshold = (params.healThreshold as number) ?? healerDef.attack.toHit;
  const enhancedThreshold = (params.enhancedThreshold as number) ?? 8;
  const healAmount = (params.healAmount as number) ?? 1;
  const enhancedHealAmount = (params.enhancedHealAmount as number) ?? 2;

  const rng = SeededRNG.fromState(state.rngSeed, state.rngState);
  const result = resolveHeal(healThreshold, enhancedThreshold, healAmount, enhancedHealAmount, target, rng);

  const updatedTarget: Unit = {
    ...target,
    currentHp: target.currentHp + result.healAmount,
  };

  const updatedHealer: Unit = {
    ...healer,
    hasUsedAbilityThisTurn: true,
    hasAttackedThisTurn: true, // heal and attack are mutually exclusive
  };

  let units = replaceUnit(state.units, updatedHealer);
  units = replaceUnit(units, updatedTarget);

  const newState: GameState = {
    ...state,
    units,
    rngState: rng.getState(),
    activeUnitId: updatedHealer.id,
  };

  const events: GameEvent[] = [{
    type: 'healResolved',
    turnNumber: state.turnNumber,
    playerId: healer.playerId,
    healerId: healer.id,
    targetId: target.id,
    roll: result.roll,
    healed: result.healed,
    healAmount: result.healAmount,
    targetHpAfter: updatedTarget.currentHp,
  }];

  return { state: newState, events };
}

// ========== Upgrade Unit Ability (King Arthur) ==========

/** Upgrade mapping: basic type → specialty type for the English faction */
const UPGRADE_MAP: Record<string, string> = {
  basic_melee: 'knight',
  basic_ranged: 'longbowman',
};

function applyAbilityAction(state: GameState, action: AbilityAction): ActionResult {
  if (action.abilityId === 'upgrade_unit') {
    return applyUpgradeAbility(state, action);
  }
  throw new Error(`Ability action not implemented: ${action.abilityId}`);
}

function applyUpgradeAbility(state: GameState, action: AbilityAction): ActionResult {
  requireGameplay(state);
  const arthur = getUnit(state, action.unitId);
  requireCurrentPlayer(state, arthur.playerId);
  requireActivatable(state, arthur);

  const player = state.players.find(p => p.id === arthur.playerId)!;
  const arthurDef = lookupUnitDef(arthur.typeId, player.factionId!);
  if (arthurDef.abilityId !== 'upgrade_unit') {
    throw new Error('Unit does not have upgrade ability');
  }
  if (arthur.hasUsedAbilityThisTurn) throw new Error('Ability already used this turn');

  // Check once-per-round cooldown
  const handler = getAbility('upgrade_unit');
  if (handler?.canActivate) {
    const ctx = { unit: arthur, state, allUnits: state.units };
    if (!handler.canActivate(ctx)) {
      throw new Error('Upgrade ability is on cooldown (once per round)');
    }
  }

  // Get target from params
  const targetId = action.params?.targetId as string;
  if (!targetId) throw new Error('Upgrade requires a target unit');

  const target = getUnit(state, targetId);
  if (target.playerId !== arthur.playerId) throw new Error('Can only upgrade friendly units');
  if (target.category !== 'basic') throw new Error('Can only upgrade basic units');
  if (target.currentHp < target.maxHp) throw new Error('Can only upgrade units at full HP');
  if (cubeDistance(arthur.position, target.position) !== 1) throw new Error('Target must be adjacent to Arthur');

  // Determine upgrade type
  const newTypeId = UPGRADE_MAP[target.typeId];
  if (!newTypeId) throw new Error(`No upgrade path for unit type: ${target.typeId}`);

  const newDef = getUnitDef(player.factionId!, newTypeId);
  if (!newDef) throw new Error(`Unknown specialty unit: ${newTypeId}`);

  // Transform the unit
  const upgradedUnit: Unit = {
    ...target,
    typeId: newDef.typeId,
    category: newDef.category,
    currentHp: newDef.hp,
    maxHp: newDef.hp,
    movement: newDef.movement,
    abilityState: newDef.abilityId ? { abilityId: newDef.abilityId } : {},
  };

  // Update Arthur's ability state
  const updatedArthur: Unit = {
    ...arthur,
    hasUsedAbilityThisTurn: true,
    abilityState: {
      ...arthur.abilityState,
      lastUpgradeTurnNumber: state.turnNumber,
    },
  };

  let units = replaceUnit(state.units, updatedArthur);
  units = replaceUnit(units, upgradedUnit);

  const newState: GameState = {
    ...state,
    units,
    activeUnitId: updatedArthur.id,
  };

  const events: GameEvent[] = [{
    type: 'unitUpgraded',
    turnNumber: state.turnNumber,
    playerId: arthur.playerId,
    upgradedBy: arthur.id,
    unitId: target.id,
    fromTypeId: target.typeId,
    toTypeId: newDef.typeId,
  }];

  return { state: newState, events };
}

function applyEndUnitTurn(state: GameState, action: EndUnitTurnAction): ActionResult {
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
    state: {
      ...state,
      units: replaceUnit(state.units, updatedUnit),
      activeUnitId: undefined,
    },
    events: [{
      type: 'unitTurnEnded',
      turnNumber: state.turnNumber,
      playerId: unit.playerId,
      unitId: unit.id,
    }],
  };
}

function applyEndTurn(state: GameState): ActionResult {
  requireGameplay(state);

  const currentPlayer = state.currentPlayerId;
  const nextPlayerIndex = getNextPlayerIndex(state);
  const nextPlayer = state.players[nextPlayerIndex].id;

  // Reset next player's unit flags (they're about to take their turn)
  const units = state.units.map(u => {
    if (u.playerId === nextPlayer && u.currentHp > 0) {
      const resetAbilityState = { ...u.abilityState };
      // Reset per-turn ability flags
      if (resetAbilityState.redirectUsedThisTurn !== undefined) {
        resetAbilityState.redirectUsedThisTurn = false;
      }
      return {
        ...u,
        hasMovedThisTurn: false,
        hasAttackedThisTurn: false,
        hasUsedAbilityThisTurn: false,
        movementUsedThisTurn: 0,
        movementUsedAtAttack: 0,
        activatedThisTurn: false,
        abilityState: resetAbilityState,
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

  const events: GameEvent[] = [
    { type: 'turnEnded', turnNumber: state.turnNumber, playerId: currentPlayer },
    { type: 'turnStarted', turnNumber: nextTurnNumber, playerId: nextPlayer },
  ];

  // Check base control at start of new player's turn
  const baseResult = checkBaseControl(newState);
  newState = baseResult.state;
  events.push(...baseResult.events);

  return { state: newState, events };
}

function applySurrender(state: GameState, action: SurrenderAction): ActionResult {
  const otherPlayers = state.players.filter(p => p.id !== action.playerId);
  if (otherPlayers.length !== 1) {
    throw new Error('Surrender only supported in 2-player games');
  }

  return {
    state: {
      ...state,
      phase: 'victory',
      winner: otherPlayers[0].id,
      winCondition: 'surrender',
    },
    events: [
      { type: 'surrender', turnNumber: state.turnNumber, playerId: action.playerId },
      {
        type: 'gameWon',
        turnNumber: state.turnNumber,
        winner: otherPlayers[0].id,
        winCondition: 'surrender' as const,
      },
    ],
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

function checkBaseControl(state: GameState): { state: GameState; events: GameEvent[] } {
  const updatedTimers = { ...state.baseControlTimers };
  const events: GameEvent[] = [];

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

        events.push({
          type: 'baseControlChanged',
          turnNumber: state.turnNumber,
          playerId: player.id,
          baseOwnerId: opponent.id,
          timerValue: updatedTimers[player.id],
          timerReset: false,
        });

        // Check win threshold
        const threshold = player.factionId === 'mongols'
          ? MONGOL_BASE_CONTROL_TURNS_TO_WIN
          : BASE_CONTROL_TURNS_TO_WIN;

        if (updatedTimers[player.id] >= threshold) {
          const winState: GameState = {
            ...state,
            phase: 'victory',
            winner: player.id,
            winCondition: 'base_control',
            baseControlTimers: updatedTimers,
          };
          events.push({
            type: 'gameWon',
            turnNumber: state.turnNumber,
            winner: player.id,
            winCondition: 'base_control',
          });
          return { state: winState, events };
        }
      } else if (attackersInBase.length === 0 && updatedTimers[player.id] > 0) {
        // No attackers and timer was running — reset
        updatedTimers[player.id] = 0;
        events.push({
          type: 'baseControlChanged',
          turnNumber: state.turnNumber,
          playerId: player.id,
          baseOwnerId: opponent.id,
          timerValue: 0,
          timerReset: true,
        });
      }
      // If defenders present but attackers too — timer pauses (no change)
    }
  }

  return { state: { ...state, baseControlTimers: updatedTimers }, events };
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
  // Identity — activation tracking is handled by activeUnitId (current) and
  // activatedThisTurn (exhausted, set by endUnitTurn). This hook exists for
  // potential future per-unit activation logic.
  return unit;
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
    movementUsedAtAttack: 0,
    activatedThisTurn: false,
    abilityState: def.abilityId ? { abilityId: def.abilityId } : {},
  };
}
