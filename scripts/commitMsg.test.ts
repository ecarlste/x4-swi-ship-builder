import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installHooks, run, tempDir } from "./testing/gitSandbox.ts";

/** The tracked commit-msg hook, run by git in a throwaway repo. */
describe("commit-msg hook", () => {
  let repo: string;
  let cleanup: () => void;

  beforeEach(() => {
    ({ dir: repo, cleanup } = tempDir());
    run("git", ["init", "-q", "-b", "91-ticket", repo]);
    installHooks(repo);
  });
  afterEach(() => cleanup());

  function commit(message: string): string {
    writeFileSync(join(repo, "file.txt"), String(Math.random()));
    run("git", ["add", "file.txt"], { cwd: repo });
    run("git", ["commit", "-q", "-m", message], { cwd: repo });
    return run("git", ["log", "--format=%B", "-1"], { cwd: repo });
  }

  it("removes a Claude co-author and keeps a human one, subject and body untouched", () => {
    const message = [
      "Tooling: strip AI attribution",
      "",
      "Why it matters.",
      "",
      "Co-authored-by: Ada Lovelace <ada@example.com>",
      "Co-authored-by: Claude <noreply@anthropic.com>",
    ].join("\n");

    expect(commit(message)).toBe(
      ["Tooling: strip AI attribution", "", "Why it matters.", "", "Co-authored-by: Ada Lovelace <ada@example.com>"].join(
        "\n",
      ),
    );
  });

  it("leaves a message with no AI trailer alone", () => {
    expect(commit("Docs: fix a typo\n\nBody.")).toBe("Docs: fix a typo\n\nBody.");
  });
});
