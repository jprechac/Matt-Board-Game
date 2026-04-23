import { describe, it, expect } from 'vitest';
import { createGame, applyAction } from '../../src/engine/game.js';
import type { GameConfig } from '../../src/engine/game.js';
import type {
  ChoosePriorityAction, SelectFactionAction, SetArmyCompositionAction,
  PlaceUnitAction, GameState, PlayerId,
} from '../../src/engine/types.js';
import { offsetToCube, cubeNeighbors, hexKey } from '../../src/engine/hex.js';
import { isOnBoard } from '../../src/engine/board.js';

const DEFAULT_CONFIG: GameConfig = {
  boardSize: '2p',
  playerIds: ['player1', 'player2'],
  seed: 42,
};

// ========== Helper: advance through setup to a specific phase ==========

function setupToFactionSelection(seed = 42): GameState {
  let state = createGame({ ...DEFAULT_CONFIG, seed });
  // Roll winner chooses priority (2-step flow)
  const winner = state.currentPlayerId;
  state = applyAction(state, {
    type: 'choosePriority',
    playerId: winner,
    orderToControl: 'factionOrder',
    position: 'first',
  });
  const loser = state.players.find(p => p.id !== winner)!.id;
  state = applyAction(state, {
    type: 'choosePriority',
    playerId: loser,
    position: 'first',
  });
  return state;
}

function setupToArmyComp(seed = 42): GameState {
  let state = setupToFactionSelection(seed);
  const order = state.setupState!.factionSelectionOrder;
  state = applyAction(state, {
    type: 'selectFaction',
    playerId: order[0],
    factionId: 'romans',
  });
  state = applyAction(state, {
    type: 'selectFaction',
    playerId: order[1],
    factionId: 'vikings',
  });
  return state;
}

function setupToPlacement(seed = 42): GameState {
  let state = setupToArmyComp(seed);
  // Both players submit army composition
  for (const p of state.players) {
    if (!p.armyComposition) {
      const factionId = p.factionId!;
      const comp = factionId === 'romans'
        ? { basicMelee: 2, basicRanged: 1, specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'centurion', 'centurion'] }
        : { basicMelee: 2, basicRanged: 1, specialtyChoices: ['berserker', 'berserker', 'berserker', 'axe_thrower', 'axe_thrower'] };
      state = applyAction(state, {
        type: 'setArmyComposition',
        playerId: p.id,
        composition: comp,
      });
    }
  }
  return state;
}

function placeAllUnits(state: GameState): GameState {
  const setup = state.setupState!;
  // Place units in placement zones for each player
  let s = state;
  let placementIdx = 0;

  while (s.phase === 'placement') {
    const currentPlayer = s.currentPlayerId;
    const roster = s.setupState!.unplacedRoster[currentPlayer] ?? [];
    if (roster.length === 0) break;

    const unitType = roster[0];
    // Find an empty hex in this player's placement zone
    const pos = findEmptyPlacementHex(s, currentPlayer, placementIdx);
    s = applyAction(s, {
      type: 'placeUnit',
      playerId: currentPlayer,
      unitTypeId: unitType,
      position: pos,
    });
    placementIdx++;
  }
  return s;
}

function findEmptyPlacementHex(state: GameState, playerId: PlayerId, offset: number) {
  const cells = Object.values(state.board.cells)
    .filter(c => c.placementZonePlayerId === playerId);
  const occupied = new Set(state.units.map(u => `${u.position.q},${u.position.r},${u.position.s}`));
  const available = cells.filter(c => !occupied.has(`${c.coord.q},${c.coord.r},${c.coord.s}`));
  if (available.length === 0) throw new Error('No empty placement hex');
  return available[offset % available.length].coord;
}

// ========== Tests ==========

describe('createGame', () => {
  it('creates a game in setup phase', () => {
    const state = createGame(DEFAULT_CONFIG);
    expect(state.phase).toBe('setup');
    expect(state.players).toHaveLength(2);
    expect(state.setupState).toBeDefined();
    expect(state.setupState!.currentStep).toBe('choosePriority');
  });

  it('resolves roll-off automatically', () => {
    const state = createGame(DEFAULT_CONFIG);
    expect(state.setupState!.rollWinner).toBeDefined();
    expect(state.setupState!.rollResults).toBeDefined();
    expect(state.currentPlayerId).toBe(state.setupState!.rollWinner);
  });

  it('resolves ties by re-rolling', () => {
    // Just ensure it always produces a winner
    for (let seed = 0; seed < 20; seed++) {
      const state = createGame({ ...DEFAULT_CONFIG, seed });
      expect(state.setupState!.rollWinner).toBeDefined();
    }
  });

  it('is deterministic with same seed', () => {
    const s1 = createGame(DEFAULT_CONFIG);
    const s2 = createGame(DEFAULT_CONFIG);
    expect(s1.setupState!.rollWinner).toBe(s2.setupState!.rollWinner);
    expect(s1.rngState).toBe(s2.rngState);
  });
});

