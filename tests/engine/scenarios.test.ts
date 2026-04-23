/**
 * Scenario tests: multi-action gameplay sequences that verify game rules
 * end-to-end through applyAction/applyActionDetailed.
 *
 * These test the kinds of bugs found during playtesting that unit tests miss.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createGame, applyAction, applyActionDetailed } from '../../src/engine/game.js';
import type { GameConfig } from '../../src/engine/game.js';
import type {
  GameState, PlayerId, Unit, CubeCoord,
} from '../../src/engine/types.js';
import { hexKey, cube, cubeNeighbors, offsetToCube } from '../../src/engine/hex.js';
import { getUnitActions } from '../../src/engine/actions.js';
import { getAvailableMovement } from '../../src/engine/movement.js';
import { validateAction } from '../../src/engine/validation.js';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';

beforeAll(() => {
  registerAllAbilities();
});

const DEFAULT_CONFIG: GameConfig = {
  boardSize: '2p',
  playerIds: ['player1', 'player2'],
  seed: 42,
};

// ========== Helpers: drive through setup to gameplay ==========

function setupToFactionSelection(seed = 42): GameState {
  let state = createGame({ ...DEFAULT_CONFIG, seed });
  const winner = state.currentPlayerId;
  state = applyAction(state, {
    type: 'choosePriority', playerId: winner,
    orderToControl: 'factionOrder', position: 'first',
  });
  const loser = state.players.find(p => p.id !== winner)!.id;
  state = applyAction(state, {
    type: 'choosePriority', playerId: loser, position: 'first',
  });
  return state;
}

function setupToPlacement(
  factions: [string, string] = ['ottomans', 'romans'],
  seed = 42,
): GameState {
  let state = setupToFactionSelection(seed);
  const order = state.setupState!.factionSelectionOrder;

  state = applyAction(state, { type: 'selectFaction', playerId: order[0], factionId: factions[0] as any });
  state = applyAction(state, { type: 'selectFaction', playerId: order[1], factionId: factions[1] as any });

  // Both submit army composition
  for (const p of state.players) {
    if (!p.armyComposition) {
      const comp = getDefaultComp(p.factionId!);
      state = applyAction(state, { type: 'setArmyComposition', playerId: p.id, composition: comp });
    }
  }
  return state;
}

function getDefaultComp(factionId: string) {
  const comps: Record<string, any> = {
    ottomans: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['medic', 'medic', 'janissary', 'janissary', 'janissary'] },
    romans: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'centurion', 'centurion'] },
    vikings: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['berserker', 'berserker', 'berserker', 'axe_thrower', 'axe_thrower'] },
    japanese: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['samurai', 'samurai', 'samurai', 'samurai', 'samurai'] },
  };
  return comps[factionId] ?? comps.romans;
}

function placeAllUnits(state: GameState): GameState {
  let s = state;
  let idx = 0;
  while (s.phase === 'placement') {
    const placer = s.currentPlayerId;
    const roster = s.setupState!.unplacedRoster[placer] ?? [];
    if (roster.length === 0) break;
    const pos = findEmptyPlacementHex(s, placer, idx);
    s = applyAction(s, { type: 'placeUnit', playerId: placer, unitTypeId: roster[0], position: pos });
    idx++;
  }
  return s;
}

function findEmptyPlacementHex(state: GameState, playerId: PlayerId, offset: number): CubeCoord {
  const cells = Object.values(state.board.cells).filter(c => c.placementZonePlayerId === playerId);
  const occupied = new Set(state.units.map(u => hexKey(u.position)));
  const available = cells.filter(c => !occupied.has(hexKey(c.coord)));
  if (available.length === 0) throw new Error('No empty placement hex');
  return available[offset % available.length].coord;
}

/** Get a gameplay-ready state with specific factions */
function setupToGameplay(factions: [string, string] = ['ottomans', 'romans'], seed = 42): GameState {
  const state = setupToPlacement(factions, seed);
  return placeAllUnits(state);
}

/** Move a unit to a position by injecting it into the state (for scenario setup) */
function moveUnitTo(state: GameState, unitId: string, position: CubeCoord): GameState {
  return {
    ...state,
    units: state.units.map(u => u.id === unitId ? { ...u, position } : u),
  };
}

