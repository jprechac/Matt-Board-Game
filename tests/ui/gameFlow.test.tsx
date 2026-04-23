// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SetupScreen } from '../../src/ui/components/SetupScreen.js';
import { TurnIndicator } from '../../src/ui/components/TurnIndicator.js';
import { EventLog } from '../../src/ui/components/EventLog.js';
import { createGame } from '../../src/engine/game.js';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';
import type { GameState } from '../../src/engine/types.js';
import type { GameEvent } from '../../src/engine/events.js';

registerAllAbilities();

function createSetupState(): GameState {
  return createGame({ boardSize: '2p', playerIds: ['player1', 'player2'], seed: 42 });
}

// ========== SetupScreen ==========

describe('SetupScreen', () => {
  it('renders choose priority step', () => {
    const state = createSetupState();
    const dispatch = vi.fn(() => ({ ok: true }));
    const { container } = render(<SetupScreen gameState={state} dispatch={dispatch} lastError={null} />);

    expect(container.textContent).toContain('won the roll');
    expect(container.textContent).toContain('Pick Faction First');
    expect(container.textContent).toContain('Move First');
    expect(container.textContent).toContain('Pick Faction Second');
    expect(container.textContent).toContain('Move Second');
  });

  it('dispatches choosePriority action on button click', () => {
    const state = createSetupState();
    const dispatch = vi.fn(() => ({ ok: true }));
    const { container } = render(<SetupScreen gameState={state} dispatch={dispatch} lastError={null} />);

    const buttons = container.querySelectorAll('button');
    const pickBtn = Array.from(buttons).find(b => b.textContent?.includes('Pick Faction First'));
    expect(pickBtn).toBeTruthy();
    fireEvent.click(pickBtn!);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'choosePriority', orderToControl: 'factionOrder', position: 'first' })
    );
  });

  it('displays error message when provided', () => {
    const state = createSetupState();
    const dispatch = vi.fn(() => ({ ok: true }));
    const { container } = render(<SetupScreen gameState={state} dispatch={dispatch} lastError="Something went wrong" />);

    expect(container.textContent).toContain('Something went wrong');
  });
});

// ========== TurnIndicator ==========

describe('TurnIndicator', () => {
  it('renders current player and turn number', () => {
    const state = createSetupState();
    const { container } = render(<TurnIndicator gameState={state} />);

    expect(container.textContent).toContain(state.currentPlayerId);
    expect(container.textContent).toContain(`Turn ${state.turnNumber}`);
  });

  it('shows base control timers when non-zero', () => {
    const state: GameState = {
      ...createSetupState(),
      baseControlTimers: { player1: 2, player2: 0 },
    };
    const { container } = render(<TurnIndicator gameState={state} />);

    expect(container.textContent).toContain('player1');
    expect(container.textContent).toContain('2 turns in base');
  });
});

// ========== EventLog ==========

describe('EventLog', () => {
  it('renders empty event list', () => {
    const { container } = render(<EventLog events={[]} />);
    const log = container.querySelector('[data-testid="event-log"]');
    expect(log).toBeTruthy();
    expect(log!.textContent).toContain('Event Log (0)');
  });

  it('renders events with correct count', () => {
    const events: GameEvent[] = [
      { type: 'gameStarted', turnNumber: 0, boardSize: '2p', playerIds: ['player1', 'player2'], seed: 42 },
      { type: 'turnStarted', turnNumber: 1, playerId: 'player1' },
    ];
    const { container } = render(<EventLog events={events} />);
    expect(container.textContent).toContain('Event Log (2)');
    expect(container.textContent).toContain('Game started');
  });

  it('limits visible events', () => {
    const events: GameEvent[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'unitTurnEnded' as const,
      turnNumber: 1,
      unitId: `unit-${i}`,
    }));
    const { container } = render(<EventLog events={events} maxVisible={3} />);
    const log = container.querySelector('[data-testid="event-log"]');
    const children = log!.querySelectorAll(':scope > div');
    // 1 header + 3 visible events = 4
    expect(children.length).toBe(4);
  });
});