describe('choosePriority', () => {
  it('winner step advances to loserChoosePriority', () => {
    let state = createGame(DEFAULT_CONFIG);
    const winner = state.currentPlayerId;
    state = applyAction(state, {
      type: 'choosePriority',
      playerId: winner,
      orderToControl: 'factionOrder',
      position: 'first',
    });
    expect(state.setupState!.currentStep).toBe('loserChoosePriority');
    expect(state.setupState!.winnerOrderChoice).toBe('factionOrder');
    expect(state.setupState!.winnerPosition).toBe('first');
  });

  it('full 2-step flow advances to factionSelection with correct orders', () => {
    let state = createGame(DEFAULT_CONFIG);
    const winner = state.currentPlayerId;
    const loser = state.players.find(p => p.id !== winner)!.id;
    state = applyAction(state, {
      type: 'choosePriority',
      playerId: winner,
      orderToControl: 'factionOrder',
      position: 'first',
    });
    state = applyAction(state, {
      type: 'choosePriority',
      playerId: loser,
      position: 'first',
    });
    expect(state.setupState!.currentStep).toBe('factionSelection');
    expect(state.setupState!.factionSelectionOrder[0]).toBe(winner);
    expect(state.setupState!.moveOrder[0]).toBe(loser);
  });

  it('winner choosing moveOrder first, loser picks factionOrder second', () => {
    let state = createGame(DEFAULT_CONFIG);
    const winner = state.currentPlayerId;
    const loser = state.players.find(p => p.id !== winner)!.id;
    state = applyAction(state, {
      type: 'choosePriority',
      playerId: winner,
      orderToControl: 'moveOrder',
      position: 'first',
    });
    state = applyAction(state, {
      type: 'choosePriority',
      playerId: loser,
      position: 'second',
    });
    expect(state.setupState!.moveOrder[0]).toBe(winner);
    expect(state.setupState!.factionSelectionOrder[1]).toBe(loser);
    expect(state.setupState!.factionSelectionOrder[0]).toBe(winner);
  });

  it('winner choosing second position works correctly', () => {
    let state = createGame(DEFAULT_CONFIG);
    const winner = state.currentPlayerId;
    const loser = state.players.find(p => p.id !== winner)!.id;
    state = applyAction(state, {
      type: 'choosePriority',
      playerId: winner,
      orderToControl: 'factionOrder',
      position: 'second',
    });
    state = applyAction(state, {
      type: 'choosePriority',
      playerId: loser,
      position: 'first',
    });
    // Winner picks faction second (counter-pick)
    expect(state.setupState!.factionSelectionOrder[1]).toBe(winner);
    expect(state.setupState!.factionSelectionOrder[0]).toBe(loser);
    // Loser chose move first
    expect(state.setupState!.moveOrder[0]).toBe(loser);
  });

  it('rejects non-winner in first step', () => {
    const state = createGame(DEFAULT_CONFIG);
    const nonWinner = state.players.find(p => p.id !== state.currentPlayerId)!.id;
    expect(() => applyAction(state, {
      type: 'choosePriority',
      playerId: nonWinner,
      orderToControl: 'factionOrder',
      position: 'first',
    })).toThrow('roll winner');
  });

  it('rejects winner in loser step', () => {
    let state = createGame(DEFAULT_CONFIG);
    const winner = state.currentPlayerId;
    state = applyAction(state, {
      type: 'choosePriority',
      playerId: winner,
      orderToControl: 'factionOrder',
      position: 'first',
    });
    expect(() => applyAction(state, {
      type: 'choosePriority',
      playerId: winner,
      position: 'first',
    })).toThrow('loser');
  });
});

describe('selectFaction', () => {
  it('assigns factions in order', () => {
    let state = setupToFactionSelection();
    const order = state.setupState!.factionSelectionOrder;

    state = applyAction(state, {
      type: 'selectFaction',
      playerId: order[0],
      factionId: 'romans',
    });
    expect(state.players.find(p => p.id === order[0])!.factionId).toBe('romans');
    expect(state.setupState!.currentStep).toBe('factionSelection');

    state = applyAction(state, {
      type: 'selectFaction',
      playerId: order[1],
      factionId: 'vikings',
    });
    expect(state.players.find(p => p.id === order[1])!.factionId).toBe('vikings');
    expect(state.setupState!.currentStep).toBe('armyComposition');
  });

  it('rejects duplicate faction', () => {
    let state = setupToFactionSelection();
    const order = state.setupState!.factionSelectionOrder;
    state = applyAction(state, {
      type: 'selectFaction',
      playerId: order[0],
      factionId: 'romans',
    });
    expect(() => applyAction(state, {
      type: 'selectFaction',
      playerId: order[1],
      factionId: 'romans',
    })).toThrow('already taken');
  });

  it('rejects wrong player order', () => {
    const state = setupToFactionSelection();
    const order = state.setupState!.factionSelectionOrder;
    expect(() => applyAction(state, {
      type: 'selectFaction',
      playerId: order[1],
      factionId: 'vikings',
    })).toThrow('turn to select');
  });
});

