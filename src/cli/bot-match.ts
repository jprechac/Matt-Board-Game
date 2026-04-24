/**
 * Bot vs Bot CLI — run AI matches from the command line.
 *
 * Usage:
 *   npm run bot-match -- --faction1 romans --faction2 vikings --seed 42
 *   npm run bot-match -- --faction1 mongols --faction2 english --quiet
 *   npm run bot-match -- --faction1 romans --faction2 vikings --verbose
 *   npm run bot-match -- --faction1 romans --faction2 vikings --faction3 mongols --faction4 english --seed 7
 */
import { createGame, applyAction } from '../engine/game.js';
import type { GameConfig } from '../engine/game.js';
import type { FactionId, PlayerId, BoardSize } from '../engine/types.js';
import { ALL_FACTION_IDS } from '../engine/types.js';
import { registerAllAbilities } from '../engine/abilities/index.js';
import { createBotForDifficulty } from '../ai/difficulty.js';
import { stepBot } from '../ai/bot-runner.js';
import { parseArgs, formatAction, advanceRound } from './utils/format.js';
import type { RoundTracker } from './utils/format.js';

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
    console.log('Usage: npm run bot-match -- --faction1 <f> --faction2 <f> [--faction3 <f> --faction4 <f>] [--seed <n>] [--quiet] [--verbose]');
    console.log(`Available factions: ${ALL_FACTION_IDS.join(', ')}`);
    process.exit(0);
  }

  // Build player/faction list (2 or 4 players)
  const factions: { playerId: PlayerId; factionId: FactionId }[] = [
    { playerId: 'player1', factionId: validateFaction(args.faction1 ?? 'romans') },
    { playerId: 'player2', factionId: validateFaction(args.faction2 ?? 'vikings') },
  ];
  if (args.faction3 || args.faction4) {
    if (!args.faction3 || !args.faction4) {
      console.error('For a 4-player game, both --faction3 and --faction4 are required.');
      process.exit(1);
    }
    console.error('4-player bot matches are not yet supported. This will be added in a future phase.');
    process.exit(1);
  }

  const playerCount = factions.length;
  const boardSize: BoardSize = playerCount === 4 ? '4p' : '2p';
  const seed = parseInt(args.seed ?? String(Date.now()), 10);
  const quiet = args.quiet === 'true';
  const verbose = args.verbose === 'true';

  registerAllAbilities();

  const playerIds = factions.map(f => f.playerId) as [PlayerId, ...PlayerId[]];
  const config: GameConfig = { boardSize, playerIds, seed };
  let state = createGame(config);

  const bots = Object.fromEntries(
    factions.map(f => [f.playerId, createBotForDifficulty({ playerId: f.playerId, difficulty: 'medium', factionId: f.factionId })])
  );
  const factionOf = Object.fromEntries(factions.map(f => [f.playerId, f.factionId])) as Record<PlayerId, FactionId>;

  if (!quiet) {
    const matchup = factions.map(f => f.factionId).join(' vs ');
    console.log(`\n⚔️  Bot Match: ${matchup} (seed: ${seed})`);
    console.log('─'.repeat(50));
  }

  const MAX_ACTIONS = playerCount === 4 ? 4000 : 2000;
  let actionCount = 0;
  let fallbackCount = 0;
  let lastPhase = state.phase;
  let turnActionCount = 0;
  let round: RoundTracker = { roundNumber: 1, turnsInRound: 0, lastPlayer: state.currentPlayerId };

  // Verbose state
  let verboseLastTurn = state.turnNumber;

  while (!state.winner && actionCount < MAX_ACTIONS) {
    const bot = bots[state.currentPlayerId];
    const prevState = state;
    const result = stepBot(state, bot, state.currentPlayerId);

    if (!result) {
      if (!quiet) console.log(`⚠️  No action available at turn ${state.turnNumber}, forcing endTurn`);
      if (state.phase === 'gameplay') {
        try {
          state = applyAction(state, { type: 'endTurn' });
        } catch {
          break;
        }
      } else {
        break;
      }
      continue;
    }

    if (result.fallback) fallbackCount++;

    // Verbose: print phase/turn transitions and every action
    if (verbose) {
      if (state.phase !== lastPhase) {
        console.log(`\n── ${state.phase.toUpperCase()} ──`);
        lastPhase = state.phase;
      }
      if (state.phase === 'gameplay' && state.turnNumber !== verboseLastTurn) {
        console.log(`\n── Round ${state.turnNumber} (${state.currentPlayerId}) ──`);
        verboseLastTurn = state.turnNumber;
      }
      const fb = result.fallback ? ' [FALLBACK]' : '';
      console.log(`  #${actionCount + 1} ${formatAction(result.action, prevState)}${fb}`);
    }

    state = result.nextState;
    actionCount++;
    turnActionCount++;

    // Track phase transitions FIRST (resets tracking, suppresses stale player-change)
    if (!verbose && state.phase !== lastPhase) {
      lastPhase = state.phase;
      round = { ...round, lastPlayer: state.currentPlayerId };
      turnActionCount = 0;
    }
    // Default: report when current player changes within same phase
    else if (!quiet && !verbose && state.phase === 'gameplay' && state.currentPlayerId !== round.lastPlayer) {
      const faction = factionOf[round.lastPlayer as PlayerId];
      console.log(`  Turn ${round.roundNumber} | ${faction} (${round.lastPlayer}) | ${turnActionCount} actions`);
      turnActionCount = 0;
      round = advanceRound(round, state.currentPlayerId, playerCount);
    }
  }

  // Print final player's turn if game ended before player switch
  if (!quiet && !verbose && state.phase === 'gameplay' && turnActionCount > 0) {
    const faction = factionOf[round.lastPlayer as PlayerId];
    console.log(`  Turn ${round.roundNumber} | ${faction} (${round.lastPlayer}) | ${turnActionCount} actions`);
  }

  // Summary
  console.log('─'.repeat(50));
  if (state.winner) {
    console.log(`🏆 Winner: ${state.winner} (${factionOf[state.winner]})`);
    console.log(`   Condition: ${state.winCondition ?? 'unknown'}`);
  } else {
    console.log('⏰ Game did not finish within action limit');
  }
  console.log(`   Turns: ${state.turnNumber}`);
  console.log(`   Actions: ${actionCount}`);
  console.log(`   Fallbacks: ${fallbackCount}`);
  console.log(`   Seed: ${seed}`);

  const alive = state.units.filter(u => u.currentHp > 0);
  for (const f of factions) {
    const count = alive.filter(u => u.playerId === f.playerId).length;
    console.log(`   ${f.factionId} (${f.playerId}): ${count} units alive`);
  }
}

main();
