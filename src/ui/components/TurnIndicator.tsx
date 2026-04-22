import React from 'react';
import type { GameState } from '../../engine/types.js';
import { getPlayerColors } from '../styles/colors.js';

interface TurnIndicatorProps {
  gameState: GameState;
}

export function TurnIndicator({ gameState }: TurnIndicatorProps) {
  const colors = getPlayerColors(gameState.currentPlayerId);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
    }}>
      <div style={{
        padding: '4px 12px', borderRadius: '4px',
        background: colors.unit, fontSize: '13px', fontWeight: 'bold',
      }}>
        {gameState.currentPlayerId}
      </div>

      <div style={{ fontSize: '13px', color: '#94a3b8' }}>
        Turn {gameState.turnNumber}
      </div>

      {/* Base control timers */}
      {Object.entries(gameState.baseControlTimers).map(([playerId, timer]) => {
        if (timer <= 0) return null;
        const pc = getPlayerColors(playerId);
        return (
          <div key={playerId} style={{
            padding: '2px 8px', borderRadius: '3px',
            background: 'rgba(251, 191, 36, 0.2)',
            border: '1px solid #fbbf24',
            fontSize: '11px', color: '#fbbf24',
          }}>
            ⚑ {playerId}: {timer} turn{timer !== 1 ? 's' : ''} in base
          </div>
        );
      })}
    </div>
  );
}
