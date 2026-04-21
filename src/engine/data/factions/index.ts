import type { FactionDefinition, FactionId, UnitDefinition } from '../../types.js';
import { AZTECS } from './aztecs.js';
import { BULGARS } from './bulgars.js';
import { ENGLISH } from './english.js';
import { HUNS } from './huns.js';
import { JAPANESE } from './japanese.js';
import { MONGOLS } from './mongols.js';
import { MUSCOVITES } from './muscovites.js';
import { OTTOMANS } from './ottomans.js';
import { ROMANS } from './romans.js';
import { VANDALS } from './vandals.js';
import { VIKINGS } from './vikings.js';

export {
  AZTECS, BULGARS, ENGLISH, HUNS, JAPANESE,
  MONGOLS, MUSCOVITES, OTTOMANS, ROMANS, VANDALS, VIKINGS,
};

/** All factions indexed by FactionId */
export const FACTIONS: Readonly<Record<FactionId, FactionDefinition>> = {
  aztecs: AZTECS,
  bulgars: BULGARS,
  english: ENGLISH,
  huns: HUNS,
  japanese: JAPANESE,
  mongols: MONGOLS,
  muscovites: MUSCOVITES,
  ottomans: OTTOMANS,
  romans: ROMANS,
  vandals: VANDALS,
  vikings: VIKINGS,
};

/** Get a faction definition by ID */
export function getFaction(id: FactionId): FactionDefinition {
  return FACTIONS[id];
}

/** Get a unit definition by faction ID and unit type ID */
export function getUnitDef(factionId: FactionId, unitTypeId: string): UnitDefinition | undefined {
  return FACTIONS[factionId].units.find(u => u.typeId === unitTypeId);
}
