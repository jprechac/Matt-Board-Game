/**
 * Tests for CLI utility functions (arg parsing, action formatting, round tracking).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { parseArgs, formatAction, advanceRound } from '../../src/cli/format.js';
import type { RoundTracker } from '../../src/cli/format.js';
import { createGame } from '../../src/engine/game.js';
import type { GameConfig } from '../../src/engine/game.js';
import type { GameState, Action, UnitState } from '../../src/engine/types.js';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';
import { offsetToCube } from '../../src/engine/hex.js';

beforeAll(() => {
  registerAllAbilities();
});

// ========== parseArgs ==========

describe('parseArgs', () => {
  it('parses key-value pairs', () => {
    const result = parseArgs(['--faction1', 'romans', '--faction2', 'vikings']);
    expect(result).toEqual({ faction1: 'romans', faction2: 'vikings' });
  });

  it('parses boolean flags', () => {
    const result = parseArgs(['--quiet', '--verbose']);
    expect(result).toEqual({ quiet: 'true', verbose: 'true' });
  });

  it('parses mixed args and flags', () => {
    const result = parseArgs(['--faction1', 'romans', '--quiet', '--seed', '42']);
    expect(result).toEqual({ faction1: 'romans', quiet: 'true', seed: '42' });
  });

  it('returns empty object for no args', () => {
    expect(parseArgs([])).toEqual({});
  });

  it('handles flag at end of args', () => {
    const result = parseArgs(['--faction1', 'romans', '--help']);
    expect(result).toEqual({ faction1: 'romans', help: 'true' });
  });

  it('handles consecutive flags (no values)', () => {
    const result = parseArgs(['--quiet', '--verbose', '--help']);
    expect(result).toEqual({ quiet: 'true', verbose: 'true', help: 'true' });
  });
});

// ========== formatAction ==========

describe('formatAction', () => {
  const CONFIG: GameConfig = { boardSize: '2p', playerIds: ['player1', 'player2'], seed: 1 };

  function makeStubState(overrides: Partial<GameState> = {}): GameState {
    const base = createGame(CONFIG);
    return { ...base, ...overrides };
  }

  function stubUnit(id: string, typeId: string, playerId: string): UnitState {
    return {
      id,
      typeId,
      playerId: playerId as 'player1' | 'player2',
      currentHp: 10,
      maxHp: 10,
      attack: 3,
      defense: 1,
      speed: 3,
      range: 1,
      position: offsetToCube(0, 0),
      hasMoved: false,
      hasActed: false,
      abilities: [],
    };
  }

  it('formats move actions with unit type', () => {
    const state = makeStubState({
      currentPlayerId: 'player1',
      units: [stubUnit('u1', 'legionnaire', 'player1')],
    });
    const action: Action = { type: 'move', unitId: 'u1', to: offsetToCube(3, 4) };
    const result = formatAction(action, state);
    expect(result).toContain('player1');
    expect(result).toContain('move');
    expect(result).toContain('legionnaire');
  });

  it('formats move with missing unit ID as fallback', () => {
    const state = makeStubState({ currentPlayerId: 'player1', units: [] });
    const action: Action = { type: 'move', unitId: 'unknown-unit', to: offsetToCube(1, 1) };
    const result = formatAction(action, state);
    expect(result).toContain('unknown-unit');
  });

  it('formats attack actions', () => {
    const state = makeStubState({
      currentPlayerId: 'player1',
      units: [
        stubUnit('u1', 'legionnaire', 'player1'),
        stubUnit('u2', 'berserker', 'player2'),
      ],
    });
    const action: Action = { type: 'attack', unitId: 'u1', targetId: 'u2' };
    const result = formatAction(action, state);
    expect(result).toContain('attack');
    expect(result).toContain('legionnaire');
    expect(result).toContain('berserker');
  });

  it('formats heal actions', () => {
    const state = makeStubState({
      currentPlayerId: 'player1',
      units: [
        stubUnit('u1', 'centurion', 'player1'),
        stubUnit('u2', 'legionnaire', 'player1'),
      ],
    });
    const action: Action = { type: 'heal', unitId: 'u1', targetId: 'u2' };
    const result = formatAction(action, state);
    expect(result).toContain('heal');
    expect(result).toContain('centurion');
    expect(result).toContain('legionnaire');
  });

  it('formats endTurn', () => {
    const state = makeStubState({ currentPlayerId: 'player1' });
    const result = formatAction({ type: 'endTurn' }, state);
    expect(result).toBe('player1 end turn');
  });

  it('formats selectFaction', () => {
    const state = makeStubState({ currentPlayerId: 'player1' });
    const action: Action = { type: 'selectFaction', playerId: 'player1', factionId: 'romans' };
    const result = formatAction(action, state);
    expect(result).toBe('player1 select faction: romans');
  });

  it('formats setArmyComposition', () => {
    const state = makeStubState({ currentPlayerId: 'player1' });
    const action: Action = { type: 'setArmyComposition', playerId: 'player1', army: {} };
    const result = formatAction(action, state);
    expect(result).toBe('player1 set army composition');
  });

  it('formats placeUnit', () => {
    const state = makeStubState({ currentPlayerId: 'player1' });
    const pos = offsetToCube(5, 2);
    const action: Action = { type: 'placeUnit', playerId: 'player1', unitTypeId: 'legionnaire', position: pos };
    const result = formatAction(action, state);
    expect(result).toContain('place');
    expect(result).toContain('legionnaire');
  });

  it('formats surrender', () => {
    const state = makeStubState({ currentPlayerId: 'player1' });
    const action: Action = { type: 'surrender', playerId: 'player1' };
    const result = formatAction(action, state);
    expect(result).toBe('player1 surrender');
  });

  it('formats endUnitTurn', () => {
    const state = makeStubState({
      currentPlayerId: 'player1',
      units: [stubUnit('u1', 'legionnaire', 'player1')],
    });
    const action: Action = { type: 'endUnitTurn', unitId: 'u1' };
    const result = formatAction(action, state);
    expect(result).toContain('end unit turn');
    expect(result).toContain('legionnaire');
  });
});

// ========== advanceRound ==========

describe('advanceRound', () => {
  it('increments turnsInRound for 2-player game', () => {
    const tracker: RoundTracker = { roundNumber: 1, turnsInRound: 0, lastPlayer: 'player1' };
    const result = advanceRound(tracker, 'player2', 2);
    expect(result).toEqual({ roundNumber: 1, turnsInRound: 1, lastPlayer: 'player2' });
  });

  it('increments roundNumber after all players go (2-player)', () => {
    const tracker: RoundTracker = { roundNumber: 1, turnsInRound: 1, lastPlayer: 'player2' };
    const result = advanceRound(tracker, 'player1', 2);
    expect(result).toEqual({ roundNumber: 2, turnsInRound: 0, lastPlayer: 'player1' });
  });

  it('does not increment roundNumber mid-round in 4-player game', () => {
    let tracker: RoundTracker = { roundNumber: 1, turnsInRound: 0, lastPlayer: 'player1' };
    tracker = advanceRound(tracker, 'player2', 4);
    expect(tracker.roundNumber).toBe(1);
    expect(tracker.turnsInRound).toBe(1);

    tracker = advanceRound(tracker, 'player3', 4);
    expect(tracker.roundNumber).toBe(1);
    expect(tracker.turnsInRound).toBe(2);

    tracker = advanceRound(tracker, 'player4', 4);
    expect(tracker.roundNumber).toBe(1);
    expect(tracker.turnsInRound).toBe(3);
  });

  it('increments roundNumber after all 4 players go', () => {
    let tracker: RoundTracker = { roundNumber: 1, turnsInRound: 0, lastPlayer: 'player1' };
    tracker = advanceRound(tracker, 'player2', 4);
    tracker = advanceRound(tracker, 'player3', 4);
    tracker = advanceRound(tracker, 'player4', 4);
    tracker = advanceRound(tracker, 'player1', 4);
    expect(tracker).toEqual({ roundNumber: 2, turnsInRound: 0, lastPlayer: 'player1' });
  });

  it('tracks multiple rounds correctly (2-player)', () => {
    let tracker: RoundTracker = { roundNumber: 1, turnsInRound: 0, lastPlayer: 'player1' };

    // Round 1
    tracker = advanceRound(tracker, 'player2', 2);
    tracker = advanceRound(tracker, 'player1', 2);
    expect(tracker.roundNumber).toBe(2);

    // Round 2
    tracker = advanceRound(tracker, 'player2', 2);
    tracker = advanceRound(tracker, 'player1', 2);
    expect(tracker.roundNumber).toBe(3);

    // Round 3
    tracker = advanceRound(tracker, 'player2', 2);
    tracker = advanceRound(tracker, 'player1', 2);
    expect(tracker.roundNumber).toBe(4);
  });

  it('does not mutate the input tracker', () => {
    const tracker: RoundTracker = { roundNumber: 1, turnsInRound: 0, lastPlayer: 'player1' };
    const result = advanceRound(tracker, 'player2', 2);
    expect(tracker.roundNumber).toBe(1);
    expect(tracker.turnsInRound).toBe(0);
    expect(tracker.lastPlayer).toBe('player1');
    expect(result).not.toBe(tracker);
  });
});
