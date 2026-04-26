import type { PlayerId, FactionId, CubeCoord, ArmyComposition, WinCondition, BoardSize } from './types.js';

// ========== Base Event ==========

interface BaseGameEvent {
  readonly type: string;
  readonly turnNumber: number;
  readonly playerId?: PlayerId;
}

// ========== Setup Events ==========

export interface GameStartedEvent extends BaseGameEvent {
  readonly type: 'gameStarted';
  readonly boardSize: BoardSize;
  readonly playerIds: readonly PlayerId[];
  readonly seed: number;
}

export interface RollOffResolvedEvent extends BaseGameEvent {
  readonly type: 'rollOffResolved';
  readonly rolls: Partial<Record<PlayerId, number>>;
  readonly winner: PlayerId;
}

export interface PriorityChosenEvent extends BaseGameEvent {
  readonly type: 'priorityChosen';
  readonly playerId: PlayerId;
  readonly orderControlled: 'factionOrder' | 'moveOrder';
  readonly position: 'first' | 'second';
}

export interface FactionSelectedEvent extends BaseGameEvent {
  readonly type: 'factionSelected';
  readonly playerId: PlayerId;
  readonly factionId: FactionId;
}

export interface ArmyCompositionSetEvent extends BaseGameEvent {
  readonly type: 'armyCompositionSet';
  readonly playerId: PlayerId;
  readonly composition: ArmyComposition;
}

// ========== Placement Events ==========

export interface UnitPlacedEvent extends BaseGameEvent {
  readonly type: 'unitPlaced';
  readonly playerId: PlayerId;
  readonly unitId: string;
  readonly unitTypeId: string;
  readonly position: CubeCoord;
}

export interface PlacementCompleteEvent extends BaseGameEvent {
  readonly type: 'placementComplete';
}

// ========== Gameplay Events ==========

export interface TurnStartedEvent extends BaseGameEvent {
  readonly type: 'turnStarted';
  readonly playerId: PlayerId;
}

export interface TurnEndedEvent extends BaseGameEvent {
  readonly type: 'turnEnded';
  readonly playerId: PlayerId;
}

export interface UnitMovedEvent extends BaseGameEvent {
  readonly type: 'unitMoved';
  readonly unitId: string;
  readonly from: CubeCoord;
  readonly to: CubeCoord;
  readonly distance: number;
}

export interface AttackResolvedEvent extends BaseGameEvent {
  readonly type: 'attackResolved';
  readonly attackerId: string;
  readonly targetId: string;
  readonly roll: number;
  readonly effectiveToHit: number;
  readonly hit: boolean;
  readonly crit: boolean;
  readonly damage: number;
  readonly targetHpAfter: number;
  readonly targetKilled: boolean;
}

export interface HealResolvedEvent extends BaseGameEvent {
  readonly type: 'healResolved';
  readonly healerId: string;
  readonly targetId: string;
  readonly roll: number;
  readonly healed: boolean;
  readonly healAmount: number;
  readonly targetHpAfter: number;
}

export interface AttackRedirectedEvent extends BaseGameEvent {
  readonly type: 'attackRedirected';
  readonly redirectedBy: string; // Caesar's unit ID
  readonly originalTargetId: string;
  readonly newTargetId: string;
  readonly attackerId: string;
}

export interface UnitUpgradedEvent extends BaseGameEvent {
  readonly type: 'unitUpgraded';
  readonly upgradedBy: string; // Arthur's unit ID
  readonly unitId: string;
  readonly fromTypeId: string;
  readonly toTypeId: string;
}

export interface UnitKilledEvent extends BaseGameEvent {
  readonly type: 'unitKilled';
  readonly unitId: string;
  readonly killedBy: string;
}

export interface UnitTurnEndedEvent extends BaseGameEvent {
  readonly type: 'unitTurnEnded';
  readonly unitId: string;
}

export interface BaseControlChangedEvent extends BaseGameEvent {
  readonly type: 'baseControlChanged';
  readonly playerId: PlayerId;
  readonly baseOwnerId: PlayerId;
  readonly timerValue: number;
  readonly timerReset: boolean;
}

// ========== Victory Events ==========

export interface GameWonEvent extends BaseGameEvent {
  readonly type: 'gameWon';
  readonly winner: PlayerId;
  readonly winCondition: WinCondition;
}

export interface SurrenderEvent extends BaseGameEvent {
  readonly type: 'surrender';
  readonly playerId: PlayerId;
}

// ========== Union ==========

export type GameEvent =
  | GameStartedEvent
  | RollOffResolvedEvent
  | PriorityChosenEvent
  | FactionSelectedEvent
  | ArmyCompositionSetEvent
  | UnitPlacedEvent
  | PlacementCompleteEvent
  | TurnStartedEvent
  | TurnEndedEvent
  | UnitMovedEvent
  | AttackResolvedEvent
  | AttackRedirectedEvent
  | HealResolvedEvent
  | UnitKilledEvent
  | UnitUpgradedEvent
  | UnitTurnEndedEvent
  | BaseControlChangedEvent
  | GameWonEvent
  | SurrenderEvent;

export type GameEventType = GameEvent['type'];
