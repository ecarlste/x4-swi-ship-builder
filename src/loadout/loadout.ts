/**
 * The Loadout: the one zod schema for a Loadout, which the codec checks every
 * Loadout read from an untrusted place against (spec #25, decided in #9 and
 * #24). Its edits, which enforce the fit and capacity rules, are in
 * `rules.ts`.
 *
 * A Loadout is sparse and keyed by Game Data ids, with empty entries left out, so
 * an Empty Loadout is `{ format, gameData, ship }`. `format` is bumped only
 * when the serialization changes.
 */
import { z } from "zod";
import type { GameData, Ship } from "../gameData.ts";
import { engineParts } from "../../shared/game-data/engines.ts";

export const LOADOUT_FORMAT = 1;

const id = z.string().min(1);
const positiveCount = z.number().int().positive();

const groupEntrySchema = z.object({ equipment: id, count: positiveCount });

/** The kinds a Loadout fits per Slot Group. Engines aren't one: the engine is fitted to the whole Ship (ADR 0001). */
export const slotGroupKindSchema = z.enum(["turret", "shield"]);
export type SlotGroupKind = z.infer<typeof slotGroupKindSchema>;

export const loadoutSchema = z.object({
  format: z.literal(LOADOUT_FORMAT),
  gameData: z.object({ swi: id, x4: id }),
  /** The Ship id. */
  ship: id,
  /** Slot id → Equipment id. */
  slots: z.record(id, id).optional(),
  /** Slot Group id → kind → the Equipment fitted and how many of the Slot Group's Slots it fills. */
  groups: z.record(id, z.partialRecord(slotGroupKindSchema, groupEntrySchema)).optional(),
  /** The engine's Equipment id, fitted to all of the Ship's engine Slots and engine Slot Groups. */
  engine: id.optional(),
  /** The thruster's Equipment id. */
  thruster: id.optional(),
  /** The software's Equipment ids. */
  software: z.array(id).optional(),
  /** A consumable's Equipment id → count. */
  consumables: z.record(id, positiveCount).optional(),
  /**
   * The Crew: service crew and marines, sharing the Ship's crew capacity, which
   * resolving checks. No Captain: every Ship gets one free (ADR 0004). With
   * both counts at 0 it is left out, so an empty one is rejected.
   */
  crew: z
    .strictObject({ service: positiveCount.optional(), marines: positiveCount.optional() })
    .refine((crew) => crew.service !== undefined || crew.marines !== undefined, "Crew needs service crew or marines")
    .optional(),
});

export type Loadout = z.infer<typeof loadoutSchema>;

/**
 * A Ship with nothing fitted, not even its mandatory software: where an
 * Empty Loadout (`emptyLoadout` in `rules.ts`) and a resolved Loadout start.
 */
export function bareLoadout(gameData: GameData, ship: Ship): Loadout {
  return {
    format: LOADOUT_FORMAT,
    gameData: { swi: gameData.manifest.swi.version, x4: gameData.manifest.x4.version },
    ship: ship.id,
  };
}

/** One of the Crew's two counts. */
export type CrewRole = keyof NonNullable<Loadout["crew"]>;

/** The Crew's roles, in the order they're shown. */
export const CREW_ROLES: readonly CrewRole[] = ["service", "marines"];

/** Each Crew role's name, as shown. */
export const CREW_ROLE_NAMES: Record<CrewRole, string> = { service: "Service crew", marines: "Marines" };

/**
 * The order Crew over the Ship's crew capacity is cut in: service crew first,
 * since marines are the deliberate choice (ADR 0004).
 */
export const CREW_CUT_ORDER: readonly CrewRole[] = ["service", "marines"];

/** How many Crew a Loadout carries, service crew and marines together. The Captain isn't Crew. */
export function crewCount(loadout: Loadout): number {
  return (loadout.crew?.service ?? 0) + (loadout.crew?.marines ?? 0);
}

/**
 * What the Ship's buy screen calls its Captain: "Pilot" on S and M Ships,
 * "Captain" on L and XL. The Captain is free, always fitted and not part of
 * the Loadout (ADR 0004).
 */
export function captainTitle(ship: Ship): "Pilot" | "Captain" {
  return ship.size === "s" || ship.size === "m" ? "Pilot" : "Captain";
}

/**
 * The Ship's seats as the game's Crew figure counts them: the Captain's seat
 * sits on top of the crew capacity, so it adds one to both what's taken and
 * the total (ADR 0004).
 */
export function crewSeats(ship: Ship, loadout: Loadout): { taken: number; total: number } {
  return { taken: crewCount(loadout) + 1, total: ship.capacities.crew + 1 };
}

export type ConsumableKind = "missile" | "drone" | "deployable" | "countermeasure";

/**
 * How many engines the Ship takes and the fit list they come from: its engine
 * Slots plus the sizes of all its engine Slot Groups, which in game take one
 * engine type between them (ADR 0001). Null for a Ship with no engines.
 * Game Data integrity guarantees they all share one fit list.
 */
export function shipEngines(ship: Ship): { count: number; fitList: string } | null {
  const [first, ...rest] = engineParts(ship);
  if (!first) return null;
  return { count: rest.reduce((sum, p) => sum + p.count, first.count), fitList: first.fitList };
}
