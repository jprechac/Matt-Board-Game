/**
 * Pure stat extraction functions for game recordings.
 *
 * All functions are side-effect-free and operate on GameRecording/GameResult data.
 */
import type { GameRecording } from './recorder.js';
import { getEventsByType } from './recorder.js';
import type { PlayerId, FactionId, WinCondition } from './types.js';
import type { ArmyComposition } from './types.js';
import type {
  AttackResolvedEvent,
  HealResolvedEvent,
  UnitKilledEvent,
  FactionSelectedEvent,
  ArmyCompositionSetEvent,
  GameWonEvent,
} from './events.js';

// ========== Types ==========

export interface GameResult {
  readonly winner: PlayerId | null;
  readonly winCondition: WinCondition | null;
  readonly turnCount: number;
  readonly actionCount: number;
  readonly seed: number;
  readonly players: readonly PlayerResult[];
}

export interface PlayerResult {
  readonly playerId: PlayerId;
  readonly factionId: FactionId | null;
  readonly armyComposition: ArmyComposition | null;
}

export interface UnitStatRecord {
  readonly unitId: string;
  readonly unitTypeId: string;
  readonly playerId: PlayerId;
  readonly factionId: FactionId | null;
  readonly damageDealt: number;
  readonly damageReceived: number;
  readonly kills: number;
  readonly healsPerformed: number;
  readonly healingDone: number;
  readonly healingReceived: number;
  readonly attacksMade: number;
  readonly attacksHit: number;
  readonly critsLanded: number;
  readonly timesAttacked: number;
  readonly survived: boolean;
}

export interface FactionStatsReport {
  readonly totalGames: number;
  readonly factionStats: readonly FactionStat[];
  readonly matchupStats: readonly MatchupStat[];
  readonly winConditionDistribution: Record<string, number>;
  readonly avgGameLength: number;
}

export interface FactionStat {
  readonly factionId: FactionId;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly winRate: number;
  readonly avgTurns: number;
}

export interface MatchupStat {
  readonly factionA: FactionId;
  readonly factionB: FactionId;
  readonly gamesPlayed: number;
  readonly factionAWins: number;
  readonly factionBWins: number;
  readonly draws: number;
  readonly factionAWinRate: number;
  readonly avgTurns: number;
}

// ========== Game Result Extraction ==========

/**
 * Extract a high-level game result from a recording.
 */
export function extractGameResult(recording: GameRecording): GameResult {
  const gameWonEvents = getEventsByType<GameWonEvent>(recording, 'gameWon');
  const winner = gameWonEvents.length > 0 ? gameWonEvents[0].winner : null;
  const winCondition = gameWonEvents.length > 0 ? gameWonEvents[0].winCondition : null;

  const factionEvents = getEventsByType<FactionSelectedEvent>(recording, 'factionSelected');
  const armyEvents = getEventsByType<ArmyCompositionSetEvent>(recording, 'armyCompositionSet');

  const factionMap = new Map<PlayerId, FactionId>();
  for (const e of factionEvents) {
    factionMap.set(e.playerId, e.factionId);
  }

  const armyMap = new Map<PlayerId, ArmyComposition>();
  for (const e of armyEvents) {
    armyMap.set(e.playerId, e.composition);
  }

  const playerIds = recording.config.playerIds;
  const players: PlayerResult[] = playerIds.map(pid => ({
    playerId: pid,
    factionId: factionMap.get(pid) ?? null,
    armyComposition: armyMap.get(pid) ?? null,
  }));

  // turnCount: use the last state's turnNumber via event counting
  // The recording's final action count = recording.actions.length
  // For turn count, find the highest turnNumber in events
  let maxTurn = 0;
  for (const event of recording.events) {
    if (event.turnNumber > maxTurn) maxTurn = event.turnNumber;
  }

  return {
    winner,
    winCondition,
    turnCount: maxTurn,
    actionCount: recording.actions.length,
    seed: recording.config.seed,
    players,
  };
}

// ========== Unit Stats Extraction ==========

