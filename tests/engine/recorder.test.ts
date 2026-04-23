import { describe, it, expect, beforeAll } from 'vitest';
import { createRecordedGame, applyRecordedAction, getEventsByType } from '../../src/engine/recorder.js';
import { applyActionDetailed } from '../../src/engine/game.js';
import type { GameConfig } from '../../src/engine/game.js';
import type { RecordedGame } from '../../src/engine/recorder.js';
import type {
  GameEvent, GameStartedEvent, RollOffResolvedEvent, PriorityChosenEvent,
  FactionSelectedEvent, ArmyCompositionSetEvent, UnitPlacedEvent,
  PlacementCompleteEvent, TurnStartedEvent, TurnEndedEvent,
  UnitMovedEvent, AttackResolvedEvent, UnitTurnEndedEvent, GameWonEvent,
  SurrenderEvent,
} from '../../src/engine/events.js';
import type { Action, PlayerId, CubeCoord } from '../../src/engine/types.js';
import { hexKey, offsetToAxial } from '../../src/engine/hex.js';
import { registerAllAbilities } from '../../src/engine/abilities/index.js';

beforeAll(() => {
  registerAllAbilities();
});

const config: GameConfig = {
  boardSize: '2p',
  playerIds: ['player1', 'player2'],
  seed: 42,
};

function findPlacementHex(game: RecordedGame, playerId: PlayerId): CubeCoord {
  const cells = Object.values(game.state.board.cells);
  for (const cell of cells) {
    if (cell.placementZonePlayerId === playerId) {
      const occupied = game.state.units.some(u => hexKey(u.position) === hexKey(cell.coord));
      if (!occupied) return cell.coord;
    }
  }
  throw new Error(`No available placement hex for ${playerId}`);
}

function setupToGameplay(seed: number = 42): RecordedGame {
  let game = createRecordedGame({ boardSize: '2p', playerIds: ['player1', 'player2'], seed });
  const rollWinner = game.state.setupState!.rollWinner!;
  const otherPlayer = rollWinner === 'player1' ? 'player2' : 'player1';

  game = applyRecordedAction(game, {
    type: 'choosePriority', playerId: rollWinner, orderToControl: 'factionOrder', position: 'first',
  });
  game = applyRecordedAction(game, {
    type: 'choosePriority', playerId: otherPlayer, position: 'first',
  });

  const factionOrder = game.state.setupState!.factionSelectionOrder;
  game = applyRecordedAction(game, {
    type: 'selectFaction', playerId: factionOrder[0], factionId: 'romans',
  });
  game = applyRecordedAction(game, {
    type: 'selectFaction', playerId: factionOrder[1], factionId: 'vikings',
  });

  const comp = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'legionnaire', 'legionnaire'] };
  const comp2 = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['berserker', 'berserker', 'berserker', 'berserker', 'berserker'] };
  game = applyRecordedAction(game, {
    type: 'setArmyComposition', playerId: factionOrder[0], composition: factionOrder[0] === rollWinner ? comp : comp2,
  });
  game = applyRecordedAction(game, {
    type: 'setArmyComposition', playerId: factionOrder[1], composition: factionOrder[1] === rollWinner ? comp : comp2,
  });

  // Place all units
  while (game.state.phase === 'placement') {
    const placer = game.state.currentPlayerId;
    const roster = game.state.setupState!.unplacedRoster[placer] as string[];
    const hex = findPlacementHex(game, placer);
    game = applyRecordedAction(game, {
      type: 'placeUnit', playerId: placer, unitTypeId: roster[0], position: hex,
    });
  }

  return game;
}

describe('createRecordedGame', () => {
  it('emits GameStarted and RollOffResolved events', () => {
    const game = createRecordedGame(config);
    expect(game.recording.events).toHaveLength(2);

    const started = game.recording.events[0] as GameStartedEvent;
    expect(started.type).toBe('gameStarted');
    expect(started.boardSize).toBe('2p');
    expect(started.seed).toBe(42);
    expect(started.playerIds).toEqual(['player1', 'player2']);

    const rollOff = game.recording.events[1] as RollOffResolvedEvent;
    expect(rollOff.type).toBe('rollOffResolved');
    expect(rollOff.winner).toBeDefined();
    expect(rollOff.rolls).toBeDefined();
  });

  it('stores config and initial state', () => {
    const game = createRecordedGame(config);
    expect(game.recording.config).toEqual(config);
    expect(game.recording.initialState).toEqual(game.state);
    expect(game.recording.actions).toHaveLength(0);
  });
});

