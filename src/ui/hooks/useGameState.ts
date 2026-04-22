import { useCallback, useMemo, useReducer } from 'react';
import type { GameState, Action, Unit, CubeCoord } from '../../engine/types.js';
import type { GameConfig } from '../../engine/game.js';
import type { GameEvent } from '../../engine/events.js';
import { validateAction } from '../../engine/validation.js';
import { getUnitActions } from '../../engine/actions.js';
import { hexKey } from '../../engine/hex.js';
import {
  createRecordedGame, applyRecordedAction, getEventsByType,
} from '../../engine/recorder.js';
import type { RecordedGame } from '../../engine/recorder.js';
import { registerAllAbilities } from '../../engine/abilities/index.js';

// ========== Types ==========

export interface DispatchResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly events?: readonly GameEvent[];
}

interface UIState {
  readonly recorded: RecordedGame;
  readonly selectedUnitId: string | null;
  readonly lastEvents: readonly GameEvent[];
  readonly lastError: string | null;
  readonly history: readonly RecordedGame[];
}

type UIAction =
  | { type: 'dispatch'; action: Action }
  | { type: 'selectUnit'; unitId: string }
  | { type: 'deselectUnit' }
  | { type: 'undo' };

// ========== Reducer ==========

function reducer(state: UIState, uiAction: UIAction): UIState {
  switch (uiAction.type) {
    case 'dispatch': {
      const gs = state.recorded.state;
      const validation = validateAction(gs, uiAction.action);
      if (!validation.valid) {
        return { ...state, lastError: validation.reason ?? 'Invalid action', lastEvents: [] };
      }

      const nextRecorded = applyRecordedAction(state.recorded, uiAction.action);
      const nextState = nextRecorded.state;

      // Compute events from this action
      const prevEventCount = state.recorded.recording.events.length;
      const newEvents = nextRecorded.recording.events.slice(prevEventCount);

      // Auto-select active unit or clear selection
      let selectedUnitId: string | null = nextState.activeUnitId ?? null;
      if (selectedUnitId) {
        const unit = nextState.units.find(u => u.id === selectedUnitId);
        if (!unit || unit.currentHp <= 0) selectedUnitId = null;
      }
      if (nextState.winner) selectedUnitId = null;

      return {
        recorded: nextRecorded,
        selectedUnitId,
        lastEvents: newEvents,
        lastError: null,
        history: [...state.history, state.recorded],
      };
    }

    case 'selectUnit': {
      const gs = state.recorded.state;
      if (gs.phase !== 'gameplay') return state;

      const unit = gs.units.find(u => u.id === uiAction.unitId);
      if (!unit || unit.currentHp <= 0) return state;
      if (unit.playerId !== gs.currentPlayerId) return state;
      if (unit.activatedThisTurn) return state;
      if (gs.activeUnitId && gs.activeUnitId !== uiAction.unitId) return state;

      return { ...state, selectedUnitId: uiAction.unitId, lastError: null };
    }

    case 'deselectUnit':
      if (state.recorded.state.activeUnitId) return state;
      return { ...state, selectedUnitId: null };

    case 'undo': {
      if (state.history.length === 0) return state;
      const prevRecorded = state.history[state.history.length - 1];
      return {
        recorded: prevRecorded,
        selectedUnitId: prevRecorded.state.activeUnitId ?? null,
        lastEvents: [],
        lastError: null,
        history: state.history.slice(0, -1),
      };
    }

    default:
      return state;
  }
}

// ========== Hook ==========

let abilitiesRegistered = false;

export function useGameState(configOrState: GameConfig | GameState) {
  if (!abilitiesRegistered) {
    registerAllAbilities();
    abilitiesRegistered = true;
  }

  const initialRecorded = useMemo(() => {
    if ('phase' in configOrState) {
      // Pre-built GameState (dev sandbox) — wrap in a minimal RecordedGame
      return {
        state: configOrState,
        recording: {
          config: { boardSize: configOrState.board.size, playerIds: configOrState.players.map(p => p.id), seed: configOrState.rngSeed },
          initialState: configOrState,
          actions: [],
          events: [],
        },
      } as RecordedGame;
    }
    return createRecordedGame(configOrState);
  }, []);

  const [state, rawDispatch] = useReducer(reducer, {
    recorded: initialRecorded,
    selectedUnitId: null,
    lastEvents: [],
    lastError: null,
    history: [],
  });

  const dispatch = useCallback((action: Action): DispatchResult => {
    const validation = validateAction(state.recorded.state, action);
    if (!validation.valid) {
      rawDispatch({ type: 'dispatch', action });
      return { ok: false, reason: validation.reason };
    }
    rawDispatch({ type: 'dispatch', action });
    return { ok: true };
  }, [state.recorded.state]);

  const selectUnit = useCallback((unitId: string) => {
    rawDispatch({ type: 'selectUnit', unitId });
  }, []);

  const deselectUnit = useCallback(() => {
    rawDispatch({ type: 'deselectUnit' });
  }, []);

  const undo = useCallback(() => {
    rawDispatch({ type: 'undo' });
  }, []);

  const gameState = state.recorded.state;

  const selectedUnit = useMemo(() => {
    if (!state.selectedUnitId) return null;
    return gameState.units.find(u => u.id === state.selectedUnitId) ?? null;
  }, [gameState.units, state.selectedUnitId]);

  const unitActions = useMemo(() => {
    if (!state.selectedUnitId || gameState.phase !== 'gameplay') {
      return { moves: [] as readonly CubeCoord[], attackTargets: [] as readonly Unit[], canEndUnitTurn: false };
    }
    return getUnitActions(gameState, state.selectedUnitId);
  }, [gameState, state.selectedUnitId]);

  const moveHighlights = useMemo(() => {
    const map = new Map<string, string>();
    if (state.selectedUnitId && selectedUnit) {
      map.set(hexKey(selectedUnit.position), '#fbbf24');
    }
    for (const coord of unitActions.moves) {
      map.set(hexKey(coord), 'rgba(59, 130, 246, 0.4)');
    }
    for (const target of unitActions.attackTargets) {
      map.set(hexKey(target.position), 'rgba(239, 68, 68, 0.4)');
    }
    return map;
  }, [state.selectedUnitId, selectedUnit, unitActions]);

  return {
    gameState,
    recording: state.recorded.recording,
    selectedUnitId: state.selectedUnitId,
    selectedUnit,
    unitActions,
    moveHighlights,
    lastEvents: state.lastEvents,
    lastError: state.lastError,
    canUndo: state.history.length > 0,
    dispatch,
    selectUnit,
    deselectUnit,
    undo,
  };
}