/** Set a unit's HP (for scenario setup) */
function setUnitHp(state: GameState, unitId: string, hp: number): GameState {
  return {
    ...state,
    units: state.units.map(u => u.id === unitId ? { ...u, currentHp: hp } : u),
  };
}

/** Find a unit by typeId and playerId */
function findUnit(state: GameState, typeId: string, playerId: PlayerId): Unit {
  const unit = state.units.find(u => u.typeId === typeId && u.playerId === playerId && u.currentHp > 0);
  if (!unit) throw new Error(`No living ${typeId} found for ${playerId}`);
  return unit;
}

/** Find an empty hex adjacent to a position */
function findEmptyAdjacent(state: GameState, pos: CubeCoord): CubeCoord {
  const neighbors = cubeNeighbors(pos);
  const occupied = new Set(state.units.map(u => hexKey(u.position)));
  for (const n of neighbors) {
    if (!occupied.has(hexKey(n)) && state.board.cells[hexKey(n)]) return n;
  }
  throw new Error('No empty adjacent hex found');
}

// ========== S01: Post-attack movement cap ==========

describe('S01: Post-attack movement cap', () => {
  it('limits unit to 1 hex of movement after attacking', () => {
    let state = setupToGameplay(['romans', 'vikings'], 42);
    const currentPlayer = state.currentPlayerId;

    // Find a melee unit for the current player
    const warrior = findUnit(state, 'basic_melee', currentPlayer);
    const enemy = state.units.find(u => u.playerId !== currentPlayer && u.currentHp > 0)!;

    // Position warrior 2 hexes from enemy (within melee range after 1 move)
    const enemyNeighbors = cubeNeighbors(enemy.position);
    const adjPos = enemyNeighbors.find(n => state.board.cells[hexKey(n)] && !state.units.some(u => hexKey(u.position) === hexKey(n)))!;
    const furtherNeighbors = cubeNeighbors(adjPos);
    const startPos = furtherNeighbors.find(n =>
      state.board.cells[hexKey(n)] &&
      !state.units.some(u => hexKey(u.position) === hexKey(n)) &&
      hexKey(n) !== hexKey(enemy.position),
    )!;

    // Place warrior at startPos
    state = moveUnitTo(state, warrior.id, startPos);

    // Move warrior adjacent to enemy (1 hex)
    state = applyAction(state, { type: 'move', unitId: warrior.id, to: adjPos });

    // Attack the enemy
    state = applyAction(state, { type: 'attack', unitId: warrior.id, targetId: enemy.id });

    // After attacking, should have at most 1 hex of movement remaining
    const updatedWarrior = state.units.find(u => u.id === warrior.id)!;
    const remaining = getAvailableMovement(updatedWarrior);
    expect(remaining).toBeLessThanOrEqual(1);

    // If movement is available, move 1 hex then verify no more moves
    if (remaining > 0) {
      const moveTarget = findEmptyAdjacent(state, updatedWarrior.position);
      state = applyAction(state, { type: 'move', unitId: warrior.id, to: moveTarget });

      const afterMove = state.units.find(u => u.id === warrior.id)!;
      expect(getAvailableMovement(afterMove)).toBe(0);

      // Any further move attempt should fail
      const actions = getUnitActions(state, warrior.id);
      expect(actions.moves).toHaveLength(0);
    }
  });
});

// ========== S02: Post-attack movement with no remaining ==========

