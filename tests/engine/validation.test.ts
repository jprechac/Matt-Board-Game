import { describe, it, expect } from 'vitest';
import { validateAction } from '../../src/engine/validation.js';
import { createGame, applyAction } from '../../src/engine/game.js';
import type { GameConfig } from '../../src/engine/game.js';
import type { GameState, PlayerId } from '../../src/engine/types.js';

const DEFAULT_CONFIG: GameConfig = {
  boardSize: '2p',
  playerIds: ['player1', 'player2'],
  seed: 42,
};

function setupToFactionSelection(seed = 42): GameState {
  let state = createGame({ ...DEFAULT_CONFIG, seed });
  const winner = state.currentPlayerId;
  return applyAction(state, {
    type: 'choosePriority',
    playerId: winner,
    choice: 'pickFactionFirst',
  });
}

describe('validateAction', () => {
  describe('game over', () => {
    it('rejects all actions when game has a winner', () => {
      let state = createGame(DEFAULT_CONFIG);
      // Manually set winner
      const finishedState: GameState = {
        ...state,
        phase: 'victory',
        winner: 'player1',
        winCondition: 'surrender',
      };
      const result = validateAction(finishedState, {
        type: 'endTurn',
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('over');
    });
  });

  describe('choosePriority', () => {
    it('validates correct player', () => {
      const state = createGame(DEFAULT_CONFIG);
      const winner = state.setupState!.rollWinner!;
      const result = validateAction(state, {
        type: 'choosePriority',
        playerId: winner,
        choice: 'pickFactionFirst',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects non-winner', () => {
      const state = createGame(DEFAULT_CONFIG);
      const nonWinner = state.players.find(p => p.id !== state.setupState!.rollWinner)!.id;
      const result = validateAction(state, {
        type: 'choosePriority',
        playerId: nonWinner,
        choice: 'pickFactionFirst',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects in wrong phase', () => {
      const state = setupToFactionSelection();
      const result = validateAction(state, {
        type: 'choosePriority',
        playerId: state.currentPlayerId,
        choice: 'pickFactionFirst',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('selectFaction', () => {
    it('validates correct player and faction', () => {
      const state = setupToFactionSelection();
      const order = state.setupState!.factionSelectionOrder;
      const result = validateAction(state, {
        type: 'selectFaction',
        playerId: order[0],
        factionId: 'romans',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects wrong player', () => {
      const state = setupToFactionSelection();
      const order = state.setupState!.factionSelectionOrder;
      const result = validateAction(state, {
        type: 'selectFaction',
        playerId: order[1],
        factionId: 'romans',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects taken faction', () => {
      let state = setupToFactionSelection();
      const order = state.setupState!.factionSelectionOrder;
      state = applyAction(state, {
        type: 'selectFaction',
        playerId: order[0],
        factionId: 'romans',
      });
      const result = validateAction(state, {
        type: 'selectFaction',
        playerId: order[1],
        factionId: 'romans',
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('already taken');
    });
  });

  describe('setArmyComposition', () => {
    it('validates correct composition', () => {
      let state = setupToFactionSelection();
      const order = state.setupState!.factionSelectionOrder;
      state = applyAction(state, { type: 'selectFaction', playerId: order[0], factionId: 'romans' });
      state = applyAction(state, { type: 'selectFaction', playerId: order[1], factionId: 'vikings' });

      const result = validateAction(state, {
        type: 'setArmyComposition',
        playerId: order[0],
        composition: {
          basicMelee: 2, basicRanged: 1,
          specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'centurion', 'centurion'],
        },
      });
      expect(result.valid).toBe(true);
    });

    it('rejects wrong basic count', () => {
      let state = setupToFactionSelection();
      const order = state.setupState!.factionSelectionOrder;
      state = applyAction(state, { type: 'selectFaction', playerId: order[0], factionId: 'romans' });
      state = applyAction(state, { type: 'selectFaction', playerId: order[1], factionId: 'vikings' });

      const result = validateAction(state, {
        type: 'setArmyComposition',
        playerId: order[0],
        composition: {
          basicMelee: 5, basicRanged: 1,
          specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'centurion', 'centurion'],
        },
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('gameplay actions in wrong phase', () => {
    it('rejects move in setup', () => {
      const state = createGame(DEFAULT_CONFIG);
      const result = validateAction(state, {
        type: 'move',
        unitId: 'some-unit',
        to: { q: 0, r: 0, s: 0 },
      });
      expect(result.valid).toBe(false);
    });

    it('rejects attack in setup', () => {
      const state = createGame(DEFAULT_CONFIG);
      const result = validateAction(state, {
        type: 'attack',
        unitId: 'u1',
        targetId: 'u2',
      });
      expect(result.valid).toBe(false);
    });
  });
});
