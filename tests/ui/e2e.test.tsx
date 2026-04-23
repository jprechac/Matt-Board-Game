// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { App } from '../../src/ui/App.js';
import { CombatOverlay } from '../../src/ui/components/CombatOverlay.js';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';
import { createGame, applyAction } from '../../src/engine/game.js';
import type { GameState, Action } from '../../src/engine/types.js';
import type { GameEvent, AttackResolvedEvent } from '../../src/engine/events.js';

registerAllAbilities();

describe('CombatOverlay', () => {
  it('renders on hit event', () => {
    const events: GameEvent[] = [
      {
        type: 'attackResolved',
        turnNumber: 1,
        attackerId: 'u1',
        targetId: 'u2',
        roll: 5,
        effectiveToHit: 4,
        hit: true,
        crit: false,
        damage: 2,
        targetHpAfter: 3,
        targetKilled: false,
      } as AttackResolvedEvent,
    ];
    const { container } = render(<CombatOverlay events={events} />);
    const overlay = container.querySelector('[data-testid="combat-overlay"]');
    expect(overlay).toBeTruthy();
    expect(overlay!.textContent).toContain('HIT');
    expect(overlay!.textContent).toContain('2 damage');
  });

  it('shows CRITICAL HIT on crit', () => {
    const events: GameEvent[] = [
      {
        type: 'attackResolved',
        turnNumber: 1,
        attackerId: 'u1',
        targetId: 'u2',
        roll: 8,
        effectiveToHit: 4,
        hit: true,
        crit: true,
        damage: 4,
        targetHpAfter: 1,
        targetKilled: false,
      } as AttackResolvedEvent,
    ];
    const { container } = render(<CombatOverlay events={events} />);
    const overlay = container.querySelector('[data-testid="combat-overlay"]');
    expect(overlay!.textContent).toContain('CRITICAL HIT');
  });

  it('shows MISS on miss', () => {
    const events: GameEvent[] = [
      {
        type: 'attackResolved',
        turnNumber: 1,
        attackerId: 'u1',
        targetId: 'u2',
        roll: 2,
        effectiveToHit: 4,
        hit: false,
        crit: false,
        damage: 0,
        targetHpAfter: 5,
        targetKilled: false,
      } as AttackResolvedEvent,
    ];
    const { container } = render(<CombatOverlay events={events} />);
    const overlay = container.querySelector('[data-testid="combat-overlay"]');
    expect(overlay!.textContent).toContain('MISS');
  });

  it('shows target destroyed on kill', () => {
    const events: GameEvent[] = [
      {
        type: 'attackResolved',
        turnNumber: 1,
        attackerId: 'u1',
        targetId: 'u2',
        roll: 6,
        effectiveToHit: 4,
        hit: true,
        crit: false,
        damage: 5,
        targetHpAfter: 0,
        targetKilled: true,
      } as AttackResolvedEvent,
    ];
    const { container } = render(<CombatOverlay events={events} />);
    const overlay = container.querySelector('[data-testid="combat-overlay"]');
    expect(overlay!.textContent).toContain('Target destroyed');
  });

  it('renders nothing with no attack events', () => {
    const events: GameEvent[] = [
      { type: 'unitMoved', turnNumber: 1, unitId: 'u1', from: { q: 0, r: 0, s: 0 }, to: { q: 1, r: 0, s: -1 }, distance: 1 },
    ];
    const { container } = render(<CombatOverlay events={events} />);
    const overlay = container.querySelector('[data-testid="combat-overlay"]');
    expect(overlay).toBeNull();
  });
});

describe('App main menu', () => {
  it('renders new game and dev sandbox buttons', () => {
    const { container } = render(<App />);
    expect(container.textContent).toContain('New Game');
    expect(container.textContent).toContain('Dev Sandbox');
  });

  it('clicking New Game shows setup screen', () => {
    const { container } = render(<App />);
    const newGameBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('New Game'));
    fireEvent.click(newGameBtn!);
    expect(container.textContent).toContain('Game Setup');
  });

  it('clicking Dev Sandbox shows gameplay', () => {
    const { container } = render(<App />);
    const devBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Dev Sandbox'));
    fireEvent.click(devBtn!);
    // Should show turn indicator and hex grid
    expect(container.textContent).toContain('Turn');
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('Full game engine flow', () => {
  it('completes setup → placement → gameplay lifecycle', () => {
    // This tests the engine flow that the UI drives
    let state = createGame({ boardSize: '2p', playerIds: ['player1', 'player2'], seed: 42 });
    expect(state.phase).toBe('setup');
    expect(state.setupState!.currentStep).toBe('choosePriority');

    // Choose priority (2-step)
    const winner = state.setupState!.rollWinner!;
    const loser = state.players.find(p => p.id !== winner)!.id;
    state = applyAction(state, { type: 'choosePriority', playerId: winner, orderToControl: 'factionOrder', position: 'first' });
    expect(state.setupState!.currentStep).toBe('loserChoosePriority');
    state = applyAction(state, { type: 'choosePriority', playerId: loser, position: 'first' });
    expect(state.setupState!.currentStep).toBe('factionSelection');

    // Select factions
    const factionOrder = state.setupState!.factionSelectionOrder;
    state = applyAction(state, { type: 'selectFaction', playerId: factionOrder[0], factionId: 'romans' });
    state = applyAction(state, { type: 'selectFaction', playerId: factionOrder[1], factionId: 'vikings' });
    expect(state.setupState!.currentStep).toBe('armyComposition');

    // Set army compositions
    const comp = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['legionnaire', 'legionnaire', 'centurion', 'centurion', 'centurion'] };
    state = applyAction(state, { type: 'setArmyComposition', playerId: 'player1', composition: comp });

    const comp2 = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['axe_thrower', 'axe_thrower', 'berserker', 'berserker', 'berserker'] };
    state = applyAction(state, { type: 'setArmyComposition', playerId: 'player2', composition: comp2 });

    expect(state.phase).toBe('placement');

    // Place all units
    const board = state.board;
    while (state.phase === 'placement') {
      const placer = state.currentPlayerId;
      const roster = state.setupState!.unplacedRoster[placer] ?? [];
      if (roster.length === 0) break;

      // Find an empty placement zone cell
      const cells = Object.values(board.cells);
      const occupiedKeys = new Set(state.units.map(u => `${u.position.q},${u.position.r},${u.position.s}`));
      const validCell = cells.find(c =>
        c.placementZonePlayerId === placer &&
        !occupiedKeys.has(`${c.coord.q},${c.coord.r},${c.coord.s}`)
      );

      if (!validCell) break;

      state = applyAction(state, {
        type: 'placeUnit',
        playerId: placer,
        unitTypeId: roster[0],
        position: validCell.coord,
      });
    }

    expect(state.phase).toBe('gameplay');
    expect(state.units.length).toBe(18); // 9 per player
    expect(state.turnNumber).toBe(1);
  });
});
