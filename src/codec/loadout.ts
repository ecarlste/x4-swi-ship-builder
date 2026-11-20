/**
 * The Loadout codec's schema: the one zod schema for every Loadout read from
 * an untrusted place (Saved Loadouts, Share Links, Loadout Files). Spec #25,
 * decided in #9 and #24.
 *
 * A Loadout is sparse and keyed by Game Data ids, with empty entries left out, so
 * an Empty Loadout is `{ format, gameData, ship }`. `format` is bumped only
 * when the serialization changes.
 */
import { z } from "zod";

export const LOADOUT_FORMAT = 1;

export const NEWER_FORMAT_ERROR = "This Loadout was made by a newer version of the builder.";

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
});

export type Loadout = z.infer<typeof loadoutSchema>;

/** A Loadout the user has kept in the browser, under a name. */
export const savedLoadoutSchema = loadoutSchema.extend({
  id: z.uuid(),
  name: z.string().trim().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type SavedLoadout = z.infer<typeof savedLoadoutSchema>;

/** A Loadout carried by a Share Link, with the name it had when it was shared. */
export const sharedLoadoutSchema = loadoutSchema.extend({
  name: z.string().trim().min(1).optional(),
});

export type SharedLoadout = z.infer<typeof sharedLoadoutSchema>;

export type ParseResult<T> = { ok: true; loadout: T } | { ok: false; error: string };

function parseWith<T>(schema: z.ZodType<T>, value: unknown): ParseResult<T> {
  // A newer format may mean anything, so it's rejected before the schema has a say.
  if (
    typeof value === "object" &&
    value !== null &&
    "format" in value &&
    typeof value.format === "number" &&
    value.format > LOADOUT_FORMAT
  ) {
    return { ok: false, error: NEWER_FORMAT_ERROR };
  }
  const result = schema.safeParse(value);
  return result.success
    ? { ok: true, loadout: result.data }
    : { ok: false, error: `This isn't a valid Loadout: ${z.prettifyError(result.error)}` };
}

/** Validates an untrusted value as a Loadout. */
export function parseLoadout(value: unknown): ParseResult<Loadout> {
  return parseWith(loadoutSchema, value);
}

/** Validates an untrusted value as a Saved Loadout. */
export function parseSavedLoadout(value: unknown): ParseResult<SavedLoadout> {
  return parseWith(savedLoadoutSchema, value);
}

/** Validates an untrusted value as a Loadout carried by a Share Link. */
export function parseSharedLoadout(value: unknown): ParseResult<SharedLoadout> {
  return parseWith(sharedLoadoutSchema, value);
}
