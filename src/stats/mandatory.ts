import type { GameData, Ship } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import { shipEngines, type Loadout } from "../builder/loadout.ts";

/** A mandatory upgrade the Loadout lacks: which row it is, and how to name it. */
export interface MissingUpgrade {
  /** Identifies the table row: `engine`, `slot:<id>`, `thruster` or `software:<id>`. */
  row: string;
  label: string;
}

const SLOT_KIND_LABEL = { weapon: "Weapon", turret: "Turret", shield: "Shield", engine: "Engine" } as const;

/**
 * The mandatory upgrades this Loadout is missing, in table order: the
 * engine, when the Ship takes any; Slots tagged `mandatory`; the thruster;
 * and the Ship's `default="1"` software. Nothing is
 * blocked by these; the builder only points them out.
 */
export function missingMandatory(gameData: GameData, ship: Ship, loadout: Loadout): MissingUpgrade[] {
  const softwareName = (id: string) => indexGameData(gameData).equipment.get(id)?.name ?? id;
  const missing: MissingUpgrade[] = [];
  if (shipEngines(ship) && !loadout.engine) missing.push({ row: "engine", label: "Engines" });
  for (const slot of ship.slots) {
    if (slot.mandatory && slot.kind !== "engine" && !loadout.slots?.[slot.id]) {
      missing.push({ row: `slot:${slot.id}`, label: `${SLOT_KIND_LABEL[slot.kind]} ${slot.id}` });
    }
  }
  if (!loadout.thruster) missing.push({ row: "thruster", label: "Thruster" });
  for (const id of ship.software.mandatory) {
    if (!loadout.software?.includes(id)) missing.push({ row: `software:${id}`, label: softwareName(id) });
  }
  return missing;
}
