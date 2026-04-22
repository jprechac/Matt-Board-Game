import React, { useEffect, useRef } from 'react';
import type { GameEvent } from '../../engine/events.js';

interface EventLogProps {
  events: readonly GameEvent[];
  maxVisible?: number;
}

const EVENT_COLORS: Record<string, string> = {
  gameStarted: '#94a3b8',
  rollOffResolved: '#94a3b8',
  priorityChosen: '#94a3b8',
  factionSelected: '#a78bfa',
  armyCompositionSet: '#a78bfa',
  unitPlaced: '#38bdf8',
  placementComplete: '#22c55e',
  turnStarted: '#22c55e',
  turnEnded: '#94a3b8',
  unitMoved: '#3b82f6',
  attackResolved: '#ef4444',
  unitKilled: '#dc2626',
  unitTurnEnded: '#64748b',
  baseControlChanged: '#fbbf24',
  gameWon: '#fbbf24',
  surrender: '#f59e0b',
};

function formatEvent(event: GameEvent): string {
  switch (event.type) {
    case 'gameStarted': return '🎮 Game started';
    case 'rollOffResolved': return `🎲 Roll-off: ${event.winner} wins`;
    case 'priorityChosen': return `${event.playerId} chose: ${event.choice}`;
    case 'factionSelected': return `${event.playerId} picked ${event.factionId}`;
    case 'armyCompositionSet': return `${event.playerId} set army composition`;
    case 'unitPlaced': return `${event.playerId} placed ${event.unitTypeId}`;
    case 'placementComplete': return '✅ Placement complete';
    case 'turnStarted': return `— Turn ${event.turnNumber}: ${event.playerId} —`;
    case 'turnEnded': return `${event.playerId} ended turn`;
    case 'unitMoved': return `Unit moved (${event.distance} hex)`;
    case 'attackResolved': return `⚔️ ${event.hit ? (event.crit ? 'CRIT!' : 'Hit') : 'Miss'} — ${event.damage} dmg`;
    case 'unitKilled': return `💀 Unit killed`;
    case 'unitTurnEnded': return `Unit exhausted`;
    case 'baseControlChanged': return `⚑ ${event.playerId} ${event.timerReset ? 'lost' : 'controls'} base (${event.timerValue})`;
    case 'gameWon': return `🏆 ${event.winner} wins by ${event.winCondition}!`;
    case 'surrender': return `🏳️ ${event.playerId} surrendered`;
    default: return (event as { type: string }).type;
  }
}

export function EventLog({ events, maxVisible = 50 }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = events.slice(-maxVisible);

  useEffect(() => {
    if (scrollRef.current?.scrollTo) {
      scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight);
    }
  }, [events.length]);

  return (
    <div
      ref={scrollRef}
      style={{
        width: '220px',
        maxHeight: '400px',
        overflow: 'auto',
        padding: '8px',
        background: '#0f172a',
        borderRadius: '6px',
        fontSize: '11px',
        lineHeight: '1.6',
      }}
      data-testid="event-log"
    >
      <div style={{ color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
        Event Log ({events.length})
      </div>
      {visible.map((event, i) => (
        <div
          key={events.length - visible.length + i}
          style={{ color: EVENT_COLORS[event.type] ?? '#94a3b8' }}
        >
          {formatEvent(event)}
        </div>
      ))}
    </div>
  );
}
