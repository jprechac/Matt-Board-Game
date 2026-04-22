import React, { useMemo } from 'react';
import type { GameState, HexCell } from '../../engine/types.js';
import { hexKey } from '../../engine/hex.js';
import { HexGrid } from './HexGrid.js';
import { getPlayerColors } from '../styles/colors.js';
import type { DispatchResult } from '../hooks/useGameState.js';

interface PlacementScreenProps {
  gameState: GameState;
  dispatch: (action: any) => DispatchResult;
  lastError: string | null;
}

export function PlacementScreen({ gameState, dispatch, lastError }: PlacementScreenProps) {
  const setup = gameState.setupState!;
  const placer = gameState.currentPlayerId;
  const roster = (setup.unplacedRoster[placer] ?? []) as string[];
  const batchCount = setup.batchCount;
  const batchMax = 2;
  const colors = getPlayerColors(placer);

  // Count remaining by type
  const rosterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const typeId of roster) {
      counts[typeId] = (counts[typeId] ?? 0) + 1;
    }
    return counts;
  }, [roster]);

  // Highlight placement zone cells
  const highlights = useMemo(() => {
    const map = new Map<string, string>();
    const cells = Object.values(gameState.board.cells);
    const occupiedKeys = new Set(gameState.units.map(u => hexKey(u.position)));
    for (const cell of cells) {
      if (cell.placementZonePlayerId === placer && !occupiedKeys.has(hexKey(cell.coord))) {
        map.set(hexKey(cell.coord), 'rgba(59, 130, 246, 0.25)');
      }
    }
    return map;
  }, [gameState.board.cells, gameState.units, placer]);

  const handleCellClick = (cell: HexCell) => {
    if (roster.length === 0) return;
    dispatch({
      type: 'placeUnit',
      playerId: placer,
      unitTypeId: roster[0],
      position: cell.coord,
    });
  };

  return (
    <div style={{ padding: '16px', width: '100%', maxWidth: '1400px' }}>
      <header style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold' }}>Unit Placement</h1>
        <div style={{
          padding: '4px 12px', borderRadius: '4px',
          background: colors.unit, fontSize: '13px', fontWeight: 'bold',
        }}>
          {placer} — placing ({batchCount}/{batchMax} this batch)
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          {roster.length} units remaining
        </div>
      </header>

      {lastError && (
        <div style={{
          padding: '6px 12px', marginBottom: '8px', borderRadius: '4px',
          background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontSize: '12px',
        }}>
          {lastError}
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <HexGrid
            board={gameState.board}
            units={gameState.units}
            showCoords={false}
            highlights={highlights}
            onCellClick={handleCellClick}
          />
        </div>

        {/* Roster sidebar */}
        <aside style={{
          width: '200px', padding: '12px', background: '#1e293b',
          borderRadius: '8px', fontSize: '13px',
        }}>
          <h3 style={{ fontSize: '14px', marginBottom: '8px', color: colors.text }}>
            Unplaced Units
          </h3>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
            Next: <strong style={{ color: '#e2e8f0' }}>{roster[0] ?? 'none'}</strong>
          </div>
          {Object.entries(rosterCounts).map(([typeId, count]) => (
            <div key={typeId} style={{
              padding: '4px 8px', marginBottom: '4px',
              background: '#334155', borderRadius: '4px',
            }}>
              {typeId} ×{count}
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
