import React, { useState, useCallback } from 'react';
import { createBoard } from '../engine/board.js';
import type { Board, BoardSize, HexCell } from '../engine/types.js';
import { HexGrid } from './components/HexGrid.js';
import { hexKey } from '../engine/hex.js';

export function App() {
  const [boardSize, setBoardSize] = useState<BoardSize>('2p');
  const [showCoords, setShowCoords] = useState(false);
  const [selectedCell, setSelectedCell] = useState<HexCell | null>(null);
  const [board] = useState<Board>(() => createBoard(boardSize));

  const handleCellClick = useCallback((cell: HexCell) => {
    setSelectedCell(prev =>
      prev && hexKey(prev.coord) === hexKey(cell.coord) ? null : cell,
    );
  }, []);

  const handleBoardSizeChange = useCallback((size: BoardSize) => {
    setBoardSize(size);
    setSelectedCell(null);
    // Board will be recreated on next render cycle
  }, []);

  const currentBoard = React.useMemo(() => createBoard(boardSize), [boardSize]);

  return (
    <div style={{ padding: '16px', width: '100%', maxWidth: '1400px' }}>
      <header style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Matt Board Game</h1>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', color: '#94a3b8' }}>Board:</label>
          <button
            onClick={() => handleBoardSizeChange('2p')}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: 'none',
              background: boardSize === '2p' ? '#3b82f6' : '#334155',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            2 Player
          </button>
          <button
            onClick={() => handleBoardSizeChange('4p')}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: 'none',
              background: boardSize === '4p' ? '#3b82f6' : '#334155',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            4 Player
          </button>
        </div>

        <label style={{ fontSize: '14px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="checkbox"
            checked={showCoords}
            onChange={e => setShowCoords(e.target.checked)}
          />
          Coordinates
        </label>
      </header>

      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <HexGrid
            board={currentBoard}
            showCoords={showCoords}
            onCellClick={handleCellClick}
          />
        </div>

        {selectedCell && (
          <aside style={{
            width: '220px',
            padding: '12px',
            background: '#1e293b',
            borderRadius: '8px',
            fontSize: '13px',
          }}>
            <h3 style={{ marginBottom: '8px', fontSize: '14px' }}>Selected Hex</h3>
            <div>q: {selectedCell.coord.q}, r: {selectedCell.coord.r}, s: {selectedCell.coord.s}</div>
            {selectedCell.basePlayerId && (
              <div style={{ color: '#f59e0b', marginTop: '4px' }}>
                Base: {selectedCell.basePlayerId}
              </div>
            )}
            {selectedCell.placementZonePlayerId && (
              <div style={{ color: '#38bdf8', marginTop: '4px' }}>
                Placement: {selectedCell.placementZonePlayerId}
              </div>
            )}
            {selectedCell.terrainPlacementZonePlayerId && (
              <div style={{ color: '#a3a3a3', marginTop: '4px' }}>
                Terrain Zone: {selectedCell.terrainPlacementZonePlayerId}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
        {Object.keys(currentBoard.cells).length} hexes •{' '}
        {currentBoard.width}×{currentBoard.height} board
      </footer>
    </div>
  );
}
