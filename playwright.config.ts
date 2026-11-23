import { defineConfig, devices } from "@playwright/test";
import { playwrightPort } from "./e2e/port.ts";

const port = playwrightPort(import.meta.dirname, process.env);
const outDir = ".cache/e2e-dist";

export default defineConfig({
  testDir: "e2e",
  // e2e/*.test.ts are Vitest unit tests of the e2e helpers.
  testMatch: "**/*.spec.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // A built app, not the dev server: in dev every page load has Vite transform each source module,
  // which under CPU contention (several worktrees' suites at once) ran tests past their timeout
  // (#155). The build goes to its own folder so it never replaces a real `dist/`. It starts with a
  // warning when the machine is under load, so a red run under contention reads as such (#164).
  webServer: {
    command: `node e2e/warn-load.ts && npx vite build --outDir ${outDir} --emptyOutDir --logLevel error && npx vite preview --outDir ${outDir} --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    // Never reuse: a server left up (an older build, or the screenshots' preview on this port)
    // would be tested in place of the code as it is now.
    reuseExistingServer: false,
    env: { GAME_DATA_DIR: "fixtures/game-data/tiny" },
  },
});
