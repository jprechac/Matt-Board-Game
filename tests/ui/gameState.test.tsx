// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createDevGameplayState } from '../../src/ui/devSandbox.js';
import { hexKey } from '../../src/engine/hex.js';
import type { GameState, Unit } from '../../src/engine/types.js';

// We test the hook logic via the reducer directly for determinism
import { useGameState } from '../../src/ui/hooks/useGameState.js';
import React from 'react';
import { render, act } from '@testing-library/react';

const initialState = createDevGameplayState(42);

// Helper to test hook in a component
function HookTester({ onResult }: { onResult: (r: ReturnType<typeof useGameState>) => void }) {
  const game = useGameState(initialState);
  // Expose latest result
  React.useEffect(() => { onResult(game); });
  return null;
}

describe('useGameState', () => {
  it('starts in gameplay phase', () => {
    let result: ReturnType<typeof useGameState> | null = null;
    render(<HookTester onResult={r => { result = r; }} />);
    expect(result!.gameState.phase).toBe('gameplay');
    expect(result!.selectedUnitId).toBeNull();
  });

  it('selectUnit sets selectedUnitId and computes valid moves', () => {
    let result: ReturnType<typeof useGameState> | null = null;
    const { rerender } = render(<HookTester onResult={r => { result = r; }} />);

    const unit = result!.gameState.units.find(u =>
      u.playerId === result!.gameState.currentPlayerId && u.currentHp > 0,
    )!;

    act(() => { result!.selectUnit(unit.id); });
    rerender(<HookTester onResult={r => { result = r; }} />);

    expect(result!.selectedUnitId).toBe(unit.id);
    expect(result!.unitActions.moves.length).toBeGreaterThan(0);
    expect(result!.unitActions.canEndUnitTurn).toBe(true);
    expect(result!.moveHighlights.size).toBeGreaterThan(0);
  });

  it('cannot select opponent unit', () => {
    let result: ReturnType<typeof useGameState> | null = null;
    render(<HookTester onResult={r => { result = r; }} />);

    const opponentUnit = result!.gameState.units.find(u =>
      u.playerId !== result!.gameState.currentPlayerId && u.currentHp > 0,
    )!;

    act(() => { result!.selectUnit(opponentUnit.id); });

    expect(result!.selectedUnitId).toBeNull();
  });

  it('dispatching a move updates state and keeps unit selected', () => {
    let result: ReturnType<typeof useGameState> | null = null;
    const { rerender } = render(<HookTester onResult={r => { result = r; }} />);

    const unit = result!.gameState.units.find(u =>
      u.playerId === result!.gameState.currentPlayerId && u.currentHp > 0,
    )!;

    act(() => { result!.selectUnit(unit.id); });
    rerender(<HookTester onResult={r => { result = r; }} />);

    const moveTarget = result!.unitActions.moves[0];
    expect(moveTarget).toBeTruthy();

    act(() => { result!.dispatch({ type: 'move', unitId: unit.id, to: moveTarget }); });
    rerender(<HookTester onResult={r => { result = r; }} />);

    // Unit should still be selected (activeUnitId set by engine)
    expect(result!.selectedUnitId).toBe(unit.id);
    // Unit position should have changed
    const movedUnit = result!.gameState.units.find(u => u.id === unit.id)!;
    expect(hexKey(movedUnit.position)).toBe(hexKey(moveTarget));
  });

  it('dispatching endUnitTurn clears selection', () => {
    let result: ReturnType<typeof useGameState> | null = null;
    const { rerender } = render(<HookTester onResult={r => { result = r; }} />);

    const unit = result!.gameState.units.find(u =>
      u.playerId === result!.gameState.currentPlayerId && u.currentHp > 0,
    )!;

    act(() => { result!.selectUnit(unit.id); });
    rerender(<HookTester onResult={r => { result = r; }} />);

    act(() => { result!.dispatch({ type: 'endUnitTurn', unitId: unit.id }); });
    rerender(<HookTester onResult={r => { result = r; }} />);

    // Unit is now exhausted, selection cleared
    expect(result!.selectedUnitId).toBeNull();
  });

  it('dispatching invalid action sets lastError', () => {
    let result: ReturnType<typeof useGameState> | null = null;
    const { rerender } = render(<HookTester onResult={r => { result = r; }} />);

    act(() => {
      result!.dispatch({ type: 'move', unitId: 'nonexistent', to: { q: 0, r: 0, s: 0 } });
    });
    rerender(<HookTester onResult={r => { result = r; }} />);

    expect(result!.lastError).toBeTruthy();
  });

  it('undo restores previous state', () => {
    let result: ReturnType<typeof useGameState> | null = null;
    const { rerender } = render(<HookTester onResult={r => { result = r; }} />);

    const unit = result!.gameState.units.find(u =>
      u.playerId === result!.gameState.currentPlayerId && u.currentHp > 0,
    )!;

    act(() => { result!.selectUnit(unit.id); });
    rerender(<HookTester onResult={r => { result = r; }} />);

    const originalPos = hexKey(unit.position);
    const moveTarget = result!.unitActions.moves[0];

    act(() => { result!.dispatch({ type: 'move', unitId: unit.id, to: moveTarget }); });
    rerender(<HookTester onResult={r => { result = r; }} />);

    expect(result!.canUndo).toBe(true);

    act(() => { result!.undo(); });
    rerender(<HookTester onResult={r => { result = r; }} />);

    const restoredUnit = result!.gameState.units.find(u => u.id === unit.id)!;
    expect(hexKey(restoredUnit.position)).toBe(originalPos);
  });
});
