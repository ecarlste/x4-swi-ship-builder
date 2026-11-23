import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { availableParallelism, loadavg } from "node:os";
import { resolve } from "node:path";
import { loadWarning } from "./machine-load.ts";

/**
 * Warns when the machine is under load. It runs as the first step of
 * Playwright's webServer command rather than as a `globalSetup`: Playwright
 * starts the webServer first, and under contention the build is what most
 * often times out, so a `globalSetup` would print too late or not at all, and
 * its load reading would count this run's own build. Never fails the run.
 */
try {
  const warning = loadWarning({
    load: loadavg()[0],
    cores: availableParallelism(),
    env: process.env,
    // The real path, since `ps` shows the path node resolved and the checkout may sit under a symlink.
    checkout: realpathSync(resolve(import.meta.dirname, "..")),
    processList: () => execFileSync("ps", ["-eo", "args"], { encoding: "utf8", timeout: 2000 }),
  });
  // stderr: Playwright shows the webServer's stderr by default, its stdout only when debugging.
  if (warning) console.error(`⚠ ${warning}`);
} catch {
  // Information only: a failure to sample the load never stops the suite.
}
