import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SNAPSHOT_FILES, validateSnapshot, type RawSnapshot } from "./validateSnapshot.ts";

/**
 * The Game Data check: re-validates the extracted snapshot the app builds
 * from. Skipped when there is none, as in CI, which has no game files.
 */
const current = join(import.meta.dirname, "../../game-data/current");

describe.skipIf(!existsSync(join(current, "manifest.json")))("Game Data check: game-data/current", () => {
  it("passes the Game Data schema and integrity pass", () => {
    const raw = Object.fromEntries(
      SNAPSHOT_FILES.map((file) => [file, JSON.parse(readFileSync(join(current, `${file}.json`), "utf8"))]),
    ) as RawSnapshot;

    expect(validateSnapshot(raw).errors).toEqual([]);
  });
});
