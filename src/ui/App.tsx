import React, { useCallback, useMemo, useState } from 'react';
import type { HexCell, Unit } from '../engine/types.js';
import { hexKey } from '../engine/hex.js';
import { HexGrid } from './components/HexGrid.js';
import { UnitInfoPanel } from './components/UnitInfoPanel.js';
import { useGameState } from './hooks/useGameState.js';
import { createDevGameplayState } from './devSandbox.js';

const initialState = createDevGameplayState(42);

export function App() {
  const [showCoords, setShowCoords] = useState(false);
  const game = useGameState(initialState);

  const handleCellClick = useCallback((cell: HexCell) => {
    if (game.gameState.phase !== 'gameplay') return;

    const key = hexKey(cell.coord);

    // If a unit is selected and this is a valid move target, move there
    if (game.selectedUnitId) {
      const isValidMove = game.unitActions.moves.some(m => hexKey(m) === key);
      if (isValidMove) {
        game.dispatch({ type: 'move', unitId: game.selectedUnitId, to: cell.coord });
        return;
      }

      // If clicking a valid attack target hex (but clicked the cell, not the unit token)
      const target = game.unitActions.attackTargets.find(t => hexKey(t.position) === key);
      if (target) {
        game.dispatch({ type: 'attack', unitId: game.selectedUnitId, targetId: target.id });
        return;
      }
    }

    // Clicking empty non-highlighted hex deselects
    game.deselectUnit();
  }, [game]);

  const handleUnitClick = useCallback((unit: Unit) => {
    if (game.gameState.phase !== 'gameplay') return;

    // If we have a selected unit and this is an attack target, attack
    if (game.selectedUnitId && game.selectedUnitId !== unit.id) {
      const isTarget = game.unitActions.attackTargets.some(t => t.id === unit.id);
      if (isTarget) {
        game.dispatch({ type: 'attack', unitId: game.selectedUnitId, targetId: unit.id });
        return;
      }
    }

    // Select/deselect own unit
    if (unit.playerId === game.gameState.currentPlayerId) {
      if (game.selectedUnitId === unit.id) {
        game.deselectUnit();
      } else {
        game.selectUnit(unit.id);
      }
    }
  }, [game]);

  const handleEndUnitTurn = useCallback(() => {
    if (game.selectedUnitId) {
      game.dispatch({ type: 'endUnitTurn', unitId: game.selectedUnitId });
    }
  }, [game]);

  const handleEndTurn = useCallback(() => {
    game.dispatch({ type: 'endTurn' });
  }, [game]);

  const currentPlayer = game.gameState.currentPlayerId;
  const turnNum = game.gameState.turnNumber;

  return (
    <div style={{ padding: '16px', width: '100%', maxWidth: '1400px' }}>
      {/* Header bar */}
      <header style={{
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold' }}>Matt Board Game</h1>

        <div style={{
          padding: '4px 12px',
          borderRadius: '4px',
          background: currentPlayer === 'player1' ? '#2563eb' : '#dc2626',
          fontSize: '13px',
          fontWeight: 'bold',
        }}>
          Turn {turnNum} — {currentPlayer}
        </div>

        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          Phase: {game.gameState.phase}
        </div>

        <label style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="checkbox"
            checked={showCoords}
            onChange={e => setShowCoords(e.target.checked)}
          />
          Coords
        </label>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {game.canUndo && (
            <button
              onClick={() => game.undo()}
              style={{
                padding: '4px 12px', borderRadius: '4px', border: '1px solid #475569',
                background: '#334155', color: '#fff', cursor: 'pointer', fontSize: '12px',
              }}
            >
              Undo
            </button>
          )}
          <button
            onClick={handleEndTurn}
            style={{
              padding: '4px 12px', borderRadius: '4px', border: 'none',
              background: '#475569', color: '#fff', cursor: 'pointer', fontSize: '12px',
            }}
          >
            End Turn
          </button>
        </div>
      </header>

      {/* Error display */}
      {game.lastError && (
        <div style={{
          padding: '6px 12px', marginBottom: '8px', borderRadius: '4px',
          background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontSize: '12px',
        }}>
          {game.lastError}
        </div>
      )}

      {/* Last events */}
      {game.lastEvents.length > 0 && (
        <div style={{
          padding: '6px 12px', marginBottom: '8px', borderRadius: '4px',
          background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', fontSize: '11px',
        }}>
          {game.lastEvents.map((e, i) => (
            <span key={i}>{i > 0 ? ' → ' : ''}{e.type}</span>
          ))}
        </div>
      )}

      {/* Main content */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <HexGrid
            board={game.gameState.board}
            units={game.gameState.units}
            selectedUnitId={game.selectedUnitId}
            showCoords={showCoords}
            highlights={game.moveHighlights}
            onCellClick={handleCellClick}
            onUnitClick={handleUnitClick}
          />
        </div>

        {game.selectedUnit && (
          <UnitInfoPanel
            unit={game.selectedUnit}
            actions={game.unitActions}
            onEndUnitTurn={handleEndUnitTurn}
          />
        )}
      </div>

      {/* Victory overlay */}
      {game.gameState.winner && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', zIndex: 10,
        }}>
          <div style={{
            padding: '32px 48px', borderRadius: '12px', background: '#1e293b',
            textAlign: 'center', border: '2px solid #fbbf24',
          }}>
            <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>🏆 {game.gameState.winner} wins!</h2>
            <p style={{ color: '#94a3b8' }}>by {game.gameState.winCondition}</p>
          </div>
        </div>
      )}

      <footer style={{ marginTop: '12px', fontSize: '11px', color: '#64748b' }}>
        {game.gameState.units.filter(u => u.currentHp > 0).length} units alive •{' '}
        {Object.keys(game.gameState.board.cells).length} hexes
      </footer>
    </div>
  );
}

