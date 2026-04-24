import React, { useCallback, useState } from 'react';
import type { HexCell, Unit, FactionId } from '../engine/types.js';
import { ALL_FACTION_IDS } from '../engine/types.js';
import type { GameConfig } from '../engine/game.js';
import { getFaction } from '../engine/data/factions/index.js';
import { hexKey } from '../engine/hex.js';
import { HexGrid } from './components/HexGrid.js';
import { UnitInfoPanel } from './components/UnitInfoPanel.js';
import { TurnIndicator } from './components/TurnIndicator.js';
import { EventLog } from './components/EventLog.js';
import { SetupScreen } from './components/SetupScreen.js';
import { PlacementScreen } from './components/PlacementScreen.js';
import { useGameState } from './hooks/useGameState.js';
import { useAIPlayer } from './hooks/useAIPlayer.js';
import type { AIPlayerConfig } from './hooks/useAIPlayer.js';
import { CombatOverlay } from './components/CombatOverlay.js';
import { createDevGameplayState } from './devSandbox.js';
import { formatWinCondition, formatFactionName } from './utils/formatters.js';

type AppMode = 'newGame' | 'vsAI' | 'devSandbox';

const DEFAULT_CONFIG: GameConfig = { boardSize: '2p', playerIds: ['player1', 'player2'], seed: Date.now() };

export function App() {
  const [mode, setMode] = useState<AppMode | null>(null);
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);

  const [aiConfig, setAIConfig] = useState<AIPlayerConfig | null>(null);

  if (!mode) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '32px' }}>Matt Board Game</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button onClick={() => setMode('newGame')} style={menuBtn('#2563eb')}>
            New Game (Hot Seat)
            <span style={{ display: 'block', fontSize: '12px', color: '#93c5fd', marginTop: '4px' }}>
              Two players on the same screen
            </span>
          </button>
          <button onClick={() => setMode('vsAI')} style={menuBtn('#16a34a')}>
            Play vs AI
            <span style={{ display: 'block', fontSize: '12px', color: '#86efac', marginTop: '4px' }}>
              Play against a computer opponent
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
    return <GameApp initialState={createDevGameplayState(42)} onExit={() => { setMode(null); setAIConfig(null); }} />;
  }

  if (mode === 'vsAI' && !aiConfig) {
    return <AISetupScreen onStart={(cfg) => { setAIConfig(cfg); }} onBack={() => setMode(null)} />;
  }

  return <GameApp config={config} aiConfig={aiConfig} onExit={() => { setMode(null); setAIConfig(null); }} />;
}

// ========== GameApp ==========

interface GameAppProps {
  config?: GameConfig;
  initialState?: import('../engine/types.js').GameState;
  aiConfig?: AIPlayerConfig | null;
  onExit: () => void;
}

