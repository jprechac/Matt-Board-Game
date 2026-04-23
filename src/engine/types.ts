// ========== Coordinates ==========

/** Cube coordinates for hex grid (q + r + s = 0) */
export interface CubeCoord {
  readonly q: number;
  readonly r: number;
  readonly s: number;
}

/** Offset coordinates for rectangular board layout (odd-r) */
export interface OffsetCoord {
  readonly col: number;
  readonly row: number;
}

// ========== Identifiers ==========

export type FactionId =
  | 'aztecs'
  | 'bulgars'
  | 'english'
  | 'huns'
  | 'japanese'
  | 'mongols'
  | 'muscovites'
  | 'ottomans'
  | 'romans'
  | 'vandals'
  | 'vikings';

export const ALL_FACTION_IDS: readonly FactionId[] = [
  'aztecs', 'bulgars', 'english', 'huns', 'japanese',
  'mongols', 'muscovites', 'ottomans', 'romans', 'vandals', 'vikings',
];

export type UnitCategory = 'basic' | 'specialty' | 'leader';

export type PlayerId = 'player1' | 'player2' | 'player3' | 'player4';

export type TeamId = 'team1' | 'team2';

// ========== Game Phases ==========

export type GamePhase = 'setup' | 'placement' | 'gameplay' | 'victory';

export type SetupStep =
  | 'rollOff'
  | 'choosePriority'
  | 'loserChoosePriority'
  | 'factionSelection'
  | 'armyComposition'
  | 'terrainPlacement'
  | 'unitPlacement';

export type PriorityOrderType = 'factionOrder' | 'moveOrder';

// ========== Unit Definitions (data / templates) ==========

/** Attack profile for primary or secondary attacks */
export interface AttackProfile {
  readonly range: number;
  readonly damage: number;
  readonly toHit: number; // minimum d8 roll to hit (e.g. 4 means 4+)
  readonly critThreshold?: number; // minimum d8 roll for critical hit
  readonly critDamage?: number; // damage on crit (default: damage + 1)
  readonly noProximityPenalty?: boolean; // exempt from ranged proximity penalty
}

/** Unit template / stat block from data files */
export interface UnitDefinition {
  readonly typeId: string;
  readonly name: string;
  readonly category: UnitCategory;
  readonly hp: number;
  readonly movement: number;
  readonly attack: AttackProfile;
  readonly secondaryAttack?: AttackProfile; // e.g. Samurai ranged throw
  readonly abilityId?: string;
  readonly abilityParams?: Record<string, unknown>;
}

/** Faction definition with all unit templates */
export interface FactionDefinition {
  readonly id: FactionId;
  readonly name: string;
  readonly leaderTypeId: string;
  readonly specialtyTypeIds: readonly string[];
  readonly units: readonly UnitDefinition[];
}

// ========== Live Game Objects ==========

/** A unit instance on the board */
export interface Unit {
  readonly id: string;
  readonly typeId: string;
  readonly playerId: PlayerId;
  readonly factionId: FactionId;
  readonly category: UnitCategory;
  readonly position: CubeCoord;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly movement: number;
  readonly hasMovedThisTurn: boolean;
  readonly hasAttackedThisTurn: boolean;
  readonly hasUsedAbilityThisTurn: boolean;
  readonly movementUsedThisTurn: number;
  readonly movementUsedAtAttack: number;
  readonly activatedThisTurn: boolean;
  readonly abilityState: Record<string, unknown>;
}

/** Terrain type — stub, details TBD */
export type TerrainType = string;

/** A single hex cell on the board */
export interface HexCell {
  readonly coord: CubeCoord;
  readonly terrain?: TerrainType;
  readonly basePlayerId?: PlayerId;
  readonly placementZonePlayerId?: PlayerId;
  readonly terrainPlacementZonePlayerId?: PlayerId;
}

export type BoardSize = '2p' | '4p';

/** The game board */
export interface Board {
  readonly size: BoardSize;
  readonly width: number;  // columns
  readonly height: number; // rows
  readonly cells: Record<string, HexCell>; // key = hexKey(coord)
}

// ========== Actions ==========

export interface MoveAction {
  readonly type: 'move';
  readonly unitId: string;
  readonly to: CubeCoord;
}

export interface AttackAction {
  readonly type: 'attack';
  readonly unitId: string;
  readonly targetId: string;
}

