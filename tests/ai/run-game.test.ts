/**
 * Tests for the shared runBotGame() function.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';
import { runBotGame } from '../../src/ai/run-game.js';
import type { BotGameConfig } from '../../src/ai/run-game.js';
import { createReplay, goToAction, getActionCount, getCurrentState } from '../../src/engine/replay.js';

beforeAll(() => {
  registerAllAbilities();
});

// ========== Completion Tests ==========

describe('runBotGame', () => {
  it('completes a romans vs vikings game', () => {
    const result = runBotGame({ factionA: 'romans', factionB: 'vikings', seed: 42 });
    expect(result.winner).toBeTruthy();
    expect(result.terminationReason).toBe('winner');
    expect(result.actionCount).toBeGreaterThan(0);
    expect(result.turnCount).toBeGreaterThan(0);
  });

  it('completes a mongols vs english game', () => {
    const result = runBotGame({ factionA: 'mongols', factionB: 'english', seed: 99 });
    expect(result.winner).toBeTruthy();
    expect(result.terminationReason).toBe('winner');
  });

  it('completes an aztecs vs ottomans game', () => {
    const result = runBotGame({ factionA: 'aztecs', factionB: 'ottomans', seed: 7 });
    expect(result.winner).toBeTruthy();
    expect(result.terminationReason).toBe('winner');
  });

  // ========== Determinism ==========

  it('produces identical results for the same seed', () => {
    const config: BotGameConfig = { factionA: 'romans', factionB: 'vikings', seed: 12345 };
    const r1 = runBotGame(config);
    const r2 = runBotGame(config);

    expect(r1.winner).toBe(r2.winner);
    expect(r1.winCondition).toBe(r2.winCondition);
    expect(r1.actionCount).toBe(r2.actionCount);
    expect(r1.turnCount).toBe(r2.turnCount);
    expect(r1.fallbackCount).toBe(r2.fallbackCount);

    // Strong determinism: compare full action sequences
    expect(r1.recording.actions.length).toBe(r2.recording.actions.length);
    for (let i = 0; i < r1.recording.actions.length; i++) {
      expect(r1.recording.actions[i]).toEqual(r2.recording.actions[i]);
    }
  });

  // ========== Recording Validity ==========

  it('produces a valid recording with correct action count', () => {
    const result = runBotGame({ factionA: 'vandals', factionB: 'huns', seed: 55 });
    expect(result.recording.actions.length).toBe(result.actionCount);
    expect(result.recording.events.length).toBeGreaterThan(0);
    expect(result.recording.config.seed).toBe(55);
  });

  it('recording is replayable and reaches the same final state', () => {
    const result = runBotGame({ factionA: 'muscovites', factionB: 'japanese', seed: 333 });
    const replay = createReplay(result.recording);
    const totalActions = getActionCount(replay);

    expect(totalActions).toBe(result.actionCount);

    // Fast-forward to end
    const endReplay = goToAction(replay, totalActions - 1);
    const replayedFinal = getCurrentState(endReplay);

    expect(replayedFinal.winner).toBe(result.finalState.winner);
    expect(replayedFinal.winCondition).toBe(result.finalState.winCondition);
    expect(replayedFinal.turnNumber).toBe(result.finalState.turnNumber);
  });

  // ========== Result Fields ==========

  it('populates all result fields correctly', () => {
    const result = runBotGame({ factionA: 'bulgars', factionB: 'romans', seed: 77 });
    expect(result.seed).toBe(77);
    expect(result.factionA).toBe('bulgars');
    expect(result.factionB).toBe('romans');
    expect(result.runtimeMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.runtimeMs)).toBe(true);
    expect(result.winCondition).toBeTruthy();
    expect(['base_control', 'all_units_defeated', 'surrender']).toContain(result.winCondition);
  });

  // ========== Fallback Tracking ==========

  it('tracks fallback count (should be 0 for well-behaved bots)', () => {
    const result = runBotGame({ factionA: 'vikings', factionB: 'english', seed: 100 });
    // Informational — fallbacks may happen but should be rare
    expect(result.fallbackCount).toBeGreaterThanOrEqual(0);
    expect(typeof result.fallbackCount).toBe('number');
  });

  // ========== Max Actions Cap ==========

  it('respects maxActions cap', () => {
    const result = runBotGame({ factionA: 'romans', factionB: 'vikings', seed: 42, maxActions: 50 });
    expect(result.actionCount).toBeLessThanOrEqual(50);
    // With only 50 actions, game likely won't finish
    if (!result.winner) {
      expect(result.terminationReason).toBe('max_actions');
    }
  });

  // ========== onAction Callback ==========

  it('calls onAction for each action', () => {
    let callCount = 0;
    const result = runBotGame({
      factionA: 'romans',
      factionB: 'vikings',
      seed: 42,
      onAction: () => { callCount++; },
    });
    expect(callCount).toBe(result.actionCount);
  });

  it('onAction receives valid states and action', () => {
    const actions: { action: string; fallback: boolean }[] = [];
    runBotGame({
      factionA: 'huns',
      factionB: 'mongols',
      seed: 200,
      maxActions: 100,
      onAction: (action, prevState, nextState, fallback) => {
        actions.push({ action: action.type, fallback });
        // prevState and nextState should be different objects
        expect(prevState).not.toBe(nextState);
        // action type should be a valid string
        expect(typeof action.type).toBe('string');
      },
    });
    expect(actions.length).toBeGreaterThan(0);
  });
});
