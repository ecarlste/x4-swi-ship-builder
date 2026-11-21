/**
 * The Loadout's lines: one walk of the Places a Ship offers, in Loadout table
 * order. Price, the stat rows, the table's rows, the mandatory marks and
 * changes since loading all read these lines instead of walking the Loadout
 * themselves.
 */
import type { Equipment, GameData, Price, Ship } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import { CREW_ROLES, shipEngines, type Loadout, type SlotGroupKind } from "./loadout.ts";
import type { Place } from "./repairs.ts";
import { loadoutRules } from "./rules.ts";

/** The kinds a Slot Group's lines come in, in table order. */
export const SLOT_GROUP_KINDS: readonly SlotGroupKind[] = ["turret", "shield"];

/**
 * What a Loadout holds at one Place: the Equipment's id as stored, and how
 * many. The Crew holds people, not Equipment, so its `equipment` is null.
 */
export interface Held {
  equipment: string | null;
  count: number;
}

/** One line of a Loadout: the Chassis (no Place), or one Place the Ship offers. */
export interface Line {
  /** Where this line is; null for the Chassis, where nothing is fitted. */
  place: Place | null;
  /** The fitted Equipment; null when the Place is empty, for the Chassis and the Crew, and for Equipment not in the Game Data. */
  equipment: Equipment | null;
  /** How many are bought: 1 for the Chassis, the Ship's engine count for the engines (ADR 0001), 0 when empty. */
  count: number;
  /** What the line costs: its price times its count (ADR 0003). Empty Places and Equipment not in the Game Data cost 0. */
  price: Price;
  /** Whether the Place is mandatory and empty. Nothing is blocked by it; the builder only points it out. */
  missing: boolean;
  /**
   * What the Loaded Loadout held here (null for nothing), given only when a
   * Loaded Loadout is and it held something else.
   */
  was?: Held | null;
}

const FREE: Price = { min: 0, average: 0, max: 0 };

const times = (price: Price, count: number): Price => ({
  min: price.min * count,
  average: price.average * count,
  max: price.max * count,
});

/**
 * Whether a Place is mandatory: the engines (when the Ship has any), Slots
 * tagged `mandatory`, the thruster, and the Ship's `default="1"` software.
 * Slot Groups never are, in game or in the Game Data.
 */
function mandatory(ship: Ship, place: Place): boolean {
  switch (place.kind) {
    case "engine":
    case "thruster":
      return true;
    case "slot":
      return ship.slots.some((s) => s.id === place.slot && s.mandatory);
    case "software":
      return ship.software.mandatory.includes(place.equipment);
    default:
      return false;
  }
}

/** What a Loadout holds at a Place, or null when it's empty. */
function heldAt(ship: Ship, loadout: Loadout, place: Place): Held | null {
  const heldOf = (equipment: string | undefined, count: number): Held | null =>
    equipment !== undefined && count > 0 ? { equipment, count } : null;
  switch (place.kind) {
    case "slot":
      return heldOf(loadout.slots?.[place.slot], 1);
    case "group": {
      const entry = loadout.groups?.[place.group]?.[place.groupKind];
      return heldOf(entry?.equipment, entry?.count ?? 0);
    }
    case "engine":
      // The engine count always comes from the Ship (ADR 0001).
      return heldOf(loadout.engine, shipEngines(ship)?.count ?? 0);
    case "thruster":
      return heldOf(loadout.thruster, 1);
    case "software":
      return heldOf(loadout.software?.includes(place.equipment) ? place.equipment : undefined, 1);
    case "consumable":
      return heldOf(place.equipment, loadout.consumables?.[place.equipment] ?? 0);
    case "crew": {
      const count = loadout.crew?.[place.role] ?? 0;
      return count > 0 ? { equipment: null, count } : null;
    }
  }
}

/** The Places a Ship offers for this Loadout, in table order. */
function places(gameData: GameData, ship: Ship, loadout: Loadout): Place[] {
  const rules = loadoutRules(gameData, ship);
  const { fitListEquipment } = indexGameData(gameData);
  return [
    ...(shipEngines(ship) ? [{ kind: "engine" } as const] : []),
    ...ship.slots.filter((s) => s.kind !== "engine").map((s): Place => ({ kind: "slot", slot: s.id })),
    ...ship.slotGroups.flatMap((g) =>
      SLOT_GROUP_KINDS.filter((k) => g.kinds[k]).map((k): Place => ({ kind: "group", group: g.id, groupKind: k })),
    ),
    { kind: "thruster" },
    // An item on more than one kind's fit list is still one Place.
    ...[...new Set(rules.consumables(loadout).flatMap((o) => o.items.map((e) => e.id)))].map(
      (id): Place => ({ kind: "consumable", equipment: id }),
    ),
    ...fitListEquipment(ship.software.fitList).map((e): Place => ({ kind: "software", equipment: e.id })),
    ...(ship.capacities.crew > 0 ? CREW_ROLES.map((role): Place => ({ kind: "crew", role })) : []),
  ];
}

const sameHeld = (a: Held | null, b: Held | null) => a?.equipment === b?.equipment && a?.count === b?.count;

/**
 * The Loadout's lines: the Chassis first, then every Place the Ship offers,
 * empty ones included. Given the Loaded Loadout, each line where it held
 * something else says what, in `was`.
 */
export function loadoutLines(gameData: GameData, ship: Ship, loadout: Loadout, loaded: Loadout | null = null): Line[] {
  const { equipment } = indexGameData(gameData);
  const line = (place: Place): Line => {
    const held = heldAt(ship, loadout, place);
    const count = held?.count ?? 0;
    const missing = !held && mandatory(ship, place);
    const item = held?.equipment ? (equipment.get(held.equipment) ?? null) : null;
    const price = place.kind === "crew" ? times(gameData.crewPrice, count) : item ? times(item.price, count) : FREE;
    const line: Line = { place, equipment: item, count, price, missing };
    if (loaded) {
      const before = heldAt(ship, loaded, place);
      if (!sameHeld(held, before)) line.was = before;
    }
    return line;
  };
  const chassis: Line = { place: null, equipment: null, count: 1, price: ship.price, missing: false };
  return [chassis, ...places(gameData, ship, loadout).map(line)];
}
