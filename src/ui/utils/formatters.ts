import type { FactionId, WinCondition } from '../../engine/types.js';
import { FACTIONS, getUnitDef } from '../../engine/data/factions/index.js';
import { BASIC_MELEE, BASIC_RANGED } from '../../engine/data/basic-units.js';

const WIN_CONDITION_LABELS: Record<WinCondition, string> = {
  all_units_defeated: 'All Units Eliminated',
  base_control: 'Base Control',
  surrender: 'Surrender',
};

/** Build a global typeId → display name lookup from all faction and basic unit data */
function buildUnitNameMap(): Record<string, string> {
  const map: Record<string, string> = {};
  map[BASIC_MELEE.typeId] = BASIC_MELEE.name;
  map[BASIC_RANGED.typeId] = BASIC_RANGED.name;
  for (const faction of Object.values(FACTIONS)) {
    for (const unit of faction.units) {
      map[unit.typeId] = unit.name;
    }
  }
  return map;
}

let unitNameMap: Record<string, string> | null = null;

function getUnitNameMap(): Record<string, string> {
  if (!unitNameMap) unitNameMap = buildUnitNameMap();
  return unitNameMap;
}

/** Format a unit typeId as a display name (e.g., "basic_melee" → "Melee") */
export function formatUnitName(typeId: string): string {
  const name = getUnitNameMap()[typeId];
  if (name) return name;
  // Fallback: title-case the typeId
  return typeId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Format a win condition code as a display string */
export function formatWinCondition(condition: WinCondition | string): string {
  return WIN_CONDITION_LABELS[condition as WinCondition]
    ?? condition.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Format a faction ID as a display name (e.g., "ottomans" → "Ottomans") */
export function formatFactionName(factionId: FactionId | string): string {
  const faction = FACTIONS[factionId as FactionId];
  if (faction) return faction.name;
  return factionId.charAt(0).toUpperCase() + factionId.slice(1);
}