describe('applyRecordedAction', () => {
  it('records priority chosen event', () => {
    let game = createRecordedGame(config);
    const winner = game.state.setupState!.rollWinner!;

    game = applyRecordedAction(game, {
      type: 'choosePriority', playerId: winner, orderToControl: 'factionOrder', position: 'first',
    });

    const events = getEventsByType<PriorityChosenEvent>(game.recording, 'priorityChosen');
    expect(events).toHaveLength(1);
    expect(events[0].playerId).toBe(winner);
    expect(events[0].orderControlled).toBe('factionOrder');
    expect(events[0].position).toBe('first');
  });

  it('records faction selection events', () => {
    let game = createRecordedGame(config);
    const winner = game.state.setupState!.rollWinner!;
    const loser = game.state.players.find(p => p.id !== winner)!.id;

    game = applyRecordedAction(game, {
      type: 'choosePriority', playerId: winner, orderToControl: 'factionOrder', position: 'first',
    });
    game = applyRecordedAction(game, {
      type: 'choosePriority', playerId: loser, position: 'first',
    });

    const factionOrder = game.state.setupState!.factionSelectionOrder;
    game = applyRecordedAction(game, {
      type: 'selectFaction', playerId: factionOrder[0], factionId: 'romans',
    });
    game = applyRecordedAction(game, {
      type: 'selectFaction', playerId: factionOrder[1], factionId: 'vikings',
    });

    const events = getEventsByType<FactionSelectedEvent>(game.recording, 'factionSelected');
    expect(events).toHaveLength(2);
    expect(events[0].factionId).toBe('romans');
    expect(events[1].factionId).toBe('vikings');
  });

  it('records army composition events', () => {
    let game = createRecordedGame(config);
    const winner = game.state.setupState!.rollWinner!;
    const loser = game.state.players.find(p => p.id !== winner)!.id;

    game = applyRecordedAction(game, {
      type: 'choosePriority', playerId: winner, orderToControl: 'factionOrder', position: 'first',
    });
    game = applyRecordedAction(game, {
      type: 'choosePriority', playerId: loser, position: 'first',
    });
    const factionOrder = game.state.setupState!.factionSelectionOrder;
    game = applyRecordedAction(game, {
      type: 'selectFaction', playerId: factionOrder[0], factionId: 'romans',
    });
    game = applyRecordedAction(game, {
      type: 'selectFaction', playerId: factionOrder[1], factionId: 'vikings',
    });

    const comp = { basicMelee: 2, basicRanged: 1, specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'legionnaire', 'legionnaire'] };
    game = applyRecordedAction(game, {
      type: 'setArmyComposition', playerId: factionOrder[0], composition: comp,
    });

    const events = getEventsByType<ArmyCompositionSetEvent>(game.recording, 'armyCompositionSet');
    expect(events).toHaveLength(1);
    expect(events[0].composition).toEqual(comp);
  });

  it('accumulates actions in recording', () => {
    let game = createRecordedGame(config);
    const winner = game.state.setupState!.rollWinner!;

    game = applyRecordedAction(game, {
      type: 'choosePriority', playerId: winner, orderToControl: 'factionOrder', position: 'first',
    });
    expect(game.recording.actions).toHaveLength(1);
    expect(game.recording.actions[0].type).toBe('choosePriority');
  });
});

describe('placement events', () => {
  it('records unit placed events', () => {
    const game = setupToGameplay();
    const placedEvents = getEventsByType<UnitPlacedEvent>(game.recording, 'unitPlaced');
    // 9 units per player = 18 total
    expect(placedEvents).toHaveLength(18);
    // Each has a unitId and position
    for (const e of placedEvents) {
      expect(e.unitId).toBeDefined();
      expect(e.position).toBeDefined();
    }
  });

  it('emits placementComplete and turnStarted when all units placed', () => {
    const game = setupToGameplay();
    const completeEvents = getEventsByType<PlacementCompleteEvent>(game.recording, 'placementComplete');
    expect(completeEvents).toHaveLength(1);

    const turnStartEvents = getEventsByType<TurnStartedEvent>(game.recording, 'turnStarted');
    expect(turnStartEvents.length).toBeGreaterThanOrEqual(1);
    expect(turnStartEvents[0].turnNumber).toBe(1);
  });
});

