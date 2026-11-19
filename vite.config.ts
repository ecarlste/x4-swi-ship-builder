import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * The snapshot the app bundles. GAME_DATA_DIR is read at build time; it
 * defaults to the extracted `game-data/current`, or to the tiny fixture
 * snapshot when running under Vitest.
 */
const gameDataDir = resolve(
  import.meta.dirname,
  process.env.GAME_DATA_DIR ??
    (process.env.VITEST ? "fixtures/game-data/tiny" : "game-data/current"),
);

if (!existsSync(join(gameDataDir, "manifest.json"))) {
  throw new Error(
    `No Game Data snapshot at ${gameDataDir}. Run the extraction, or set GAME_DATA_DIR ` +
      `to a snapshot folder (e.g. GAME_DATA_DIR=fixtures/game-data/tiny).`,
  );
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@snapshot": gameDataDir },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "shared/**/*.test.ts", "extract/**/*.test.ts"],
  },
});
