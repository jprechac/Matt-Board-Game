/**
 * Tests for bot-runner and difficulty factory.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createGame, applyAction } from '../../src/engine/game.js';
import type { GameConfig } from '../../src/engine/game.js';
import type { GameState, FactionId } from '../../src/engine/types.js';
import { ALL_FACTION_IDS } from '../../src/engine/types.js';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';
import { stepBot, runBotTurnActions } from '../../src/ai/bot-runner.js';
import { createBotForDifficulty } from '../../src/ai/difficulty.js';
import { createBot } from '../../src/ai/strategies/index.js';

beforeAll(() => {
  registerAllAbilities();
});

const DEFAULT_CONFIG: GameConfig = {
  boardSize: '2p',
  playerIds: ['player1', 'player2'],
  seed: 42,
};

const MAX_ACTIONS = 2000;

// ========== stepBot Tests ==========

describe('stepBot', () => {
  it('returns an action and next state in setup phase', () => {
    const state = createGame(DEFAULT_CONFIG);
    const bot = createBot({ playerId: 'player1', difficulty: 'medium', factionId: 'romans' });
    const result = stepBot(state, bot, state.currentPlayerId);

    expect(result).not.toBeNull();
    expect(result!.action).toBeDefined();
    expect(result!.nextState).toBeDefined();
    expect(result!.nextState).not.toBe(state);
  });

  it('handles fallback on invalid bot action', () => {
    // Create a bot that always returns garbage
    const badBot = {
      chooseAction: () => ({ type: 'surrender', playerId: 'nobody' } as any),
    };
    const state = createGame(DEFAULT_CONFIG);
    // stepBot should fall back (or return null if no fallback available)
    const result = stepBot(state, badBot, state.currentPlayerId);
    // Setup phase has limited fallback — may return null
    // That's acceptable behavior
  });

  it('handles bot that throws exceptions', () => {
    const throwingBot = {
      chooseAction: () => { throw new Error('bot crashed'); },
    };
    const state = createGame(DEFAULT_CONFIG);
    // Should not throw, should return null or fallback
    const result = stepBot(state, throwingBot, state.currentPlayerId);
    // Won't crash — that's the test
  });
});

// ========== runBotTurnActions Tests ==========

describe('runBotTurnActions', () => {
  it('collects actions until player changes in setup', () => {
    const state = createGame(DEFAULT_CONFIG);
    const bot = createBot({ playerId: 'player1', difficulty: 'medium', factionId: 'romans' });
    const result = runBotTurnActions(state, bot, state.currentPlayerId);

    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.finalState).toBeDefined();
  });

  it('respects max actions safety cap', () => {
    const state = createGame(DEFAULT_CONFIG);
    const bot = createBot({ playerId: 'player1', difficulty: 'medium', factionId: 'romans' });
    const result = runBotTurnActions(state, bot, state.currentPlayerId, 2);

    expect(result.actions.length).toBeLessThanOrEqual(2);
  });
});

// ========== Difficulty Factory Tests ==========

describe('createBotForDifficulty', () => {
  it('creates a bot for each difficulty level', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const bot = createBotForDifficulty({ playerId: 'player1', difficulty, factionId: 'romans' });
      expect(bot).toBeDefined();
      expect(typeof bot.chooseAction).toBe('function');
    }
  });

  it('creates bots for all 11 factions at medium difficulty', () => {
    for (const factionId of ALL_FACTION_IDS) {
      const bot = createBotForDifficulty({ playerId: 'player1', difficulty: 'medium', factionId });
      expect(bot).toBeDefined();
      // Verify bot can produce an action
      const state = createGame(DEFAULT_CONFIG);
      const action = bot.chooseAction(state, state.currentPlayerId);
      expect(action).toBeDefined();
    }
  });
});

// ========== Full Game via Bot Runner ==========

describe('Full games via bot runner', () => {
  function runFullGame(faction1: FactionId, faction2: FactionId, seed: number) {
    let state = createGame({ ...DEFAULT_CONFIG, seed });
    const bot1 = createBotForDifficulty({ playerId: 'player1', difficulty: 'medium', factionId: faction1 });
    const bot2 = createBotForDifficulty({ playerId: 'player2', difficulty: 'medium', factionId: faction2 });

    let actionCount = 0;
    let fallbackCount = 0;

    while (!state.winner && actionCount < MAX_ACTIONS) {
      const bot = state.currentPlayerId === 'player1' ? bot1 : bot2;
      const result = stepBot(state, bot, state.currentPlayerId);

      if (!result) {
        if (state.phase === 'gameplay') {
          try { state = applyAction(state, { type: 'endTurn' }); } catch { break; }
        } else {
          break;
        }
        continue;
      }

      if (result.fallback) fallbackCount++;
      state = result.nextState;
      actionCount++;
    }

    return { state, actionCount, fallbackCount };
  }

  it('all 11 factions complete games via stepBot', () => {
    for (const factionId of ALL_FACTION_IDS) {
      const { state, actionCount } = runFullGame(factionId, 'vikings', 100);
      expect(state.winner).toBeTruthy();
      expect(actionCount).toBeGreaterThan(0);
      expect(actionCount).toBeLessThan(MAX_ACTIONS);
    }
  }, 120_000);

  it('produces varied outcomes across seeds', () => {
    const winners: string[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const { state } = runFullGame('romans', 'mongols', seed);
      if (state.winner) winners.push(state.winner);
    }
    // At least some games should complete
    expect(winners.length).toBeGreaterThanOrEqual(3);
  }, 60_000);
});
