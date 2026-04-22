import type { GameState, Action, BoardSize, PlayerId } from './types.js';
import type { GameEvent } from './events.js';
import type { GameConfig } from './game.js';
import { createGame, applyActionDetailed } from './game.js';

// ========== Recording Types ==========

export interface GameRecording {
  readonly config: GameConfig;
  readonly initialState: GameState;
  readonly events: readonly GameEvent[];
  readonly actions: readonly Action[];
}

/** Bundled state + recording for tracked games */
export interface RecordedGame {
  readonly state: GameState;
  readonly recording: GameRecording;
}

// ========== Recorded Game API ==========

/** Create a new game with event recording. Emits GameStarted + RollOffResolved. */
export function createRecordedGame(config: GameConfig): RecordedGame {
  const state = createGame(config);

  const initialEvents: GameEvent[] = [
    {
      type: 'gameStarted',
      turnNumber: 0,
      boardSize: config.boardSize,
      playerIds: config.playerIds,
      seed: config.seed,
    },
    {
      type: 'rollOffResolved',
      turnNumber: 0,
      rolls: { ...state.setupState!.rollResults },
      winner: state.setupState!.rollWinner!,
    },
  ];

  return {
    state,
    recording: {
      config,
      initialState: state,
      events: initialEvents,
      actions: [],
    },
  };
}

/** Apply an action and record the resulting events. */
export function applyRecordedAction(game: RecordedGame, action: Action): RecordedGame {
  const { state: newState, events } = applyActionDetailed(game.state, action);

  return {
    state: newState,
    recording: {
      ...game.recording,
      events: [...game.recording.events, ...events],
      actions: [...game.recording.actions, action],
    },
  };
}

/** Get all events of a specific type from a recording. */
export function getEventsByType<T extends GameEvent>(
  recording: GameRecording,
  type: T['type'],
): T[] {
  return recording.events.filter(e => e.type === type) as T[];
}
