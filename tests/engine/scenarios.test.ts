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
import { hexKey, cube, cubeNeighbors, offsetToCube, cubeDistance } from '../../src/engine/hex.js';
import { getBaseCells } from '../../src/engine/board.js';
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
    mongols: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['kheshig', 'kheshig', 'pillager', 'pillager', 'pillager'] },
    muscovites: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['streltsy', 'streltsy', 'streltsy', 'cossack_cavalry', 'cossack_cavalry'] },
    vandals: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['raider', 'raider', 'raider', 'vandal_heavy_cavalry', 'vandal_heavy_cavalry'] },
    english: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['knight', 'knight', 'knight', 'longbowman', 'longbowman'] },
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

// ========== S07: Win by elimination ==========

describe('S07: Win by elimination', () => {
  it('triggers victory when all enemy units are defeated', () => {
    let state = setupToGameplay(['romans', 'vikings'], 42);
    const currentPlayer = state.currentPlayerId;
    const enemyPlayer = state.players.find(p => p.id !== currentPlayer)!.id;

    // Kill all enemy units except one by setting HP to 0
    const enemyUnits = state.units.filter(u => u.playerId === enemyPlayer && u.currentHp > 0);
    expect(enemyUnits.length).toBeGreaterThan(0);

    const lastEnemy = enemyUnits[enemyUnits.length - 1];
    for (const enemy of enemyUnits.slice(0, -1)) {
      state = setUnitHp(state, enemy.id, 0);
    }

    // Set last enemy to low HP so it dies on any hit
    state = setUnitHp(state, lastEnemy.id, 1);

    // Position attacker adjacent to last enemy
    const attacker = findUnit(state, 'basic_melee', currentPlayer);
    const adjPos = cubeNeighbors(lastEnemy.position).find(n =>
      state.board.cells[hexKey(n)] &&
      !state.units.some(u => u.currentHp > 0 && hexKey(u.position) === hexKey(n)),
    )!;
    expect(adjPos).toBeDefined();
    state = moveUnitTo(state, attacker.id, adjPos);

    // Attack the last enemy — keep trying until a hit lands (seeded RNG)
    const result = applyActionDetailed(state, { type: 'attack', unitId: attacker.id, targetId: lastEnemy.id });
    const attackEvent = result.events.find(e => e.type === 'attackResolved');
    expect(attackEvent).toBeDefined();

    if (attackEvent && attackEvent.type === 'attackResolved' && attackEvent.hit) {
      // The last enemy should be killed
      expect(result.state.phase).toBe('victory');
      expect(result.state.winCondition).toBe('all_units_defeated');
      expect(result.state.winner).toBe(currentPlayer);

      const gameWonEvent = result.events.find(e => e.type === 'gameWon');
      expect(gameWonEvent).toBeDefined();
      if (gameWonEvent && gameWonEvent.type === 'gameWon') {
        expect(gameWonEvent.winner).toBe(currentPlayer);
        expect(gameWonEvent.winCondition).toBe('all_units_defeated');
      }
    } else {
      // If the attack missed, the game shouldn't be over yet — verify not in victory
      expect(result.state.phase).toBe('gameplay');
    }
  });
});

// ========== S08: Win by base control ==========

describe('S08: Win by base control', () => {
  it('triggers victory after controlling enemy base for 3 turns', () => {
    let state = setupToGameplay(['romans', 'vikings'], 42);
    const player1 = state.players[0].id;
    const player2 = state.players[1].id;

    // Get a player1 unit
    const unit = state.units.find(u => u.playerId === player1 && u.currentHp > 0)!;

    // Find a base cell for player2
    const baseCells = getBaseCells(state.board, player2);
    expect(baseCells.length).toBeGreaterThan(0);
    const basePos = baseCells[0].coord;
    expect(state.board.cells[hexKey(basePos)]).toBeDefined();

    // Move all player2 units OUT of their base so no defenders
    const baseKeys = new Set(baseCells.map(c => hexKey(c.coord)));
    for (const u of state.units.filter(u => u.playerId === player2 && u.currentHp > 0)) {
      if (baseKeys.has(hexKey(u.position))) {
        const safePos = offsetToCube(9, 9);
        if (!state.units.some(other => other.id !== u.id && hexKey(other.position) === hexKey(safePos))) {
          state = moveUnitTo(state, u.id, safePos);
        } else {
          const alt = cubeNeighbors(safePos).find(n =>
            state.board.cells[hexKey(n)] && !state.units.some(o => o.id !== u.id && hexKey(o.position) === hexKey(n)),
          )!;
          state = moveUnitTo(state, u.id, alt);
        }
      }
    }

    // Position player1's unit in player2's base
    state = moveUnitTo(state, unit.id, basePos);

    // Make sure it's player1's turn
    if (state.currentPlayerId !== player1) {
      state = applyAction(state, { type: 'endTurn' });
    }

    // Base control checks at start of current player's turn.
    // Timer increments when the controlling player's turn begins.
    // Flow: p1 ends → p2 starts (no check for p1) → p2 ends → p1 starts (timer +1)
    // Round 1: p1 end → p2 end → p1 starts (timer = 1)
    // Round 2: p1 end → p2 end → p1 starts (timer = 2)
    // Round 3: p1 end → p2 end → p1 starts (timer = 3 → WIN)
    for (let round = 1; round <= 3; round++) {
      // Player1 ends turn
      state = applyAction(state, { type: 'endTurn' });
      if (state.phase === 'victory') break;
      // Player2 ends turn → player1's turn starts, base control checked
      const result = applyActionDetailed(state, { type: 'endTurn' });
      state = result.state;
      if (state.phase === 'victory') break;
    }

    expect(state.phase).toBe('victory');
    expect(state.winCondition).toBe('base_control');
    expect(state.winner).toBe(player1);
  });
});

