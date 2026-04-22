// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { createDevGameplayState } from '../../src/ui/devSandbox.js';
import { HexGrid } from '../../src/ui/components/HexGrid.js';
import { UnitToken } from '../../src/ui/components/UnitToken.js';
import { UnitInfoPanel } from '../../src/ui/components/UnitInfoPanel.js';
import { getUnitActions } from '../../src/engine/actions.js';
import { hexToPixel } from '../../src/ui/hexLayout.js';

const gameState = createDevGameplayState(42);

describe('UnitToken', () => {
  it('renders a unit with circle and label', () => {
    const unit = gameState.units[0];
    const { container } = render(
      <svg><UnitToken unit={unit} /></svg>,
    );
    const circle = container.querySelector('circle');
    expect(circle).toBeTruthy();
    const text = container.querySelector('text');
    expect(text).toBeTruthy();
  });

  it('shows selection glow when selected', () => {
    const unit = gameState.units[0];
    const { container } = render(
      <svg><UnitToken unit={unit} selected /></svg>,
    );
    const circles = container.querySelectorAll('circle');
    // 2 circles: glow ring + unit circle
    expect(circles.length).toBe(2);
  });

  it('fires onClick with unit data', () => {
    const unit = gameState.units[0];
    const clicked: string[] = [];
    const { container } = render(
      <svg><UnitToken unit={unit} onClick={u => clicked.push(u.id)} /></svg>,
    );
    const g = container.querySelector('[data-testid]');
    if (g) fireEvent.click(g);
    expect(clicked).toEqual([unit.id]);
  });

  it('renders HP bar', () => {
    const unit = gameState.units[0];
    const { container } = render(
      <svg><UnitToken unit={unit} /></svg>,
    );
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(2); // background + fill
  });
});

describe('HexGrid with units', () => {
  it('renders unit tokens for alive units', () => {
    const aliveCount = gameState.units.filter(u => u.currentHp > 0).length;
    const { container } = render(
      <HexGrid board={gameState.board} units={gameState.units} />,
    );
    const unitGroups = container.querySelectorAll('[data-testid^="unit-"]');
    expect(unitGroups.length).toBe(aliveCount);
  });

  it('highlights selected unit', () => {
    const unit = gameState.units.find(u => u.playerId === gameState.currentPlayerId)!;
    const { container } = render(
      <HexGrid
        board={gameState.board}
        units={gameState.units}
        selectedUnitId={unit.id}
      />,
    );
    const selectedGroup = container.querySelector(`[data-testid="unit-${unit.id}"]`);
    expect(selectedGroup).toBeTruthy();
    // Should have glow circle (2 circles: glow + unit)
    const circles = selectedGroup!.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });
});

describe('UnitInfoPanel', () => {
  it('shows unit stats', () => {
    const unit = gameState.units.find(u => u.playerId === gameState.currentPlayerId)!;
    const actions = getUnitActions(gameState, unit.id);
    const { container } = render(
      <UnitInfoPanel unit={unit} actions={actions} />,
    );
    expect(container.textContent).toContain('HP');
    expect(container.textContent).toContain(`${unit.currentHp}/${unit.maxHp}`);
    expect(container.textContent).toContain('Attack');
  });

  it('shows End Unit Turn button when available', () => {
    const unit = gameState.units.find(u => u.playerId === gameState.currentPlayerId)!;
    const actions = getUnitActions(gameState, unit.id);
    const clicked: boolean[] = [];
    const { container } = render(
      <UnitInfoPanel unit={unit} actions={actions} onEndUnitTurn={() => clicked.push(true)} />,
    );
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(button!.textContent).toBe('End Unit Turn');
    fireEvent.click(button!);
    expect(clicked).toHaveLength(1);
  });
});
