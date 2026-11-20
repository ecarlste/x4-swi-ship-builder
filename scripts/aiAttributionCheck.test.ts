import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanEnv, repoRoot, run, tempDir } from "./testing/gitSandbox.ts";

/** The check CI runs over a PR: `node scripts/aiAttribution.ts check <base> <head>`, in a throwaway repo. */
describe("AI attribution check", () => {
  let repo: string;
  let cleanup: () => void;
  let base: string;

  beforeEach(() => {
    ({ dir: repo, cleanup } = tempDir());
    run("git", ["init", "-q", "-b", "main", repo]);
    base = commit("Initial commit\n\nCo-authored-by: Claude <noreply@anthropic.com>");
  });
  afterEach(() => cleanup());

  function commit(message: string, env: Record<string, string> = {}): string {
    writeFileSync(join(repo, "file.txt"), String(Math.random()));
    run("git", ["add", "file.txt"], { cwd: repo });
    run("git", ["commit", "-q", "-m", message], { cwd: repo, env: cleanEnv(env) });
    return run("git", ["rev-parse", "HEAD"], { cwd: repo });
  }

  function check(prDescription = ""): { status: number | null; stderr: string } {
    const result = spawnSync("node", [join(repoRoot, "scripts/aiAttribution.ts"), "check", base, "HEAD"], {
      cwd: repo,
      encoding: "utf8",
      env: cleanEnv({ PR_DESCRIPTION: prDescription }),
    });
    return { status: result.status, stderr: result.stderr };
  }

  it("passes a clean PR, ignoring commits before its base", () => {
    commit("Fix it\n\nCo-authored-by: Ada Lovelace <ada@example.com>");
    expect(check("Closes #91.").status).toBe(0);
  });

  it("fails a PR whose commit has an AI co-author, naming the commit and the line", () => {
    const sha = commit("Fix it\n\nCo-authored-by: Claude <noreply@anthropic.com>");
    const { status, stderr } = check();
    expect(status).toBe(1);
    expect(stderr).toContain(`commit ${sha.slice(0, 12)}: Co-authored-by: Claude <noreply@anthropic.com>`);
  });

  it("fails a PR whose commit was authored by an AI tool", () => {
    const sha = commit("Fix it", { GIT_AUTHOR_EMAIL: "noreply@anthropic.com" });
    const { status, stderr } = check();
    expect(status).toBe(1);
    expect(stderr).toContain(`commit ${sha.slice(0, 12)}: author: noreply@anthropic.com`);
  });

  it("fails a PR whose description has an AI co-author", () => {
    commit("Fix it");
    const { status, stderr } = check("Summary.\n\nCo-authored-by: Claude <noreply@anthropic.com>");
    expect(status).toBe(1);
    expect(stderr).toContain("the PR description: Co-authored-by: Claude <noreply@anthropic.com>");
  });
});
