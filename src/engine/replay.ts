import type { GameState, Action } from './types.js';
import type { GameEvent, TurnStartedEvent } from './events.js';
import type { GameRecording } from './recorder.js';
import { createGame, applyAction, applyActionDetailed } from './game.js';

// ========== Replay Types ==========

export interface ReplayState {
  readonly recording: GameRecording;
  /** Action position: -1 = initial state, 0..n-1 = after action[i] */
  readonly currentActionIndex: number;
  /** Event timeline position for display purposes */
  readonly currentEventIndex: number;
  /** Cached states: stateHistory[0] = initialState, [i+1] = after action[i] */
  readonly stateHistory: readonly GameState[];
  /** Maps each action index to its first event index in recording.events.
   *  Length = actions.length + 1 (last entry = total event count).
   *  Pre-creation events (gameStarted, rollOffResolved) are at indices before actionEventBoundaries[0]. */
  readonly actionEventBoundaries: readonly number[];
}

// ========== Replay Creation ==========

/** Create a replay viewer from a recording. Starts at initial state. */
export function createReplay(recording: GameRecording): ReplayState {
  // Build action→event boundaries by replaying actions
  const boundaries = buildEventBoundaries(recording);

  return {
    recording,
    currentActionIndex: -1,
    currentEventIndex: -1,
    stateHistory: [recording.initialState],
    actionEventBoundaries: boundaries,
  };
}

function buildEventBoundaries(recording: GameRecording): number[] {
  // Count pre-action events (gameStarted, rollOffResolved from createRecordedGame)
  const totalEvents = recording.events.length;
  const totalActions = recording.actions.length;

  if (totalActions === 0) return [totalEvents];

  // Replay actions to count events per action
  const boundaries: number[] = [];
  let eventCursor = 0;

  // Find where action events start (skip pre-action events)
  // Pre-action events: gameStarted + rollOffResolved = 2 (from createRecordedGame)
  const preActionEventCount = findPreActionEventCount(recording);
  eventCursor = preActionEventCount;

  let state = recording.initialState;
  for (let i = 0; i < totalActions; i++) {
    boundaries.push(eventCursor);
    // Count events this action produced by examining the recording
    const { state: nextState, events } = replayActionForEvents(state, recording.actions[i]);
    eventCursor += events.length;
    state = nextState;
  }
  boundaries.push(eventCursor); // sentinel: total event count

  return boundaries;
}

