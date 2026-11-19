import type { Equipment, Faction, FitList, Licence, Manifest, Ship } from "./schema.ts";
import { snapshotSchema } from "./schema.ts";
import { checkIntegrity } from "./integrity.ts";

/** The six files of a snapshot, without the `.json` extension. */
export const SNAPSHOT_FILES = [
  "manifest",
  "ships",
  "equipment",
  "fit-lists",
  "factions",
  "licences",
] as const;
export type SnapshotFile = (typeof SNAPSHOT_FILES)[number];

/** A snapshot's parsed JSON files, not yet validated. */
export type RawSnapshot = Record<SnapshotFile, unknown>;

/** Validated Game Data. */
export interface GameData {
  manifest: Manifest;
  ships: Ship[];
  equipment: Equipment[];
  fitLists: FitList[];
  factions: Faction[];
  licences: Licence[];
}

export type ValidationResult =
  | { ok: true; gameData: GameData; errors: [] }
  | { ok: false; errors: string[] };

/**
 * Checks a snapshot against the Game Data schema, then runs the
 * reference-integrity pass. Every error found is returned, each prefixed
 * with the file it is in.
 */
export function validateSnapshot(raw: RawSnapshot): ValidationResult {
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }

  const data = parsed.data;
  const errors = checkIntegrity(data);
  if (errors.length > 0) return { ok: false, errors };

  const gameData: GameData = {
    manifest: data.manifest,
    ships: data.ships,
    equipment: data.equipment,
    fitLists: data["fit-lists"],
    factions: data.factions,
    licences: data.licences,
  };
  return { ok: true, gameData, errors: [] };
}