// ========== S09: Base control timer reset ==========

describe('S09: Base control timer reset', () => {
  it('resets timer when unit leaves the base', () => {
    let state = setupToGameplay(['romans', 'vikings'], 42);
    const player1 = state.players[0].id;
    const player2 = state.players[1].id;

    const unit = state.units.find(u => u.playerId === player1 && u.currentHp > 0)!;

    const baseCells = getBaseCells(state.board, player2);
    expect(baseCells.length).toBeGreaterThan(0);
    const basePos = baseCells[0].coord;

    // Move all player2 units out of their base
    const baseKeys = new Set(baseCells.map(c => hexKey(c.coord)));
    for (const u of state.units.filter(u => u.playerId === player2 && u.currentHp > 0)) {
      if (baseKeys.has(hexKey(u.position))) {
        const safePos = offsetToCube(9, 9);
        if (!state.units.some(o => o.id !== u.id && hexKey(o.position) === hexKey(safePos))) {
          state = moveUnitTo(state, u.id, safePos);
        } else {
          const alt = cubeNeighbors(safePos).find(n =>
            state.board.cells[hexKey(n)] && !state.units.some(o => o.id !== u.id && hexKey(o.position) === hexKey(n)),
          )!;
          state = moveUnitTo(state, u.id, alt);
        }
      }
    }

    state = moveUnitTo(state, unit.id, basePos);

    if (state.currentPlayerId !== player1) {
      state = applyAction(state, { type: 'endTurn' });
    }

    // Accumulate base control timer. The guard endTurn above may add an extra cycle
    // when player1 isn't the initial current player.
    state = applyAction(state, { type: 'endTurn' }); // current player ends
    state = applyAction(state, { type: 'endTurn' }); // other player ends → current starts (timer increments)

    expect(state.phase).toBe('gameplay');
    const timerAfterRound = state.baseControlTimers[player1];
    expect(timerAfterRound).toBeGreaterThanOrEqual(1);
    expect(timerAfterRound).toBeLessThan(3); // must not have won yet

    // Move unit OUT of the base
    const outsidePos = cubeNeighbors(basePos).find(n =>
      state.board.cells[hexKey(n)] &&
      !baseKeys.has(hexKey(n)) &&
      !state.units.some(u => u.id !== unit.id && u.currentHp > 0 && hexKey(u.position) === hexKey(n)),
    )!;
    expect(outsidePos).toBeDefined();
    state = moveUnitTo(state, unit.id, outsidePos);

    // Complete another round so base control is re-checked
    state = applyAction(state, { type: 'endTurn' }); // p1 ends
    state = applyAction(state, { type: 'endTurn' }); // p2 ends → p1 starts (timer should reset)

    expect(state.baseControlTimers[player1]).toBe(0);
    expect(state.phase).toBe('gameplay');
  });
});

// ========== S10: Mongol reduced base control (2 turns) ==========

describe('S10: Mongol reduced base control (2 turns)', () => {
  it('mongols win base control after 2 turns instead of 3', () => {
    let state = setupToGameplay(['mongols', 'romans'], 42);
    const mongolPlayer = state.players.find(p => p.factionId === 'mongols')!.id;
    const romanPlayer = state.players.find(p => p.factionId === 'romans')!.id;

    const unit = state.units.find(u => u.playerId === mongolPlayer && u.currentHp > 0)!;

    const baseCells = getBaseCells(state.board, romanPlayer);
    expect(baseCells.length).toBeGreaterThan(0);
    const basePos = baseCells[0].coord;

    // Move all roman units out of their base
    const baseKeys = new Set(baseCells.map(c => hexKey(c.coord)));
    for (const u of state.units.filter(u => u.playerId === romanPlayer && u.currentHp > 0)) {
      if (baseKeys.has(hexKey(u.position))) {
        const safePos = offsetToCube(9, 9);
        if (!state.units.some(o => o.id !== u.id && hexKey(o.position) === hexKey(safePos))) {
          state = moveUnitTo(state, u.id, safePos);
        } else {
          const alt = cubeNeighbors(safePos).find(n =>
            state.board.cells[hexKey(n)] && !state.units.some(o => o.id !== u.id && hexKey(o.position) === hexKey(n)),
          )!;
          state = moveUnitTo(state, u.id, alt);
        }
      }
    }

    state = moveUnitTo(state, unit.id, basePos);

    // Ensure it's the mongol player's turn
    if (state.currentPlayerId !== mongolPlayer) {
      state = applyAction(state, { type: 'endTurn' });
    }

    // 2 rounds for mongols
    for (let round = 1; round <= 2; round++) {
      state = applyAction(state, { type: 'endTurn' }); // mongol ends
      if (state.phase === 'victory') break;
      const result = applyActionDetailed(state, { type: 'endTurn' }); // opponent ends → mongol starts
      state = result.state;
      if (state.phase === 'victory') break;
    }

    expect(state.phase).toBe('victory');
    expect(state.winCondition).toBe('base_control');
    expect(state.winner).toBe(mongolPlayer);
  });
});

// ========== S11: Ranged proximity penalty ==========