function findPreActionEventCount(recording: GameRecording): number {
  // Pre-action events are gameStarted and rollOffResolved (always 2)
  let count = 0;
  for (const e of recording.events) {
    if (e.type === 'gameStarted' || e.type === 'rollOffResolved') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function replayActionForEvents(state: GameState, action: Action) {
  return applyActionDetailed(state, action);
}

// ========== Navigation ==========

/** Get the current game state at the replay position. */
export function getCurrentState(replay: ReplayState): GameState {
  if (replay.currentActionIndex === -1) {
    return replay.stateHistory[0];
  }
  return replay.stateHistory[replay.currentActionIndex + 1];
}

/** Get all events up to and including the current position. */
export function getEventsUpTo(replay: ReplayState): GameEvent[] {
  if (replay.currentEventIndex < 0) return [];
  return replay.recording.events.slice(0, replay.currentEventIndex + 1);
}

/** Step forward one action. Returns updated replay, or same replay if at end. */
export function stepForward(replay: ReplayState): ReplayState {
  const nextActionIndex = replay.currentActionIndex + 1;
  if (nextActionIndex >= replay.recording.actions.length) {
    return replay; // already at end
  }

  const filledReplay = ensureStateCached(replay, nextActionIndex);

  // Advance event index to last event of this action
  const lastEventOfAction = filledReplay.actionEventBoundaries[nextActionIndex + 1] - 1;

  return {
    ...filledReplay,
    currentActionIndex: nextActionIndex,
    currentEventIndex: lastEventOfAction,
  };
}

/** Step backward one action. Returns updated replay, or same replay if at start. */
export function stepBackward(replay: ReplayState): ReplayState {
  if (replay.currentActionIndex < 0) {
    return replay; // already at initial state
  }

  const prevActionIndex = replay.currentActionIndex - 1;

  // Event index: if going to initial state (-1), show pre-action events
  let eventIndex: number;
  if (prevActionIndex === -1) {
    const preActionCount = findPreActionEventCount(replay.recording);
    eventIndex = preActionCount > 0 ? preActionCount - 1 : -1;
  } else {
    eventIndex = replay.actionEventBoundaries[prevActionIndex + 1] - 1;
  }

  return {
    ...replay,
    currentActionIndex: prevActionIndex,
    currentEventIndex: eventIndex,
  };
}

/** Jump to the state after a specific action index. Use -1 for initial state. */
export function goToAction(replay: ReplayState, actionIndex: number): ReplayState {
  if (actionIndex < -1 || actionIndex >= replay.recording.actions.length) {
    throw new Error(`Action index ${actionIndex} out of range [-1, ${replay.recording.actions.length - 1}]`);
  }

  if (actionIndex === -1) {
    const preActionCount = findPreActionEventCount(replay.recording);
    return {
      ...replay,
      currentActionIndex: -1,
      currentEventIndex: preActionCount > 0 ? preActionCount - 1 : -1,
    };
  }

  const filledReplay = ensureStateCached(replay, actionIndex);
  const lastEventOfAction = filledReplay.actionEventBoundaries[actionIndex + 1] - 1;

  return {
    ...filledReplay,
    currentActionIndex: actionIndex,
    currentEventIndex: lastEventOfAction,
  };
}

/** Jump to the start of a specific turn number.
 *  Turn 0 = initial state. Turn N (N>=1) = state when TurnStarted(N) was emitted. */
export function goToTurn(replay: ReplayState, turnNumber: number): ReplayState {
  if (turnNumber === 0) {
    return goToAction(replay, -1);
  }

  // Find the TurnStarted event for this turn number
  const events = replay.recording.events;
  for (let i = 0; i < events.length; i++) {
    if (events[i].type === 'turnStarted' && events[i].turnNumber === turnNumber) {
      // This event was emitted by some action — find which one
      return goToEvent(replay, i);
    }
  }

  throw new Error(`Turn ${turnNumber} not found in recording`);
}

/** Jump to the state after the action that produced a specific event index.
 *  Sets currentEventIndex to the specified event for timeline display. */
export function goToEvent(replay: ReplayState, eventIndex: number): ReplayState {
  if (eventIndex < 0 || eventIndex >= replay.recording.events.length) {
    throw new Error(`Event index ${eventIndex} out of range [0, ${replay.recording.events.length - 1}]`);
  }

  // Find which action produced this event
  const preActionCount = findPreActionEventCount(replay.recording);
  if (eventIndex < preActionCount) {
    // Pre-action event → initial state
    return {
      ...replay,
      currentActionIndex: -1,
      currentEventIndex: eventIndex,
    };
  }

  // Binary search / linear scan for the action that contains this event
  for (let i = 0; i < replay.actionEventBoundaries.length - 1; i++) {
    if (eventIndex >= replay.actionEventBoundaries[i] && eventIndex < replay.actionEventBoundaries[i + 1]) {
      const filledReplay = ensureStateCached(replay, i);
      return {
        ...filledReplay,
        currentActionIndex: i,
        currentEventIndex: eventIndex,
      };
    }
  }

  throw new Error(`Event index ${eventIndex} could not be mapped to an action`);
}

/** Total number of actions in the recording. */
export function getActionCount(replay: ReplayState): number {
  return replay.recording.actions.length;
}

/** Total number of events in the recording. */
export function getEventCount(replay: ReplayState): number {
  return replay.recording.events.length;
}

/** Whether the replay is at the end (after last action). */
export function isAtEnd(replay: ReplayState): boolean {
  return replay.currentActionIndex === replay.recording.actions.length - 1;
}

/** Whether the replay is at the beginning (initial state). */
export function isAtStart(replay: ReplayState): boolean {
  return replay.currentActionIndex === -1;
}

// ========== Internal ==========

/** Ensure states are cached up to and including the given action index. */
function ensureStateCached(replay: ReplayState, targetActionIndex: number): ReplayState {
  const neededLength = targetActionIndex + 2; // stateHistory[0] = initial, [i+1] = after action[i]
  if (replay.stateHistory.length >= neededLength) {
    return replay;
  }

  const history = [...replay.stateHistory];
  let state = history[history.length - 1];
  const startAction = history.length - 1; // first uncached action index

  for (let i = startAction; i <= targetActionIndex; i++) {
    state = applyAction(state, replay.recording.actions[i]);
    history.push(state);
  }

  return { ...replay, stateHistory: history };
}