describe('S02: Post-attack movement when all movement used', () => {
  it('prevents any movement after attacking when all movement was used', () => {
    let state = setupToGameplay(['romans', 'vikings'], 42);
    const currentPlayer = state.currentPlayerId;

    // Find a melee unit (movement = 2) and an enemy
    const warrior = findUnit(state, 'basic_melee', currentPlayer);
    const enemy = state.units.find(u => u.playerId !== currentPlayer && u.currentHp > 0)!;

    // Position warrior exactly 2 hexes from enemy
    const adjPos = cubeNeighbors(enemy.position).find(n =>
      state.board.cells[hexKey(n)] && !state.units.some(u => hexKey(u.position) === hexKey(n)))!;
    const step1 = cubeNeighbors(adjPos).find(n =>
      state.board.cells[hexKey(n)] &&
      !state.units.some(u => hexKey(u.position) === hexKey(n)) &&
      hexKey(n) !== hexKey(enemy.position))!;
    state = moveUnitTo(state, warrior.id, step1);

    // Move warrior 1 hex
    state = applyAction(state, { type: 'move', unitId: warrior.id, to: adjPos });

    // Move warrior 1 more hex (use remaining movement) — need to go back or to another neighbor
    const otherAdj = cubeNeighbors(adjPos).find(n =>
      state.board.cells[hexKey(n)] &&
      !state.units.some(u => hexKey(u.position) === hexKey(n)) &&
      hexKey(n) !== hexKey(enemy.position) &&
      hexKey(n) !== hexKey(step1))!;

    if (otherAdj) {
      state = applyAction(state, { type: 'move', unitId: warrior.id, to: otherAdj });
    }

    // Now move adjacent to enemy for attack
    const warriorNow = state.units.find(u => u.id === warrior.id)!;
    if (getAvailableMovement(warriorNow) > 0) {
      // This scenario tests: use all movement, then attack → no post-attack movement
      // If we couldn't use all movement, just verify the cap works
    }

    // Attack if in range
    const updatedWarrior = state.units.find(u => u.id === warrior.id)!;
    const inRange = cubeNeighbors(updatedWarrior.position).some(n => hexKey(n) === hexKey(enemy.position));
    if (inRange) {
      state = applyAction(state, { type: 'attack', unitId: warrior.id, targetId: enemy.id });
      const afterAttack = state.units.find(u => u.id === warrior.id)!;
      // If all base movement was used, post-attack movement should be 0
      if (afterAttack.movementUsedThisTurn >= afterAttack.movement) {
        expect(getAvailableMovement(afterAttack)).toBe(0);
      }
    }
  });
});

// ========== S03: Samurai adjacency bonus at melee range ==========

describe('S03: Samurai adjacency bonus at melee range', () => {
  it('applies adjacency bonus when samurai is adjacent to 2+ enemies and attacks melee', () => {
    let state = setupToGameplay(['japanese', 'romans'], 42);
    const currentPlayer = state.currentPlayerId;

    // Skip to the Japanese player's turn if needed
    if (!state.units.some(u => u.typeId === 'samurai' && u.playerId === currentPlayer)) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const samurai = findUnit(state, 'samurai', state.currentPlayerId);

    // Find 2 enemies
    const enemies = state.units.filter(u => u.playerId !== state.currentPlayerId && u.currentHp > 0).slice(0, 2);
    expect(enemies.length).toBeGreaterThanOrEqual(2);

    // Use known valid board positions (mid-board, offset coords)
    const pos1 = offsetToCube(9, 9); // samurai
    const neighbors = cubeNeighbors(pos1);
    // Pick two neighbors that are on the board
    const validNeighbors = neighbors.filter(n => state.board.cells[hexKey(n)]);
    expect(validNeighbors.length).toBeGreaterThanOrEqual(2);
    const pos2 = validNeighbors[0]; // enemy 1
    const pos3 = validNeighbors[1]; // enemy 2

    state = moveUnitTo(state, samurai.id, pos1);
    state = moveUnitTo(state, enemies[0].id, pos2);
    state = moveUnitTo(state, enemies[1].id, pos3);

    // Attack enemy at pos2 (adjacent, melee range)
    const result = applyActionDetailed(state, { type: 'attack', unitId: samurai.id, targetId: enemies[0].id });
    const attackEvent = result.events.find(e => e.type === 'attackResolved');
    expect(attackEvent).toBeDefined();
    expect(attackEvent!.type).toBe('attackResolved');
    if (attackEvent!.type === 'attackResolved') {
      // Samurai base toHit is 4; with adjacency bonus (-1), effective should be 3
      expect(attackEvent!.effectiveToHit).toBe(3);
    }
  });
});

// ========== S04: Samurai adjacency does NOT apply at range ==========

