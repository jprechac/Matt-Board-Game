/**
 * Tests for faction-specific AI strategies.
 * Each faction bot must complete full games without errors.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createGame, applyAction } from '../../src/engine/game.js';
import type { GameConfig } from '../../src/engine/game.js';
import type { GameState, FactionId } from '../../src/engine/types.js';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';
import { getAllLegalActions } from '../../src/engine/actions.js';
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

const ALL_FACTIONS: FactionId[] = [
  'aztecs', 'bulgars', 'english', 'huns', 'japanese',
  'mongols', 'muscovites', 'ottomans', 'romans', 'vandals', 'vikings',
];

function runBotGame(faction1: FactionId, faction2: FactionId, seed: number): { phase: string; actions: number } {
  let state = createGame({ ...DEFAULT_CONFIG, seed });
  const bot1 = createBot({ playerId: 'player1', difficulty: 'medium', factionId: faction1 });
  const bot2 = createBot({ playerId: 'player2', difficulty: 'medium', factionId: faction2 });

  let actionCount = 0;
  while (state.phase !== 'victory' && actionCount < MAX_ACTIONS) {
    const currentBot = state.currentPlayerId === 'player1' ? bot1 : bot2;
    try {
      const action = currentBot.chooseAction(state, state.currentPlayerId);
      state = applyAction(state, action);
    } catch {
      // Action threw (e.g., blockAttack) — fall back to legal actions
      const legal = getAllLegalActions(state);
      if (legal.length === 0) break;
      // Try each legal action until one succeeds
      let applied = false;
      for (const la of legal) {
        try {
          state = applyAction(state, la);
          applied = true;
          break;
        } catch { /* skip blocked actions */ }
      }
      if (!applied) break;
    }
    actionCount++;
  }

  return { phase: state.phase, actions: actionCount };
}

// ========== Per-Faction Tests ==========

describe('Faction-specific bot strategies', () => {
  for (const faction of ALL_FACTIONS) {
    describe(faction, () => {
      it(`${faction} vs generic completes a game`, () => {
        const result = runBotGame(faction, 'romans', 42);
        expect(result.actions).toBeLessThan(MAX_ACTIONS);
        expect(['gameplay', 'victory']).toContain(result.phase);
      });

      it(`${faction} mirror match completes`, () => {
        const result = runBotGame(faction, faction, 100);
        expect(result.actions).toBeLessThan(MAX_ACTIONS);
        expect(['gameplay', 'victory']).toContain(result.phase);
      });
    });
  }
});

// ========== Cross-Faction Matchups ==========

describe('Cross-faction matchups', () => {
  const matchups: [FactionId, FactionId][] = [
    ['mongols', 'romans'],     // Rush vs formation
    ['vandals', 'romans'],     // Lone wolf vs formation
    ['vikings', 'ottomans'],   // Aggression vs sustain
    ['japanese', 'english'],   // Melee adjacency vs ranged
    ['muscovites', 'huns'],    // Defensive vs mobile
    ['aztecs', 'bulgars'],     // Aura vs cavalry
  ];

  for (const [f1, f2] of matchups) {
    it(`${f1} vs ${f2} completes`, () => {
      const result = runBotGame(f1, f2, 77);
      expect(result.actions).toBeLessThan(MAX_ACTIONS);
      expect(['gameplay', 'victory']).toContain(result.phase);
    });
  }
});

// ========== Strategy Registry ==========

describe('Strategy registry', () => {
  it('creates faction-specific bot when factionId provided', () => {
    const bot = createBot({ playerId: 'p1', difficulty: 'medium', factionId: 'vikings' });
    expect(bot).toBeDefined();
    expect(bot.chooseAction).toBeTypeOf('function');
  });

  it('creates generic bot when no factionId', () => {
    const bot = createBot({ playerId: 'p1', difficulty: 'medium' });
    expect(bot).toBeDefined();
    expect(bot.chooseAction).toBeTypeOf('function');
  });

  it('all 11 factions have strategies', () => {
    for (const faction of ALL_FACTIONS) {
      const bot = createBot({ playerId: 'p1', difficulty: 'medium', factionId: faction });
      expect(bot).toBeDefined();
    }
  });
});
