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
  const worktree = () => join(tmp, "x4-swi-ship-builder-76");

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

  it("prints the path to open the session in", () => {
    expect(newWorktree("76", "ticket-worktrees")).toContain(realpathSync(main).replace(/x4-swi-ship-builder$/, "x4-swi-ship-builder-76"));
  });

  it("still makes the worktree when the main checkout has no extraction, and says so", () => {
    const output = newWorktree("76", "ticket-worktrees");

    expect(git(worktree(), "branch", "--show-current")).toBe("76-ticket-worktrees");
    expect(output).toMatch(/no game-data/i);
  });

  it("works when run from another worktree", () => {
    newWorktree("76", "ticket-worktrees");

    run("bash", ["scripts/new-worktree.sh", "77", "next"], { cwd: worktree(), env });

    expect(git(join(tmp, "x4-swi-ship-builder-77"), "branch", "--show-current")).toBe("77-next");
  });

  it("refuses without an issue number and a slug", () => {
    expect(() => newWorktree("76")).toThrow(/usage/i);
    expect(() => newWorktree("ticket", "worktrees")).toThrow(/usage/i);
  });
});
