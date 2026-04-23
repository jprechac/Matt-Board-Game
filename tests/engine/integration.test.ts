import { describe, it, expect } from 'vitest';
import { createGame, applyAction } from '../../src/engine/game.js';
import type { GameConfig } from '../../src/engine/game.js';
import type { GameState, PlayerId, Unit, CubeCoord } from '../../src/engine/types.js';
import { cubeNeighbors, hexKey, cubeDistance } from '../../src/engine/hex.js';
import { isOnBoard, getBaseCells } from '../../src/engine/board.js';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';

registerAllAbilities();

const CONFIG: GameConfig = {
  boardSize: '2p',
  playerIds: ['player1', 'player2'],
  seed: 123,
};

function findEmptyPlacementHex(state: GameState, playerId: PlayerId, exclude: Set<string>): CubeCoord {
  const cells = Object.values(state.board.cells)
    .filter(c => c.placementZonePlayerId === playerId);
  const occupied = new Set([
    ...state.units.map(u => hexKey(u.position)),
    ...exclude,
  ]);
  const available = cells.filter(c => !occupied.has(hexKey(c.coord)));
  if (available.length === 0) throw new Error('No empty placement hex');
  return available[0].coord;
}

function findEmptyNeighbor(state: GameState, pos: CubeCoord): CubeCoord | null {
  const neighbors = cubeNeighbors(pos);
  const occupied = new Set(state.units.filter(u => u.currentHp > 0).map(u => hexKey(u.position)));
  return neighbors.find(n => isOnBoard(state.board, n) && !occupied.has(hexKey(n))) ?? null;
}

function findUnitTarget(state: GameState, attacker: Unit): Unit | null {
  const player = state.players.find(p => p.id === attacker.playerId)!;
  // Look up attack range from the unit def
  const range = attacker.typeId === 'basic_ranged' ? 4
    : attacker.typeId === 'axe_thrower' ? 3
    : 1;

  return state.units.find(u =>
    u.currentHp > 0 &&
    u.playerId !== attacker.playerId &&
    cubeDistance(attacker.position, u.position) <= range,
  ) ?? null;
}

