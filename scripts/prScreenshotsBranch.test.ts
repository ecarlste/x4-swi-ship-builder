import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanEnv, repoRoot, run, tempDir } from "./testing/gitSandbox.ts";

/**
 * `node scripts/prScreenshots.ts publish|clean`, as the screenshots workflow
 * runs it: in a checkout of the PR, against a throwaway origin.
 */
describe("the pr-screenshots branch", () => {
  let tmp: string;
  let cleanup: () => void;
  let origin: string;
  let checkout: string;

  beforeEach(() => {
    ({ dir: tmp, cleanup } = tempDir());
    origin = join(tmp, "origin.git");
    checkout = join(tmp, "checkout");
    run("git", ["init", "-q", "--bare", "-b", "main", origin]);
    run("git", ["clone", "-q", origin, checkout]);
    writeFileSync(join(checkout, "README.md"), "app\n");
    run("git", ["add", "."], { cwd: checkout });
    run("git", ["commit", "-q", "-m", "first"], { cwd: checkout });
    run("git", ["push", "-q", "origin", "main"], { cwd: checkout });
  });
  afterEach(() => cleanup());

  /** A shots folder holding these files, each containing its own name. */
  function shots(name: string, files: string[]): string {
    const dir = join(tmp, name);
    mkdirSync(dir);
    for (const file of files) writeFileSync(join(dir, file), file);
    return dir;
  }

  function script(args: string[], env: Record<string, string>) {
    const result = spawnSync("node", [join(repoRoot, "scripts/prScreenshots.ts"), ...args], {
      cwd: checkout,
      encoding: "utf8",
      env: cleanEnv(env),
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  }

  const publish = (pr: number, headSha: string, dir: string) =>
    script(["publish", dir], { PR_NUMBER: String(pr), HEAD_SHA: headSha });
  const clean = (pr: number) => script(["clean"], { PR_NUMBER: String(pr) });

  const onBranch = (...args: string[]) => run("git", args, { cwd: origin });
  const branchFiles = () => onBranch("ls-tree", "-r", "--name-only", "pr-screenshots").split("\n").filter(Boolean);

  it("creates the branch with no history from main, holding the PR's screenshots under its head commit", () => {
    publish(150, "aaa111", shots("one", ["before-empty.png", "after-empty.png"]));

    expect(branchFiles()).toEqual(["pr-150/aaa111/after-empty.png", "pr-150/aaa111/before-empty.png"]);
    expect(onBranch("show", "pr-screenshots:pr-150/aaa111/before-empty.png")).toBe("before-empty.png");
    expect(onBranch("rev-list", "--count", "pr-screenshots")).toBe("1");
  });

  it("commits as the Actions bot", () => {
    publish(150, "aaa111", shots("one", ["after-empty.png"]));

    expect(onBranch("log", "-1", "--format=%an <%ae>|%cn <%ce>", "pr-screenshots")).toBe(
      "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>|" +
        "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
    );
  });

  it("replaces the PR's earlier screenshots on a new push, keeping other PRs'", () => {
    publish(150, "aaa111", shots("one", ["before-empty.png", "after-empty.png"]));
    publish(151, "ccc333", shots("other", ["after-empty.png"]));
    publish(150, "bbb222", shots("two", ["after-save-dialog.png"]));

    expect(branchFiles()).toEqual(["pr-150/bbb222/after-save-dialog.png", "pr-151/ccc333/after-empty.png"]);
    expect(onBranch("rev-list", "--count", "pr-screenshots")).toBe("3");
  });

  it("removes a closed PR's folder, keeping other PRs'", () => {
    publish(150, "aaa111", shots("one", ["after-empty.png"]));
    publish(151, "ccc333", shots("other", ["after-empty.png"]));
    clean(150);

    expect(branchFiles()).toEqual(["pr-151/ccc333/after-empty.png"]);
  });

  it("cleaning a PR that has no screenshots changes nothing", () => {
    clean(150);
    expect(onBranch("branch", "--list", "pr-screenshots")).toBe("");

    publish(151, "ccc333", shots("other", ["after-empty.png"]));
    clean(150);
    expect(onBranch("rev-list", "--count", "pr-screenshots")).toBe("1");
  });
});