function GameApp({ config, initialState, aiConfig, onExit }: GameAppProps) {
  const game = useGameState(initialState ?? config!);
  const [showCoords, setShowCoords] = useState(false);
  const ai = useAIPlayer(game.gameState, game.dispatch, aiConfig ?? null);

  const phase = game.gameState.phase;
  const isAITurn = ai.isThinking;

  // Setup phase
  if (phase === 'setup') {
    return <SetupScreen gameState={game.gameState} dispatch={game.dispatch} lastError={game.lastError} aiPlayerId={aiConfig?.playerId ?? null} />;
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
  return <GameplayScreen game={game} showCoords={showCoords} setShowCoords={setShowCoords} onExit={onExit} isAITurn={isAITurn} />;
}

// ========== Gameplay Screen ==========

function GameplayScreen({
  game,
  showCoords,
  setShowCoords,
  onExit,
  isAITurn,
}: {
  game: ReturnType<typeof useGameState>;
  showCoords: boolean;
  setShowCoords: (v: boolean) => void;
  onExit: () => void;
  isAITurn: boolean;
}) {
  const handleCellClick = useCallback((cell: HexCell) => {
    if (isAITurn) return;
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
      const healTarget = game.unitActions.healTargets.find(t => hexKey(t.position) === key);
      if (healTarget) {
        game.dispatch({ type: 'heal', unitId: game.selectedUnitId, targetId: healTarget.id });
        return;
      }
    }
    game.deselectUnit();
  }, [game]);

  const handleUnitClick = useCallback((unit: Unit) => {
    if (isAITurn) return;
    if (game.gameState.phase !== 'gameplay') return;

    if (game.selectedUnitId && game.selectedUnitId !== unit.id) {
      // Check if it's an attack target
      const isTarget = game.unitActions.attackTargets.some(t => t.id === unit.id);
      if (isTarget) {
        game.dispatch({ type: 'attack', unitId: game.selectedUnitId, targetId: unit.id });
        return;
      }
      // Check if it's a heal target
      const isHealTarget = game.unitActions.healTargets.some(t => t.id === unit.id);
      if (isHealTarget) {
        game.dispatch({ type: 'heal', unitId: game.selectedUnitId, targetId: unit.id });
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
        {isAITurn && (
          <span style={{ fontSize: '13px', color: '#fbbf24', fontWeight: 'bold', animation: 'pulse 1.5s ease-in-out infinite' }}>
            🤖 AI is thinking…
          </span>
        )}

        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={showCoords} onChange={e => setShowCoords(e.target.checked)} />
          Coords
        </label>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {game.canUndo && !isAITurn && (
            <button onClick={() => game.undo()} style={headerBtn}>Undo</button>
          )}
          <button
            onClick={() => {
              if (!isAITurn && game.selectedUnitId) game.dispatch({ type: 'endUnitTurn', unitId: game.selectedUnitId });
            }}
            disabled={isAITurn || !game.selectedUnitId}
            style={{ ...headerBtn, opacity: (!isAITurn && game.selectedUnitId) ? 1 : 0.4 }}
          >
            End Unit Turn
          </button>
          <button
            onClick={() => { if (!isAITurn) game.dispatch({ type: 'endTurn' }); }}
            disabled={isAITurn}
            style={{ ...headerBtn, opacity: isAITurn ? 0.4 : 1 }}
          >
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
          Victory by {formatWinCondition(gameState.winCondition!)}
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

// ========== AI Setup Screen ==========

function AISetupScreen({ onStart, onBack }: {
  onStart: (config: AIPlayerConfig) => void;
  onBack: () => void;
}) {
  const [selectedFaction, setSelectedFaction] = useState<FactionId>('romans');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
        Play vs AI
      </h1>
      <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '24px', fontSize: '14px' }}>
        You are Player 1. The AI plays as Player 2.
      </p>

      {/* Difficulty */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>AI Difficulty</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['easy', 'medium', 'hard'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              style={{
                flex: 1, padding: '10px', borderRadius: '6px',
                border: difficulty === d ? '2px solid #3b82f6' : '1px solid #475569',
                background: difficulty === d ? '#1e3a5f' : '#334155',
                color: '#e2e8f0', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
                textTransform: 'capitalize',
              }}
            >
              {d}
              {d === 'easy' && <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Generic strategy</span>}
              {d === 'medium' && <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Faction tactics</span>}
              {d === 'hard' && <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Coming soon</span>}
            </button>
          ))}
        </div>
      </div>

      {/* AI Faction */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>AI Faction</div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '6px',
        }}>
          {ALL_FACTION_IDS.map(fid => {
            const faction = getFaction(fid);
            const selected = selectedFaction === fid;
            return (
              <button
                key={fid}
                onClick={() => setSelectedFaction(fid)}
                style={{
                  padding: '8px 6px', borderRadius: '6px',
                  border: selected ? '2px solid #3b82f6' : '1px solid #475569',
                  background: selected ? '#1e3a5f' : '#334155',
                  color: '#e2e8f0', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                  textAlign: 'center',
                }}
              >
                {faction.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={onBack} style={{ ...menuBtn('#475569'), flex: 1 }}>← Back</button>
        <button
          onClick={() => onStart({
            playerId: 'player2',
            factionId: selectedFaction,
            difficulty,
          })}
          style={{ ...menuBtn('#16a34a'), flex: 2 }}
        >
          Start Game
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