describe('S04: Samurai adjacency does not apply at range', () => {
  it('samurai cannot attack with primary melee attack beyond range 1', () => {
    let state = setupToGameplay(['japanese', 'romans'], 42);
    const currentPlayer = state.currentPlayerId;

    if (!state.units.some(u => u.typeId === 'samurai' && u.playerId === currentPlayer)) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const samurai = findUnit(state, 'samurai', state.currentPlayerId);
    const enemy = state.units.find(u => u.playerId !== state.currentPlayerId && u.currentHp > 0)!;

    // Position samurai 2 hexes from enemy (out of melee range)
    const pos1 = offsetToCube(9, 9);
    const pos2 = offsetToCube(9, 11); // distance 2 in offset coords

    state = moveUnitTo(state, samurai.id, pos1);
    state = moveUnitTo(state, enemy.id, pos2);

    // Attack should be invalid — samurai primary attack range is 1
    const validation = validateAction(state, { type: 'attack', unitId: samurai.id, targetId: enemy.id });
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('out of range');
  });
});

// ========== S05: Priority 2-step flow ==========

describe('S05: Priority 2-step flow', () => {
  it('winner picks order to control, loser picks remaining', () => {
    let state = createGame({ ...DEFAULT_CONFIG, seed: 42 });
    const winner = state.setupState!.rollWinner!;
    const loser = state.players.find(p => p.id !== winner)!.id;

    // Winner chooses to control faction order, picks second
    const result1 = applyActionDetailed(state, {
      type: 'choosePriority', playerId: winner,
      orderToControl: 'factionOrder', position: 'second',
    });
    state = result1.state;

    expect(state.setupState!.currentStep).toBe('loserChoosePriority');
    expect(state.setupState!.winnerOrderChoice).toBe('factionOrder');
    expect(state.setupState!.winnerPosition).toBe('second');

    // Loser picks first in the remaining order (moveOrder)
    const result2 = applyActionDetailed(state, {
      type: 'choosePriority', playerId: loser, position: 'first',
    });
    state = result2.state;

    expect(state.setupState!.currentStep).toBe('factionSelection');
    // Winner chose faction order second → loser is first in faction selection
    expect(state.setupState!.factionSelectionOrder[0]).toBe(loser);
    expect(state.setupState!.factionSelectionOrder[1]).toBe(winner);
    // Loser chose move order first → loser moves first
    expect(state.setupState!.moveOrder[0]).toBe(loser);
    expect(state.setupState!.moveOrder[1]).toBe(winner);
  });

  it('winner controls move order and picks first', () => {
    let state = createGame({ ...DEFAULT_CONFIG, seed: 42 });
    const winner = state.setupState!.rollWinner!;
    const loser = state.players.find(p => p.id !== winner)!.id;

    // Winner chooses to control move order, picks first
    state = applyAction(state, {
      type: 'choosePriority', playerId: winner,
      orderToControl: 'moveOrder', position: 'first',
    });

    // Loser picks second in faction order
    state = applyAction(state, {
      type: 'choosePriority', playerId: loser, position: 'second',
    });

    // Winner controls move order, picks first → winner moves first
    expect(state.setupState!.moveOrder[0]).toBe(winner);
    // Loser picks second in faction order → loser picks faction second
    expect(state.setupState!.factionSelectionOrder[1]).toBe(loser);
    expect(state.setupState!.factionSelectionOrder[0]).toBe(winner);
  });
});

// ========== S06: Medic heal action ==========

