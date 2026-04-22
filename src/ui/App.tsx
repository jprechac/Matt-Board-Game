import React, { useCallback, useState } from 'react';
import type { HexCell, Unit } from '../engine/types.js';
import type { GameConfig } from '../engine/game.js';
import { hexKey } from '../engine/hex.js';
import { HexGrid } from './components/HexGrid.js';
import { UnitInfoPanel } from './components/UnitInfoPanel.js';
import { TurnIndicator } from './components/TurnIndicator.js';
import { EventLog } from './components/EventLog.js';
import { SetupScreen } from './components/SetupScreen.js';
import { PlacementScreen } from './components/PlacementScreen.js';
import { useGameState } from './hooks/useGameState.js';
import { CombatOverlay } from './components/CombatOverlay.js';
import { createDevGameplayState } from './devSandbox.js';

type AppMode = 'newGame' | 'devSandbox';

const DEFAULT_CONFIG: GameConfig = { boardSize: '2p', playerIds: ['player1', 'player2'], seed: Date.now() };

export function App() {
  const [mode, setMode] = useState<AppMode | null>(null);
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);

  if (!mode) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '32px' }}>Matt Board Game</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button onClick={() => setMode('newGame')} style={menuBtn('#2563eb')}>
            New Game
            <span style={{ display: 'block', fontSize: '12px', color: '#93c5fd', marginTop: '4px' }}>
              Full setup → placement → gameplay
            </span>
          </button>
          <button onClick={() => setMode('devSandbox')} style={menuBtn('#475569')}>
            Dev Sandbox
            <span style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Skip to gameplay (Romans vs Vikings)
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'devSandbox') {
    return <GameApp initialState={createDevGameplayState(42)} onExit={() => setMode(null)} />;
  }

  return <GameApp config={config} onExit={() => setMode(null)} />;
}

// ========== GameApp ==========

interface GameAppProps {
  config?: GameConfig;
  initialState?: import('../engine/types.js').GameState;
  onExit: () => void;
}

function GameApp({ config, initialState, onExit }: GameAppProps) {
  const game = useGameState(initialState ?? config!);
  const [showCoords, setShowCoords] = useState(false);

  const phase = game.gameState.phase;

  // Setup phase
  if (phase === 'setup') {
    return <SetupScreen gameState={game.gameState} dispatch={game.dispatch} lastError={game.lastError} />;
  }

  // Placement phase
  if (phase === 'placement') {
    return <PlacementScreen gameState={game.gameState} dispatch={game.dispatch} lastError={game.lastError} />;
  }

  // Victory phase
  if (game.gameState.winner) {
    return <VictoryOverlay gameState={game.gameState} recording={game.recording} onExit={onExit} />;
  }

  // Gameplay phase
  return <GameplayScreen game={game} showCoords={showCoords} setShowCoords={setShowCoords} onExit={onExit} />;
}

// ========== Gameplay Screen ==========

