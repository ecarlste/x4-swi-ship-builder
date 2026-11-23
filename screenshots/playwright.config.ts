import { defineConfig, devices } from "@playwright/test";
import { playwrightPort } from "../e2e/port.ts";

/**
 * Takes the PR screenshots (#150): `screenshots/shots.spec.ts` against a built
 * app, served by `vite preview`. Not a test, and not part of `npm test`.
 *
 * - `SHOTS_DIST`: the build to serve (absolute, or relative to the repo root).
 * - `SHOTS_PHASE`: `before` (the PR's base) or `after` (its head).
 * - `SHOTS_OUT`: the folder the PNGs are written to.
 */

const root = new URL("..", import.meta.url).pathname;
const port = playwrightPort(root, process.env);

export default defineConfig({
  testDir: ".",
  testMatch: "shots.spec.ts",
  retries: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: `npx vite preview --outDir "${process.env.SHOTS_DIST ?? "dist"}" --port ${port} --strictPort`,
    cwd: root,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    // vite.config.ts needs a snapshot to load, though preview only serves the built files.
    env: { GAME_DATA_DIR: "fixtures/game-data/tiny" },
  },
});
