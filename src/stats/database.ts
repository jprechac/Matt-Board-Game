/**
 * SQLite database for game results storage and querying.
 *
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 * This module is Node-only (excluded from browser tsconfig).
 */
import Database from 'better-sqlite3';
import type { BotGameResult } from '../ai/run-game.js';
import type { GameRecording } from '../engine/recorder.js';
import type { FactionId, WinCondition } from '../engine/types.js';

// ========== Types ==========

export interface GameRow {
  id: number;
  seed: number;
  faction_a: string;
  faction_b: string;
  winner_faction: string | null;
  winner_player: string | null;
  win_condition: string | null;
  termination_reason: string;
  turns: number;
  actions: number;
  fallbacks: number;
  runtime_ms: number;
  engine_version: string;
  created_at: string;
  recording_json: string | null;
}

export interface MatchupQueryResult {
  factionAWins: number;
  factionBWins: number;
  draws: number;
  totalGames: number;
  avgTurns: number;
}

export interface FactionOverviewRow {
  faction: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  avgTurns: number;
}

export interface SaveOptions {
  includeRecording?: boolean;
}

// ========== Constants ==========

const SCHEMA_VERSION = 1;
const ENGINE_VERSION = '0.1.0';

// ========== Database Setup ==========

/**
 * Open (or create) a game stats database at the given path.
 * Applies schema migrations if needed.
 */
export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applyMigrations(db);
  return db;
}

function applyMigrations(db: Database.Database): void {
  // Create schema_version table if missing
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );
  `);

  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seed INTEGER NOT NULL,
        faction_a TEXT NOT NULL,
        faction_b TEXT NOT NULL,
        winner_faction TEXT,
        winner_player TEXT,
        win_condition TEXT,
        termination_reason TEXT NOT NULL,
        turns INTEGER NOT NULL,
        actions INTEGER NOT NULL,
        fallbacks INTEGER NOT NULL DEFAULT 0,
        runtime_ms REAL NOT NULL DEFAULT 0,
        engine_version TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        recording_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_games_factions ON games(faction_a, faction_b);
      CREATE INDEX IF NOT EXISTS idx_games_seed ON games(seed);
    `);

    if (currentVersion === 0) {
      db.exec(`INSERT INTO schema_version (version) VALUES (${SCHEMA_VERSION});`);
    } else {
      db.exec(`UPDATE schema_version SET version = ${SCHEMA_VERSION};`);
    }
  }
}

// ========== Write Operations ==========

/**
 * Save a bot game result to the database.
 * Optionally includes the full recording JSON for replay.
 */
export function saveGameResult(
  db: Database.Database,
  result: BotGameResult,
  options?: SaveOptions,
): number {
  const winnerFaction = result.winner
    ? (result.winner === 'player1' ? result.factionA : result.factionB)
    : null;

  const recordingJson = options?.includeRecording
    ? JSON.stringify(result.recording)
    : null;

  const stmt = db.prepare(`
    INSERT INTO games (seed, faction_a, faction_b, winner_faction, winner_player,
      win_condition, termination_reason, turns, actions, fallbacks, runtime_ms,
      engine_version, recording_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    result.seed,
    result.factionA,
    result.factionB,
    winnerFaction,
    result.winner,
    result.winCondition,
    result.terminationReason,
    result.turnCount,
    result.actionCount,
    result.fallbackCount,
    result.runtimeMs,
    ENGINE_VERSION,
    recordingJson,
  );

  return Number(info.lastInsertRowid);
}

/**
 * Batch-save multiple results in a single transaction.
 */
export function saveGameResults(
  db: Database.Database,
  results: readonly BotGameResult[],
  options?: SaveOptions,
): void {
  const txn = db.transaction(() => {
    for (const result of results) {
      saveGameResult(db, result, options);
    }
  });
  txn();
}

// ========== Read Operations ==========

/**
 * Get matchup statistics between two factions.
 * Checks both orderings (A vs B and B vs A).
 */
export function getMatchupStats(
  db: Database.Database,
  factionA: FactionId,
  factionB: FactionId,
): MatchupQueryResult {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN winner_faction = ? THEN 1 ELSE 0 END), 0) as a_wins,
      COALESCE(SUM(CASE WHEN winner_faction = ? THEN 1 ELSE 0 END), 0) as b_wins,
      COALESCE(SUM(CASE WHEN winner_faction IS NULL THEN 1 ELSE 0 END), 0) as draws,
      COUNT(*) as total,
      COALESCE(AVG(turns), 0) as avg_turns
    FROM games
    WHERE (faction_a = ? AND faction_b = ?) OR (faction_a = ? AND faction_b = ?)
  `).get(factionA, factionB, factionA, factionB, factionB, factionA) as {
    a_wins: number; b_wins: number; draws: number; total: number; avg_turns: number;
  };

  return {
    factionAWins: row.a_wins,
    factionBWins: row.b_wins,
    draws: row.draws,
    totalGames: row.total,
    avgTurns: row.avg_turns,
  };
}

/**
 * Get an overview of all factions' performance.
 */
export function getFactionOverview(db: Database.Database): FactionOverviewRow[] {
  // Get all factions that appear in games
  const rows = db.prepare(`
    WITH all_factions AS (
      SELECT faction_a AS faction FROM games
      UNION
      SELECT faction_b AS faction FROM games
    ),
    faction_games AS (
      SELECT f.faction,
        COUNT(*) as games_played,
        COALESCE(SUM(CASE WHEN g.winner_faction = f.faction THEN 1 ELSE 0 END), 0) as wins,
        COALESCE(AVG(g.turns), 0) as avg_turns
      FROM all_factions f
      JOIN games g ON g.faction_a = f.faction OR g.faction_b = f.faction
      GROUP BY f.faction
    )
    SELECT faction, games_played, wins,
      CASE WHEN games_played > 0 THEN CAST(wins AS REAL) / games_played ELSE 0 END as win_rate,
      avg_turns
    FROM faction_games
    ORDER BY win_rate DESC
  `).all() as Array<{ faction: string; games_played: number; wins: number; win_rate: number; avg_turns: number }>;

  return rows.map(r => ({
    faction: r.faction,
    gamesPlayed: r.games_played,
    wins: r.wins,
    winRate: r.win_rate,
    avgTurns: r.avg_turns,
  }));
}

/**
 * Get all game rows, optionally filtered.
 */
export function getGames(
  db: Database.Database,
  options?: { limit?: number; faction?: string },
): GameRow[] {
  let sql = 'SELECT * FROM games';
  const params: unknown[] = [];

  if (options?.faction) {
    sql += ' WHERE faction_a = ? OR faction_b = ?';
    params.push(options.faction, options.faction);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.prepare(sql).all(...params) as GameRow[];
}

/**
 * Get total count of games in the database.
 */
export function getGameCount(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number };
  return row.count;
}