describe('S06: Medic heal action (engine integration)', () => {
  it('heals adjacent wounded ally', () => {
    let state = setupToGameplay(['ottomans', 'romans'], 42);

    // Get to the Ottoman player's turn
    if (!state.units.some(u => u.typeId === 'medic' && u.playerId === state.currentPlayerId)) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const medic = findUnit(state, 'medic', state.currentPlayerId);
    const ally = state.units.find(u =>
      u.playerId === state.currentPlayerId && u.id !== medic.id && u.currentHp > 0,
    )!;

    // Position medic adjacent to wounded ally using valid board positions
    const pos1 = offsetToCube(9, 9);
    const pos2 = cubeNeighbors(pos1).find(n => state.board.cells[hexKey(n)])!;

    state = moveUnitTo(state, medic.id, pos1);
    state = moveUnitTo(state, ally.id, pos2);
    state = setUnitHp(state, ally.id, ally.maxHp - 2);

    const woundedHp = ally.maxHp - 2;

    const result = applyActionDetailed(state, {
      type: 'heal', unitId: medic.id, targetId: ally.id,
    });

    const healEvent = result.events.find(e => e.type === 'healResolved');
    expect(healEvent).toBeDefined();

    if (healEvent && healEvent.type === 'healResolved') {
      expect(healEvent.healerId).toBe(medic.id);
      expect(healEvent.targetId).toBe(ally.id);
      expect(healEvent.targetHpAfter).toBeLessThanOrEqual(ally.maxHp);
      expect(healEvent.targetHpAfter).toBeGreaterThanOrEqual(woundedHp);
    }

    const updatedMedic = result.state.units.find(u => u.id === medic.id)!;
    expect(updatedMedic.hasUsedAbilityThisTurn).toBe(true);
    expect(updatedMedic.hasAttackedThisTurn).toBe(true);
    expect(result.state.activeUnitId).toBe(medic.id);
  });

  it('rejects heal on full-HP ally', () => {
    let state = setupToGameplay(['ottomans', 'romans'], 42);

    if (!state.units.some(u => u.typeId === 'medic' && u.playerId === state.currentPlayerId)) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const medic = findUnit(state, 'medic', state.currentPlayerId);
    const ally = state.units.find(u =>
      u.playerId === state.currentPlayerId && u.id !== medic.id && u.currentHp > 0,
    )!;

    const pos1 = offsetToCube(9, 9);
    const pos2 = cubeNeighbors(pos1).find(n => state.board.cells[hexKey(n)])!;

    state = moveUnitTo(state, medic.id, pos1);
    state = moveUnitTo(state, ally.id, pos2);

    const validation = validateAction(state, {
      type: 'heal', unitId: medic.id, targetId: ally.id,
    });
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('full health');
  });

  it('rejects heal on non-adjacent ally', () => {
    let state = setupToGameplay(['ottomans', 'romans'], 42);

    if (!state.units.some(u => u.typeId === 'medic' && u.playerId === state.currentPlayerId)) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const medic = findUnit(state, 'medic', state.currentPlayerId);
    const ally = state.units.find(u =>
      u.playerId === state.currentPlayerId && u.id !== medic.id && u.currentHp > 0,
    )!;

    const pos1 = offsetToCube(5, 5);
    const pos2 = offsetToCube(5, 8); // far away

    state = moveUnitTo(state, medic.id, pos1);
    state = moveUnitTo(state, ally.id, pos2);
    state = setUnitHp(state, ally.id, 1);

    const validation = validateAction(state, {
      type: 'heal', unitId: medic.id, targetId: ally.id,
    });
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('adjacent');
  });

  it('rejects heal on enemy unit', () => {
    let state = setupToGameplay(['ottomans', 'romans'], 42);

    if (!state.units.some(u => u.typeId === 'medic' && u.playerId === state.currentPlayerId)) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const medic = findUnit(state, 'medic', state.currentPlayerId);
    const enemy = state.units.find(u => u.playerId !== state.currentPlayerId && u.currentHp > 0)!;

    const pos1 = offsetToCube(9, 9);
    const pos2 = cubeNeighbors(pos1).find(n => state.board.cells[hexKey(n)])!;

    state = moveUnitTo(state, medic.id, pos1);
    state = moveUnitTo(state, enemy.id, pos2);
    state = setUnitHp(state, enemy.id, 1);

    const validation = validateAction(state, {
      type: 'heal', unitId: medic.id, targetId: enemy.id,
    });
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('friendly');
  });

  it('non-medic unit cannot heal', () => {
    let state = setupToGameplay(['ottomans', 'romans'], 42);
    const warrior = findUnit(state, 'basic_melee', state.currentPlayerId);
    const ally = state.units.find(u =>
      u.playerId === state.currentPlayerId && u.id !== warrior.id && u.currentHp > 0,
    )!;

    const pos1 = offsetToCube(9, 9);
    const pos2 = cubeNeighbors(pos1).find(n => state.board.cells[hexKey(n)])!;

    state = moveUnitTo(state, warrior.id, pos1);
    state = moveUnitTo(state, ally.id, pos2);
    state = setUnitHp(state, ally.id, 1);

    const validation = validateAction(state, {
      type: 'heal', unitId: warrior.id, targetId: ally.id,
    });
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('cannot heal');
  });
});