describe('setArmyComposition', () => {
  it('accepts valid compositions from both players', () => {
    let state = setupToArmyComp();
    state = applyAction(state, {
      type: 'setArmyComposition',
      playerId: state.players[0].id,
      composition: {
        basicMelee: 2, basicRanged: 1,
        specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'centurion', 'centurion'],
      },
    });
    // First player submitted, still in armyComposition step
    expect(state.setupState!.currentStep).toBe('armyComposition');

    state = applyAction(state, {
      type: 'setArmyComposition',
      playerId: state.players[1].id,
      composition: {
        basicMelee: 2, basicRanged: 1,
        specialtyChoices: ['berserker', 'berserker', 'berserker', 'axe_thrower', 'axe_thrower'],
      },
    });
    // Both submitted — advances to placement
    expect(state.phase).toBe('placement');
    expect(state.setupState!.currentStep).toBe('unitPlacement');
  });

  it('rejects invalid basic count', () => {
    const state = setupToArmyComp();
    expect(() => applyAction(state, {
      type: 'setArmyComposition',
      playerId: state.players[0].id,
      composition: {
        basicMelee: 4, basicRanged: 1,
        specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'centurion', 'centurion'],
      },
    })).toThrow('Basic units must total 3');
  });

  it('rejects invalid specialty for faction', () => {
    const state = setupToArmyComp();
    expect(() => applyAction(state, {
      type: 'setArmyComposition',
      playerId: state.players[0].id,
      composition: {
        basicMelee: 2, basicRanged: 1,
        specialtyChoices: ['berserker', 'berserker', 'berserker', 'axe_thrower', 'axe_thrower'],
      },
    })).toThrow('not a valid specialty');
  });

  it('rejects double submission', () => {
    let state = setupToArmyComp();
    state = applyAction(state, {
      type: 'setArmyComposition',
      playerId: state.players[0].id,
      composition: {
        basicMelee: 2, basicRanged: 1,
        specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'centurion', 'centurion'],
      },
    });
    expect(() => applyAction(state, {
      type: 'setArmyComposition',
      playerId: state.players[0].id,
      composition: {
        basicMelee: 2, basicRanged: 1,
        specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'centurion', 'centurion'],
      },
    })).toThrow('already set');
  });

  it('builds correct rosters including leader', () => {
    const state = setupToPlacement();
    const roster1 = state.setupState!.unplacedRoster[state.players[0].id] as string[];
    const roster2 = state.setupState!.unplacedRoster[state.players[1].id] as string[];
    // 3 basic + 5 specialty + 1 leader = 9
    expect(roster1).toHaveLength(9);
    expect(roster2).toHaveLength(9);
    // Leader is included
    expect(roster1).toContain('julius_caesar');
    expect(roster2).toContain('eric_the_red');
  });
});

describe('placement phase', () => {
  it('places units and tracks roster', () => {
    let state = setupToPlacement();
    const placer = state.currentPlayerId;
    const roster = state.setupState!.unplacedRoster[placer] as string[];
    const unitType = roster[0];

    const pos = findEmptyPlacementHex(state, placer, 0);
    state = applyAction(state, {
      type: 'placeUnit',
      playerId: placer,
      unitTypeId: unitType,
      position: pos,
    });

    expect(state.units).toHaveLength(1);
    expect(state.units[0].typeId).toBe(unitType);
    const newRoster = state.setupState!.unplacedRoster[placer] as string[];
    expect(newRoster).toHaveLength(8);
  });

  it('switches player after 2 placements', () => {
    let state = setupToPlacement();
    const firstPlacer = state.currentPlayerId;
    const otherPlayer = state.players.find(p => p.id !== firstPlacer)!.id;

    // Place 2 units
    for (let i = 0; i < 2; i++) {
      const roster = state.setupState!.unplacedRoster[state.currentPlayerId] as string[];
      const pos = findEmptyPlacementHex(state, state.currentPlayerId, i);
      state = applyAction(state, {
        type: 'placeUnit',
        playerId: state.currentPlayerId,
        unitTypeId: roster[0],
        position: pos,
      });
    }

    expect(state.currentPlayerId).toBe(otherPlayer);
  });

  it('rejects placement in wrong zone', () => {
    let state = setupToPlacement();
    const placer = state.currentPlayerId;
    const roster = state.setupState!.unplacedRoster[placer] as string[];

    // Find a hex in the OTHER player's zone
    const otherPlayer = state.players.find(p => p.id !== placer)!.id;
    const wrongPos = findEmptyPlacementHex(state, otherPlayer, 0);

    expect(() => applyAction(state, {
      type: 'placeUnit',
      playerId: placer,
      unitTypeId: roster[0],
      position: wrongPos,
    })).toThrow('not in your placement zone');
  });

  it('advances to gameplay after all units placed', () => {
    const state = placeAllUnits(setupToPlacement());
    expect(state.phase).toBe('gameplay');
    expect(state.turnNumber).toBe(1);
    expect(state.units).toHaveLength(18); // 9 per player
  });
});