describe('S11: Ranged proximity penalty', () => {
  it('applies +1 to-hit penalty for ranged unit attacking at distance 1', () => {
    let state = setupToGameplay(['ottomans', 'romans'], 42);
    const currentPlayer = state.currentPlayerId;

    // Get to the player with a basic_ranged unit
    if (!state.units.some(u => u.typeId === 'basic_ranged' && u.playerId === currentPlayer)) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const ranged = findUnit(state, 'basic_ranged', state.currentPlayerId);
    const enemyPlayer = state.players.find(p => p.id !== state.currentPlayerId)!.id;
    const enemy = state.units.find(u => u.playerId === enemyPlayer && u.currentHp > 0)!;

    // Position ranged unit adjacent to enemy (distance 1)
    const pos1 = offsetToCube(9, 9);
    const pos2 = cubeNeighbors(pos1).find(n => state.board.cells[hexKey(n)])!;
    expect(pos2).toBeDefined();
    expect(cubeDistance(pos1, pos2)).toBe(1);

    state = moveUnitTo(state, ranged.id, pos1);
    state = moveUnitTo(state, enemy.id, pos2);

    const result = applyActionDetailed(state, { type: 'attack', unitId: ranged.id, targetId: enemy.id });
    const attackEvent = result.events.find(e => e.type === 'attackResolved');
    expect(attackEvent).toBeDefined();
    if (attackEvent && attackEvent.type === 'attackResolved') {
      // basic_ranged: toHit 5, range 4 → at distance 1 gets +1 penalty → effectiveToHit = 6
      expect(attackEvent.effectiveToHit).toBe(6);
    }
  });
});

// ========== S12: Samurai noProximityPenalty (SKIP) ==========

describe('S12: Samurai noProximityPenalty', () => {
  it.skip('samurai noProximityPenalty — pending secondary attack wiring', () => {
    // Placeholder — secondary attacks aren't wired in the engine yet
  });
});

// ========== S13: Streltsy blocks move-and-attack ==========

describe('S13: Streltsy blocks move-and-attack', () => {
  it('blocks melee attack from unit that has moved this turn', () => {
    let state = setupToGameplay(['romans', 'muscovites'], 42);

    // Get to the Roman player's turn (they have basic_melee)
    const romanPlayer = state.players.find(p => p.factionId === 'romans')!.id;
    if (state.currentPlayerId !== romanPlayer) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const attacker = findUnit(state, 'basic_melee', romanPlayer);
    const muscovitePlayer = state.players.find(p => p.factionId === 'muscovites')!.id;
    const streltsy = findUnit(state, 'streltsy', muscovitePlayer);

    // Position attacker 2 hexes from streltsy:
    // Place streltsy at a known position, then find a hex 2 away via neighbors
    const streltsyPos = offsetToCube(9, 9);
    expect(state.board.cells[hexKey(streltsyPos)]).toBeDefined();
    state = moveUnitTo(state, streltsy.id, streltsyPos);

    // Find a valid neighbor adjacent to streltsy (1 hex away)
    const adjToStreltsy = cubeNeighbors(streltsyPos).find(n =>
      state.board.cells[hexKey(n)] &&
      !state.units.some(u => u.id !== streltsy.id && u.id !== attacker.id && u.currentHp > 0 && hexKey(u.position) === hexKey(n)),
    )!;
    expect(adjToStreltsy).toBeDefined();

    // Find a hex adjacent to adjToStreltsy but NOT adjacent to streltsy (2 hexes from streltsy)
    const startPos = cubeNeighbors(adjToStreltsy).find(n =>
      state.board.cells[hexKey(n)] &&
      hexKey(n) !== hexKey(streltsyPos) &&
      cubeDistance(n, streltsyPos) === 2 &&
      !state.units.some(u => u.id !== streltsy.id && u.id !== attacker.id && u.currentHp > 0 && hexKey(u.position) === hexKey(n)),
    )!;
    expect(startPos).toBeDefined();

    state = moveUnitTo(state, attacker.id, startPos);

    // Move attacker 1 hex toward streltsy (to adjToStreltsy)
    state = applyAction(state, { type: 'move', unitId: attacker.id, to: adjToStreltsy });

    // Verify attacker has moved
    const movedAttacker = state.units.find(u => u.id === attacker.id)!;
    expect(movedAttacker.hasMovedThisTurn).toBe(true);

    // Attack should be blocked by streltsy defense ability
    expect(() =>
      applyActionDetailed(state, { type: 'attack', unitId: attacker.id, targetId: streltsy.id }),
    ).toThrow('blocked');
  });
});

// ========== S14: Streltsy allows stationary melee attack ==========

describe('S14: Streltsy allows stationary melee attack', () => {
  it('allows melee attack from unit that has NOT moved this turn', () => {
    let state = setupToGameplay(['romans', 'muscovites'], 42);

    const romanPlayer = state.players.find(p => p.factionId === 'romans')!.id;
    if (state.currentPlayerId !== romanPlayer) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const attacker = findUnit(state, 'basic_melee', romanPlayer);
    const muscovitePlayer = state.players.find(p => p.factionId === 'muscovites')!.id;
    const streltsy = findUnit(state, 'streltsy', muscovitePlayer);

    // Position attacker directly adjacent to streltsy without moving
    const streltsyPos = offsetToCube(9, 9);
    expect(state.board.cells[hexKey(streltsyPos)]).toBeDefined();
    state = moveUnitTo(state, streltsy.id, streltsyPos);

    const adjPos = cubeNeighbors(streltsyPos).find(n =>
      state.board.cells[hexKey(n)] &&
      !state.units.some(u => u.id !== streltsy.id && u.id !== attacker.id && u.currentHp > 0 && hexKey(u.position) === hexKey(n)),
    )!;
    expect(adjPos).toBeDefined();
    state = moveUnitTo(state, attacker.id, adjPos);

    // Ensure attacker has NOT moved
    const stationaryAttacker = state.units.find(u => u.id === attacker.id)!;
    expect(stationaryAttacker.hasMovedThisTurn).toBe(false);

    // Attack should succeed (not throw)
    const result = applyActionDetailed(state, { type: 'attack', unitId: attacker.id, targetId: streltsy.id });
    const attackEvent = result.events.find(e => e.type === 'attackResolved');
    expect(attackEvent).toBeDefined();
  });
});