function GameplayScreen({
  game,
  showCoords,
  setShowCoords,
  onExit,
}: {
  game: ReturnType<typeof useGameState>;
  showCoords: boolean;
  setShowCoords: (v: boolean) => void;
  onExit: () => void;
}) {
  const handleCellClick = useCallback((cell: HexCell) => {
    if (game.gameState.phase !== 'gameplay') return;
    const key = hexKey(cell.coord);

    if (game.selectedUnitId) {
      const isValidMove = game.unitActions.moves.some(m => hexKey(m) === key);
      if (isValidMove) {
        game.dispatch({ type: 'move', unitId: game.selectedUnitId, to: cell.coord });
        return;
      }
      const target = game.unitActions.attackTargets.find(t => hexKey(t.position) === key);
      if (target) {
        game.dispatch({ type: 'attack', unitId: game.selectedUnitId, targetId: target.id });
        return;
      }
    }
    game.deselectUnit();
  }, [game]);

  const handleUnitClick = useCallback((unit: Unit) => {
    if (game.gameState.phase !== 'gameplay') return;

    if (game.selectedUnitId && game.selectedUnitId !== unit.id) {
      const isTarget = game.unitActions.attackTargets.some(t => t.id === unit.id);
      if (isTarget) {
        game.dispatch({ type: 'attack', unitId: game.selectedUnitId, targetId: unit.id });
        return;
      }
    }

    if (unit.playerId === game.gameState.currentPlayerId) {
      if (game.selectedUnitId === unit.id) {
        game.deselectUnit();
      } else {
        game.selectUnit(unit.id);
      }
    }
  }, [game]);

  return (
    <div style={{ padding: '16px', width: '100%', maxWidth: '1400px' }}>
      <header style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', cursor: 'pointer' }} onClick={onExit}>
          ← Matt Board Game
        </h1>
        <TurnIndicator gameState={game.gameState} />

        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={showCoords} onChange={e => setShowCoords(e.target.checked)} />
          Coords
        </label>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {game.canUndo && (
            <button onClick={() => game.undo()} style={headerBtn}>Undo</button>
          )}
          <button
            onClick={() => {
              if (game.selectedUnitId) game.dispatch({ type: 'endUnitTurn', unitId: game.selectedUnitId });
            }}
            disabled={!game.selectedUnitId}
            style={{ ...headerBtn, opacity: game.selectedUnitId ? 1 : 0.4 }}
          >
            End Unit Turn
          </button>
          <button onClick={() => game.dispatch({ type: 'endTurn' })} style={headerBtn}>
            End Turn
          </button>
        </div>
      </header>

      {game.lastError && (
        <div style={{
          padding: '6px 12px', marginBottom: '8px', borderRadius: '4px',
          background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontSize: '12px',
        }}>
          {game.lastError}
        </div>
      )}

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

      <CombatOverlay events={game.lastEvents} />

      <div style={{ display: 'flex', gap: '12px' }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {game.selectedUnit && (
            <UnitInfoPanel
              unit={game.selectedUnit}
              actions={game.unitActions}
              onEndUnitTurn={() => game.dispatch({ type: 'endUnitTurn', unitId: game.selectedUnitId! })}
            />
          )}
          <EventLog events={game.recording.events} />
        </div>
      </div>

      <footer style={{ marginTop: '12px', fontSize: '11px', color: '#64748b' }}>
        {game.gameState.units.filter(u => u.currentHp > 0).length} units alive •{' '}
        {Object.keys(game.gameState.board.cells).length} hexes
      </footer>
    </div>
  );
}

// ========== Victory ==========

function VictoryOverlay({ gameState, recording, onExit }: {
  gameState: import('../engine/types.js').GameState;
  recording: import('../engine/recorder.js').GameRecording;
  onExit: () => void;
}) {
  const aliveByPlayer: Record<string, number> = {};
  for (const u of gameState.units) {
    if (u.currentHp > 0) {
      aliveByPlayer[u.playerId] = (aliveByPlayer[u.playerId] ?? 0) + 1;
    }
  }
  const totalActions = recording.actions.length;
  const killCount = recording.events.filter(e => e.type === 'unitKilled').length;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '80vh',
    }}>
      <div style={{
        padding: '48px 64px', borderRadius: '16px', background: '#1e293b',
        textAlign: 'center', border: '2px solid #fbbf24', minWidth: '350px',
      }}>
        <h2 style={{ fontSize: '32px', marginBottom: '12px' }}>🏆 {gameState.winner} wins!</h2>
        <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '16px' }}>
          Victory by {gameState.winCondition}
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
          marginBottom: '24px', fontSize: '13px', textAlign: 'left',
          padding: '12px', background: '#0f172a', borderRadius: '8px',
        }}>
          <span style={{ color: '#94a3b8' }}>Turns played:</span>
          <span>{gameState.turnNumber}</span>
          <span style={{ color: '#94a3b8' }}>Total actions:</span>
          <span>{totalActions}</span>
          <span style={{ color: '#94a3b8' }}>Units killed:</span>
          <span>{killCount}</span>
          {Object.entries(aliveByPlayer).map(([pid, count]) => (
            <React.Fragment key={pid}>
              <span style={{ color: '#94a3b8' }}>{pid} alive:</span>
              <span>{count}</span>
            </React.Fragment>
          ))}
        </div>

        <button onClick={onExit} style={menuBtn('#2563eb')}>
          Play Again
        </button>
      </div>
    </div>
  );
}

// ========== Styles ==========

function menuBtn(bg: string): React.CSSProperties {
  return {
    padding: '16px 24px', borderRadius: '8px', border: 'none',
    background: bg, color: '#fff', cursor: 'pointer',
    fontSize: '16px', fontWeight: 'bold', width: '100%',
  };
}

const headerBtn: React.CSSProperties = {
  padding: '4px 12px', borderRadius: '4px', border: '1px solid #475569',
  background: '#334155', color: '#fff', cursor: 'pointer', fontSize: '12px',
};

