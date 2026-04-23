import React, { useEffect, useState } from 'react';
import type { GameEvent } from '../../engine/events.js';

interface CombatOverlayProps {
  events: readonly GameEvent[];
}

interface CombatResult {
  hit: boolean;
  crit: boolean;
  damage: number;
  roll: number;
  toHit: number;
  targetKilled: boolean;
  targetHpAfter: number;
}

export function CombatOverlay({ events }: CombatOverlayProps) {
  const [result, setResult] = useState<CombatResult | null>(null);
  const [visible, setVisible] = useState(false);
  const [eventKey, setEventKey] = useState(0);

  useEffect(() => {
    const attackEvent = events.find(e => e.type === 'attackResolved');
    if (attackEvent && attackEvent.type === 'attackResolved') {
      setResult({
        hit: attackEvent.hit,
        crit: attackEvent.crit,
        damage: attackEvent.damage,
        roll: attackEvent.roll,
        toHit: attackEvent.effectiveToHit,
        targetKilled: attackEvent.targetKilled,
        targetHpAfter: attackEvent.targetHpAfter,
      });
      setVisible(true);
      setEventKey(k => k + 1);
    } else {
      // No attack event — ensure overlay is hidden
      setVisible(false);
    }
  }, [events]);

  // Auto-dismiss timer keyed to eventKey so it only resets on new attacks
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [eventKey, visible]);

  if (!visible || !result) return null;

  const bgColor = result.crit
    ? 'rgba(234, 179, 8, 0.95)'
    : result.hit
      ? 'rgba(239, 68, 68, 0.9)'
      : 'rgba(100, 116, 139, 0.9)';

  const label = result.crit ? 'CRITICAL HIT!' : result.hit ? 'HIT' : 'MISS';

  return (
    <div
      data-testid="combat-overlay"
      onClick={() => setVisible(false)}
      style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        padding: '16px 32px',
        borderRadius: '12px',
        background: bgColor,
        color: '#fff',
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', opacity: 0.9 }}>
        🎲 {result.roll} vs {result.toHit}+ • {result.damage} damage
      </div>
      {result.targetKilled && (
        <div style={{ fontSize: '16px', marginTop: '4px' }}>💀 Target destroyed!</div>
      )}
    </div>
  );
}
