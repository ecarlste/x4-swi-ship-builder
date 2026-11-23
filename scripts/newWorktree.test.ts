import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanEnv, repoRoot, run, tempDir } from "./testing/gitSandbox.ts";

/**
 * `scripts/new-worktree.sh`, run end to end against a throwaway origin and
 * main checkout. `npm` is a stub on PATH that logs where it ran and with what.
 */
describe("new-worktree.sh", () => {
  let tmp: string;
  let cleanup: () => void;
  let main: string;
  let npmLog: string;
  let env: NodeJS.ProcessEnv;
  /** Where the script puts issue N's worktree: beside the main checkout. */
  const worktreeFor = (issue: number) => join(tmp, `x4-swi-ship-builder-${issue}`);
  const worktree = () => worktreeFor(76);

  beforeEach(() => {
    ({ dir: tmp, cleanup } = tempDir());
    const origin = join(tmp, "origin.git");
    main = join(tmp, "x4-swi-ship-builder");
    run("git", ["init", "-q", "--bare", "-b", "main", origin]);
    run("git", ["clone", "-q", origin, main]);
    cpSync(join(repoRoot, "scripts/new-worktree.sh"), join(main, "scripts/new-worktree.sh"));
    git(main, "add", ".");
    git(main, "commit", "-q", "-m", "first");
    git(main, "push", "-q", "origin", "main");

    const bin = join(tmp, "bin");
    npmLog = join(tmp, "npm.log");
    mkdirSync(bin);
    writeFileSync(join(bin, "npm"), `#!/bin/sh\necho "$PWD $*" >> "${npmLog}"\n`);
    chmodSync(join(bin, "npm"), 0o755);
    env = cleanEnv({ PATH: `${bin}:${process.env.PATH}` });
  });
  afterEach(() => cleanup());

  function git(cwd: string, ...args: string[]): string {
    return run("git", args, { cwd });
  }

  function newWorktree(...args: string[]): string {
    return run("bash", ["scripts/new-worktree.sh", ...args], { cwd: main, env });
  }

  /** The extracted snapshot and cache a main checkout has after `npm run extract`. */
  function extractInMain(): void {
    mkdirSync(join(main, "game-data/091_x4-800"), { recursive: true });
    writeFileSync(join(main, "game-data/091_x4-800/manifest.json"), "{}");
    symlinkSync("091_x4-800", join(main, "game-data/current"));
    mkdirSync(join(main, ".cache/extract/files/libraries"), { recursive: true });
    writeFileSync(join(main, ".cache/extract/files/libraries/wares.json"), "{}");
    writeFileSync(join(main, ".cache/extract/layers.json"), "{}");
    writeFileSync(join(main, ".cache/extract/merge-log.json"), "[]");
    writeFileSync(join(main, ".cache/extract/extract-report.md"), "main's report");
  }

  it("branches <N>-<slug> from a freshly fetched origin/main, not the main checkout's HEAD", () => {
    // origin moves on after the main checkout last fetched…
    const other = join(tmp, "other");
    run("git", ["clone", "-q", join(tmp, "origin.git"), other]);
    git(other, "commit", "-q", "--allow-empty", "-m", "on origin");
    git(other, "push", "-q", "origin", "main");
    // …and the main checkout has a local commit origin doesn't.
    git(main, "commit", "-q", "--allow-empty", "-m", "local only");

    newWorktree("76", "ticket-worktrees");

    expect(git(worktree(), "branch", "--show-current")).toBe("76-ticket-worktrees");
    expect(git(worktree(), "log", "--format=%s", "-1")).toBe("on origin");
  });

  it("branches from origin/<base> when given a base branch, and runs npm ci once", () => {
    const other = join(tmp, "other");
    run("git", ["clone", "-q", join(tmp, "origin.git"), other]);
    git(other, "switch", "-q", "-c", "integration");
    git(other, "commit", "-q", "--allow-empty", "-m", "on integration");
    git(other, "push", "-q", "origin", "integration");

    newWorktree("76", "ticket-worktrees", "integration");

    expect(git(worktree(), "branch", "--show-current")).toBe("76-ticket-worktrees");
    expect(git(worktree(), "log", "--format=%s", "-1")).toBe("on integration");
    expect(readFileSync(npmLog, "utf8").trim()).toBe(`${realpathSync(worktree())} ci`);
  });

  it("refuses a base branch origin doesn't have, before making a worktree", () => {
    expect(() => newWorktree("76", "ticket-worktrees", "no-such-branch")).toThrow(/origin has no branch no-such-branch/);
    // A revision, not a branch: it would cut from a commit that isn't a tip.
    git(main, "commit", "-q", "--allow-empty", "-m", "second");
    git(main, "push", "-q", "origin", "main");
    expect(() => newWorktree("76", "ticket-worktrees", "main~1")).toThrow(/origin has no branch main~1/);

    expect(existsSync(worktree())).toBe(false);
    expect(git(main, "branch", "--list", "76-ticket-worktrees")).toBe("");
    expect(existsSync(npmLog)).toBe(false);
  });

  it("runs npm ci in the new worktree", () => {
    newWorktree("76", "ticket-worktrees");

    expect(readFileSync(npmLog, "utf8").trim()).toBe(`${realpathSync(worktree())} ci`);
  });

  it("gives the worktree its own copy of game-data", () => {
    extractInMain();

    newWorktree("76", "ticket-worktrees");

    const gameData = join(worktree(), "game-data");
    expect(lstatSync(gameData).isSymbolicLink()).toBe(false);
    expect(lstatSync(join(gameData, "091_x4-800")).isSymbolicLink()).toBe(false);
    expect(readlinkSync(join(gameData, "current"))).toBe("091_x4-800");
    expect(existsSync(join(gameData, "current/manifest.json"))).toBe(true);
  });

  it("links the merged files cache, and keeps the rest of .cache/extract its own", () => {
    extractInMain();

    newWorktree("76", "ticket-worktrees");

    const cache = join(worktree(), ".cache/extract");
    expect(lstatSync(cache).isSymbolicLink()).toBe(false);
    expect(readlinkSync(join(cache, "files"))).toBe(join(realpathSync(main), ".cache/extract/files"));
    expect(existsSync(join(cache, "files/libraries/wares.json"))).toBe(true);
    // Stage 2 (`--transform-only`) reads these beside the files.
    expect(lstatSync(join(cache, "layers.json")).isFile()).toBe(true);
    expect(lstatSync(join(cache, "merge-log.json")).isFile()).toBe(true);
    // The report and diff are the worktree's own outputs.
    expect(existsSync(join(cache, "extract-report.md"))).toBe(false);
  });

  it("gives the worktree its own copy of the main checkout's .env", () => {
    writeFileSync(join(main, ".env"), "X4_INSTALL_DIR=/games/x4\n");

    newWorktree("76", "ticket-worktrees");

    const dotEnv = join(worktree(), ".env");
    expect(lstatSync(dotEnv).isFile()).toBe(true);
    expect(readFileSync(dotEnv, "utf8")).toBe("X4_INSTALL_DIR=/games/x4\n");
  });

  it("still makes the worktree, with no .env, when the main checkout has none", () => {
    newWorktree("76", "ticket-worktrees");

    expect(git(worktree(), "branch", "--show-current")).toBe("76-ticket-worktrees");
    expect(existsSync(join(worktree(), ".env"))).toBe(false);
  });

  it("prints the path to open the session in", () => {
    expect(newWorktree("76", "ticket-worktrees")).toContain(realpathSync(worktree()));
  });

  it("still makes the worktree when the main checkout has no extraction, and says so", () => {
    const output = newWorktree("76", "ticket-worktrees");

    expect(git(worktree(), "branch", "--show-current")).toBe("76-ticket-worktrees");
    expect(output).toMatch(/no game-data/i);
  });

  it("works when run from another worktree", () => {
    newWorktree("76", "ticket-worktrees");

    run("bash", ["scripts/new-worktree.sh", "77", "next"], { cwd: worktree(), env });

    expect(git(worktreeFor(77), "branch", "--show-current")).toBe("77-next");
  });

  it("refuses without an issue number and a slug", () => {
    expect(() => newWorktree("76")).toThrow(/usage/i);
    expect(() => newWorktree("ticket", "worktrees")).toThrow(/usage/i);
  });
});
