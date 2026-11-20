import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The repo root, where the scripts and hooks under test live. */
export const repoRoot = join(import.meta.dirname, "../..");

/**
 * The environment the scripts run in: this process's, without the GIT_*
 * variables a surrounding git command (a hook, say) may have set, and with
 * an author so commits work on a machine with no git identity.
 */
export function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return {
    ...env,
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.com",
    ...extra,
  };
}

/** Runs a command and returns its trimmed stdout; throws on a non-zero exit. */
export function run(command: string, args: string[], options: ExecFileSyncOptions = {}): string {
  return execFileSync(command, args, { encoding: "utf8", stdio: "pipe", env: cleanEnv(), ...options })
    .toString()
    .trim();
}

/** A fresh temp folder, removed by the returned cleanup. */
export function tempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "x4-swi-scripts-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
