import React from 'react';
import type { Unit } from '../../engine/types.js';
import type { UnitActions } from '../../engine/actions.js';
import { getUnitDef } from '../../engine/data/factions/index.js';
import { getPlayerColors } from '../styles/colors.js';

export interface UnitInfoPanelProps {
  unit: Unit;
  actions: UnitActions;
  onEndUnitTurn?: () => void;
}

export function UnitInfoPanel({ unit, actions, onEndUnitTurn }: UnitInfoPanelProps) {
  const colors = getPlayerColors(unit.playerId);
  const def = getUnitDef(unit.factionId, unit.typeId);

  return (
    <aside style={{
      width: '240px',
      padding: '12px',
      background: '#1e293b',
      borderRadius: '8px',
      fontSize: '13px',
      borderLeft: `3px solid ${colors.unit}`,
    }}>
      <h3 style={{ fontSize: '15px', marginBottom: '8px', color: colors.text }}>
        {def?.name ?? unit.typeId}
      </h3>

      <div style={{ marginBottom: '8px', color: '#94a3b8', fontSize: '11px' }}>
        {unit.factionId} • {unit.category}
      </div>

      {/* HP */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>HP</span>
          <span>{unit.currentHp}/{unit.maxHp}</span>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '3px', height: '6px' }}>
          <div style={{
            width: `${(unit.currentHp / unit.maxHp) * 100}%`,
            height: '100%',
            borderRadius: '3px',
            background: unit.currentHp / unit.maxHp > 0.5 ? '#22c55e' : '#f59e0b',
          }} />
        </div>
      </div>

      {/* Attack stats */}
      {def && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>Attack</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
            <span>Hit: {def.attack.toHit}+</span>
            <span>Dmg: {def.attack.damage}</span>
            <span>Range: {def.attack.range}</span>
            {def.attack.critThreshold && <span>Crit: {def.attack.critThreshold}+</span>}
          </div>
        </div>
      )}

      {/* Movement */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>Movement</div>
        <span>{unit.movement - unit.movementUsedThisTurn}/{unit.movement}</span>
        {unit.hasMovedThisTurn && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>moved</span>}
      </div>

      {/* Status */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>Status</div>
        {unit.activatedThisTurn && <span style={{ color: '#666' }}>Exhausted</span>}
        {!unit.activatedThisTurn && unit.hasAttackedThisTurn && <span style={{ color: '#ef4444' }}>Attacked</span>}
        {!unit.activatedThisTurn && !unit.hasAttackedThisTurn && !unit.hasMovedThisTurn && (
          <span style={{ color: '#22c55e' }}>Ready</span>
        )}
        {!unit.activatedThisTurn && unit.hasMovedThisTurn && !unit.hasAttackedThisTurn && (
          <span style={{ color: '#3b82f6' }}>Active</span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {actions.moves.length > 0 && (
          <div style={{ color: '#3b82f6', fontSize: '11px' }}>
            {actions.moves.length} valid move{actions.moves.length !== 1 ? 's' : ''}
          </div>
        )}
        {actions.attackTargets.length > 0 && (
          <div style={{ color: '#ef4444', fontSize: '11px' }}>
            {actions.attackTargets.length} target{actions.attackTargets.length !== 1 ? 's' : ''}
          </div>
        )}
        {actions.canEndUnitTurn && onEndUnitTurn && (
          <button
            onClick={onEndUnitTurn}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #475569',
              background: '#334155',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              marginTop: '4px',
            }}
          >
            End Unit Turn
          </button>
        )}
      </div>
    </aside>
  );
}
