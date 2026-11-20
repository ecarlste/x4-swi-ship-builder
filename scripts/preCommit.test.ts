import { cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanEnv, repoRoot, run, tempDir } from "./testing/gitSandbox.ts";

/** The tracked pre-commit hook, run by git in a throwaway repo. */
describe("pre-commit hook", () => {
  let repo: string;
  let cleanup: () => void;

  beforeEach(() => {
    ({ dir: repo, cleanup } = tempDir());
    run("git", ["init", "-q", "-b", "main", repo]);
    cpSync(join(repoRoot, ".githooks"), join(repo, ".githooks"), { recursive: true });
    run("git", ["config", "core.hooksPath", ".githooks"], { cwd: repo });
  });
  afterEach(() => cleanup());

  function commit(env: Record<string, string> = {}): string {
    writeFileSync(join(repo, "file.txt"), String(Math.random()));
    run("git", ["add", "file.txt"], { cwd: repo });
    run("git", ["commit", "-q", "-m", "change"], { cwd: repo, env: cleanEnv(env) });
    return run("git", ["log", "--format=%s", "-1"], { cwd: repo });
  }

  it("refuses a commit on main", () => {
    expect(() => commit()).toThrow(/main/);
  });

  it("lets a deliberate commit on main through with ALLOW_MAIN_COMMIT=1", () => {
    expect(commit({ ALLOW_MAIN_COMMIT: "1" })).toBe("change");
  });

  it("allows a commit on any other branch", () => {
    run("git", ["switch", "-q", "-c", "76-ticket"], { cwd: repo });
    expect(commit()).toBe("change");
  });
});