export interface AbilityAction {
  readonly type: 'ability';
  readonly unitId: string;
  readonly abilityId: string;
  readonly params?: Record<string, unknown>;
}

export interface PlaceUnitAction {
  readonly type: 'placeUnit';
  readonly playerId: PlayerId;
  readonly unitTypeId: string;
  readonly position: CubeCoord;
}

export interface EndUnitTurnAction {
  readonly type: 'endUnitTurn';
  readonly unitId: string;
}

export interface EndTurnAction {
  readonly type: 'endTurn';
}

export interface SelectFactionAction {
  readonly type: 'selectFaction';
  readonly playerId: PlayerId;
  readonly factionId: FactionId;
}

export interface SetArmyCompositionAction {
  readonly type: 'setArmyComposition';
  readonly playerId: PlayerId;
  readonly composition: ArmyComposition;
}

export interface PlaceTerrainAction {
  readonly type: 'placeTerrain';
  readonly playerId: PlayerId;
  readonly terrainType: TerrainType;
  readonly position: CubeCoord;
}

export interface ChoosePriorityAction {
  readonly type: 'choosePriority';
  readonly playerId: PlayerId;
  readonly orderToControl?: PriorityOrderType; // required for winner, absent for loser
  readonly position: 'first' | 'second';
}

export interface SurrenderAction {
  readonly type: 'surrender';
  readonly playerId: PlayerId;
}

export type Action =
  | MoveAction
  | AttackAction
  | AbilityAction
  | PlaceUnitAction
  | EndUnitTurnAction
  | EndTurnAction
  | SelectFactionAction
  | SetArmyCompositionAction
  | PlaceTerrainAction
  | ChoosePriorityAction
  | SurrenderAction;

// ========== Army Composition ==========

export interface ArmyComposition {
  readonly basicMelee: number;
  readonly basicRanged: number;
  readonly specialtyChoices: readonly string[]; // unit type IDs
}

export const DEFAULT_ARMY_LIMITS = {
  basic: 3,
  specialty: 5,
  leader: 1,
  total: 9,
} as const;

// ========== Win Conditions ==========

export type WinCondition = 'base_control' | 'all_units_defeated' | 'surrender';

// ========== Game State ==========

export interface SetupState {
  readonly rollResults: Partial<Record<PlayerId, number>>;
  readonly rollWinner?: PlayerId;
  readonly factionSelectionOrder: readonly PlayerId[];
  readonly moveOrder: readonly PlayerId[];
  readonly currentStep: SetupStep;
  readonly currentPlayerIndex: number;
  readonly placementCount: number;
  readonly batchCount: number; // 0, 1 within a 2-unit batch
  readonly unplacedRoster: Partial<Record<PlayerId, readonly string[]>>; // unitTypeIds remaining
  readonly winnerOrderChoice?: PriorityOrderType; // which order the winner chose to control
  readonly winnerPosition?: 'first' | 'second'; // winner's position in their chosen order
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly factionId?: FactionId;
  readonly armyComposition?: ArmyComposition;
  readonly teamId?: TeamId;
}

/** Immutable game state — every action produces a new GameState */
export interface GameState {
  readonly phase: GamePhase;
  readonly turnNumber: number;
  readonly currentPlayerId: PlayerId;
  readonly players: readonly PlayerState[];
  readonly board: Board;
  readonly units: readonly Unit[];
  readonly rngSeed: number;
  readonly rngState: number;
  readonly baseControlTimers: Record<PlayerId, number>;
  readonly activeUnitId?: string;
  readonly winner?: PlayerId;
  readonly winCondition?: WinCondition;
  readonly setupState?: SetupState;
}

// ========== Constants ==========

export const BASE_CONTROL_TURNS_TO_WIN = 3;
export const MONGOL_BASE_CONTROL_TURNS_TO_WIN = 2;
export const RANGED_PROXIMITY_PENALTY = 1; // +1 to hit threshold at melee range
export const D8_SIDES = 8;
export const POST_ATTACK_MAX_MOVEMENT = 1;

// Board dimensions
export const BOARD_2P = { width: 18, height: 19 } as const;
export const BOARD_4P = { width: 22, height: 19 } as const;
export const BASE_BACK_ROW_SIZE = 4;
export const BASE_FRONT_ROW_SIZE = 3;
export const PLACEMENT_ZONE_DEPTH = 3;
export const TERRAIN_PLACEMENT_ZONE_DEPTH = 5;
