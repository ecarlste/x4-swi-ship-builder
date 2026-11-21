/**
 * The Loadout codec's wire formats: parsing every Loadout read from an
 * untrusted place (Saved Loadouts, Share Links, Loadout Files) against the
 * Loadout's schema, and the Saved and shared shapes that extend it. Spec #25,
 * decided in #9 and #24.
 */
import { z } from "zod";
import { LOADOUT_FORMAT, loadoutSchema, type Loadout } from "../loadout/loadout.ts";

export const NEWER_FORMAT_ERROR = "This Loadout was made by a newer version of the builder.";

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

/** A Loadout split from the name it was opened under, with the id of the Saved Loadout it is, if it is one. */
export interface Opening<Named> {
  loadout: Loadout;
  named: Named;
}

/** A Saved Loadout as the Loadout it holds, and its id and name. */
export function openingOfSaved(saved: SavedLoadout): Opening<{ id: string; name: string }> {
  const { id, name, createdAt: _createdAt, updatedAt: _updatedAt, ...loadout } = saved;
  return { loadout, named: { id, name } };
}

/** A shared Loadout as the Loadout it carries, and the name it was shared under, if it had one. */
export function openingOfShared(shared: SharedLoadout): Opening<{ name: string } | null> {
  const { name, ...loadout } = shared;
  return { loadout, named: name === undefined ? null : { name } };
}
