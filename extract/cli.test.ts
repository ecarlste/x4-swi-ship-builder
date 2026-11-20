import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractConfig } from "./config.ts";
import { dlcContent, swiContent, writeInstall } from "./testing/fixtureInstall.ts";

const cli = join(import.meta.dirname, "cli.ts");

/** A fixture install whose ids match the real config, so the CLI's default config accepts it. */
function installMatchingConfig(): string {
  return writeInstall({
    version: "800",
    base: { "01": { "libraries/wares.xml": "<wares/>" } },
    extensions: {
      ...Object.fromEntries(
        extractConfig.expectedDependencies.map((id) => [id, { content: dlcContent(id), catalogs: { ext_01: {} } }]),
      ),
      [extractConfig.swiFolder]: { content: swiContent(extractConfig.expectedDependencies), catalogs: { ext_01: {} } },
    },
  });
}

function runCli(args: string[], env: Record<string, string> = {}) {
  const cacheDir = mkdtempSync(join(tmpdir(), "extract-cli-"));
  const { X4_INSTALL_DIR: _, npm_config_x4: __, ...cleanEnv } = process.env;
  const result = spawnSync(process.execPath, [cli, ...args, "--cache", cacheDir], {
    env: { ...cleanEnv, ...env },
    encoding: "utf8",
  });
  return { ...result, cacheDir };
}

describe("npm run extract", () => {
  it("fails with a clear message when no install path is given", () => {
    const { status, stderr } = runCli([]);

    expect(status).toBe(1);
    expect(stderr).toMatch(/No X4 install folder given\. Pass --x4 <path>, or set X4_INSTALL_DIR in \.env\./);
  });

  it("takes the install path from --x4", () => {
    const { status, stdout, cacheDir } = runCli(["--x4", installMatchingConfig()]);

    expect(status).toBe(0);
    expect(stdout).toMatch(/Merged 7 layers into 1 files in /);
    expect(existsSync(join(cacheDir, "files/libraries/wares.json"))).toBe(true);
    expect(existsSync(join(cacheDir, "extract-report.md"))).toBe(true);
  });

  it("takes the install path from X4_INSTALL_DIR", () => {
    const { status, cacheDir } = runCli([], { X4_INSTALL_DIR: installMatchingConfig() });

    expect(status).toBe(0);
    expect(existsSync(join(cacheDir, "layers.json"))).toBe(true);
  });

  it("prints an extraction failure without a stack trace", () => {
    const { status, stderr } = runCli(["--x4", mkdtempSync(join(tmpdir(), "not-x4-"))]);

    expect(status).toBe(1);
    expect(stderr).toMatch(/doesn't look like an X4 install/);
    expect(stderr).not.toMatch(/\n\s+at /);
  });
});

describe("npm run extract (through npm)", () => {
  it("takes the install path from `npm run extract --x4 <path>`, without `--`", () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "extract-npm-"));
    const { X4_INSTALL_DIR: _, npm_config_x4: __, ...env } = process.env;
    const result = spawnSync("npm", ["run", "extract", "--x4", installMatchingConfig(), "--", "--cache", cacheDir], {
      cwd: join(import.meta.dirname, ".."),
      env,
      encoding: "utf8",
    });

    expect(result.stderr).not.toMatch(/Extraction failed/);
    expect(result.status).toBe(0);
    expect(existsSync(join(cacheDir, "layers.json"))).toBe(true);
  });
});
