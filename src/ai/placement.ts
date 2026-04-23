/**
 * AI placement logic: default army compositions and placement heuristics.
 */
import type { GameState, PlayerId, CubeCoord, FactionId } from '../engine/types.js';
import { hexKey, cubeDistance } from '../engine/hex.js';
import { getPlacementZoneCells, getBaseCells } from '../engine/board.js';
import { getUnitDef } from '../engine/data/factions/index.js';

// ========== Default Army Compositions ==========

/** Recommended army composition per faction (basicMelee, basicRanged, specialtyChoices). */
const DEFAULT_COMPOSITIONS: Record<FactionId, ArmyComposition> = {
  aztecs: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['jaguar_warrior', 'jaguar_warrior', 'jaguar_warrior', 'priest', 'priest'] },
  bulgars: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['light_cavalry', 'light_cavalry', 'light_cavalry', 'heavy_cavalry', 'heavy_cavalry'] },
  english: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['longbowman', 'longbowman', 'longbowman', 'knight', 'knight'] },
  huns: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['mounted_archer', 'mounted_archer', 'mounted_archer', 'mounted_swordsman', 'mounted_swordsman'] },
  japanese: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['samurai', 'samurai', 'samurai', 'samurai', 'samurai'] },
  mongols: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['kheshig', 'kheshig', 'pillager', 'pillager', 'pillager'] },
  muscovites: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['streltsy', 'streltsy', 'streltsy', 'cossack_cavalry', 'cossack_cavalry'] },
  ottomans: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['medic', 'medic', 'janissary', 'janissary', 'janissary'] },
  romans: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['legionnaire', 'legionnaire', 'legionnaire', 'centurion', 'centurion'] },
  vandals: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['raider', 'raider', 'raider', 'vandal_heavy_cavalry', 'vandal_heavy_cavalry'] },
  vikings: { basicMelee: 2, basicRanged: 1, specialtyChoices: ['berserker', 'berserker', 'berserker', 'axe_thrower', 'axe_thrower'] },
};

interface ArmyComposition {
  readonly basicMelee: number;
  readonly basicRanged: number;
  readonly specialtyChoices: readonly string[];
}

/** Get the default army composition for a faction. */
export function getDefaultComposition(factionId: FactionId): ArmyComposition {
  return DEFAULT_COMPOSITIONS[factionId];
}

// ========== Placement Heuristics ==========

/**
 * Choose a placement position for a unit type.
 *
 * Heuristics:
 * - Ranged units placed in back rows (closer to own base)
 * - Melee/specialty in front rows (closer to center)
 * - Leader in center-back (protected)
 * - Fill from center of the zone outward
 */
export function choosePlacementPosition(
  state: GameState,
  playerId: PlayerId,
  unitTypeId: string,
): CubeCoord {
  const placementCells = getPlacementZoneCells(state.board, playerId);
  const occupiedKeys = new Set(state.units.map(u => hexKey(u.position)));
  const available = placementCells.filter(c => !occupiedKeys.has(hexKey(c.coord)));

  if (available.length === 0) {
    throw new Error('No available placement positions');
  }

  // Determine unit role from data
  const player = state.players.find(p => p.id === playerId);
  const factionId = player?.factionId;
  const unitDef = factionId ? getUnitDef(factionId, unitTypeId) : undefined;
  const isRanged = unitDef ? unitDef.attack.range > 1 : unitTypeId === 'basic_ranged';
  const isLeader = unitDef?.category === 'leader';

  // Get own base center for distance calculations
  const baseCells = getBaseCells(state.board, playerId);
  const baseCenter = getCenter(baseCells.map(c => c.coord));

  // Get enemy base center
  const enemyId = state.players.find(p => p.id !== playerId)?.id;
  const enemyBaseCells = enemyId ? getBaseCells(state.board, enemyId) : [];
  const enemyCenter = enemyBaseCells.length > 0
    ? getCenter(enemyBaseCells.map(c => c.coord))
    : baseCenter;

  // Score each available position
  const scored = available.map(cell => {
    const coord = cell.coord;
    const distToOwnBase = cubeDistance(coord, baseCenter);
    const distToEnemyBase = cubeDistance(coord, enemyCenter);
    const zoneCenter = getCenter(placementCells.map(c => c.coord));
    const distToCenter = cubeDistance(coord, zoneCenter);

    let score = 0;

    if (isLeader) {
      // Leader: prefer center-back (close to own base, center of zone)
      score += distToEnemyBase * 0.5;   // farther from enemy = safer
      score -= distToCenter * 0.3;       // closer to center = better
    } else if (isRanged) {
      // Ranged: back rows
      score += distToEnemyBase * 0.4;   // farther from enemy
      score -= distToCenter * 0.2;       // prefer center
    } else {
      // Melee/specialty: front rows
      score -= distToEnemyBase * 0.4;   // closer to enemy
      score -= distToCenter * 0.2;       // prefer center
    }

    // Slight preference for center of zone
    score -= distToCenter * 0.1;

    return { coord, score };
  });

  // Pick highest score
  scored.sort((a, b) => b.score - a.score);
  return scored[0].coord;
}

// ========== Helpers ==========

function getCenter(coords: readonly CubeCoord[]): CubeCoord {
  if (coords.length === 0) return { q: 0, r: 0, s: 0 };
  const avgQ = coords.reduce((sum, c) => sum + c.q, 0) / coords.length;
  const avgR = coords.reduce((sum, c) => sum + c.r, 0) / coords.length;
  const avgS = coords.reduce((sum, c) => sum + c.s, 0) / coords.length;
  // Round to nearest valid cube coord
  let rQ = Math.round(avgQ);
  let rR = Math.round(avgR);
  let rS = Math.round(avgS);
  const dQ = Math.abs(rQ - avgQ);
  const dR = Math.abs(rR - avgR);
  const dS = Math.abs(rS - avgS);
  if (dQ > dR && dQ > dS) rQ = -rR - rS;
  else if (dR > dS) rR = -rQ - rS;
  else rS = -rQ - rR;
  return { q: rQ, r: rR, s: rS };
}
