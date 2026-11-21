/**
 * Loadout Files (spec #25, decided in #9 and #24): one or more Saved
 * Loadouts in a pretty-printed `.json` envelope,
 * `{ "app": "x4-swi-ship-builder", "format": 1, "loadouts": [ … ] }`.
 *
 * Export and import carry Loadouts unchanged: there's no repair either way.
 * Import only adds, and a file is validated as a whole, so a bad file is
 * rejected in full and nothing from it is stored.
 */
import { z } from "zod";
import { LOADOUT_FORMAT, savedLoadoutSchema, type SavedLoadout } from "./loadout.ts";
import { addSavedLoadouts, type LoadoutStorage } from "./savedLoadouts.ts";

export const LOADOUT_FILE_APP = "x4-swi-ship-builder";

/** The largest Loadout File import accepts, in bytes. */
export const MAX_LOADOUT_FILE_BYTES = 5 * 1024 * 1024;

export const OVERSIZE_FILE_ERROR = "This file is over 5 MB, so it isn't imported.";
export const NEWER_FILE_FORMAT_ERROR = "This Loadout File was made by a newer version of the builder.";

const loadoutFileSchema = z.object({
  app: z.literal(LOADOUT_FILE_APP),
  format: z.literal(LOADOUT_FORMAT),
  loadouts: z.array(savedLoadoutSchema),
});

const isNewer = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  "format" in value &&
  typeof value.format === "number" &&
  value.format > LOADOUT_FORMAT;

/**
 * Validates a Loadout File's text as a whole: every Loadout in it is valid,
 * or the file is rejected.
 */
export function parseLoadoutFile(text: string): { ok: true; loadouts: SavedLoadout[] } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: "This isn't a Loadout File: it isn't JSON." };
  }
  // A newer format may mean anything, so it's rejected before the schema has a say.
  if (
    isNewer(value) ||
    (typeof value === "object" && value !== null && "loadouts" in value && Array.isArray(value.loadouts) && value.loadouts.some(isNewer))
  ) {
    return { ok: false, error: NEWER_FILE_FORMAT_ERROR };
  }
  const result = loadoutFileSchema.safeParse(value);
  return result.success
    ? { ok: true, loadouts: result.data.loadouts }
    : { ok: false, error: `This isn't a Loadout File: ${z.prettifyError(result.error)}` };
}

/** Serializes Saved Loadouts as a Loadout File's text. */
export function exportLoadoutFile(loadouts: SavedLoadout[]): string {
  return JSON.stringify({ app: LOADOUT_FILE_APP, format: LOADOUT_FORMAT, loadouts }, null, 2);
}

/**
 * Imports a picked Loadout File, adding its Loadouts after the stored ones.
 * A file over the size cap is rejected by its size, before it's read.
 */
export async function importLoadoutFile(
  storage: LoadoutStorage,
  file: Blob,
  options: { newId?: () => string } = {},
): Promise<{ ok: true; added: SavedLoadout[] } | { ok: false; error: string }> {
  if (file.size > MAX_LOADOUT_FILE_BYTES) return { ok: false, error: OVERSIZE_FILE_ERROR };
  const parsed = parseLoadoutFile(await file.text());
  if (!parsed.ok) return parsed;
  return addSavedLoadouts(storage, parsed.loadouts, options);
}
