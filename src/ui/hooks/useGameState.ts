import { useCallback, useMemo, useReducer } from 'react';
import type { GameState, Action, Unit, CubeCoord } from '../../engine/types.js';
import type { GameConfig } from '../../engine/game.js';
import type { GameEvent } from '../../engine/events.js';
import { createGame, applyActionDetailed } from '../../engine/game.js';
import { validateAction } from '../../engine/validation.js';
import { getUnitActions } from '../../engine/actions.js';
import { hexKey } from '../../engine/hex.js';

// ========== Types ==========

export interface DispatchResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly events?: readonly GameEvent[];
}

interface UIState {
  readonly gameState: GameState;
  readonly selectedUnitId: string | null;
  readonly lastEvents: readonly GameEvent[];
  readonly lastError: string | null;
  readonly stateHistory: readonly GameState[];
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
      const validation = validateAction(state.gameState, uiAction.action);
      if (!validation.valid) {
        return { ...state, lastError: validation.reason ?? 'Invalid action', lastEvents: [] };
      }

      const { state: nextState, events } = applyActionDetailed(state.gameState, uiAction.action);

      // Auto-select active unit or clear selection
      let selectedUnitId: string | null = nextState.activeUnitId ?? null;

      // If unit died or game ended, clear selection
      if (selectedUnitId) {
        const unit = nextState.units.find(u => u.id === selectedUnitId);
        if (!unit || unit.currentHp <= 0) selectedUnitId = null;
      }
      if (nextState.winner) selectedUnitId = null;

      return {
        gameState: nextState,
        selectedUnitId,
        lastEvents: events,
        lastError: null,
        stateHistory: [...state.stateHistory, state.gameState],
      };
    }

    case 'selectUnit': {
      const gs = state.gameState;
      if (gs.phase !== 'gameplay') return state;

      const unit = gs.units.find(u => u.id === uiAction.unitId);
      if (!unit || unit.currentHp <= 0) return state;
      if (unit.playerId !== gs.currentPlayerId) return state;
      if (unit.activatedThisTurn) return state;

      // Can't select a different unit while one is active
      if (gs.activeUnitId && gs.activeUnitId !== uiAction.unitId) return state;

      return { ...state, selectedUnitId: uiAction.unitId, lastError: null };
    }

    case 'deselectUnit':
      // Can't deselect if engine has an active unit
      if (state.gameState.activeUnitId) return state;
      return { ...state, selectedUnitId: null };

    case 'undo': {
      if (state.stateHistory.length === 0) return state;
      const prevState = state.stateHistory[state.stateHistory.length - 1];
      return {
        gameState: prevState,
        selectedUnitId: prevState.activeUnitId ?? null,
        lastEvents: [],
        lastError: null,
        stateHistory: state.stateHistory.slice(0, -1),
      };
    }

    default:
      return state;
  }
}

// ========== Hook ==========

export function useGameState(initialState: GameState) {
  const [state, rawDispatch] = useReducer(reducer, {
    gameState: initialState,
    selectedUnitId: null,
    lastEvents: [],
    lastError: null,
    stateHistory: [],
  });

  const dispatch = useCallback((action: Action): DispatchResult => {
    const validation = validateAction(state.gameState, action);
    if (!validation.valid) {
      rawDispatch({ type: 'dispatch', action });
      return { ok: false, reason: validation.reason };
    }
    rawDispatch({ type: 'dispatch', action });
    return { ok: true };
  }, [state.gameState]);

  const selectUnit = useCallback((unitId: string) => {
    rawDispatch({ type: 'selectUnit', unitId });
  }, []);

  const deselectUnit = useCallback(() => {
    rawDispatch({ type: 'deselectUnit' });
  }, []);

  const undo = useCallback(() => {
    rawDispatch({ type: 'undo' });
  }, []);

  // Derived data
  const selectedUnit = useMemo(() => {
    if (!state.selectedUnitId) return null;
    return state.gameState.units.find(u => u.id === state.selectedUnitId) ?? null;
  }, [state.gameState.units, state.selectedUnitId]);

  const unitActions = useMemo(() => {
    if (!state.selectedUnitId || state.gameState.phase !== 'gameplay') {
      return { moves: [] as readonly CubeCoord[], attackTargets: [] as readonly Unit[], canEndUnitTurn: false };
    }
    return getUnitActions(state.gameState, state.selectedUnitId);
  }, [state.gameState, state.selectedUnitId]);

  const moveHighlights = useMemo(() => {
    const map = new Map<string, string>();
    if (state.selectedUnitId && selectedUnit) {
      map.set(hexKey(selectedUnit.position), '#fbbf24'); // gold for selected
    }
    for (const coord of unitActions.moves) {
      map.set(hexKey(coord), 'rgba(59, 130, 246, 0.4)'); // blue for moves
    }
    for (const target of unitActions.attackTargets) {
      map.set(hexKey(target.position), 'rgba(239, 68, 68, 0.4)'); // red for targets
    }
    return map;
  }, [state.selectedUnitId, selectedUnit, unitActions]);

  return {
    gameState: state.gameState,
    selectedUnitId: state.selectedUnitId,
    selectedUnit,
    unitActions,
    moveHighlights,
    lastEvents: state.lastEvents,
    lastError: state.lastError,
    canUndo: state.stateHistory.length > 0,
    dispatch,
    selectUnit,
    deselectUnit,
    undo,
  };
}
