/**
 * Pure utility functions for CLI output formatting and argument parsing.
 * Extracted from bot-match.ts to enable unit testing.
 */
import type { GameState, Action } from '../engine/types.js';

// ========== Arg Parsing ==========

export function parseArgs(args: string[]): Record<string, string> {
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

// ========== Action Formatting ==========

export function formatAction(action: Action, state: GameState): string {
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

// ========== Round Tracking ==========

export interface RoundTracker {
  roundNumber: number;
  turnsInRound: number;
  lastPlayer: string;
}

/**
 * Advance the round tracker after a player completes their turn.
 * Returns the updated tracker (new object, pure function).
 */
export function advanceRound(
  tracker: RoundTracker,
  nextPlayer: string,
  playerCount: number,
): RoundTracker {
  let { roundNumber, turnsInRound } = tracker;
  turnsInRound++;
  if (turnsInRound >= playerCount) {
    roundNumber++;
    turnsInRound = 0;
  }
  return { roundNumber, turnsInRound, lastPlayer: nextPlayer };
}
