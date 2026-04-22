import { describe, it, expect, beforeAll } from 'vitest';
import { getUnitActions, getAllLegalActions } from '../../src/engine/actions.js';
import { createRecordedGame, applyRecordedAction, getEventsByType } from '../../src/engine/recorder.js';
import type { GameConfig } from '../../src/engine/game.js';
import type { RecordedGame } from '../../src/engine/recorder.js';
import type { PlayerId, CubeCoord } from '../../src/engine/types.js';
import type { BaseControlChangedEvent } from '../../src/engine/events.js';
import { hexKey } from '../../src/engine/hex.js';
import { getBaseCells } from '../../src/engine/board.js';
import { serializeRecording, deserializeRecording } from '../../src/engine/serialization.js';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';

beforeAll(() => {
  registerAllAbilities();
});

const config: GameConfig = {
  boardSize: '2p',
  playerIds: ['player1', 'player2'],
  seed: 42,
};

function findPlacementHex(game: RecordedGame, playerId: PlayerId): CubeCoord {
  const cells = Object.values(game.state.board.cells);
  for (const cell of cells) {
    if (cell.placementZonePlayerId === playerId) {
      const occupied = game.state.units.some(u => hexKey(u.position) === hexKey(cell.coord));
      if (!occupied) return cell.coord;
    }
  }
  throw new Error(`No available placement hex for ${playerId}`);
}

function setupToGameplay(seed: number = 42): RecordedGame {
  let game = createRecordedGame({ boardSize: '2p', playerIds: ['player1', 'player2'], seed });
  const rollWinner = game.state.setupState!.rollWinner!;

  game = applyRecordedAction(game, {
    type: 'choosePriority', playerId: rollWinner, choice: 'pickFactionFirst',
  });

  const factionOrder = game.state.setupState!.factionSelectionOrder;
  game = applyRecordedAction(game, {
    type: 'selectFaction', playerId: factionOrder[0], factionId: 'romans',
  });
  game = applyRecordedAction(game, {
    type: 'selectFaction', playerId: factionOrder[1], factionId: 'vikings',
  });

  const comp = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'legionnaire', 'legionnaire'] };
  const comp2 = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['berserker', 'berserker', 'berserker', 'berserker', 'berserker'] };
  game = applyRecordedAction(game, {
    type: 'setArmyComposition', playerId: factionOrder[0], composition: factionOrder[0] === rollWinner ? comp : comp2,
  });
  game = applyRecordedAction(game, {
    type: 'setArmyComposition', playerId: factionOrder[1], composition: factionOrder[1] === rollWinner ? comp : comp2,
  });

  while (game.state.phase === 'placement') {
    const placer = game.state.currentPlayerId;
    const roster = game.state.setupState!.unplacedRoster[placer] as string[];
    const hex = findPlacementHex(game, placer);
    game = applyRecordedAction(game, {
      type: 'placeUnit', playerId: placer, unitTypeId: roster[0], position: hex,
    });
  }

  return game;
}

// ========== getUnitActions ==========