/**
 * Extract per-unit combat statistics from a recording.
 * Builds stats by walking attack, heal, and kill events.
 */
export function extractUnitStats(recording: GameRecording): UnitStatRecord[] {
  const attacks = getEventsByType<AttackResolvedEvent>(recording, 'attackResolved');
  const heals = getEventsByType<HealResolvedEvent>(recording, 'healResolved');
  const kills = getEventsByType<UnitKilledEvent>(recording, 'unitKilled');
  const factionEvents = getEventsByType<FactionSelectedEvent>(recording, 'factionSelected');

  // Build faction lookup from events
  const playerFaction = new Map<PlayerId, FactionId>();
  for (const e of factionEvents) {
    playerFaction.set(e.playerId, e.factionId);
  }

  // Build unit info from UnitPlaced events (initialState has no units — they're placed during setup)
  const unitInfo = new Map<string, { typeId: string; playerId: PlayerId }>();

  // Also check initialState units as fallback
  for (const u of recording.initialState.units) {
    unitInfo.set(u.id, { typeId: u.typeId, playerId: u.playerId });
  }

  // UnitPlaced events are the primary source of unit info
  for (const e of recording.events) {
    if (e.type === 'unitPlaced') {
      unitInfo.set(e.unitId, { typeId: e.unitTypeId, playerId: e.playerId });
    }
  }

  // Track killed units
  const killedUnits = new Set<string>();
  for (const k of kills) {
    killedUnits.add(k.unitId);
  }

  // Accumulate stats
  interface MutableStats {
    damageDealt: number;
    damageReceived: number;
    kills: number;
    healsPerformed: number;
    healingDone: number;
    healingReceived: number;
    attacksMade: number;
    attacksHit: number;
    critsLanded: number;
    timesAttacked: number;
  }

  const statsMap = new Map<string, MutableStats>();

  function getStats(unitId: string): MutableStats {
    if (!statsMap.has(unitId)) {
      statsMap.set(unitId, {
        damageDealt: 0, damageReceived: 0, kills: 0,
        healsPerformed: 0, healingDone: 0, healingReceived: 0,
        attacksMade: 0, attacksHit: 0, critsLanded: 0, timesAttacked: 0,
      });
    }
    return statsMap.get(unitId)!;
  }

  for (const atk of attacks) {
    const attacker = getStats(atk.attackerId);
    const target = getStats(atk.targetId);

    attacker.attacksMade++;
    target.timesAttacked++;

    if (atk.hit) {
      attacker.attacksHit++;
      attacker.damageDealt += atk.damage;
      target.damageReceived += atk.damage;
    }
    if (atk.crit) {
      attacker.critsLanded++;
    }
    if (atk.targetKilled) {
      attacker.kills++;
    }
  }

  for (const heal of heals) {
    if (heal.healed) {
      const healer = getStats(heal.healerId);
      const target = getStats(heal.targetId);
      healer.healsPerformed++;
      healer.healingDone += heal.healAmount;
      target.healingReceived += heal.healAmount;
    }
  }

  // Build final records for all units that have info
  const results: UnitStatRecord[] = [];
  for (const [unitId, info] of unitInfo) {
    const s = statsMap.get(unitId) ?? {
      damageDealt: 0, damageReceived: 0, kills: 0,
      healsPerformed: 0, healingDone: 0, healingReceived: 0,
      attacksMade: 0, attacksHit: 0, critsLanded: 0, timesAttacked: 0,
    };
    results.push({
      unitId,
      unitTypeId: info.typeId,
      playerId: info.playerId,
      factionId: playerFaction.get(info.playerId) ?? null,
      damageDealt: s.damageDealt,
      damageReceived: s.damageReceived,
      kills: s.kills,
      healsPerformed: s.healsPerformed,
      healingDone: s.healingDone,
      healingReceived: s.healingReceived,
      attacksMade: s.attacksMade,
      attacksHit: s.attacksHit,
      critsLanded: s.critsLanded,
      timesAttacked: s.timesAttacked,
      survived: !killedUnits.has(unitId),
    });
  }

  return results;
}

