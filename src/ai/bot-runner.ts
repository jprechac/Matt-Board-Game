/**
 * Bot runner — incremental bot stepping and batch helpers.
 *
 * Core API:
 * - `decideBotAction()` — choose+validate an action without applying it
 * - `stepBot()` — decide + apply in one call
 * - `runBotTurnActions()` — collect a full turn's worth of actions
 */
import type { GameState, Action, PlayerId } from '../engine/types.js';
import type { Bot } from './types.js';
import { validateAction } from '../engine/validation.js';
import { applyAction } from '../engine/game.js';
import { getAllLegalActions } from '../engine/actions.js';

// ========== Types ==========

export interface BotDecision {
  readonly action: Action;
  readonly fallback: boolean;
}

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

// ========== Core: Decision (no side effects) ==========

/**
 * Ask the bot for one action and validate it. Does NOT apply the action.
 * If the bot's action is invalid or throws, falls back to the first legal action.
 * Returns null if no legal action exists.
 */
export function decideBotAction(
  state: GameState,
  bot: Bot,
  playerId: PlayerId,
): BotDecision | null {
  try {
    const chosen = bot.chooseAction(state, playerId);
    const validation = validateAction(state, chosen);
    if (!validation.valid) {
      const fb = findFallbackAction(state, playerId);
      return fb ? { action: fb, fallback: true } : null;
    }
    return { action: chosen, fallback: false };
  } catch {
    const fb = findFallbackAction(state, playerId);
    return fb ? { action: fb, fallback: true } : null;
  }
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
  const decision = decideBotAction(state, bot, playerId);
  if (!decision) return null;

  try {
    const nextState = applyAction(state, decision.action);
    return { action: decision.action, nextState, fallback: decision.fallback };
  } catch {
    // Action validated but threw on apply — try fallback if we haven't already
    if (!decision.fallback) {
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