describe('getUnitActions', () => {
  it('returns available moves and attack targets for a unit', () => {
    const game = setupToGameplay();
    const currentPlayer = game.state.currentPlayerId;
    const unit = game.state.units.find(u =>
      u.playerId === currentPlayer && u.currentHp > 0,
    )!;

    const actions = getUnitActions(game.state, unit.id);
    expect(actions.moves.length).toBeGreaterThan(0);
    expect(actions.canEndUnitTurn).toBe(true);
  });

  it('returns empty for dead units', () => {
    const game = setupToGameplay();
    const deadUnit = { ...game.state.units[0], currentHp: 0 };
    const state = {
      ...game.state,
      units: [deadUnit, ...game.state.units.slice(1)],
    };

    const actions = getUnitActions(state, deadUnit.id);
    expect(actions.moves).toHaveLength(0);
    expect(actions.attackTargets).toHaveLength(0);
    expect(actions.canEndUnitTurn).toBe(false);
  });

  it('returns empty for opponent units', () => {
    const game = setupToGameplay();
    const opponentUnit = game.state.units.find(u =>
      u.playerId !== game.state.currentPlayerId && u.currentHp > 0,
    )!;

    const actions = getUnitActions(game.state, opponentUnit.id);
    expect(actions.moves).toHaveLength(0);
    expect(actions.attackTargets).toHaveLength(0);
    expect(actions.canEndUnitTurn).toBe(false);
  });

  it('returns empty for already-activated units', () => {
    let game = setupToGameplay();
    const unit = game.state.units.find(u =>
      u.playerId === game.state.currentPlayerId && u.currentHp > 0,
    )!;

    // End the unit's turn to mark it activated
    game = applyRecordedAction(game, { type: 'endUnitTurn', unitId: unit.id });

    const actions = getUnitActions(game.state, unit.id);
    expect(actions.moves).toHaveLength(0);
    expect(actions.canEndUnitTurn).toBe(false);
  });

  it('returns empty when game is over', () => {
    const game = setupToGameplay();
    const stateWithWinner = { ...game.state, winner: 'player1' as PlayerId };

    const unit = game.state.units.find(u => u.playerId === 'player1' && u.currentHp > 0)!;
    const actions = getUnitActions(stateWithWinner, unit.id);
    expect(actions.moves).toHaveLength(0);
    expect(actions.canEndUnitTurn).toBe(false);
  });
});

// ========== getAllLegalActions ==========

describe('getAllLegalActions', () => {
  it('returns actions during gameplay', () => {
    const game = setupToGameplay();
    const actions = getAllLegalActions(game.state);

    expect(actions.length).toBeGreaterThan(0);
    // Should include at least endTurn and surrender
    expect(actions.some(a => a.type === 'endTurn')).toBe(true);
    expect(actions.some(a => a.type === 'surrender')).toBe(true);
    // Should include unit actions (moves, endUnitTurn)
    expect(actions.some(a => a.type === 'move')).toBe(true);
    expect(actions.some(a => a.type === 'endUnitTurn')).toBe(true);
  });

  it('returns no actions when game is over', () => {
    const game = setupToGameplay();
    const stateWithWinner = { ...game.state, winner: 'player1' as PlayerId };
    const actions = getAllLegalActions(stateWithWinner);
    expect(actions).toHaveLength(0);
  });

  it('returns choosePriority actions during setup', () => {
    const game = createRecordedGame(config);
    const actions = getAllLegalActions(game.state);

    expect(actions).toHaveLength(2);
    expect(actions.every(a => a.type === 'choosePriority')).toBe(true);
  });

  it('returns faction selection actions after priority is chosen', () => {
    let game = createRecordedGame(config);
    const rollWinner = game.state.setupState!.rollWinner!;

    game = applyRecordedAction(game, {
      type: 'choosePriority', playerId: rollWinner, choice: 'pickFactionFirst',
    });

    const actions = getAllLegalActions(game.state);
    expect(actions.every(a => a.type === 'selectFaction')).toBe(true);
    expect(actions.length).toBe(11); // 11 factions
  });

  it('returns placement actions during placement phase', () => {
    let game = createRecordedGame(config);
    const rollWinner = game.state.setupState!.rollWinner!;

    game = applyRecordedAction(game, {
      type: 'choosePriority', playerId: rollWinner, choice: 'pickFactionFirst',
    });
    const factionOrder = game.state.setupState!.factionSelectionOrder;
    game = applyRecordedAction(game, {
      type: 'selectFaction', playerId: factionOrder[0], factionId: 'romans',
    });
    game = applyRecordedAction(game, {
      type: 'selectFaction', playerId: factionOrder[1], factionId: 'vikings',
    });
    const comp = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'legionnaire', 'legionnaire'] };
    const comp2 = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['berserker', 'berserker', 'berserker', 'berserker', 'berserker'] };
    game = applyRecordedAction(game, {
      type: 'setArmyComposition', playerId: factionOrder[0], composition: factionOrder[0] === rollWinner ? comp : comp2,
    });
    game = applyRecordedAction(game, {
      type: 'setArmyComposition', playerId: factionOrder[1], composition: factionOrder[1] === rollWinner ? comp : comp2,
    });

    const actions = getAllLegalActions(game.state);
    expect(actions.every(a => a.type === 'placeUnit')).toBe(true);
    expect(actions.length).toBeGreaterThan(0);
  });

  it('all returned gameplay actions produce a valid new state', () => {
    const game = setupToGameplay();
    const actions = getAllLegalActions(game.state);

    // Every action should be applicable (no throw)
    for (const action of actions) {
      expect(() => applyRecordedAction(game, action)).not.toThrow();
    }
  });
});

