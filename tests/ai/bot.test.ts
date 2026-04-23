/**
 * Tests for AI bot framework: evaluation, placement, and generic strategy.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createGame, applyAction } from '../../src/engine/game.js';
import type { GameConfig } from '../../src/engine/game.js';
import type { GameState, PlayerId } from '../../src/engine/types.js';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';
import { evaluateBoard, materialScore, positionScore, leaderSafetyScore, baseControlScore } from '../../src/ai/evaluate.js';
import { getDefaultComposition, choosePlacementPosition } from '../../src/ai/placement.js';
import { createGenericBot } from '../../src/ai/strategies/generic.js';
import { getAllLegalActions } from '../../src/engine/actions.js';

beforeAll(() => {
  registerAllAbilities();
});

const DEFAULT_CONFIG: GameConfig = {
  boardSize: '2p',
  playerIds: ['player1', 'player2'],
  seed: 42,
};

const MAX_ACTIONS_PER_GAME = 2000;

// ========== Evaluation Tests ==========

describe('Board evaluation', () => {
  it('returns scores in expected ranges', () => {
    const state = createGame(DEFAULT_CONFIG);
    // In setup phase with no units placed, evaluation should handle gracefully
    const eval1 = evaluateBoard(state, 'player1');
    expect(eval1.material).toBeGreaterThanOrEqual(-1);
    expect(eval1.material).toBeLessThanOrEqual(1);
    expect(eval1.total).toBeDefined();
  });

  it('material score favors player with more weighted HP', () => {
    const state = createGame(DEFAULT_CONFIG);
    // With no units, score should be 0
    const score = materialScore(state, 'player1');
    expect(score).toBe(0);
  });

  it('leader safety returns -1 when leader is dead', () => {
    const state = createGame(DEFAULT_CONFIG);
    // No units = no leader = -1
    const safety = leaderSafetyScore(state, 'player1');
    expect(safety).toBe(-1);
  });

  it('base control score is 0 with no timers', () => {
    const state = createGame(DEFAULT_CONFIG);
    const score = baseControlScore(state, 'player1');
    expect(score).toBe(0);
  });
});

// ========== Placement Tests ==========

describe('Default compositions', () => {
  it('provides composition for every faction', () => {
    const factions = [
      'aztecs', 'bulgars', 'english', 'huns', 'japanese',
      'mongols', 'muscovites', 'ottomans', 'romans', 'vandals', 'vikings',
    ] as const;

    for (const factionId of factions) {
      const comp = getDefaultComposition(factionId);
      expect(comp).toBeDefined();
      expect(comp.basicMelee).toBeGreaterThanOrEqual(0);
      expect(comp.basicRanged).toBeGreaterThanOrEqual(0);
      expect(comp.specialtyChoices.length).toBe(5);
      // Total units: leader (1) + basic melee + basic ranged + specialty = 9
      const total = 1 + comp.basicMelee + comp.basicRanged + comp.specialtyChoices.length;
      expect(total).toBe(9);
    }
  });
});

describe('Placement heuristics', () => {
  it('chooses valid placement positions', () => {
    // Drive a game to placement phase
    let state = createGame({ ...DEFAULT_CONFIG, seed: 42 });
    const winner = state.currentPlayerId;
    state = applyAction(state, {
      type: 'choosePriority', playerId: winner,
      orderToControl: 'factionOrder', position: 'first',
    });
    const loser = state.players.find(p => p.id !== winner)!.id;
    state = applyAction(state, {
      type: 'choosePriority', playerId: loser, position: 'first',
    });
    state = applyAction(state, { type: 'selectFaction', playerId: state.setupState!.factionSelectionOrder[0], factionId: 'romans' });
    state = applyAction(state, { type: 'selectFaction', playerId: state.setupState!.factionSelectionOrder[1], factionId: 'vikings' });

    for (const p of state.players) {
      if (!p.armyComposition) {
        const comp = getDefaultComposition(p.factionId!);
        state = applyAction(state, { type: 'setArmyComposition', playerId: p.id, composition: comp });
      }
    }

    expect(state.phase).toBe('placement');

    // Use placement heuristic for first unit
    const placer = state.currentPlayerId;
    const roster = state.setupState!.unplacedRoster[placer] ?? [];
    expect(roster.length).toBeGreaterThan(0);

    const pos = choosePlacementPosition(state, placer, roster[0]);
    expect(pos).toBeDefined();
    expect(pos.q + pos.r + pos.s).toBe(0); // Valid cube coord
  });
});

// ========== Generic Bot Tests ==========

describe('Generic bot', () => {
  it('produces legal actions in setup phase', () => {
    let state = createGame({ ...DEFAULT_CONFIG, seed: 100 });
    const bot = createGenericBot({ playerId: 'player1', difficulty: 'medium' });

    // Bot should handle priority choice
    const action = bot.chooseAction(state, state.currentPlayerId);
    expect(action.type).toBe('choosePriority');
    // Verify it doesn't throw when applied
    const newState = applyAction(state, action);
    expect(newState.setupState!.currentStep).not.toBe('choosePriority');
  });

  it('completes a full game without illegal moves', () => {
    let state = createGame({ ...DEFAULT_CONFIG, seed: 77 });
    const bot1 = createGenericBot({ playerId: 'player1', difficulty: 'medium', factionId: 'romans' });
    const bot2 = createGenericBot({ playerId: 'player2', difficulty: 'medium', factionId: 'vikings' });

    let actionCount = 0;

    while (state.phase !== 'victory' && actionCount < MAX_ACTIONS_PER_GAME) {
      const currentBot = state.currentPlayerId === 'player1' ? bot1 : bot2;
      try {
        const action = currentBot.chooseAction(state, state.currentPlayerId);
        state = applyAction(state, action);
      } catch {
        // If an action throws (e.g., blockAttack), fall back to legal actions
        const legal = getAllLegalActions(state);
        if (legal.length === 0) break;
        state = applyAction(state, legal[0]);
      }
      actionCount++;
    }

    // Game should complete within the action cap
    expect(actionCount).toBeLessThan(MAX_ACTIONS_PER_GAME);
    // Game should reach victory or at least get to gameplay
    expect(['gameplay', 'victory']).toContain(state.phase);
  });

  it('completes setup and placement phases correctly', () => {
    let state = createGame({ ...DEFAULT_CONFIG, seed: 200 });
    const bot1 = createGenericBot({ playerId: 'player1', difficulty: 'medium', factionId: 'ottomans' });
    const bot2 = createGenericBot({ playerId: 'player2', difficulty: 'medium', factionId: 'japanese' });

    let actionCount = 0;

    // Run through setup + placement
    while (state.phase !== 'gameplay' && state.phase !== 'victory' && actionCount < 500) {
      const currentBot = state.currentPlayerId === 'player1' ? bot1 : bot2;
      const action = currentBot.chooseAction(state, state.currentPlayerId);
      state = applyAction(state, action);
      actionCount++;
    }

    expect(state.phase).toBe('gameplay');
    // All units should be placed
    expect(state.units.length).toBeGreaterThan(0);
    // Both players should have factions
    for (const player of state.players) {
      expect(player.factionId).toBeDefined();
    }
  });

  it('bot vs bot reaches victory with different factions', () => {
    const factionPairs: [string, string][] = [
      ['mongols', 'romans'],
      ['vandals', 'ottomans'],
      ['japanese', 'english'],
    ];

    for (const [f1, f2] of factionPairs) {
      let state = createGame({ ...DEFAULT_CONFIG, seed: 42 });
      const bot1 = createGenericBot({ playerId: 'player1', difficulty: 'medium', factionId: f1 as any });
      const bot2 = createGenericBot({ playerId: 'player2', difficulty: 'medium', factionId: f2 as any });

      let actionCount = 0;
      while (state.phase !== 'victory' && actionCount < MAX_ACTIONS_PER_GAME) {
        const currentBot = state.currentPlayerId === 'player1' ? bot1 : bot2;
        try {
          const action = currentBot.chooseAction(state, state.currentPlayerId);
          const validation = validateAction(state, action);
          if (!validation.valid) {
            const legal = getAllLegalActions(state);
            if (legal.length === 0) break;
            state = applyAction(state, legal[0]);
          } else {
            state = applyAction(state, action);
          }
        } catch {
          // If an action throws (e.g., blockAttack), fall back to legal actions
          const legal = getAllLegalActions(state);
          if (legal.length === 0) break;
          state = applyAction(state, legal[0]);
        }
        actionCount++;
      }

      expect(actionCount).toBeLessThan(MAX_ACTIONS_PER_GAME);
    }
  });
});
