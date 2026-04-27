/**
 * Tests for game stat extraction functions.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';
import { runBotGame } from '../../src/ai/run-game.js';
import {
  extractGameResult,
  extractUnitStats,
  extractFactionStats,
} from '../../src/engine/stats.js';
import type { GameResult } from '../../src/engine/stats.js';

beforeAll(() => {
  registerAllAbilities();
});

// Helper: run a game and return the recording
function getRecording(factionA: string, factionB: string, seed: number) {
  const result = runBotGame({
    factionA: factionA as any,
    factionB: factionB as any,
    seed,
  });
  return result;
}

// ========== extractGameResult ==========

describe('extractGameResult', () => {
  it('extracts winner and win condition from a completed game', () => {
    const game = getRecording('romans', 'vikings', 42);
    const result = extractGameResult(game.recording);

    expect(result.winner).toBeTruthy();
    expect(result.winner).toBe(game.winner);
    expect(result.winCondition).toBe(game.winCondition);
  });

  it('extracts correct turn and action counts', () => {
    const game = getRecording('mongols', 'english', 99);
    const result = extractGameResult(game.recording);

    expect(result.actionCount).toBe(game.actionCount);
    expect(result.turnCount).toBeGreaterThan(0);
    expect(result.seed).toBe(99);
  });

  it('extracts player factions and army compositions', () => {
    const game = getRecording('aztecs', 'ottomans', 7);
    const result = extractGameResult(game.recording);

    expect(result.players).toHaveLength(2);
    const p1 = result.players.find(p => p.playerId === 'player1')!;
    const p2 = result.players.find(p => p.playerId === 'player2')!;
    expect(p1.factionId).toBe('aztecs');
    expect(p2.factionId).toBe('ottomans');
    // Army compositions should be set
    expect(p1.armyComposition).toBeTruthy();
    expect(p2.armyComposition).toBeTruthy();
  });

  it('handles max-action-cap game (no winner)', () => {
    const game = runBotGame({
      factionA: 'romans',
      factionB: 'vikings',
      seed: 42,
      maxActions: 30,
    });
    const result = extractGameResult(game.recording);

    // May or may not have a winner depending on how quickly the game ends
    expect(result.actionCount).toBeLessThanOrEqual(30);
    expect(result.seed).toBe(42);
    expect(result.players).toHaveLength(2);
  });
});

// ========== extractUnitStats ==========

describe('extractUnitStats', () => {
  it('returns stats for all units', () => {
    const game = getRecording('romans', 'vikings', 42);
    const stats = extractUnitStats(game.recording);

    // Both sides should have units (9 per side in default comp)
    expect(stats.length).toBeGreaterThanOrEqual(18);

    // Each stat record should have valid fields
    for (const s of stats) {
      expect(s.unitId).toBeTruthy();
      expect(s.unitTypeId).toBeTruthy();
      expect(s.playerId).toBeTruthy();
      expect(s.damageDealt).toBeGreaterThanOrEqual(0);
      expect(s.damageReceived).toBeGreaterThanOrEqual(0);
      expect(s.kills).toBeGreaterThanOrEqual(0);
      expect(typeof s.survived).toBe('boolean');
    }
  });

  it('total damage dealt equals total damage received', () => {
    const game = getRecording('vandals', 'huns', 55);
    const stats = extractUnitStats(game.recording);

    const totalDealt = stats.reduce((sum, s) => sum + s.damageDealt, 0);
    const totalReceived = stats.reduce((sum, s) => sum + s.damageReceived, 0);

    expect(totalDealt).toBe(totalReceived);
    expect(totalDealt).toBeGreaterThan(0); // some combat happened
  });

  it('total kills equals number of non-surviving units', () => {
    const game = getRecording('muscovites', 'japanese', 333);
    const stats = extractUnitStats(game.recording);

    const totalKills = stats.reduce((sum, s) => sum + s.kills, 0);
    const deadUnits = stats.filter(s => !s.survived).length;

    expect(totalKills).toBe(deadUnits);
  });

  it('attack accuracy is consistent (hits ≤ attacks made)', () => {
    const game = getRecording('bulgars', 'english', 77);
    const stats = extractUnitStats(game.recording);

    for (const s of stats) {
      expect(s.attacksHit).toBeLessThanOrEqual(s.attacksMade);
      expect(s.critsLanded).toBeLessThanOrEqual(s.attacksHit);
    }
  });

  it('assigns correct factions to units', () => {
    const game = getRecording('romans', 'mongols', 200);
    const stats = extractUnitStats(game.recording);

    const p1Units = stats.filter(s => s.playerId === 'player1');
    const p2Units = stats.filter(s => s.playerId === 'player2');

    expect(p1Units.length).toBeGreaterThan(0);
    expect(p2Units.length).toBeGreaterThan(0);

    for (const u of p1Units) expect(u.factionId).toBe('romans');
    for (const u of p2Units) expect(u.factionId).toBe('mongols');
  });
});

// ========== extractFactionStats ==========

describe('extractFactionStats', () => {
  // Run a few games upfront to build a result set
  let gameResults: GameResult[];

  beforeAll(() => {
    const games = [
      getRecording('romans', 'vikings', 42),
      getRecording('romans', 'vikings', 100),
      getRecording('mongols', 'english', 99),
      getRecording('aztecs', 'vikings', 7),
      getRecording('romans', 'mongols', 200),
    ];
    gameResults = games.map(g => extractGameResult(g.recording));
  });

  it('reports correct total game count', () => {
    const report = extractFactionStats(gameResults);
    expect(report.totalGames).toBe(5);
  });

  it('computes faction stats with consistent win rates', () => {
    const report = extractFactionStats(gameResults);

    for (const fs of report.factionStats) {
      expect(fs.gamesPlayed).toBeGreaterThan(0);
      expect(fs.wins).toBeGreaterThanOrEqual(0);
      expect(fs.wins).toBeLessThanOrEqual(fs.gamesPlayed);
      expect(fs.winRate).toBeGreaterThanOrEqual(0);
      expect(fs.winRate).toBeLessThanOrEqual(1);
      expect(fs.avgTurns).toBeGreaterThan(0);
    }

    // Total wins across all factions should equal total games with winners
    const totalWins = report.factionStats.reduce((s, f) => s + f.wins, 0);
    const gamesWithWinners = gameResults.filter(r => r.winner).length;
    expect(totalWins).toBe(gamesWithWinners);
  });

  it('computes matchup stats correctly', () => {
    const report = extractFactionStats(gameResults);

    for (const m of report.matchupStats) {
      expect(m.gamesPlayed).toBeGreaterThan(0);
      expect(m.factionAWins + m.factionBWins + m.draws).toBe(m.gamesPlayed);
      expect(m.factionAWinRate).toBeGreaterThanOrEqual(0);
      expect(m.factionAWinRate).toBeLessThanOrEqual(1);
    }

    // Romans vs Vikings should have 2 games
    const rvMatchup = report.matchupStats.find(
      m => (m.factionA === 'romans' && m.factionB === 'vikings') ||
           (m.factionA === 'vikings' && m.factionB === 'romans'),
    );
    expect(rvMatchup).toBeDefined();
    expect(rvMatchup!.gamesPlayed).toBe(2);
  });

  it('tracks win condition distribution', () => {
    const report = extractFactionStats(gameResults);

    const totalWC = Object.values(report.winConditionDistribution).reduce((s, v) => s + v, 0);
    const gamesWithWinners = gameResults.filter(r => r.winner).length;
    expect(totalWC).toBe(gamesWithWinners);
  });

  it('computes average game length', () => {
    const report = extractFactionStats(gameResults);
    expect(report.avgGameLength).toBeGreaterThan(0);
    expect(Number.isFinite(report.avgGameLength)).toBe(true);
  });

  it('handles empty results array', () => {
    const report = extractFactionStats([]);
    expect(report.totalGames).toBe(0);
    expect(report.factionStats).toHaveLength(0);
    expect(report.matchupStats).toHaveLength(0);
    expect(report.avgGameLength).toBe(0);
  });

  it('factionStats sorted by win rate descending', () => {
    const report = extractFactionStats(gameResults);
    for (let i = 1; i < report.factionStats.length; i++) {
      expect(report.factionStats[i - 1].winRate).toBeGreaterThanOrEqual(
        report.factionStats[i].winRate,
      );
    }
  });
});
