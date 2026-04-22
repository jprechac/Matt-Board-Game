import React, { useState } from 'react';
import type { GameState, FactionId } from '../../engine/types.js';
import { ALL_FACTION_IDS, DEFAULT_ARMY_LIMITS } from '../../engine/types.js';
import { getFaction } from '../../engine/data/factions/index.js';
import type { DispatchResult } from '../hooks/useGameState.js';
import { getPlayerColors } from '../styles/colors.js';

interface SetupScreenProps {
  gameState: GameState;
  dispatch: (action: any) => DispatchResult;
  lastError: string | null;
}

export function SetupScreen({ gameState, dispatch, lastError }: SetupScreenProps) {
  const setup = gameState.setupState!;
  const step = setup.currentStep;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center' }}>
        Game Setup
      </h1>

      {lastError && (
        <div style={{
          padding: '8px 12px', marginBottom: '16px', borderRadius: '4px',
          background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontSize: '13px',
        }}>
          {lastError}
        </div>
      )}

      {step === 'choosePriority' && <ChoosePriorityStep gameState={gameState} dispatch={dispatch} />}
      {step === 'factionSelection' && <FactionSelectionStep gameState={gameState} dispatch={dispatch} />}
      {step === 'armyComposition' && <ArmyCompositionStep gameState={gameState} dispatch={dispatch} />}
    </div>
  );
}

// ========== Choose Priority ==========

function ChoosePriorityStep({ gameState, dispatch }: { gameState: GameState; dispatch: any }) {
  const setup = gameState.setupState!;
  const winner = setup.rollWinner!;
  const colors = getPlayerColors(winner);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '18px', marginBottom: '8px', color: '#94a3b8' }}>Roll-off Result</div>
      <div style={{ fontSize: '22px', marginBottom: '24px', color: colors.text }}>
        🎲 <strong>{winner}</strong> won the roll!
      </div>
      <div style={{ fontSize: '15px', marginBottom: '16px', color: '#e2e8f0' }}>
        Choose your advantage:
      </div>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        <button
          onClick={() => dispatch({ type: 'choosePriority', playerId: winner, choice: 'pickFactionFirst' })}
          style={bigButtonStyle('#2563eb')}
        >
          Pick Faction First
          <span style={{ display: 'block', fontSize: '11px', color: '#93c5fd', marginTop: '4px' }}>
            Choose your faction before your opponent
          </span>
        </button>
        <button
          onClick={() => dispatch({ type: 'choosePriority', playerId: winner, choice: 'moveFirst' })}
          style={bigButtonStyle('#16a34a')}
        >
          Move First
          <span style={{ display: 'block', fontSize: '11px', color: '#86efac', marginTop: '4px' }}>
            Take the first turn in gameplay
          </span>
        </button>
      </div>
    </div>
  );
}

// ========== Faction Selection ==========

