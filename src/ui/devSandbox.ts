import type { GameState } from '../engine/types.js';
import type { GameConfig } from '../engine/game.js';
import { createGame, applyAction } from '../engine/game.js';
import { registerAllAbilities } from '../engine/abilities/index.js';
import { hexKey } from '../engine/hex.js';

let registered = false;

/**
 * Create a GameState that's already in gameplay phase.
 * Useful for dev/testing UI without going through setup screens.
 */
export function createDevGameplayState(seed: number = 42): GameState {
  if (!registered) {
    registerAllAbilities();
    registered = true;
  }

  const config: GameConfig = { boardSize: '2p', playerIds: ['player1', 'player2'], seed };
  let state = createGame(config);

  const rollWinner = state.setupState!.rollWinner!;
  state = applyAction(state, {
    type: 'choosePriority', playerId: rollWinner, choice: 'pickFactionFirst',
  });

  const factionOrder = state.setupState!.factionSelectionOrder;
  state = applyAction(state, {
    type: 'selectFaction', playerId: factionOrder[0], factionId: 'romans',
  });
  state = applyAction(state, {
    type: 'selectFaction', playerId: factionOrder[1], factionId: 'vikings',
  });

  const comp1 = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'legionnaire', 'legionnaire'] };
  const comp2 = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['berserker', 'berserker', 'berserker', 'berserker', 'berserker'] };
  state = applyAction(state, {
    type: 'setArmyComposition', playerId: factionOrder[0],
    composition: factionOrder[0] === rollWinner ? comp1 : comp2,
  });
  state = applyAction(state, {
    type: 'setArmyComposition', playerId: factionOrder[1],
    composition: factionOrder[1] === rollWinner ? comp1 : comp2,
  });

  // Place all units
  while (state.phase === 'placement') {
    const placer = state.currentPlayerId;
    const roster = state.setupState!.unplacedRoster[placer] as string[];
    const cells = Object.values(state.board.cells);
    const hex = cells.find(c =>
      c.placementZonePlayerId === placer &&
      !state.units.some(u => hexKey(u.position) === hexKey(c.coord)),
    )!;
    state = applyAction(state, {
      type: 'placeUnit', playerId: placer, unitTypeId: roster[0], position: hex.coord,
    });
  }

  return state;
}
