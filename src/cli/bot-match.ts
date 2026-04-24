/**
 * Bot vs Bot CLI — run AI matches from the command line.
 *
 * Usage:
 *   npm run bot-match -- --faction1 romans --faction2 vikings --seed 42
 *   npm run bot-match -- --faction1 mongols --faction2 english --quiet
 */
import { createGame, applyAction } from '../engine/game.js';
import type { GameConfig } from '../engine/game.js';
import type { GameState, FactionId } from '../engine/types.js';
import { ALL_FACTION_IDS } from '../engine/types.js';
import { registerAllAbilities } from '../engine/abilities/index.js';
import { createBotForDifficulty } from '../ai/difficulty.js';
import { stepBot } from '../ai/bot-runner.js';

// ========== Arg Parsing ==========

function parseArgs(args: string[]) {
  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      const key = args[i].slice(2);
      if (!args[i + 1].startsWith('--')) {
        opts[key] = args[i + 1];
        i++;
      } else {
        opts[key] = 'true';
      }
    } else if (args[i].startsWith('--')) {
      opts[args[i].slice(2)] = 'true';
    }
  }
  return opts;
}

function validateFaction(name: string): FactionId {
  if (ALL_FACTION_IDS.includes(name as FactionId)) return name as FactionId;
  console.error(`Unknown faction: ${name}`);
  console.error(`Available factions: ${ALL_FACTION_IDS.join(', ')}`);
  process.exit(1);
}

// ========== Main ==========

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: npm run bot-match -- --faction1 <faction> --faction2 <faction> [--seed <number>] [--quiet]');
    console.log(`Available factions: ${ALL_FACTION_IDS.join(', ')}`);
    process.exit(0);
  }

  const faction1 = validateFaction(args.faction1 ?? 'romans');
  const faction2 = validateFaction(args.faction2 ?? 'vikings');
  const seed = parseInt(args.seed ?? String(Date.now()), 10);
  const quiet = args.quiet === 'true';

  registerAllAbilities();

  const config: GameConfig = { boardSize: '2p', playerIds: ['player1', 'player2'], seed };
  let state = createGame(config);

  const bot1 = createBotForDifficulty({ playerId: 'player1', difficulty: 'medium', factionId: faction1 });
  const bot2 = createBotForDifficulty({ playerId: 'player2', difficulty: 'medium', factionId: faction2 });

  if (!quiet) {
    console.log(`\n⚔️  Bot Match: ${faction1} vs ${faction2} (seed: ${seed})`);
    console.log('─'.repeat(50));
  }

  const MAX_ACTIONS = 2000;
  let actionCount = 0;
  let fallbackCount = 0;

  while (!state.winner && actionCount < MAX_ACTIONS) {
    const bot = state.currentPlayerId === 'player1' ? bot1 : bot2;
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
    state = result.nextState;
    actionCount++;

    if (!quiet && state.phase === 'gameplay' && actionCount % 50 === 0) {
      console.log(`  Turn ${state.turnNumber} | ${actionCount} actions`);
    }
  }

  // Summary
  console.log('─'.repeat(50));
  if (state.winner) {
    const winnerFaction = state.currentPlayerId === 'player1' ? faction1 : faction2;
    console.log(`🏆 Winner: ${state.winner} (${state.winner === 'player1' ? faction1 : faction2})`);
    console.log(`   Condition: ${state.winCondition ?? 'unknown'}`);
  } else {
    console.log('⏰ Game did not finish within action limit');
  }
  console.log(`   Turns: ${state.turnNumber}`);
  console.log(`   Actions: ${actionCount}`);
  console.log(`   Fallbacks: ${fallbackCount}`);
  console.log(`   Seed: ${seed}`);

  const alive = state.units.filter(u => u.currentHp > 0);
  const p1Alive = alive.filter(u => u.playerId === 'player1').length;
  const p2Alive = alive.filter(u => u.playerId === 'player2').length;
  console.log(`   Units alive: ${faction1}=${p1Alive}, ${faction2}=${p2Alive}`);
}

main();