// ========== Faction Stats Aggregation ==========

/**
 * Aggregate faction-level statistics from a collection of game results.
 */
export function extractFactionStats(results: readonly GameResult[]): FactionStatsReport {
  if (results.length === 0) {
    return {
      totalGames: 0,
      factionStats: [],
      matchupStats: [],
      winConditionDistribution: {},
      avgGameLength: 0,
    };
  }

  // Per-faction tracking
  const factionGames = new Map<FactionId, number>();
  const factionWins = new Map<FactionId, number>();
  const factionTotalTurns = new Map<FactionId, number>();

  // Per-matchup tracking (key: "factionA:factionB" alphabetically sorted)
  interface MatchupAccum {
    factionA: FactionId;
    factionB: FactionId;
    games: number;
    aWins: number;
    bWins: number;
    draws: number;
    totalTurns: number;
  }
  const matchups = new Map<string, MatchupAccum>();

  function matchupKey(a: FactionId, b: FactionId): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  // Win condition distribution
  const wcDist: Record<string, number> = {};

  let totalTurns = 0;

  for (const r of results) {
    totalTurns += r.turnCount;

    if (r.winCondition) {
      wcDist[r.winCondition] = (wcDist[r.winCondition] ?? 0) + 1;
    }

    // Get factions for this game
    const factions = r.players
      .filter(p => p.factionId !== null)
      .map(p => ({ playerId: p.playerId, factionId: p.factionId! }));

    // Track per-faction
    for (const { playerId, factionId } of factions) {
      factionGames.set(factionId, (factionGames.get(factionId) ?? 0) + 1);
      factionTotalTurns.set(factionId, (factionTotalTurns.get(factionId) ?? 0) + r.turnCount);
      if (r.winner === playerId) {
        factionWins.set(factionId, (factionWins.get(factionId) ?? 0) + 1);
      }
    }

    // Track matchup (only for 2-player games with known factions)
    if (factions.length === 2) {
      const [p1, p2] = factions;
      const key = matchupKey(p1.factionId, p2.factionId);
      const [sortedA, sortedB] = p1.factionId < p2.factionId
        ? [p1, p2] : [p2, p1];

      if (!matchups.has(key)) {
        matchups.set(key, {
          factionA: sortedA.factionId,
          factionB: sortedB.factionId,
          games: 0, aWins: 0, bWins: 0, draws: 0, totalTurns: 0,
        });
      }
      const m = matchups.get(key)!;
      m.games++;
      m.totalTurns += r.turnCount;

      if (r.winner === sortedA.playerId) {
        m.aWins++;
      } else if (r.winner === sortedB.playerId) {
        m.bWins++;
      } else {
        m.draws++;
      }
    }
  }

  // Build faction stats
  const factionStats: FactionStat[] = [];
  for (const [factionId, games] of factionGames) {
    const wins = factionWins.get(factionId) ?? 0;
    const totalFactionTurns = factionTotalTurns.get(factionId) ?? 0;
    factionStats.push({
      factionId,
      gamesPlayed: games,
      wins,
      winRate: games > 0 ? wins / games : 0,
      avgTurns: games > 0 ? totalFactionTurns / games : 0,
    });
  }
  factionStats.sort((a, b) => b.winRate - a.winRate);

  // Build matchup stats
  const matchupStats: MatchupStat[] = [];
  for (const m of matchups.values()) {
    matchupStats.push({
      factionA: m.factionA,
      factionB: m.factionB,
      gamesPlayed: m.games,
      factionAWins: m.aWins,
      factionBWins: m.bWins,
      draws: m.draws,
      factionAWinRate: m.games > 0 ? m.aWins / m.games : 0,
      avgTurns: m.games > 0 ? m.totalTurns / m.games : 0,
    });
  }
  matchupStats.sort((a, b) => a.factionA.localeCompare(b.factionA) || a.factionB.localeCompare(b.factionB));

  return {
    totalGames: results.length,
    factionStats,
    matchupStats,
    winConditionDistribution: wcDist,
    avgGameLength: totalTurns / results.length,
  };
}
