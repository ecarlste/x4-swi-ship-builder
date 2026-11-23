import { execFileSync } from "node:child_process";
import { availableParallelism, loadavg } from "node:os";
import { resolve } from "node:path";
import { loadWarning } from "./load.ts";

/** Warns, before any test runs, when the machine is under load. Never fails the run. */
export default function globalSetup(): void {
  try {
    const warning = loadWarning({
      load: loadavg()[0],
      cores: availableParallelism(),
      env: process.env,
      checkout: resolve(import.meta.dirname, ".."),
      processList: () => execFileSync("ps", ["-eo", "args"], { encoding: "utf8", timeout: 2000 }),
    });
    if (warning) console.warn(`⚠ ${warning}`);
  } catch {
    // Information only: a failure to sample the load never stops the suite.
  }
}
