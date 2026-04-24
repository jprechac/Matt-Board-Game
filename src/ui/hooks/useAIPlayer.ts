/**
 * useAIPlayer — React hook that auto-executes AI turns.
 *
 * Watches the game state and, when it's the AI player's turn,
 * dispatches bot actions one at a time with configurable delays.
 * Uses abort refs for safe cancellation on unmount/undo/game-over.
 */
import { useEffect, useRef, useCallback } from 'react';
import type { GameState, Action, PlayerId, FactionId } from '../../engine/types.js';
import type { Bot } from '../../ai/types.js';
import { createBotForDifficulty } from '../../ai/difficulty.js';
import { stepBot } from '../../ai/bot-runner.js';
import type { DispatchResult } from './useGameState.js';

// ========== Types ==========

export interface AIPlayerConfig {
  readonly playerId: PlayerId;
  readonly factionId: FactionId;
  readonly difficulty: 'easy' | 'medium' | 'hard';
  /** Delay between actions in gameplay phase (ms). Setup/placement run instantly. */
  readonly thinkDelayMs?: number;
}

export interface AIPlayerState {
  /** True when the AI is actively executing actions */
  readonly isThinking: boolean;
}

// ========== Hook ==========

export function useAIPlayer(
  gameState: GameState,
  dispatch: (action: Action) => DispatchResult,
  config: AIPlayerConfig | null,
): AIPlayerState {
  const isThinking = useRef(false);
  const abortRef = useRef(0);
  const botRef = useRef<Bot | null>(null);

  // Create bot once when config changes
  useEffect(() => {
    if (config) {
      botRef.current = createBotForDifficulty({
        playerId: config.playerId,
        difficulty: config.difficulty,
        factionId: config.factionId,
      });
    } else {
      botRef.current = null;
    }
  }, [config?.playerId, config?.difficulty, config?.factionId]);

  const runAIStep = useCallback(async () => {
    if (!config || !botRef.current) return;
    if (gameState.winner) return;
    if (gameState.currentPlayerId !== config.playerId) return;

    const bot = botRef.current;
    const runId = ++abortRef.current;
    isThinking.current = true;

    const delay = gameState.phase === 'gameplay' ? (config.thinkDelayMs ?? 400) : 50;

    const step = () => {
      // Check abort
      if (abortRef.current !== runId) {
        isThinking.current = false;
        return;
      }

      const result = stepBot(gameState, bot, config.playerId);
      if (!result) {
        isThinking.current = false;
        return;
      }

      dispatch(result.action);
      // Note: the next render will trigger another effect if still AI's turn
      isThinking.current = false;
    };

    setTimeout(step, delay);
  }, [gameState, dispatch, config]);

  // Trigger AI step when it's the AI's turn
  useEffect(() => {
    if (!config || !botRef.current) return;
    if (gameState.winner) return;
    if (gameState.currentPlayerId !== config.playerId) return;

    const runId = ++abortRef.current;
    const delay = gameState.phase === 'gameplay' ? (config.thinkDelayMs ?? 400) : 50;

    const timer = setTimeout(() => {
      if (abortRef.current !== runId) return;

      const result = stepBot(gameState, botRef.current!, config.playerId);
      if (!result) return;

      dispatch(result.action);
    }, delay);

    return () => {
      clearTimeout(timer);
      abortRef.current++;
    };
  }, [gameState, config, dispatch]);

  const isAITurn = !!(config && gameState.currentPlayerId === config.playerId && !gameState.winner);

  return { isThinking: isAITurn };
}
