import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repoRoot, tempDir } from "./testing/gitSandbox.ts";

/** The check CI runs: `node scripts/e2eLocators.ts [dir]`, from the repo root. */
function check(dir?: string): { status: number | null; stderr: string } {
  const args = [join(repoRoot, "scripts/e2eLocators.ts"), ...(dir === undefined ? [] : [dir])];
  const result = spawnSync("node", args, { cwd: repoRoot, encoding: "utf8" });
  return { status: result.status, stderr: result.stderr };
}

describe("e2e locator check", () => {
  let dir: string;
  let cleanup: () => void;

  beforeEach(() => ({ dir, cleanup } = tempDir()));
  afterEach(() => cleanup());

  it("passes the repo's own e2e/", () => {
    expect(check()).toEqual({ status: 0, stderr: "" });
  });

  it("fails on a markup locator in a nested .ts file, naming its file and line", () => {
    mkdirSync(join(dir, "nested"));
    writeFileSync(join(dir, "clean.spec.ts"), 'await page.getByRole("button", { name: "Save" }).click();\n');
    writeFileSync(join(dir, "nested", "bad.spec.ts"), '\n\nawait page.locator(".slot-row").click();\n');
    writeFileSync(join(dir, "notes.md"), 'page.locator(".ignored")\n');

    const { status, stderr } = check(dir);
    expect(status).toBe(1);
    expect(stderr).toContain(`${join(dir, "nested", "bad.spec.ts")}:3: await page.locator(".slot-row").click();`);
    expect(stderr).not.toContain("clean.spec.ts");
    expect(stderr).not.toContain("notes.md");
  });
});
