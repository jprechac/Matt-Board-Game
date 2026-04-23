/**
 * AI Bot type definitions.
 *
 * A Bot is stateless: given a GameState and a player ID, it returns
 * a single Action. The bot runner calls it repeatedly until the turn ends.
 */
import type { GameState, Action, PlayerId, FactionId } from '../engine/types.js';

// ========== Bot Interface ==========

/** A stateless bot that picks one action at a time. */
export interface Bot {
  /** Choose the next action for the given player. */
  chooseAction(state: GameState, playerId: PlayerId): Action;
}

/** Configuration for creating a bot. */
export interface BotConfig {
  readonly playerId: PlayerId;
  readonly difficulty: Difficulty;
  readonly factionId?: FactionId;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

// ========== Evaluation Types ==========

/** Scores representing a player's board position. All values are normalized roughly to [-1, 1]. */
export interface BoardEvaluation {
  /** Weighted HP advantage over opponent (positive = ahead) */
  readonly material: number;
  /** Positional advantage: forward units, zone control */
  readonly position: number;
  /** How threatened our units are by enemy attacks */
  readonly threat: number;
  /** Leader safety: HP, nearby enemies, nearby allies */
  readonly leaderSafety: number;
  /** Urgency of base control: how close either side is to winning/losing */
  readonly baseControl: number;
  /** Composite score (weighted sum of all factors) */
  readonly total: number;
}

/** Weights for combining evaluation factors into a total score. */
export interface EvalWeights {
  readonly material: number;
  readonly position: number;
  readonly threat: number;
  readonly leaderSafety: number;
  readonly baseControl: number;
}

export const DEFAULT_EVAL_WEIGHTS: EvalWeights = {
  material: 0.35,
  position: 0.20,
  threat: 0.15,
  leaderSafety: 0.15,
  baseControl: 0.15,
};

// ========== Action Scoring ==========

/** Score assigned to a candidate action, used to pick the best action. */
export interface ScoredAction {
  readonly action: Action;
  readonly score: number;
  readonly reason: string;
}
