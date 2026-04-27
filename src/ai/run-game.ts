/**
 * Shared bot-game runner — runs a complete AI-vs-AI game with recording.
 *
 * Used by bot-match CLI and future batch simulation (Phase 6).
 * Uses decideBotAction() + applyRecordedAction() to avoid double-apply.
 */
import type { GameState, Action, FactionId, PlayerId, WinCondition } from '../engine/types.js';
import type { GameConfig } from '../engine/game.js';
import { applyAction } from '../engine/game.js';
import type { GameRecording } from '../engine/recorder.js';
import { createRecordedGame, applyRecordedAction } from '../engine/recorder.js';
import type { RecordedGame } from '../engine/recorder.js';
import { registerAllAbilities } from '../engine/abilities/index.js';
import { createBotForDifficulty } from './difficulty.js';
import { decideBotAction } from './bot-runner.js';
import type { Bot } from './types.js';
import type { Difficulty } from './types.js';

// ========== Types ==========

export interface BotGameConfig {
  readonly factionA: FactionId;
  readonly factionB: FactionId;
  readonly seed: number;
  readonly difficultyA?: Difficulty;
  readonly difficultyB?: Difficulty;
  readonly maxActions?: number;
  /** Called after each action is applied. For verbose CLI output. */
  readonly onAction?: (action: Action, prevState: GameState, nextState: GameState, fallback: boolean) => void;
}

export type TerminationReason = 'winner' | 'max_actions' | 'no_action' | 'error';

export interface BotGameResult {
  readonly finalState: GameState;
  readonly recording: GameRecording;
  readonly winner: PlayerId | null;
  readonly winCondition: WinCondition | null;
  readonly terminationReason: TerminationReason;
  readonly turnCount: number;
  readonly actionCount: number;
  readonly fallbackCount: number;
  readonly runtimeMs: number;
  readonly seed: number;
  readonly factionA: FactionId;
  readonly factionB: FactionId;
}

// ========== Constants ==========

const DEFAULT_MAX_ACTIONS = 2000;

let abilitiesRegistered = false;

// ========== Main ==========

/**
 * Run a complete bot-vs-bot game with event recording.
 * Returns the final state, full recording, and summary stats.
 */
export function runBotGame(config: BotGameConfig): BotGameResult {
  // Ensure abilities are registered (idempotent guard)
  if (!abilitiesRegistered) {
    registerAllAbilities();
    abilitiesRegistered = true;
  }

  const maxActions = config.maxActions ?? DEFAULT_MAX_ACTIONS;

  const gameConfig: GameConfig = {
    boardSize: '2p',
    playerIds: ['player1', 'player2'],
    seed: config.seed,
  };

  const bots: Record<string, Bot> = {
    player1: createBotForDifficulty({
      playerId: 'player1',
      difficulty: config.difficultyA ?? 'medium',
      factionId: config.factionA,
    }),
    player2: createBotForDifficulty({
      playerId: 'player2',
      difficulty: config.difficultyB ?? 'medium',
      factionId: config.factionB,
    }),
  };

  let game: RecordedGame = createRecordedGame(gameConfig);
  let actionCount = 0;
  let fallbackCount = 0;
  let terminationReason: TerminationReason = 'winner';
  const startTime = Date.now();

  while (!game.state.winner && actionCount < maxActions) {
    const state = game.state;
    const bot = bots[state.currentPlayerId];
    const decision = decideBotAction(state, bot, state.currentPlayerId);

    if (!decision) {
      // No legal action available
      if (state.phase === 'gameplay') {
        // Force endTurn as last resort
        try {
          game = applyRecordedAction(game, { type: 'endTurn' });
          actionCount++;
          config.onAction?.({ type: 'endTurn' }, state, game.state, false);
          continue;
        } catch {
          terminationReason = 'no_action';
          break;
        }
      }
      terminationReason = 'no_action';
      break;
    }

    if (decision.fallback) fallbackCount++;

    // Apply via recorded path (captures events)
    try {
      const prevState = game.state;
      game = applyRecordedAction(game, decision.action);
      actionCount++;
      config.onAction?.(decision.action, prevState, game.state, decision.fallback);
    } catch {
      // Decision validated but threw on apply — try endTurn as emergency fallback
      if (state.phase === 'gameplay') {
        try {
          game = applyRecordedAction(game, { type: 'endTurn' });
          actionCount++;
          fallbackCount++;
          continue;
        } catch {
          terminationReason = 'error';
          break;
        }
      }
      terminationReason = 'error';
      break;
    }
  }

  if (game.state.winner) {
    terminationReason = 'winner';
  } else if (actionCount >= maxActions) {
    terminationReason = 'max_actions';
  }

  const runtimeMs = Date.now() - startTime;

  return {
    finalState: game.state,
    recording: game.recording,
    winner: game.state.winner ?? null,
    winCondition: game.state.winCondition ?? null,
    terminationReason,
    turnCount: game.state.turnNumber,
    actionCount,
    fallbackCount,
    runtimeMs,
    seed: config.seed,
    factionA: config.factionA,
    factionB: config.factionB,
  };
}