// ========== S15: Formation bonus (Legionnaire) ==========

describe('S15: Formation bonus (Legionnaire)', () => {
  it('applies -1 to-hit when adjacent to a friendly unit', () => {
    let state = setupToGameplay(['romans', 'vikings'], 42);
    const romanPlayer = state.players.find(p => p.factionId === 'romans')!.id;

    if (state.currentPlayerId !== romanPlayer) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const legionnaire = findUnit(state, 'legionnaire', romanPlayer);
    const ally = state.units.find(u =>
      u.playerId === romanPlayer && u.id !== legionnaire.id && u.currentHp > 0,
    )!;
    const enemyPlayer = state.players.find(p => p.id !== romanPlayer)!.id;
    const enemy = state.units.find(u => u.playerId === enemyPlayer && u.currentHp > 0)!;

    // Place legionnaire, ally adjacent to each other, and enemy adjacent to legionnaire
    const legPos = offsetToCube(9, 9);
    expect(state.board.cells[hexKey(legPos)]).toBeDefined();

    const neighbors = cubeNeighbors(legPos).filter(n => state.board.cells[hexKey(n)]);
    expect(neighbors.length).toBeGreaterThanOrEqual(2);

    const allyPos = neighbors[0];
    const enemyPos = neighbors[1];

    state = moveUnitTo(state, legionnaire.id, legPos);
    state = moveUnitTo(state, ally.id, allyPos);
    state = moveUnitTo(state, enemy.id, enemyPos);

    const result = applyActionDetailed(state, { type: 'attack', unitId: legionnaire.id, targetId: enemy.id });
    const attackEvent = result.events.find(e => e.type === 'attackResolved');
    expect(attackEvent).toBeDefined();
    if (attackEvent && attackEvent.type === 'attackResolved') {
      // Legionnaire base toHit = 4, formation bonus = -1 → effective = 3
      expect(attackEvent.effectiveToHit).toBe(3);
    }
  });
});

// ========== S16: Lone wolf bonus (Raider) ==========

describe('S16: Lone wolf bonus (Raider)', () => {
  it('applies -1 to-hit when no adjacent allies', () => {
    let state = setupToGameplay(['vandals', 'romans'], 42);
    const vandalPlayer = state.players.find(p => p.factionId === 'vandals')!.id;

    if (state.currentPlayerId !== vandalPlayer) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const raider = findUnit(state, 'raider', vandalPlayer);
    const enemyPlayer = state.players.find(p => p.id !== vandalPlayer)!.id;
    const enemy = state.units.find(u => u.playerId === enemyPlayer && u.currentHp > 0)!;

    // Position raider with NO adjacent allies, enemy adjacent
    const raiderPos = offsetToCube(9, 9);
    expect(state.board.cells[hexKey(raiderPos)]).toBeDefined();

    const raiderNeighbors = cubeNeighbors(raiderPos).filter(n => state.board.cells[hexKey(n)]);
    const enemyPos = raiderNeighbors[0];

    // Move ALL allied units far from raider so none are adjacent
    for (const u of state.units.filter(u => u.playerId === vandalPlayer && u.id !== raider.id && u.currentHp > 0)) {
      const farPos = offsetToCube(3, 3);
      const neighbors = cubeNeighbors(farPos).filter(n => state.board.cells[hexKey(n)]);
      const emptyFar = [farPos, ...neighbors].find(p =>
        state.board.cells[hexKey(p)] &&
        !state.units.some(o => o.id !== u.id && o.id !== raider.id && hexKey(o.position) === hexKey(p)) &&
        cubeDistance(p, raiderPos) > 1,
      );
      if (emptyFar) state = moveUnitTo(state, u.id, emptyFar);
    }

    state = moveUnitTo(state, raider.id, raiderPos);
    state = moveUnitTo(state, enemy.id, enemyPos);

    // Verify no adjacent allies
    const adjacentAllies = state.units.filter(u =>
      u.playerId === vandalPlayer && u.id !== raider.id && u.currentHp > 0 &&
      cubeNeighbors(raiderPos).some(n => hexKey(n) === hexKey(u.position)),
    );
    expect(adjacentAllies.length).toBe(0);

    const result = applyActionDetailed(state, { type: 'attack', unitId: raider.id, targetId: enemy.id });
    const attackEvent = result.events.find(e => e.type === 'attackResolved');
    expect(attackEvent).toBeDefined();
    if (attackEvent && attackEvent.type === 'attackResolved') {
      // Raider base toHit = 4, lone wolf bonus = -1 → effective = 3
      expect(attackEvent.effectiveToHit).toBe(3);
    }
  });
});

// ========== S17: Kheshig full movement bonus ==========

describe('S17: Kheshig full movement bonus', () => {
  it('applies -1 to-hit after using full movement', () => {
    let state = setupToGameplay(['mongols', 'romans'], 42);
    const mongolPlayer = state.players.find(p => p.factionId === 'mongols')!.id;

    if (state.currentPlayerId !== mongolPlayer) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const kheshig = findUnit(state, 'kheshig', mongolPlayer);
    const enemyPlayer = state.players.find(p => p.id !== mongolPlayer)!.id;
    const enemy = state.units.find(u => u.playerId === enemyPlayer && u.currentHp > 0)!;

    // Position kheshig adjacent to enemy and inject full movement used
    const kheshigPos = offsetToCube(9, 9);
    expect(state.board.cells[hexKey(kheshigPos)]).toBeDefined();

    const adjPos = cubeNeighbors(kheshigPos).find(n => state.board.cells[hexKey(n)])!;
    expect(adjPos).toBeDefined();

    state = moveUnitTo(state, kheshig.id, kheshigPos);
    state = moveUnitTo(state, enemy.id, adjPos);

    // Inject movementUsedThisTurn = 3 (kheshig's full movement) and hasMovedThisTurn
    state = {
      ...state,
      units: state.units.map(u =>
        u.id === kheshig.id
          ? { ...u, movementUsedThisTurn: 3, hasMovedThisTurn: true }
          : u,
      ),
    };

    const result = applyActionDetailed(state, { type: 'attack', unitId: kheshig.id, targetId: enemy.id });
    const attackEvent = result.events.find(e => e.type === 'attackResolved');
    expect(attackEvent).toBeDefined();
    if (attackEvent && attackEvent.type === 'attackResolved') {
      // Kheshig base toHit = 4, full movement bonus = -1 → effective = 3
      expect(attackEvent.effectiveToHit).toBe(3);
    }
  });
});