// ========== Test Gap: baseControlChanged events in recorder ==========

describe('baseControlChanged events in recorder', () => {
  it('emits baseControlChanged when attacker occupies undefended base', () => {
    let game = setupToGameplay();

    // checkBaseControl runs after turn switch, checking the NEW currentPlayer.
    // So we need: after turn ends and switches to nextPlayer, nextPlayer has
    // a unit in the original currentPlayer's base with no defenders.
    const currentPlayer = game.state.currentPlayerId;
    const nextPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';

    // Get current player's base cells (which nextPlayer needs to occupy)
    const currentPlayerBaseCells = getBaseCells(game.state.board, currentPlayer);
    const baseKeys = new Set(currentPlayerBaseCells.map(c => hexKey(c.coord)));

    // Modify state: remove current player's units from their own base, and
    // place one of nextPlayer's units in current player's base
    let modState = { ...game.state };
    const nextPlayerUnit = modState.units.find(u =>
      u.playerId === nextPlayer && u.currentHp > 0,
    )!;
    const baseCoord = currentPlayerBaseCells[0].coord;

    modState = {
      ...modState,
      units: modState.units.map(u => {
        // Kill any current player units in their own base
        if (u.playerId === currentPlayer && baseKeys.has(hexKey(u.position))) {
          return { ...u, currentHp: 0 };
        }
        // Move one nextPlayer unit into the base
        if (u.id === nextPlayerUnit.id) {
          return { ...u, position: baseCoord };
        }
        return u;
      }),
    };

    // End all current player's alive unit turns
    let modGame: RecordedGame = { ...game, state: modState };
    const aliveUnits = modState.units.filter(u =>
      u.playerId === currentPlayer && u.currentHp > 0 && !u.activatedThisTurn,
    );
    for (const u of aliveUnits) {
      modGame = applyRecordedAction(modGame, { type: 'endUnitTurn', unitId: u.id });
    }

    // End turn — switches to nextPlayer, then checkBaseControl runs
    modGame = applyRecordedAction(modGame, { type: 'endTurn' });

    const baseControlEvents = getEventsByType<BaseControlChangedEvent>(
      modGame.recording, 'baseControlChanged',
    );
    expect(baseControlEvents.length).toBeGreaterThanOrEqual(1);
    const evt = baseControlEvents[baseControlEvents.length - 1];
    expect(evt.playerId).toBe(nextPlayer);
    expect(evt.baseOwnerId).toBe(currentPlayer);
    expect(evt.timerValue).toBeGreaterThanOrEqual(1);
    expect(evt.timerReset).toBe(false);
  });
});

// ========== Test Gap: empty game serialization round-trip ==========

describe('empty game serialization round-trip', () => {
  it('serializes and deserializes a game with 0 gameplay actions', () => {
    const game = createRecordedGame(config);
    // Game has only pre-action events (gameStarted + rollOffResolved), 0 actions
    expect(game.recording.actions).toHaveLength(0);
    expect(game.recording.events.length).toBe(2);

    const json = serializeRecording(game.recording);
    const restored = deserializeRecording(json);

    expect(restored.actions).toHaveLength(0);
    expect(restored.events).toHaveLength(2);
    expect(restored.events[0].type).toBe('gameStarted');
    expect(restored.events[1].type).toBe('rollOffResolved');
  });
});