function FactionSelectionStep({ gameState, dispatch }: { gameState: GameState; dispatch: any }) {
  const setup = gameState.setupState!;
  const currentPlayer = setup.factionSelectionOrder[setup.currentPlayerIndex];
  const takenFactions = new Set(gameState.players.filter(p => p.factionId).map(p => p.factionId));
  const colors = getPlayerColors(currentPlayer);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <span style={{ color: colors.text, fontSize: '18px', fontWeight: 'bold' }}>
          {currentPlayer}
        </span>
        <span style={{ color: '#94a3b8', fontSize: '16px' }}> — Choose your faction</span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '8px',
      }}>
        {ALL_FACTION_IDS.map(fid => {
          const faction = getFaction(fid);
          const taken = takenFactions.has(fid);
          return (
            <button
              key={fid}
              disabled={taken}
              onClick={() => dispatch({ type: 'selectFaction', playerId: currentPlayer, factionId: fid })}
              style={{
                padding: '12px 8px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: taken ? '#334155' : '#475569',
                background: taken ? '#1e293b' : '#334155',
                color: taken ? '#475569' : '#e2e8f0',
                cursor: taken ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
                textAlign: 'center',
              }}
            >
              {faction.name}
              {taken && <span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>Taken</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== Army Composition ==========

function ArmyCompositionStep({ gameState, dispatch }: { gameState: GameState; dispatch: any }) {
  const setup = gameState.setupState!;
  // Find a player who hasn't submitted yet
  const pendingPlayer = gameState.players.find(p => p.factionId && !p.armyComposition);
  const [handedOff, setHandedOff] = useState(false);

  if (!pendingPlayer) return <div style={{ textAlign: 'center', color: '#94a3b8' }}>Waiting...</div>;

  // Privacy handoff screen
  if (!handedOff) {
    const colors = getPlayerColors(pendingPlayer.id);
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '16px' }}>
          Hand the device to:
        </div>
        <div style={{ fontSize: '24px', color: colors.text, fontWeight: 'bold', marginBottom: '24px' }}>
          {pendingPlayer.id}
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
          Faction: <strong style={{ color: '#e2e8f0' }}>{getFaction(pendingPlayer.factionId!).name}</strong>
        </div>
        <button
          onClick={() => setHandedOff(true)}
          style={bigButtonStyle('#2563eb')}
        >
          I'm ready — show my army builder
        </button>
      </div>
    );
  }

  return (
    <ArmyBuilder
      player={pendingPlayer}
      onSubmit={(comp) => {
        dispatch({
          type: 'setArmyComposition',
          playerId: pendingPlayer.id,
          composition: comp,
        });
        setHandedOff(false);
      }}
    />
  );
}

// ========== Army Builder ==========

interface ArmyBuilderProps {
  player: { id: string; factionId?: import('../../engine/types.js').FactionId };
  onSubmit: (comp: { basicMelee: number; basicRanged: number; specialtyChoices: string[] }) => void;
}

function ArmyBuilder({ player, onSubmit }: ArmyBuilderProps) {
  const faction = getFaction(player.factionId!);
  const [basicMelee, setBasicMelee] = useState(2);
  const [specialtyChoices, setSpecialtyChoices] = useState<string[]>([]);
  const basicRanged = DEFAULT_ARMY_LIMITS.basic - basicMelee;
  const specialtyNeeded = DEFAULT_ARMY_LIMITS.specialty;
  const colors = getPlayerColors(player.id);

  const toggleSpecialty = (typeId: string) => {
    setSpecialtyChoices(prev => {
      const count = prev.filter(s => s === typeId).length;
      if (count > 0) {
        // Remove one instance
        const idx = prev.indexOf(typeId);
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      }
      if (prev.length < specialtyNeeded) {
        return [...prev, typeId];
      }
      return prev;
    });
  };

  const addSpecialty = (typeId: string) => {
    if (specialtyChoices.length < specialtyNeeded) {
      setSpecialtyChoices(prev => [...prev, typeId]);
    }
  };

  const removeSpecialty = (index: number) => {
    setSpecialtyChoices(prev => [...prev.slice(0, index), ...prev.slice(index + 1)]);
  };

  const isValid = basicMelee >= 0 && basicRanged >= 0 && specialtyChoices.length === specialtyNeeded;

  return (
    <div>
      <h3 style={{ fontSize: '18px', color: colors.text, marginBottom: '16px', textAlign: 'center' }}>
        {player.id} — Army Composition
      </h3>

      {/* Basic units */}
      <div style={{ marginBottom: '16px', padding: '12px', background: '#1e293b', borderRadius: '6px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
          Basic Units ({DEFAULT_ARMY_LIMITS.basic} total)
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Melee:
            <button onClick={() => setBasicMelee(Math.max(0, basicMelee - 1))} style={smallBtn}>&minus;</button>
            <span style={{ minWidth: '20px', textAlign: 'center' }}>{basicMelee}</span>
            <button onClick={() => setBasicMelee(Math.min(DEFAULT_ARMY_LIMITS.basic, basicMelee + 1))} style={smallBtn}>+</button>
          </label>
          <span style={{ color: '#94a3b8' }}>Ranged: {basicRanged}</span>
        </div>
      </div>

      {/* Specialty units */}
      <div style={{ marginBottom: '16px', padding: '12px', background: '#1e293b', borderRadius: '6px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
          Specialty Units ({specialtyChoices.length}/{specialtyNeeded})
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {faction.specialtyTypeIds.map(typeId => {
            const def = faction.units.find(u => u.typeId === typeId);
            return (
              <button
                key={typeId}
                onClick={() => addSpecialty(typeId)}
                disabled={specialtyChoices.length >= specialtyNeeded}
                style={{
                  padding: '6px 12px', borderRadius: '4px',
                  border: '1px solid #475569',
                  background: '#334155', color: '#e2e8f0',
                  cursor: specialtyChoices.length >= specialtyNeeded ? 'not-allowed' : 'pointer',
                  fontSize: '12px', opacity: specialtyChoices.length >= specialtyNeeded ? 0.5 : 1,
                }}
              >
                + {def?.name ?? typeId}
              </button>
            );
          })}
        </div>

        {specialtyChoices.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {specialtyChoices.map((typeId, i) => {
              const def = faction.units.find(u => u.typeId === typeId);
              return (
                <span key={i} style={{
                  padding: '3px 8px', borderRadius: '3px',
                  background: colors.unit, color: '#fff', fontSize: '11px',
                  cursor: 'pointer',
                }} onClick={() => removeSpecialty(i)}>
                  {def?.name ?? typeId} ✕
                </span>
              );
            })}
          </div>
        )}
      </div>

      <button
        disabled={!isValid}
        onClick={() => onSubmit({ basicMelee, basicRanged, specialtyChoices })}
        style={{
          ...bigButtonStyle(isValid ? '#16a34a' : '#334155'),
          width: '100%',
          opacity: isValid ? 1 : 0.5,
          cursor: isValid ? 'pointer' : 'not-allowed',
        }}
      >
        Confirm Army
      </button>
    </div>
  );
}

// ========== Styles ==========

function bigButtonStyle(bg: string): React.CSSProperties {
  return {
    padding: '16px 24px',
    borderRadius: '8px',
    border: 'none',
    background: bg,
    color: '#fff',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 'bold',
  };
}

const smallBtn: React.CSSProperties = {
  width: '28px', height: '28px', borderRadius: '4px',
  border: '1px solid #475569', background: '#334155',
  color: '#fff', cursor: 'pointer', fontSize: '16px',
};