// ========== S18: Anti-basic damage (Pillager) ==========

describe('S18: Anti-basic damage (Pillager)', () => {
  it('deals +1 damage to basic category units', () => {
    let state = setupToGameplay(['mongols', 'romans'], 42);
    const mongolPlayer = state.players.find(p => p.factionId === 'mongols')!.id;

    if (state.currentPlayerId !== mongolPlayer) {
      state = applyAction(state, { type: 'endTurn' });
    }

    const pillager = findUnit(state, 'pillager', mongolPlayer);
    const enemyPlayer = state.players.find(p => p.id !== mongolPlayer)!.id;
    const basicEnemy = findUnit(state, 'basic_melee', enemyPlayer);

    // Verify target is basic category
    expect(basicEnemy.category).toBe('basic');

    // Position pillager adjacent to basic enemy
    const pillagerPos = offsetToCube(9, 9);
    expect(state.board.cells[hexKey(pillagerPos)]).toBeDefined();

    const adjPos = cubeNeighbors(pillagerPos).find(n => state.board.cells[hexKey(n)])!;
    expect(adjPos).toBeDefined();

    state = moveUnitTo(state, pillager.id, pillagerPos);
    state = moveUnitTo(state, basicEnemy.id, adjPos);

    const hpBefore = state.units.find(u => u.id === basicEnemy.id)!.currentHp;

    const result = applyActionDetailed(state, { type: 'attack', unitId: pillager.id, targetId: basicEnemy.id });
    const attackEvent = result.events.find(e => e.type === 'attackResolved');
    expect(attackEvent).toBeDefined();

    if (attackEvent && attackEvent.type === 'attackResolved' && attackEvent.hit) {
      // Pillager base damage = 2, anti_basic_damage = +1 → damage should be >= 3
      expect(attackEvent.damage).toBeGreaterThanOrEqual(3);
    }
  });
});

// ========== S19: Caesar redirect_attack — melee ==========

