import { defineConfig, devices } from "@playwright/test";
import { playwrightPort } from "./e2e/port.ts";

const port = playwrightPort(import.meta.dirname, process.env);

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
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    env: { GAME_DATA_DIR: "fixtures/game-data/tiny" },
  },
});
