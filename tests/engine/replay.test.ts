import { describe, it, expect, beforeAll } from 'vitest';
import { createRecordedGame, applyRecordedAction } from '../../src/engine/recorder.js';
import {
  createReplay, stepForward, stepBackward, goToAction, goToTurn, goToEvent,
  getCurrentState, getEventsUpTo, getActionCount, getEventCount, isAtEnd, isAtStart,
} from '../../src/engine/replay.js';
import {
  serializeRecording, deserializeRecording, SCHEMA_VERSION,
} from '../../src/engine/serialization.js';
import type { GameConfig } from '../../src/engine/game.js';
import type { RecordedGame } from '../../src/engine/recorder.js';
import type { PlayerId, CubeCoord } from '../../src/engine/types.js';
import { hexKey } from '../../src/engine/hex.js';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';

beforeAll(() => {
  registerAllAbilities();
});

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

  const comp1 = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'legionnaire', 'legionnaire'] };
  const comp2 = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['berserker', 'berserker', 'berserker', 'berserker', 'berserker'] };
  game = applyRecordedAction(game, {
    type: 'setArmyComposition', playerId: factionOrder[0], composition: factionOrder[0] === rollWinner ? comp1 : comp2,
  });
  game = applyRecordedAction(game, {
    type: 'setArmyComposition', playerId: factionOrder[1], composition: factionOrder[1] === rollWinner ? comp1 : comp2,
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

// ========== Replay Tests ==========

describe('replay - creation and navigation', () => {
  it('creates replay at initial state', () => {
    const game = setupToGameplay();
    const replay = createReplay(game.recording);

    expect(isAtStart(replay)).toBe(true);
    expect(isAtEnd(replay)).toBe(false);
    expect(replay.currentActionIndex).toBe(-1);
    expect(getActionCount(replay)).toBe(game.recording.actions.length);
    expect(getEventCount(replay)).toBe(game.recording.events.length);
  });

  it('getCurrentState returns initial state at start', () => {
    const game = setupToGameplay();
    const replay = createReplay(game.recording);
    const state = getCurrentState(replay);
    expect(state).toEqual(game.recording.initialState);
  });

  it('stepForward advances through actions', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);

    replay = stepForward(replay);
    expect(replay.currentActionIndex).toBe(0);
    expect(isAtStart(replay)).toBe(false);

    // State should differ from initial
    const state = getCurrentState(replay);
    expect(state).not.toEqual(game.recording.initialState);
  });

  it('stepForward through all actions reaches end state', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);

    while (!isAtEnd(replay)) {
      replay = stepForward(replay);
    }

    expect(isAtEnd(replay)).toBe(true);
    const finalState = getCurrentState(replay);
    expect(finalState.phase).toBe(game.state.phase);
    expect(finalState.units.length).toBe(game.state.units.length);
  });

  it('stepBackward returns to previous state', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);

    // Step forward twice
    replay = stepForward(replay);
    replay = stepForward(replay);
    const stateAt1 = getCurrentState(stepBackward(replay));

    // Step back
    replay = stepBackward(replay);
    expect(replay.currentActionIndex).toBe(0);
    expect(getCurrentState(replay)).toEqual(stateAt1);
  });

  it('stepBackward at start returns same replay', () => {
    const game = setupToGameplay();
    const replay = createReplay(game.recording);
    const result = stepBackward(replay);
    expect(result.currentActionIndex).toBe(-1);
  });

  it('stepForward at end returns same replay', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);
    while (!isAtEnd(replay)) replay = stepForward(replay);

    const result = stepForward(replay);
    expect(result.currentActionIndex).toBe(replay.currentActionIndex);
  });
});

describe('replay - random access', () => {
  it('goToAction jumps to specific action', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);

    // Jump to action 5
    replay = goToAction(replay, 5);
    expect(replay.currentActionIndex).toBe(5);

    // State should be cached
    expect(replay.stateHistory.length).toBeGreaterThanOrEqual(7); // 0 through 6
  });

  it('goToAction(-1) returns to initial state', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);
    replay = goToAction(replay, 5);
    replay = goToAction(replay, -1);
    expect(replay.currentActionIndex).toBe(-1);
    expect(getCurrentState(replay)).toEqual(game.recording.initialState);
  });

  it('goToAction throws for out-of-range index', () => {
    const game = setupToGameplay();
    const replay = createReplay(game.recording);
    expect(() => goToAction(replay, 9999)).toThrow('out of range');
    expect(() => goToAction(replay, -2)).toThrow('out of range');
  });

  it('goToEvent jumps to action that produced the event', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);

    // Find a unitPlaced event
    const placedIdx = game.recording.events.findIndex(e => e.type === 'unitPlaced');
    expect(placedIdx).toBeGreaterThan(-1);

    replay = goToEvent(replay, placedIdx);
    expect(replay.currentEventIndex).toBe(placedIdx);
    // State should have at least one unit placed
    expect(getCurrentState(replay).units.length).toBeGreaterThan(0);
  });

  it('goToEvent for pre-action events stays at initial state', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);

    // Event 0 = gameStarted (pre-action)
    replay = goToEvent(replay, 0);
    expect(replay.currentActionIndex).toBe(-1);
    expect(replay.currentEventIndex).toBe(0);
  });

  it('goToTurn(0) returns to initial state', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);
    replay = goToAction(replay, 10);
    replay = goToTurn(replay, 0);
    expect(replay.currentActionIndex).toBe(-1);
  });

  it('goToTurn(1) jumps to start of gameplay', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);
    replay = goToTurn(replay, 1);

    // Should be at the action that produced TurnStarted(1)
    const state = getCurrentState(replay);
    expect(state.phase).toBe('gameplay');
    expect(state.turnNumber).toBe(1);
  });

  it('goToTurn throws for nonexistent turn', () => {
    const game = setupToGameplay();
    const replay = createReplay(game.recording);
    expect(() => goToTurn(replay, 999)).toThrow('not found');
  });
});