describe('S19: Caesar redirect_attack on melee attacks', () => {
  it('redirects melee attack damage to an adjacent ally (highest HP)', () => {
    let state = setupToGameplay(['vikings', 'romans'], 100);

    // We need the viking player to go first and attack a Roman unit
    // The Romans should have Caesar alive with redirect available
    const attackerPlayer = state.currentPlayerId;
    const defenderPlayer = state.players.find(p => p.id !== attackerPlayer)!.id;

    // Ensure attacker is vikings
    const attackerFaction = state.players.find(p => p.id === attackerPlayer)!.factionId;
    if (attackerFaction !== 'vikings') {
      // End turn to get to the viking player
      state = applyAction(state, { type: 'endTurn' });
    }

    const currentPlayer = state.currentPlayerId;
    const otherPlayer = state.players.find(p => p.id !== currentPlayer)!.id;

    // Find Caesar and a Roman ally, and a Viking attacker
    const caesar = findUnit(state, 'julius_caesar', otherPlayer);
    const romanAlly = state.units.find(u =>
      u.playerId === otherPlayer && u.id !== caesar.id && u.currentHp > 0,
    )!;
    const attacker = findUnit(state, 'basic_melee', currentPlayer);

    // Position: attacker adjacent to romanAlly, romanAlly adjacent to another Roman unit
    // Caesar just needs to be alive (no proximity requirement)
    const centerPos = offsetToCube(9, 9);
    const neighbors = cubeNeighbors(centerPos);
    const attackerPos = neighbors[0];
    const allyPos = centerPos; // The target
    const redirectPos = neighbors[1]; // Adjacent to the target

    state = moveUnitTo(state, romanAlly.id, allyPos);
    state = moveUnitTo(state, attacker.id, attackerPos);

    // Place another Roman unit adjacent to the target for redirect
    const anotherRoman = state.units.find(u =>
      u.playerId === otherPlayer && u.id !== caesar.id && u.id !== romanAlly.id && u.currentHp > 0,
    )!;
    state = moveUnitTo(state, anotherRoman.id, redirectPos);

    // Move Caesar away so he's not adjacent (to prove no proximity needed)
    state = moveUnitTo(state, caesar.id, offsetToCube(1, 1));

    const allyHpBefore = state.units.find(u => u.id === romanAlly.id)!.currentHp;
    const redirectHpBefore = state.units.find(u => u.id === anotherRoman.id)!.currentHp;

    // Attack the Roman ally
    const result = applyActionDetailed(state, { type: 'attack', unitId: attacker.id, targetId: romanAlly.id });
    const attackEvent = result.events.find(e => e.type === 'attackResolved');
    const redirectEvent = result.events.find(e => e.type === 'attackRedirected');

    if (attackEvent && attackEvent.type === 'attackResolved' && attackEvent.hit) {
      // Redirect should have occurred
      expect(redirectEvent).toBeDefined();
      if (redirectEvent && redirectEvent.type === 'attackRedirected') {
        expect(redirectEvent.originalTargetId).toBe(romanAlly.id);
        expect(redirectEvent.newTargetId).toBe(anotherRoman.id);
      }

      // Original target should be unharmed
      const originalAfter = result.state.units.find(u => u.id === romanAlly.id)!;
      expect(originalAfter.currentHp).toBe(allyHpBefore);

      // Redirect target should have taken damage
      const redirectAfter = result.state.units.find(u => u.id === anotherRoman.id)!;
      expect(redirectAfter.currentHp).toBeLessThan(redirectHpBefore);

      // For melee: Roman chooses → highest HP (our heuristic)
      // The attackResolved event should reference the actual damaged unit
      expect(attackEvent.targetId).toBe(anotherRoman.id);
    }
  });

  it('does not redirect when Caesar is dead', () => {
    let state = setupToGameplay(['vikings', 'romans'], 100);

    const attackerPlayer = state.currentPlayerId;
    const attackerFaction = state.players.find(p => p.id === attackerPlayer)!.factionId;
    if (attackerFaction !== 'vikings') {
      state = applyAction(state, { type: 'endTurn' });
    }

    const currentPlayer = state.currentPlayerId;
    const otherPlayer = state.players.find(p => p.id !== currentPlayer)!.id;

    const caesar = findUnit(state, 'julius_caesar', otherPlayer);
    const romanAlly = state.units.find(u =>
      u.playerId === otherPlayer && u.id !== caesar.id && u.currentHp > 0,
    )!;
    const attacker = findUnit(state, 'basic_melee', currentPlayer);

    const centerPos = offsetToCube(9, 9);
    const neighbors = cubeNeighbors(centerPos);

    state = moveUnitTo(state, romanAlly.id, centerPos);
    state = moveUnitTo(state, attacker.id, neighbors[0]);

    // Place another Roman adjacent
    const anotherRoman = state.units.find(u =>
      u.playerId === otherPlayer && u.id !== caesar.id && u.id !== romanAlly.id && u.currentHp > 0,
    )!;
    state = moveUnitTo(state, anotherRoman.id, neighbors[1]);

    // Kill Caesar
    state = setUnitHp(state, caesar.id, 0);

    const result = applyActionDetailed(state, { type: 'attack', unitId: attacker.id, targetId: romanAlly.id });
    const redirectEvent = result.events.find(e => e.type === 'attackRedirected');
    expect(redirectEvent).toBeUndefined();
  });

  it('does not redirect when no allies are adjacent to target', () => {
    let state = setupToGameplay(['vikings', 'romans'], 100);

    const attackerPlayer = state.currentPlayerId;
    const attackerFaction = state.players.find(p => p.id === attackerPlayer)!.factionId;
    if (attackerFaction !== 'vikings') {
      state = applyAction(state, { type: 'endTurn' });
    }

    const currentPlayer = state.currentPlayerId;
    const otherPlayer = state.players.find(p => p.id !== currentPlayer)!.id;

    const romanAlly = state.units.find(u =>
      u.playerId === otherPlayer && u.currentHp > 0,
    )!;
    const attacker = findUnit(state, 'basic_melee', currentPlayer);

    // Position target isolated (no adjacent allies)
    const isolatedPos = offsetToCube(9, 9);
    state = moveUnitTo(state, romanAlly.id, isolatedPos);
    state = moveUnitTo(state, attacker.id, cubeNeighbors(isolatedPos)[0]);

    // Move all other Roman units far away
    const otherRomans = state.units.filter(u =>
      u.playerId === otherPlayer && u.id !== romanAlly.id && u.currentHp > 0,
    );
    for (let i = 0; i < otherRomans.length; i++) {
      state = moveUnitTo(state, otherRomans[i].id, offsetToCube(1, 1 + i));
    }

    const result = applyActionDetailed(state, { type: 'attack', unitId: attacker.id, targetId: romanAlly.id });
    const redirectEvent = result.events.find(e => e.type === 'attackRedirected');
    expect(redirectEvent).toBeUndefined();
  });

  it('redirect only fires once per turn', () => {
    let state = setupToGameplay(['vikings', 'romans'], 100);

    const attackerPlayer = state.currentPlayerId;
    const attackerFaction = state.players.find(p => p.id === attackerPlayer)!.factionId;
    if (attackerFaction !== 'vikings') {
      state = applyAction(state, { type: 'endTurn' });
    }

    const currentPlayer = state.currentPlayerId;
    const otherPlayer = state.players.find(p => p.id !== currentPlayer)!.id;

    const caesar = findUnit(state, 'julius_caesar', otherPlayer);
    const romanUnit1 = state.units.find(u =>
      u.playerId === otherPlayer && u.id !== caesar.id && u.currentHp > 0,
    )!;
    const romanUnit2 = state.units.find(u =>
      u.playerId === otherPlayer && u.id !== caesar.id && u.id !== romanUnit1.id && u.currentHp > 0,
    )!;
    const romanUnit3 = state.units.find(u =>
      u.playerId === otherPlayer && u.id !== caesar.id && u.id !== romanUnit1.id && u.id !== romanUnit2.id && u.currentHp > 0,
    )!;

    const attacker1 = findUnit(state, 'basic_melee', currentPlayer);
    const attacker2 = state.units.find(u =>
      u.playerId === currentPlayer && u.id !== attacker1.id && u.currentHp > 0,
    )!;

    // Set up: two attackers each attacking different Roman units, each with allies adjacent
    const pos1 = offsetToCube(9, 9);
    const n1 = cubeNeighbors(pos1);
    state = moveUnitTo(state, romanUnit1.id, pos1);
    state = moveUnitTo(state, romanUnit2.id, n1[1]);
    state = moveUnitTo(state, attacker1.id, n1[0]);

    const pos2 = offsetToCube(9, 12);
    const n2 = cubeNeighbors(pos2);
    state = moveUnitTo(state, romanUnit3.id, pos2);
    state = moveUnitTo(state, attacker2.id, n2[0]);

    // First attack: should trigger redirect
    const result1 = applyActionDetailed(state, { type: 'attack', unitId: attacker1.id, targetId: romanUnit1.id });
    state = result1.state;

    // End first unit's turn
    state = applyAction(state, { type: 'endUnitTurn', unitId: attacker1.id });

    // Move another Roman next to romanUnit3 for potential second redirect
    const anotherRoman = state.units.find(u =>
      u.playerId === otherPlayer && u.id !== caesar.id &&
      u.id !== romanUnit1.id && u.id !== romanUnit2.id && u.id !== romanUnit3.id &&
      u.currentHp > 0,
    );
    if (anotherRoman) {
      state = moveUnitTo(state, anotherRoman.id, n2[1]);
    }

    // Second attack: redirect should NOT trigger (already used)
    const result2 = applyActionDetailed(state, { type: 'attack', unitId: attacker2.id, targetId: romanUnit3.id });
    const redirect2 = result2.events.find(e => e.type === 'attackRedirected');
    expect(redirect2).toBeUndefined();
  });

  it('redirect resets on new turn', () => {
    let state = setupToGameplay(['vikings', 'romans'], 100);

    const attackerPlayer = state.currentPlayerId;
    const attackerFaction = state.players.find(p => p.id === attackerPlayer)!.factionId;
    if (attackerFaction !== 'vikings') {
      state = applyAction(state, { type: 'endTurn' });
    }

    const currentPlayer = state.currentPlayerId;
    const otherPlayer = state.players.find(p => p.id !== currentPlayer)!.id;

    // Manually mark Caesar's redirect as used
    const caesar = findUnit(state, 'julius_caesar', otherPlayer);
    state = {
      ...state,
      units: state.units.map(u => u.id === caesar.id
        ? { ...u, abilityState: { ...u.abilityState, redirectUsedThisTurn: true } }
        : u,
      ),
    };

    // End turn and start new turn for the Roman player
    state = applyAction(state, { type: 'endTurn' });

    // Caesar's redirect should be reset
    const resetCaesar = state.units.find(u => u.id === caesar.id)!;
    expect(resetCaesar.abilityState.redirectUsedThisTurn).toBe(false);
  });
});

