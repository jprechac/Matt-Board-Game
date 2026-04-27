/**
 * Stats Export CLI — query and export game statistics.
 *
 * Usage:
 *   npm run stats-export -- --summary
 *   npm run stats-export -- --format csv --out games.csv
 *   npm run stats-export -- --format json --out games.json
 *   npm run stats-export -- --matchup romans vikings
 */
import { openDatabase, getFactionOverview, getMatchupStats, getGames, getGameCount } from '../stats/database.js';
import type { FactionOverviewRow } from '../stats/database.js';
import { ALL_FACTION_IDS } from '../engine/types.js';
import type { FactionId } from '../engine/types.js';
import { parseArgs } from './utils/format.js';
import * as fs from 'fs';
import * as path from 'path';

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: npm run stats-export -- [options]');
    console.log('');
    console.log('Options:');
    console.log('  --db <path>        Database path (default: data/games.db)');
    console.log('  --summary          Print faction overview and matchup matrix');
    console.log('  --matchup <a> <b>  Show stats for a specific matchup');
    console.log('  --format csv|json  Export all games in the given format');
    console.log('  --out <path>       Output file path (default: stdout)');
    console.log('  --limit <n>        Limit number of exported games');
    console.log('  --help             Show this help');
    process.exit(0);
  }

  const dbPath = args.db ?? 'data/games.db';

  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    console.error('Run some bot matches first with: npm run bot-match');
    process.exit(1);
  }

  const db = openDatabase(dbPath);
  const totalGames = getGameCount(db);

  if (args.summary === 'true') {
    printSummary(db, totalGames);
  } else if (args.matchup) {
    // Parse matchup factions from remaining positional args
    const remaining = process.argv.slice(2).filter(a => !a.startsWith('--'));
    const factionA = args.matchup as string;
    const factionB = remaining.find(a => a !== factionA && ALL_FACTION_IDS.includes(a as FactionId));

    if (!factionB) {
      console.error('Usage: --matchup <factionA> <factionB>');
      process.exit(1);
    }

    printMatchup(db, factionA as FactionId, factionB as FactionId);
  } else if (args.format) {
    const format = args.format as 'csv' | 'json';
    const limit = args.limit ? parseInt(args.limit, 10) : undefined;
    exportGames(db, format, args.out, limit);
  } else {
    // Default: print summary
    printSummary(db, totalGames);
  }

  db.close();
}

function printSummary(db: ReturnType<typeof openDatabase>, totalGames: number) {
  console.log(`\n📊 Game Statistics (${totalGames} games)\n${'═'.repeat(50)}\n`);

  if (totalGames === 0) {
    console.log('No games recorded yet. Run some bot matches first!');
    return;
  }

  // Faction overview
  const factions = getFactionOverview(db);
  console.log('Faction Overview:');
  console.log('  Faction       | Games | Wins | Win Rate | Avg Turns');
  console.log('  --------------|-------|------|----------|----------');
  for (const f of factions) {
    const name = f.faction.padEnd(13);
    const games = String(f.gamesPlayed).padStart(5);
    const wins = String(f.wins).padStart(4);
    const rate = `${(f.winRate * 100).toFixed(1)}%`.padStart(7);
    const turns = f.avgTurns.toFixed(1).padStart(9);
    console.log(`  ${name} | ${games} | ${wins} | ${rate} | ${turns}`);
  }

  // Matchup matrix (if enough factions)
  const playedFactions = factions.map(f => f.faction as FactionId);
  if (playedFactions.length >= 2) {
    console.log(`\nMatchup Win Rates (row vs column):\n`);

    // Header
    const colWidth = 6;
    const header = ''.padEnd(12) + playedFactions.map(f => f.slice(0, colWidth).padStart(colWidth)).join(' ');
    console.log(header);

    for (const a of playedFactions) {
      let row = a.padEnd(12);
      for (const b of playedFactions) {
        if (a === b) {
          row += '   -- ';
        } else {
          const stats = getMatchupStats(db, a, b);
          if (stats.totalGames === 0) {
            row += '    - ';
          } else {
            const rate = (stats.factionAWins / stats.totalGames * 100).toFixed(0);
            row += `${rate}%`.padStart(colWidth) + ' ';
          }
        }
      }
      console.log(row);
    }
  }

  console.log('');
}

function printMatchup(db: ReturnType<typeof openDatabase>, factionA: FactionId, factionB: FactionId) {
  const stats = getMatchupStats(db, factionA, factionB);

  console.log(`\n⚔️  ${factionA} vs ${factionB} (${stats.totalGames} games)\n`);
  if (stats.totalGames === 0) {
    console.log('No games recorded for this matchup.');
    return;
  }

  console.log(`  ${factionA} wins: ${stats.factionAWins} (${(stats.factionAWins / stats.totalGames * 100).toFixed(1)}%)`);
  console.log(`  ${factionB} wins: ${stats.factionBWins} (${(stats.factionBWins / stats.totalGames * 100).toFixed(1)}%)`);
  console.log(`  Draws/Incomplete: ${stats.draws}`);
  console.log(`  Avg turns: ${stats.avgTurns.toFixed(1)}`);
  console.log('');
}

function exportGames(
  db: ReturnType<typeof openDatabase>,
  format: 'csv' | 'json',
  outPath?: string,
  limit?: number,
) {
  const games = getGames(db, { limit });

  if (games.length === 0) {
    console.log('No games to export.');
    return;
  }

  // Strip recording_json from exports (too large)
  const exportRows = games.map(({ recording_json, ...rest }) => rest);

  let output: string;
  if (format === 'json') {
    output = JSON.stringify(exportRows, null, 2);
  } else {
    const headers = Object.keys(exportRows[0]);
    const rows = exportRows.map(row =>
      headers.map(h => {
        const val = (row as Record<string, unknown>)[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','),
    );
    output = [headers.join(','), ...rows].join('\n');
  }

  if (outPath) {
    // Ensure directory exists
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, output, 'utf-8');
    console.log(`Exported ${exportRows.length} games to ${outPath}`);
  } else {
    console.log(output);
  }
}

main();