describe('gameplay events', () => {
  it('records move events with from/to/distance', () => {
    const game = setupToGameplay();
    const currentPlayer = game.state.currentPlayerId;
    const unit = game.state.units.find(u =>
      u.playerId === currentPlayer && u.currentHp > 0,
    )!;

    // Find a valid move destination
    const neighbors = [
      { q: unit.position.q + 1, r: unit.position.r, s: unit.position.s - 1 },
      { q: unit.position.q - 1, r: unit.position.r, s: unit.position.s + 1 },
      { q: unit.position.q, r: unit.position.r + 1, s: unit.position.s - 1 },
      { q: unit.position.q, r: unit.position.r - 1, s: unit.position.s + 1 },
    ];

    let moved = false;
    for (const dest of neighbors) {
      const key = hexKey(dest);
      if (game.state.board.cells[key] && !game.state.units.some(u => hexKey(u.position) === key)) {
        const result = applyRecordedAction(game, { type: 'move', unitId: unit.id, to: dest });
        const moveEvents = getEventsByType<UnitMovedEvent>(result.recording, 'unitMoved');
        const lastMove = moveEvents[moveEvents.length - 1];
        expect(lastMove.unitId).toBe(unit.id);
        expect(lastMove.from).toEqual(unit.position);
        expect(lastMove.to).toEqual(dest);
        expect(lastMove.distance).toBe(1);
        moved = true;
        break;
      }
    }
    expect(moved).toBe(true);
  });

  it('records endUnitTurn events', () => {
    const game = setupToGameplay();
    const currentPlayer = game.state.currentPlayerId;
    const unit = game.state.units.find(u =>
      u.playerId === currentPlayer && u.currentHp > 0,
    )!;

    const result = applyRecordedAction(game, { type: 'endUnitTurn', unitId: unit.id });
    const events = getEventsByType<UnitTurnEndedEvent>(result.recording, 'unitTurnEnded');
    const last = events[events.length - 1];
    expect(last.unitId).toBe(unit.id);
    expect(last.playerId).toBe(currentPlayer);
  });

  it('records turn end and turn start events', () => {
    let game = setupToGameplay();
    const currentPlayer = game.state.currentPlayerId;

    // End all units' turns
    for (const unit of game.state.units.filter(u => u.playerId === currentPlayer && u.currentHp > 0)) {
      game = applyRecordedAction(game, { type: 'endUnitTurn', unitId: unit.id });
    }

    game = applyRecordedAction(game, { type: 'endTurn' });

    const turnEndEvents = getEventsByType<TurnEndedEvent>(game.recording, 'turnEnded');
    expect(turnEndEvents.length).toBeGreaterThanOrEqual(1);
    const lastEnd = turnEndEvents[turnEndEvents.length - 1];
    expect(lastEnd.playerId).toBe(currentPlayer);

    const turnStartEvents = getEventsByType<TurnStartedEvent>(game.recording, 'turnStarted');
    // At least 2: one from placement→gameplay, one from endTurn
    expect(turnStartEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('records surrender and gameWon events', () => {
    const game = setupToGameplay();
    const result = applyRecordedAction(game, {
      type: 'surrender', playerId: 'player2',
    });

    const surrenderEvents = getEventsByType<SurrenderEvent>(result.recording, 'surrender');
    expect(surrenderEvents).toHaveLength(1);
    expect(surrenderEvents[0].playerId).toBe('player2');

    const wonEvents = getEventsByType<GameWonEvent>(result.recording, 'gameWon');
    expect(wonEvents).toHaveLength(1);
    expect(wonEvents[0].winner).toBe('player1');
    expect(wonEvents[0].winCondition).toBe('surrender');
  });
});

describe('full game recording', () => {
  it('records a complete game from start to finish', () => {
    const game = setupToGameplay();

    // Verify event ordering: gameStarted → rollOff → priority(x2) → factions → armies → placements → turnStarted
    const types = game.recording.events.map(e => e.type);
    expect(types[0]).toBe('gameStarted');
    expect(types[1]).toBe('rollOffResolved');
    expect(types[2]).toBe('priorityChosen');
    expect(types[3]).toBe('priorityChosen');
    expect(types[4]).toBe('factionSelected');
    expect(types[5]).toBe('factionSelected');
    expect(types.includes('armyCompositionSet')).toBe(true);
    expect(types.includes('unitPlaced')).toBe(true);
    expect(types.includes('placementComplete')).toBe(true);
    expect(types[types.length - 1]).toBe('turnStarted');
  });

  it('action count matches actions recorded', () => {
    const game = setupToGameplay();
    // Actions: 2 choosePriority + 2 selectFaction + 2 setArmy + 18 placeUnit = 24
    expect(game.recording.actions).toHaveLength(24);
  });

  it('getEventsByType filters correctly', () => {
    const game = setupToGameplay();
    const placed = getEventsByType<UnitPlacedEvent>(game.recording, 'unitPlaced');
    expect(placed).toHaveLength(18);
    expect(placed.every(e => e.type === 'unitPlaced')).toBe(true);
  });
});

describe('applyActionDetailed', () => {
  it('returns events alongside state', () => {
    const game = createRecordedGame(config);
    const winner = game.state.setupState!.rollWinner!;
    const { state, events } = applyActionDetailed(game.state, {
      type: 'choosePriority', playerId: winner, orderToControl: 'moveOrder', position: 'first',
    });

    expect(state.setupState!.currentStep).toBe('loserChoosePriority');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('priorityChosen');
  });
});
