/**
 * Tests for the game stats database module.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';
import { runBotGame } from '../../src/ai/run-game.js';
import type { BotGameResult } from '../../src/ai/run-game.js';
import {
  openDatabase,
  saveGameResult,
  saveGameResults,
  getMatchupStats,
  getFactionOverview,
  getGames,
  getGameCount,
} from '../../src/stats/database.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type Database from 'better-sqlite3';

beforeAll(() => {
  registerAllAbilities();
});

// Use temp file for each test
let dbPath: string;
let db: Database.Database;

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `test-games-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  db = openDatabase(dbPath);
});

afterEach(() => {
  db.close();
  try { fs.unlinkSync(dbPath); } catch { /* ok */ }
});

// Pre-run some games for reuse
let gameRomansVikings42: BotGameResult;
let gameRomansVikings100: BotGameResult;
let gameMongolsEnglish: BotGameResult;

beforeAll(() => {
  gameRomansVikings42 = runBotGame({ factionA: 'romans', factionB: 'vikings', seed: 42 });
  gameRomansVikings100 = runBotGame({ factionA: 'romans', factionB: 'vikings', seed: 100 });
  gameMongolsEnglish = runBotGame({ factionA: 'mongols', factionB: 'english', seed: 99 });
});

// ========== Save + Query Round-Trip ==========

describe('save and query', () => {
  it('saves a game result and retrieves it', () => {
    const id = saveGameResult(db, gameRomansVikings42);
    expect(id).toBeGreaterThan(0);

    const games = getGames(db);
    expect(games).toHaveLength(1);
    expect(games[0].seed).toBe(42);
    expect(games[0].faction_a).toBe('romans');
    expect(games[0].faction_b).toBe('vikings');
    expect(games[0].turns).toBe(gameRomansVikings42.turnCount);
    expect(games[0].actions).toBe(gameRomansVikings42.actionCount);
    expect(games[0].termination_reason).toBe('winner');
  });

  it('saves with recording JSON when requested', () => {
    saveGameResult(db, gameRomansVikings42, { includeRecording: true });

    const games = getGames(db);
    expect(games[0].recording_json).toBeTruthy();
    const parsed = JSON.parse(games[0].recording_json!);
    expect(parsed.config.seed).toBe(42);
    expect(parsed.actions.length).toBe(gameRomansVikings42.actionCount);
  });

  it('saves without recording by default', () => {
    saveGameResult(db, gameRomansVikings42);
    const games = getGames(db);
    expect(games[0].recording_json).toBeNull();
  });

  it('batch-saves multiple results', () => {
    saveGameResults(db, [gameRomansVikings42, gameRomansVikings100, gameMongolsEnglish]);
    expect(getGameCount(db)).toBe(3);
  });

  it('getGames respects limit', () => {
    saveGameResults(db, [gameRomansVikings42, gameRomansVikings100, gameMongolsEnglish]);
    const games = getGames(db, { limit: 2 });
    expect(games).toHaveLength(2);
  });

  it('getGames filters by faction', () => {
    saveGameResults(db, [gameRomansVikings42, gameMongolsEnglish]);
    const romanGames = getGames(db, { faction: 'romans' });
    expect(romanGames).toHaveLength(1);
    expect(romanGames[0].faction_a).toBe('romans');
  });
});

// ========== Matchup Stats ==========

describe('getMatchupStats', () => {
  it('returns correct stats for a matchup', () => {
    saveGameResults(db, [gameRomansVikings42, gameRomansVikings100]);

    const stats = getMatchupStats(db, 'romans', 'vikings');
    expect(stats.totalGames).toBe(2);
    expect(stats.factionAWins + stats.factionBWins + stats.draws).toBe(2);
    expect(stats.avgTurns).toBeGreaterThan(0);
  });

  it('returns zero stats for unplayed matchup', () => {
    const stats = getMatchupStats(db, 'aztecs', 'huns');
    expect(stats.totalGames).toBe(0);
    expect(stats.factionAWins).toBe(0);
    expect(stats.factionBWins).toBe(0);
  });

  it('handles reversed faction order', () => {
    saveGameResult(db, gameRomansVikings42);

    const statsAB = getMatchupStats(db, 'romans', 'vikings');
    const statsBA = getMatchupStats(db, 'vikings', 'romans');

    expect(statsAB.totalGames).toBe(statsBA.totalGames);
  });
});

// ========== Faction Overview ==========

describe('getFactionOverview', () => {
  it('returns overview for all factions that played', () => {
    saveGameResults(db, [gameRomansVikings42, gameRomansVikings100, gameMongolsEnglish]);

    const overview = getFactionOverview(db);
    expect(overview.length).toBe(4); // romans, vikings, mongols, english

    for (const f of overview) {
      expect(f.gamesPlayed).toBeGreaterThan(0);
      expect(f.winRate).toBeGreaterThanOrEqual(0);
      expect(f.winRate).toBeLessThanOrEqual(1);
      expect(f.avgTurns).toBeGreaterThan(0);
    }
  });

  it('returns empty array for empty database', () => {
    const overview = getFactionOverview(db);
    expect(overview).toHaveLength(0);
  });

  it('total wins do not exceed total games', () => {
    saveGameResults(db, [gameRomansVikings42, gameRomansVikings100, gameMongolsEnglish]);
    const overview = getFactionOverview(db);
    const totalWins = overview.reduce((s, f) => s + f.wins, 0);
    // Each game has at most 1 winner, so total wins ≤ total games
    expect(totalWins).toBeLessThanOrEqual(getGameCount(db));
  });
});

// ========== Schema ==========

describe('schema', () => {
  it('openDatabase is idempotent (can open same db twice)', () => {
    saveGameResult(db, gameRomansVikings42);
    db.close();

    // Re-open should not fail or duplicate schema
    const db2 = openDatabase(dbPath);
    expect(getGameCount(db2)).toBe(1);
    db2.close();

    // Reopen for afterEach cleanup
    db = openDatabase(dbPath);
  });
});
