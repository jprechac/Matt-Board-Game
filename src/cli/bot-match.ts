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
import type { GameState, FactionId, Action, PlayerId, BoardSize } from '../engine/types.js';
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

// ========== Action Formatting ==========

function formatAction(action: Action, state: GameState): string {
  const player = state.currentPlayerId;
  switch (action.type) {
    case 'move': {
      const unit = state.units.find(u => u.id === action.unitId);
      const name = unit ? `${unit.typeId}` : action.unitId;
      return `${player} move ${name} → (${action.to.q},${action.to.r})`;
    }
    case 'attack': {
      const attacker = state.units.find(u => u.id === action.unitId);
      const target = state.units.find(u => u.id === action.targetId);
      return `${player} attack ${attacker?.typeId ?? action.unitId} → ${target?.typeId ?? action.targetId}`;
    }
    case 'heal': {
      const healer = state.units.find(u => u.id === action.unitId);
      const target = state.units.find(u => u.id === action.targetId);
      return `${player} heal ${healer?.typeId ?? action.unitId} → ${target?.typeId ?? action.targetId}`;
    }
    case 'endUnitTurn': {
      const unit = state.units.find(u => u.id === action.unitId);
      return `${player} end unit turn (${unit?.typeId ?? action.unitId})`;
    }
    case 'endTurn':
      return `${player} end turn`;
    case 'selectFaction':
      return `${action.playerId} select faction: ${action.factionId}`;
    case 'setArmyComposition':
      return `${action.playerId} set army composition`;
    case 'choosePriority':
      return `${action.playerId} choose priority: ${action.orderToControl ?? 'remaining'} ${action.position}`;
    case 'placeUnit':
      return `${action.playerId} place ${action.unitTypeId} at (${action.position.q},${action.position.r})`;
    case 'surrender':
      return `${action.playerId} surrender`;
    default:
      return `${player} ${(action as Action).type}`;
  }
}

// ========== Main ==========

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
  let lastPlayer = state.currentPlayerId;
  let turnActionCount = 0;
  let roundNumber = 1;
  let turnsInRound = 0;

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
      lastPlayer = state.currentPlayerId;
      turnActionCount = 0;
    }
    // Default: report when current player changes within same phase
    else if (!quiet && !verbose && state.phase === 'gameplay' && state.currentPlayerId !== lastPlayer) {
      const faction = factionOf[lastPlayer];
      console.log(`  Turn ${roundNumber} | ${faction} (${lastPlayer}) | ${turnActionCount} actions`);
      turnActionCount = 0;
      lastPlayer = state.currentPlayerId;
      turnsInRound++;
      if (turnsInRound >= playerCount) {
        roundNumber++;
        turnsInRound = 0;
      }
    }
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
