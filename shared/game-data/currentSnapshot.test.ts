import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SNAPSHOT_FILES, validateSnapshot, type RawSnapshot } from "./validateSnapshot.ts";

/**
 * The Game Data check: re-validates the extracted snapshot the app builds
 * from. Skipped when there is none, as in CI, which has no game files.
 * Outside CI the skip says so, so a checkout with no snapshot (a fresh
 * worktree, say) doesn't read as fully green.
 */
const current = join(import.meta.dirname, "../../game-data/current");
const hasSnapshot = existsSync(join(current, "manifest.json"));

if (!hasSnapshot && !process.env.CI) {
  // Straight to stderr: Vitest drops console output from a file whose tests all skip.
  process.stderr.write(`Game Data check skipped: no snapshot at ${current}. Run the extraction to check it.\n`);
}

describe.skipIf(!hasSnapshot)("Game Data check: game-data/current", () => {
  it("passes the Game Data schema and integrity pass", () => {
    const raw = Object.fromEntries(
      SNAPSHOT_FILES.map((file) => [file, JSON.parse(readFileSync(join(current, `${file}.json`), "utf8"))]),
    ) as RawSnapshot;

    expect(validateSnapshot(raw).errors).toEqual([]);
  });

  // Checked against the game's buy screen on 2026-11-21 (#112): each Seller names its own copy of a licence type.
  it("names the X-wing XJ-3/5's Licence as the Rebel Alliance's buy screen does", () => {
    const read = (file: string) => JSON.parse(readFileSync(join(current, `${file}.json`), "utf8"));
    const xwing = read("ships").find((s: { id: string }) => s.id === "t65xj3_xwing");
    const licence = read("licences").find(
      (l: { id: string; faction: string }) => l.id === xwing.licence && l.faction === "rebelalliance",
    );

    expect(licence?.name).toBe("Rebellion Advanced Ships Access");
  });
});
