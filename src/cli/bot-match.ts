/**
 * Bot vs Bot CLI — run AI matches from the command line.
 *
 * Usage:
 *   npm run bot-match -- --faction1 romans --faction2 vikings --seed 42
 *   npm run bot-match -- --faction1 mongols --faction2 english --quiet
 *   npm run bot-match -- --faction1 romans --faction2 vikings --verbose
 */
import type { FactionId, PlayerId, GameState, Action } from '../engine/types.js';
import { ALL_FACTION_IDS } from '../engine/types.js';
import { runBotGame } from '../ai/run-game.js';
import type { BotGameConfig } from '../ai/run-game.js';
import { parseArgs, formatAction } from './utils/format.js';

// ========== Main ==========

function validateFaction(name: string): FactionId {
  if (ALL_FACTION_IDS.includes(name as FactionId)) return name as FactionId;
  console.error(`Unknown faction: ${name}`);
  console.error(`Available factions: ${ALL_FACTION_IDS.join(', ')}`);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: npm run bot-match -- --faction1 <f> --faction2 <f> [--seed <n>] [--quiet] [--verbose]');
    console.log(`Available factions: ${ALL_FACTION_IDS.join(', ')}`);
    process.exit(0);
  }

  const faction1 = validateFaction(args.faction1 ?? 'romans');
  const faction2 = validateFaction(args.faction2 ?? 'vikings');
  const seed = parseInt(args.seed ?? String(Date.now()), 10);
  const quiet = args.quiet === 'true';
  const verbose = args.verbose === 'true';

  if (!quiet) {
    console.log(`\n⚔️  Bot Match: ${faction1} vs ${faction2} (seed: ${seed})`);
    console.log('─'.repeat(50));
  }

  // Verbose state for tracking turn transitions
  let verboseLastTurn = -1;
  let lastPhase = '';
  // Quiet mode: track player turns for summary lines
  let turnActionCount = 0;
  let lastPlayer: PlayerId | null = null;
  let roundNumber = 1;
  const factionOf: Record<string, FactionId> = { player1: faction1, player2: faction2 };

  const config: BotGameConfig = {
    factionA: faction1,
    factionB: faction2,
    seed,
    onAction: verbose || !quiet ? (action: Action, prevState: GameState, nextState: GameState, fallback: boolean) => {
      if (verbose) {
        // Phase transitions
        if (prevState.phase !== lastPhase) {
          console.log(`\n── ${prevState.phase.toUpperCase()} ──`);
          lastPhase = prevState.phase;
        }
        // Turn headers in gameplay
        if (prevState.phase === 'gameplay' && prevState.turnNumber !== verboseLastTurn) {
          console.log(`\n── Round ${prevState.turnNumber} (${prevState.currentPlayerId}) ──`);
          verboseLastTurn = prevState.turnNumber;
        }
        const fb = fallback ? ' [FALLBACK]' : '';
        console.log(`  ${formatAction(action, prevState)}${fb}`);
      } else if (!quiet && prevState.phase === 'gameplay') {
        // Default mode: report when current player changes
        if (lastPlayer !== null && nextState.currentPlayerId !== lastPlayer && nextState.phase === 'gameplay') {
          const faction = factionOf[lastPlayer];
          console.log(`  Turn ${roundNumber} | ${faction} (${lastPlayer}) | ${turnActionCount} actions`);
          if (lastPlayer === 'player2') roundNumber++;
          turnActionCount = 0;
        }
        lastPlayer = prevState.currentPlayerId as PlayerId;
        turnActionCount++;
      }
    } : undefined,
  };

  const result = runBotGame(config);

  // Print final player's turn in default mode
  if (!quiet && !verbose && lastPlayer && turnActionCount > 0) {
    const faction = factionOf[lastPlayer];
    console.log(`  Turn ${roundNumber} | ${faction} (${lastPlayer}) | ${turnActionCount} actions`);
  }

  // Summary
  console.log('─'.repeat(50));
  if (result.winner) {
    console.log(`🏆 Winner: ${result.winner} (${factionOf[result.winner]})`);
    console.log(`   Condition: ${result.winCondition ?? 'unknown'}`);
  } else {
    console.log(`⏰ Game did not finish (${result.terminationReason})`);
  }
  console.log(`   Turns: ${result.turnCount}`);
  console.log(`   Actions: ${result.actionCount}`);
  console.log(`   Fallbacks: ${result.fallbackCount}`);
  console.log(`   Seed: ${result.seed}`);

  const alive = result.finalState.units.filter(u => u.currentHp > 0);
  console.log(`   ${faction1} (player1): ${alive.filter(u => u.playerId === 'player1').length} units alive`);
  console.log(`   ${faction2} (player2): ${alive.filter(u => u.playerId === 'player2').length} units alive`);
}

main();