describe('integration: full game', () => {
  it('plays a complete game from setup through victory via surrender', () => {
    // ===== SETUP =====
    let state = createGame(CONFIG);
    expect(state.phase).toBe('setup');

    // Choose priority (2-step flow)
    const winner = state.currentPlayerId;
    const loser = state.players.find(p => p.id !== winner)!.id;
    state = applyAction(state, {
      type: 'choosePriority',
      playerId: winner,
      orderToControl: 'factionOrder',
      position: 'first',
    });
    expect(state.setupState!.currentStep).toBe('loserChoosePriority');
    state = applyAction(state, {
      type: 'choosePriority',
      playerId: loser,
      position: 'first',
    });
    expect(state.setupState!.currentStep).toBe('factionSelection');

    // Select factions
    const factionOrder = state.setupState!.factionSelectionOrder;
    state = applyAction(state, {
      type: 'selectFaction',
      playerId: factionOrder[0],
      factionId: 'romans',
    });
    state = applyAction(state, {
      type: 'selectFaction',
      playerId: factionOrder[1],
      factionId: 'vikings',
    });
    expect(state.setupState!.currentStep).toBe('armyComposition');

    // Set army compositions (blind/simultaneous)
    const romansPlayer = state.players.find(p => p.factionId === 'romans')!;
    const vikingsPlayer = state.players.find(p => p.factionId === 'vikings')!;

    state = applyAction(state, {
      type: 'setArmyComposition',
      playerId: romansPlayer.id,
      composition: {
        basicMelee: 2, basicRanged: 1,
        specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'centurion', 'centurion'],
      },
    });
    state = applyAction(state, {
      type: 'setArmyComposition',
      playerId: vikingsPlayer.id,
      composition: {
        basicMelee: 1, basicRanged: 2,
        specialtyChoices: ['berserker', 'berserker', 'axe_thrower', 'axe_thrower', 'axe_thrower'],
      },
    });

    expect(state.phase).toBe('placement');

    // ===== PLACEMENT =====
    const usedPositions = new Set<string>();
    while (state.phase === 'placement') {
      const placer = state.currentPlayerId;
      const roster = state.setupState!.unplacedRoster[placer] as string[] | undefined;
      if (!roster || roster.length === 0) break; // safety check

      const pos = findEmptyPlacementHex(state, placer, usedPositions);
      usedPositions.add(hexKey(pos));

      state = applyAction(state, {
        type: 'placeUnit',
        playerId: placer,
        unitTypeId: roster[0],
        position: pos,
      });
    }

    expect(state.phase).toBe('gameplay');
    expect(state.units).toHaveLength(18);
    expect(state.turnNumber).toBe(1);

    // Verify each player has 9 units
    for (const p of state.players) {
      const playerUnits = state.units.filter(u => u.playerId === p.id);
      expect(playerUnits).toHaveLength(9);
    }

    // Verify leaders are placed
    const romansLeader = state.units.find(u => u.typeId === 'julius_caesar');
    const vikingsLeader = state.units.find(u => u.typeId === 'eric_the_red');
    expect(romansLeader).toBeDefined();
    expect(vikingsLeader).toBeDefined();

    // ===== GAMEPLAY: Play a few turns =====
    const maxTurns = 10;
    let turnsPlayed = 0;

    while (state.phase === 'gameplay' && turnsPlayed < maxTurns) {
      const currentPlayer = state.currentPlayerId;
      const myUnits = state.units.filter(u =>
        u.playerId === currentPlayer && u.currentHp > 0 && !u.activatedThisTurn,
      );

      // Activate a few units, then end turn
      let unitsActed = 0;
      for (const unit of myUnits) {
        if (unitsActed >= 3) break; // Act with up to 3 units per turn
        if (state.phase !== 'gameplay') break;

        // Try to move
        const emptyNeighbor = findEmptyNeighbor(state, unit.position);
        if (emptyNeighbor) {
          try {
            state = applyAction(state, { type: 'move', unitId: unit.id, to: emptyNeighbor });
          } catch {
            // Move failed (e.g., not reachable), skip
          }
        }

        // Try to attack
        const updatedUnit = state.units.find(u => u.id === unit.id)!;
        const target = findUnitTarget(state, updatedUnit);
        if (target && !updatedUnit.hasAttackedThisTurn) {
          try {
            state = applyAction(state, { type: 'attack', unitId: unit.id, targetId: target.id });
          } catch {
            // Attack failed, skip
          }
        }

        // End this unit's turn
        if (state.phase === 'gameplay') {
          try {
            state = applyAction(state, { type: 'endUnitTurn', unitId: unit.id });
            unitsActed++;
          } catch {
            break;
          }
        }
      }

      // End turn
      if (state.phase === 'gameplay') {
        state = applyAction(state, { type: 'endTurn' });
        turnsPlayed++;
      }
    }

    // ===== VICTORY: End via surrender if not already won =====
    if (state.phase === 'gameplay') {
      state = applyAction(state, {
        type: 'surrender',
        playerId: state.currentPlayerId,
      });
    }

    expect(state.phase).toBe('victory');
    expect(state.winner).toBeDefined();
    expect(state.winCondition).toBeDefined();

    // Game state is consistent
    expect(state.units.length).toBeGreaterThan(0);
  });

  it('is deterministic — same seed produces same game', () => {
    function playToGameplay(seed: number): GameState {
      let s = createGame({ ...CONFIG, seed });
      const winner = s.currentPlayerId;
      s = applyAction(s, { type: 'choosePriority', playerId: winner, orderToControl: 'moveOrder', position: 'first' });
      const loser = s.players.find(p => p.id !== winner)!.id;
      s = applyAction(s, { type: 'choosePriority', playerId: loser, position: 'first' });
      const factionOrder = s.setupState!.factionSelectionOrder;
      s = applyAction(s, { type: 'selectFaction', playerId: factionOrder[0], factionId: 'aztecs' });
      s = applyAction(s, { type: 'selectFaction', playerId: factionOrder[1], factionId: 'english' });

      s = applyAction(s, {
        type: 'setArmyComposition',
        playerId: s.players.find(p => p.factionId === 'aztecs')!.id,
        composition: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['jaguar_warrior', 'jaguar_warrior', 'jaguar_warrior', 'priest', 'priest'] },
      });
      s = applyAction(s, {
        type: 'setArmyComposition',
        playerId: s.players.find(p => p.factionId === 'english')!.id,
        composition: { basicMelee: 1, basicRanged: 2, specialtyChoices: ['knight', 'knight', 'knight', 'longbowman', 'longbowman'] },
      });

      // Place all
      const used = new Set<string>();
      while (s.phase === 'placement') {
        const placer = s.currentPlayerId;
        const roster = s.setupState!.unplacedRoster[placer] as string[] | undefined;
        if (!roster || roster.length === 0) break;
        const pos = findEmptyPlacementHex(s, placer, used);
        used.add(hexKey(pos));
        s = applyAction(s, { type: 'placeUnit', playerId: placer, unitTypeId: roster[0], position: pos });
      }
      return s;
    }

    const g1 = playToGameplay(999);
    const g2 = playToGameplay(999);

    expect(g1.rngState).toBe(g2.rngState);
    expect(g1.units.map(u => u.id)).toEqual(g2.units.map(u => u.id));
    expect(g1.units.map(u => hexKey(u.position))).toEqual(g2.units.map(u => hexKey(u.position)));
  });
});