describe('replay - state caching', () => {
  it('lazily caches states as needed', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);
    expect(replay.stateHistory.length).toBe(1); // just initial

    replay = stepForward(replay);
    expect(replay.stateHistory.length).toBe(2);

    // Jump ahead — fills cache incrementally
    replay = goToAction(replay, 10);
    expect(replay.stateHistory.length).toBe(12);

    // Going backward doesn't add more cache
    replay = stepBackward(replay);
    expect(replay.stateHistory.length).toBe(12);
  });

  it('forward/backward stepping produces consistent states', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);

    // Step forward 5 times, save states
    const states: ReturnType<typeof getCurrentState>[] = [getCurrentState(replay)];
    for (let i = 0; i < 5; i++) {
      replay = stepForward(replay);
      states.push(getCurrentState(replay));
    }

    // Step backward 5 times, verify states match
    for (let i = 5; i >= 1; i--) {
      expect(getCurrentState(replay)).toEqual(states[i]);
      replay = stepBackward(replay);
    }
    expect(getCurrentState(replay)).toEqual(states[0]);
  });
});

describe('replay - event timeline', () => {
  it('getEventsUpTo returns events up to current position', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);

    // At start, pre-action events exist but currentEventIndex is -1
    expect(getEventsUpTo(replay)).toHaveLength(0);

    // Step forward — should include events from first action
    replay = stepForward(replay);
    const events = getEventsUpTo(replay);
    expect(events.length).toBeGreaterThan(0);
  });

  it('event index advances correctly through actions', () => {
    const game = setupToGameplay();
    let replay = createReplay(game.recording);
    const prevEventIdx = replay.currentEventIndex;

    replay = stepForward(replay);
    expect(replay.currentEventIndex).toBeGreaterThan(prevEventIdx);

    replay = stepForward(replay);
    expect(replay.currentEventIndex).toBeGreaterThan(prevEventIdx + 1);
  });
});

// ========== Serialization Tests ==========

describe('serialization - round trip', () => {
  it('serialize → deserialize produces identical recording', () => {
    const game = setupToGameplay();
    const json = serializeRecording(game.recording);
    const restored = deserializeRecording(json);

    expect(restored.config).toEqual(game.recording.config);
    expect(restored.actions).toEqual(game.recording.actions);
    expect(restored.events.length).toBe(game.recording.events.length);
    expect(restored.initialState.phase).toBe(game.recording.initialState.phase);
    expect(restored.initialState.rngSeed).toBe(game.recording.initialState.rngSeed);
  });

  it('events are correctly reconstructed from actions', () => {
    const game = setupToGameplay();
    const json = serializeRecording(game.recording);
    const restored = deserializeRecording(json);

    // Event types should match exactly
    const originalTypes = game.recording.events.map(e => e.type);
    const restoredTypes = restored.events.map(e => e.type);
    expect(restoredTypes).toEqual(originalTypes);
  });

  it('replay of deserialized recording matches original', () => {
    const game = setupToGameplay();
    const json = serializeRecording(game.recording);
    const restored = deserializeRecording(json);

    // Replay both and compare final states
    let originalReplay = createReplay(game.recording);
    let restoredReplay = createReplay(restored);

    while (!isAtEnd(originalReplay)) {
      originalReplay = stepForward(originalReplay);
      restoredReplay = stepForward(restoredReplay);
      expect(getCurrentState(restoredReplay)).toEqual(getCurrentState(originalReplay));
    }
  });

  it('serialized JSON includes version and eventCount', () => {
    const game = setupToGameplay();
    const json = serializeRecording(game.recording);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(SCHEMA_VERSION);
    expect(parsed.eventCount).toBe(game.recording.events.length);
    // Should NOT include events or initialState (they're reconstructed)
    expect(parsed.events).toBeUndefined();
    expect(parsed.initialState).toBeUndefined();
  });
});

describe('serialization - error handling', () => {
  it('rejects invalid JSON', () => {
    expect(() => deserializeRecording('not json')).toThrow('Invalid JSON');
  });

  it('rejects non-object JSON', () => {
    expect(() => deserializeRecording('"string"')).toThrow('must be a JSON object');
  });

  it('rejects missing version', () => {
    expect(() => deserializeRecording('{"config": {}, "actions": []}')).toThrow('version');
  });

  it('rejects missing config', () => {
    expect(() => deserializeRecording('{"version": 1, "actions": []}')).toThrow('config');
  });

  it('rejects missing actions', () => {
    expect(() => deserializeRecording('{"version": 1, "config": {"seed": 1, "playerIds": ["p1","p2"], "boardSize": "2p"}}')).toThrow('actions');
  });

  it('rejects future schema version', () => {
    const data = {
      version: 999,
      config: { seed: 1, playerIds: ['player1', 'player2'], boardSize: '2p' },
      actions: [],
    };
    expect(() => deserializeRecording(JSON.stringify(data))).toThrow('newer than supported');
  });

  it('rejects actions without type field', () => {
    const data = {
      version: 1,
      config: { seed: 1, playerIds: ['player1', 'player2'], boardSize: '2p' },
      actions: [{ noType: true }],
    };
    expect(() => deserializeRecording(JSON.stringify(data))).toThrow('missing "type"');
  });
});