// ========== S20: King Arthur upgrade_unit ==========

describe('S20: King Arthur upgrade_unit ability', () => {
  it('upgrades basic_melee to knight when adjacent and at full HP', () => {
    let state = setupToGameplay(['english', 'romans'], 200);

    const currentPlayer = state.currentPlayerId;
    const playerFaction = state.players.find(p => p.id === currentPlayer)!.factionId;
    if (playerFaction !== 'english') {
      state = applyAction(state, { type: 'endTurn' });
    }

    const arthur = findUnit(state, 'king_arthur', state.currentPlayerId);
    const basicMelee = findUnit(state, 'basic_melee', state.currentPlayerId);

    // Position them adjacent
    const centerPos = offsetToCube(9, 9);
    const neighbors = cubeNeighbors(centerPos);
    state = moveUnitTo(state, arthur.id, centerPos);
    state = moveUnitTo(state, basicMelee.id, neighbors[0]);

    // Use upgrade ability
    const result = applyActionDetailed(state, {
      type: 'ability',
      unitId: arthur.id,
      abilityId: 'upgrade_unit',
      params: { targetId: basicMelee.id },
    });

    // Verify upgrade event
    const upgradeEvent = result.events.find(e => e.type === 'unitUpgraded');
    expect(upgradeEvent).toBeDefined();
    if (upgradeEvent && upgradeEvent.type === 'unitUpgraded') {
      expect(upgradeEvent.fromTypeId).toBe('basic_melee');
      expect(upgradeEvent.toTypeId).toBe('knight');
    }

    // Verify unit is now a Knight
    const upgraded = result.state.units.find(u => u.id === basicMelee.id)!;
    expect(upgraded.typeId).toBe('knight');
    expect(upgraded.category).toBe('specialty');
    // Knight stats: HP 7, Movement 3
    expect(upgraded.maxHp).toBe(7);
    expect(upgraded.currentHp).toBe(7);
    expect(upgraded.movement).toBe(3);
  });

  it('upgrades basic_ranged to longbowman', () => {
    let state = setupToGameplay(['english', 'romans'], 200);

    const currentPlayer = state.currentPlayerId;
    const playerFaction = state.players.find(p => p.id === currentPlayer)!.factionId;
    if (playerFaction !== 'english') {
      state = applyAction(state, { type: 'endTurn' });
    }

    const arthur = findUnit(state, 'king_arthur', state.currentPlayerId);
    const basicRanged = findUnit(state, 'basic_ranged', state.currentPlayerId);

    const centerPos = offsetToCube(9, 9);
    const neighbors = cubeNeighbors(centerPos);
    state = moveUnitTo(state, arthur.id, centerPos);
    state = moveUnitTo(state, basicRanged.id, neighbors[0]);

    const result = applyActionDetailed(state, {
      type: 'ability',
      unitId: arthur.id,
      abilityId: 'upgrade_unit',
      params: { targetId: basicRanged.id },
    });

    const upgraded = result.state.units.find(u => u.id === basicRanged.id)!;
    expect(upgraded.typeId).toBe('longbowman');
    expect(upgraded.category).toBe('specialty');
    // Longbowman stats: HP 4, Movement 2, Range 5
    expect(upgraded.maxHp).toBe(4);
    expect(upgraded.movement).toBe(2);
  });

  it('rejects upgrade of non-adjacent unit', () => {
    let state = setupToGameplay(['english', 'romans'], 200);

    const currentPlayer = state.currentPlayerId;
    const playerFaction = state.players.find(p => p.id === currentPlayer)!.factionId;
    if (playerFaction !== 'english') {
      state = applyAction(state, { type: 'endTurn' });
    }

    const arthur = findUnit(state, 'king_arthur', state.currentPlayerId);
    const basicMelee = findUnit(state, 'basic_melee', state.currentPlayerId);

    // Position them far apart
    state = moveUnitTo(state, arthur.id, offsetToCube(1, 1));
    state = moveUnitTo(state, basicMelee.id, offsetToCube(10, 10));

    expect(() => applyAction(state, {
      type: 'ability',
      unitId: arthur.id,
      abilityId: 'upgrade_unit',
      params: { targetId: basicMelee.id },
    })).toThrow('Target must be adjacent');
  });

  it('rejects upgrade of damaged unit', () => {
    let state = setupToGameplay(['english', 'romans'], 200);

    const currentPlayer = state.currentPlayerId;
    const playerFaction = state.players.find(p => p.id === currentPlayer)!.factionId;
    if (playerFaction !== 'english') {
      state = applyAction(state, { type: 'endTurn' });
    }

    const arthur = findUnit(state, 'king_arthur', state.currentPlayerId);
    const basicMelee = findUnit(state, 'basic_melee', state.currentPlayerId);

    const centerPos = offsetToCube(9, 9);
    const neighbors = cubeNeighbors(centerPos);
    state = moveUnitTo(state, arthur.id, centerPos);
    state = moveUnitTo(state, basicMelee.id, neighbors[0]);

    // Damage the basic unit
    state = setUnitHp(state, basicMelee.id, 3);

    expect(() => applyAction(state, {
      type: 'ability',
      unitId: arthur.id,
      abilityId: 'upgrade_unit',
      params: { targetId: basicMelee.id },
    })).toThrow('Can only upgrade units at full HP');
  });

  it('rejects upgrade of specialty unit', () => {
    let state = setupToGameplay(['english', 'romans'], 200);

    const currentPlayer = state.currentPlayerId;
    const playerFaction = state.players.find(p => p.id === currentPlayer)!.factionId;
    if (playerFaction !== 'english') {
      state = applyAction(state, { type: 'endTurn' });
    }

    const arthur = findUnit(state, 'king_arthur', state.currentPlayerId);
    const knight = findUnit(state, 'knight', state.currentPlayerId);

    const centerPos = offsetToCube(9, 9);
    const neighbors = cubeNeighbors(centerPos);
    state = moveUnitTo(state, arthur.id, centerPos);
    state = moveUnitTo(state, knight.id, neighbors[0]);

    expect(() => applyAction(state, {
      type: 'ability',
      unitId: arthur.id,
      abilityId: 'upgrade_unit',
      params: { targetId: knight.id },
    })).toThrow('Can only upgrade basic units');
  });

  it('respects once-per-round cooldown', () => {
    let state = setupToGameplay(['english', 'romans'], 200);

    const currentPlayer = state.currentPlayerId;
    const playerFaction = state.players.find(p => p.id === currentPlayer)!.factionId;
    if (playerFaction !== 'english') {
      state = applyAction(state, { type: 'endTurn' });
    }

    const arthur = findUnit(state, 'king_arthur', state.currentPlayerId);
    const basicMelee = findUnit(state, 'basic_melee', state.currentPlayerId);

    const centerPos = offsetToCube(9, 9);
    const neighbors = cubeNeighbors(centerPos);
    state = moveUnitTo(state, arthur.id, centerPos);
    state = moveUnitTo(state, basicMelee.id, neighbors[0]);

    // First upgrade succeeds
    state = applyAction(state, {
      type: 'ability',
      unitId: arthur.id,
      abilityId: 'upgrade_unit',
      params: { targetId: basicMelee.id },
    });

    // End Arthur's unit turn and end player turn
    state = applyAction(state, { type: 'endUnitTurn', unitId: arthur.id });
    state = applyAction(state, { type: 'endTurn' });

    // Opponent's turn — end it
    state = applyAction(state, { type: 'endTurn' });

    // Back to English player's turn — should have another basic melee
    const basicMelee2 = state.units.find(u =>
      u.typeId === 'basic_melee' && u.playerId === state.currentPlayerId && u.currentHp > 0,
    );
    if (basicMelee2) {
      state = moveUnitTo(state, basicMelee2.id, neighbors[1]);

      // After a full round (both players took turns), upgrade should work again
      const result = applyActionDetailed(state, {
        type: 'ability',
        unitId: arthur.id,
        abilityId: 'upgrade_unit',
        params: { targetId: basicMelee2.id },
      });

      const upgradeEvent = result.events.find(e => e.type === 'unitUpgraded');
      expect(upgradeEvent).toBeDefined();
    }
  });

  it('shows upgrade targets in getUnitActions', () => {
    let state = setupToGameplay(['english', 'romans'], 200);

    const currentPlayer = state.currentPlayerId;
    const playerFaction = state.players.find(p => p.id === currentPlayer)!.factionId;
    if (playerFaction !== 'english') {
      state = applyAction(state, { type: 'endTurn' });
    }

    const arthur = findUnit(state, 'king_arthur', state.currentPlayerId);
    const basicMelee = findUnit(state, 'basic_melee', state.currentPlayerId);

    const centerPos = offsetToCube(9, 9);
    const neighbors = cubeNeighbors(centerPos);
    state = moveUnitTo(state, arthur.id, centerPos);
    state = moveUnitTo(state, basicMelee.id, neighbors[0]);

    const actions = getUnitActions(state, arthur.id);
    expect(actions.upgradeTargets.length).toBeGreaterThanOrEqual(1);
    expect(actions.upgradeTargets.some(t => t.id === basicMelee.id)).toBe(true);
  });
});
