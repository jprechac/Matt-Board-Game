/**
 * Bot runner — incremental bot stepping and batch helpers.
 *
 * Core API is `stepBot()` which produces one action at a time.
 * `runBotTurnActions()` is a convenience for CLI/tests that collects
 * a full turn's worth of actions.
 */
import type { GameState, Action, PlayerId } from '../engine/types.js';
import type { Bot } from './types.js';
import { validateAction } from '../engine/validation.js';
import { applyAction } from '../engine/game.js';
import { getAllLegalActions } from '../engine/actions.js';

// ========== Types ==========

export interface StepResult {
  readonly action: Action;
  readonly nextState: GameState;
  readonly fallback: boolean;
}

export interface BotTurnResult {
  readonly actions: readonly Action[];
  readonly finalState: GameState;
  readonly fallbackCount: number;
}

// ========== Core: Single Step ==========

/**
 * Ask the bot for one action, validate it, and apply it.
 * If the bot's action is invalid or throws, falls back to the first legal action.
 * Returns null if no legal action exists (should not happen in a well-formed game).
 */
export function stepBot(
  state: GameState,
  bot: Bot,
  playerId: PlayerId,
): StepResult | null {
  // Try bot's chosen action
  let action: Action | null = null;
  let fallback = false;

  try {
    const chosen = bot.chooseAction(state, playerId);
    const validation = validateAction(state, chosen);
    if (!validation.valid) {
      action = findFallbackAction(state, playerId);
      fallback = true;
    } else {
      action = chosen;
    }
  } catch {
    action = findFallbackAction(state, playerId);
    fallback = true;
  }

  // If no action is available at all, return null
  if (action === null) return null;

  // Apply the action (may still throw for edge cases like blocked attacks)
  try {
    const nextState = applyAction(state, action);
    return { action, nextState, fallback };
  } catch {
    // Action validated but threw on apply — try fallback
    if (!fallback) {
      const fb = findFallbackAction(state, playerId);
      if (fb === null) return null;
      try {
        const nextState = applyAction(state, fb);
        return { action: fb, nextState, fallback: true };
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ========== Batch: Full Turn ==========

const DEFAULT_MAX_ACTIONS = 100;

/**
 * Run a bot's full turn, collecting all actions until the turn ends.
 * Stops when:
 * - currentPlayerId changes (turn ended)
 * - phase changes (e.g., setup → placement)
 * - game has a winner
 * - max actions reached (safety cap)
 * - no legal action available
 */
export function runBotTurnActions(
  state: GameState,
  bot: Bot,
  playerId: PlayerId,
  maxActions: number = DEFAULT_MAX_ACTIONS,
): BotTurnResult {
  const actions: Action[] = [];
  let current = state;
  let fallbackCount = 0;
  const startPhase = current.phase;
  const startPlayer = current.currentPlayerId;

  for (let i = 0; i < maxActions; i++) {
    // Stop if game is over
    if (current.winner) break;

    // Stop if it's no longer this player's turn (or phase changed)
    if (i > 0 && (current.currentPlayerId !== startPlayer || current.phase !== startPhase)) {
      break;
    }

    const result = stepBot(current, bot, playerId);
    if (!result) break;

    actions.push(result.action);
    if (result.fallback) fallbackCount++;
    current = result.nextState;
  }

  return { actions, finalState: current, fallbackCount };
}

// ========== Helpers ==========

/**
 * Find a fallback action when the bot's choice is invalid.
 * Phase-aware: only uses getAllLegalActions for gameplay/placement,
 * returns endTurn for gameplay, or null for other phases.
 */
function findFallbackAction(state: GameState, playerId: PlayerId): Action | null {
  if (state.phase === 'gameplay' || state.phase === 'placement') {
    const legal = getAllLegalActions(state);
    if (legal.length > 0) return legal[0];
    if (state.phase === 'gameplay') {
      return { type: 'endTurn' };
    }
  }
  return null;
}