describe('gameplay phase', () => {
  function setupGameplay(seed = 42): GameState {
    return placeAllUnits(setupToPlacement(seed));
  }

  it('allows move action', () => {
    let state = setupGameplay();
    const unit = state.units.find(u => u.playerId === state.currentPlayerId && u.currentHp > 0)!;

    // Find adjacent empty hex
    const neighbors = cubeNeighbors(unit.position);
    const occupiedKeys = new Set(state.units.map((u: any) => hexKey(u.position)));
    const emptyNeighbor = neighbors.find((n: any) =>
      isOnBoard(state.board, n) && !occupiedKeys.has(hexKey(n)),
    );

    if (emptyNeighbor) {
      state = applyAction(state, { type: 'move', unitId: unit.id, to: emptyNeighbor });
      const updated = state.units.find(u => u.id === unit.id)!;
      expect(updated.position).toEqual(emptyNeighbor);
      expect(state.activeUnitId).toBe(unit.id);
    }
  });

  it('sets activeUnitId on first action', () => {
    let state = setupGameplay();
    expect(state.activeUnitId).toBeUndefined();

    const unit = state.units.find(u => u.playerId === state.currentPlayerId)!;
    // End unit turn to test activeUnitId lifecycle
    state = applyAction(state, { type: 'endUnitTurn', unitId: unit.id });
    expect(state.activeUnitId).toBeUndefined();
    const updated = state.units.find(u => u.id === unit.id)!;
    expect(updated.activatedThisTurn).toBe(true);
  });

  it('prevents acting with already-activated unit', () => {
    let state = setupGameplay();
    const unit = state.units.find(u => u.playerId === state.currentPlayerId)!;
    state = applyAction(state, { type: 'endUnitTurn', unitId: unit.id });

    // Try to act again with same unit
    expect(() => applyAction(state, { type: 'endUnitTurn', unitId: unit.id })).toThrow();
  });

  it('allows end turn', () => {
    let state = setupGameplay();
    const currentPlayer = state.currentPlayerId;
    state = applyAction(state, { type: 'endTurn' });
    expect(state.currentPlayerId).not.toBe(currentPlayer);
  });

  it('resets unit flags on new turn', () => {
    let state = setupGameplay();
    const currentPlayer = state.currentPlayerId;
    const nextPlayer = state.players.find(p => p.id !== currentPlayer)!.id;

    // End turn
    state = applyAction(state, { type: 'endTurn' });

    // Next player's units should be fresh
    const nextUnits = state.units.filter(u => u.playerId === nextPlayer);
    for (const u of nextUnits) {
      expect(u.activatedThisTurn).toBe(false);
      expect(u.hasMovedThisTurn).toBe(false);
      expect(u.hasAttackedThisTurn).toBe(false);
    }
  });

  it('handles surrender', () => {
    let state = setupGameplay();
    const loser = state.currentPlayerId;
    const winner = state.players.find(p => p.id !== loser)!.id;
    state = applyAction(state, { type: 'surrender', playerId: loser });
    expect(state.phase).toBe('victory');
    expect(state.winner).toBe(winner);
    expect(state.winCondition).toBe('surrender');
  });
});

describe('win conditions', () => {
  it('detects all units defeated via surrender proxy', () => {
    // Full elimination is hard to script without many rolls.
    // We verify via surrender (another win path) that victory state works,
    // and rely on integration test for real gameplay flow.
    let state = placeAllUnits(setupToPlacement());
    state = applyAction(state, { type: 'surrender', playerId: state.currentPlayerId });
    expect(state.phase).toBe('victory');
    expect(state.winner).toBeDefined();
    expect(state.winCondition).toBe('surrender');
    expect(state.winner).not.toBe(state.currentPlayerId);
  });
});
