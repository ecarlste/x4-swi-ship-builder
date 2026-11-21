import type { GameData, Ship } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import type { Line } from "../loadout/lines.ts";
import type { Place } from "../loadout/repairs.ts";

/** A mandatory upgrade the Loadout lacks: its Place, and how to name it. */
export interface MissingUpgrade {
  place: Place;
  label: string;
}

const SLOT_KIND_LABEL = { weapon: "Weapon", turret: "Turret", shield: "Shield", engine: "Engine" } as const;

/**
 * The mandatory upgrades the Loadout is missing, from its lines' marks, in
 * Loadout table order. Nothing is blocked by these; the builder only points
 * them out.
 */
export function missingUpgrades(gameData: GameData, ship: Ship, lines: Line[]): MissingUpgrade[] {
  const nameOf = (id: string) => indexGameData(gameData).equipment.get(id)?.name ?? id;
  const label = (place: Place): string => {
    switch (place.kind) {
      case "engine":
        return "Engines";
      case "slot": {
        const kind = ship.slots.find((s) => s.id === place.slot)?.kind;
        return kind ? `${SLOT_KIND_LABEL[kind]} ${place.slot}` : place.slot;
      }
      case "thruster":
        return "Thruster";
      case "software":
      case "consumable":
        return nameOf(place.equipment);
      case "group":
        return place.group;
      case "crew":
        return place.role;
    }
  };
  return lines.flatMap(({ place, missing }) => (place && missing ? [{ place, label: label(place) }] : []));
}
