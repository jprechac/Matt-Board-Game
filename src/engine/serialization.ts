import type { Action } from './types.js';
import type { GameRecording } from './recorder.js';
import type { GameConfig } from './game.js';
import { createGame, applyActionDetailed } from './game.js';

// ========== Schema ==========

const SCHEMA_VERSION = 1;

interface SerializedRecording {
  readonly version: number;
  readonly config: GameConfig;
  readonly actions: readonly Action[];
  /** Verification: total event count to detect drift */
  readonly eventCount: number;
}

// ========== Serialization ==========

/** Serialize a GameRecording to a JSON string.
 *  Only stores config + actions (events and states are deterministic). */
export function serializeRecording(recording: GameRecording): string {
  const data: SerializedRecording = {
    version: SCHEMA_VERSION,
    config: recording.config,
    actions: recording.actions,
    eventCount: recording.events.length,
  };
  return JSON.stringify(data);
}

// ========== Deserialization ==========

/** Deserialize a JSON string into a GameRecording.
 *  Replays all actions to reconstruct events and states deterministically. */
export function deserializeRecording(json: string): GameRecording {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }

  validateSchema(data);
  const serialized = data as SerializedRecording;

  if (serialized.version > SCHEMA_VERSION) {
    throw new Error(
      `Recording version ${serialized.version} is newer than supported version ${SCHEMA_VERSION}`,
    );
  }

  return rebuildRecording(serialized);
}

// ========== Internal ==========

function validateSchema(data: unknown): void {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Recording must be a JSON object');
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== 'number') {
    throw new Error('Missing or invalid "version" field');
  }
  if (typeof obj.config !== 'object' || obj.config === null) {
    throw new Error('Missing or invalid "config" field');
  }
  if (!Array.isArray(obj.actions)) {
    throw new Error('Missing or invalid "actions" field');
  }

  const config = obj.config as Record<string, unknown>;
  if (typeof config.seed !== 'number') {
    throw new Error('Config missing "seed" field');
  }
  if (!Array.isArray(config.playerIds) || config.playerIds.length < 2) {
    throw new Error('Config missing or invalid "playerIds" field');
  }
  if (typeof config.boardSize !== 'string') {
    throw new Error('Config missing "boardSize" field');
  }

  for (let i = 0; i < (obj.actions as unknown[]).length; i++) {
    const action = (obj.actions as unknown[])[i];
    if (typeof action !== 'object' || action === null) {
      throw new Error(`Action at index ${i} is not an object`);
    }
    if (typeof (action as Record<string, unknown>).type !== 'string') {
      throw new Error(`Action at index ${i} missing "type" field`);
    }
  }
}

function rebuildRecording(serialized: SerializedRecording): GameRecording {
  const config = serialized.config as GameConfig;
  const initialState = createGame(config);

  // Replay all actions to rebuild events
  const allEvents: import('./events.js').GameEvent[] = [
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
      rolls: { ...initialState.setupState!.rollResults },
      winner: initialState.setupState!.rollWinner!,
    },
  ];

  let state = initialState;
  for (const action of serialized.actions) {
    const result = applyActionDetailed(state, action as Action);
    allEvents.push(...result.events);
    state = result.state;
  }

  // Verify event count if present
  if (typeof serialized.eventCount === 'number' && allEvents.length !== serialized.eventCount) {
    throw new Error(
      `Event count mismatch: expected ${serialized.eventCount}, got ${allEvents.length}. ` +
      'Recording may have been created with a different engine version.',
    );
  }

  return {
    config,
    initialState,
    events: allEvents,
    actions: serialized.actions as Action[],
  };
}

export { SCHEMA_VERSION };
