import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtractConfig } from "../config.ts";

/** Archive path → file contents. */
export type ArchiveFiles = Record<string, string>;

export interface FixtureExtension {
  /** The whole `content.xml`. */
  content: string;
  /** Catalog base name (`ext_01`, `subst_01`, ...) → its files. */
  catalogs: Record<string, ArchiveFiles>;
}

export interface FixtureInstallSpec {
  version: string;
  /** Base catalog number (`01`, `02`, ...) → its files. */
  base: Record<string, ArchiveFiles>;
  extensions: Record<string, FixtureExtension>;
}

/** Writes a cat/dat pair the way X4 lays them out. */
export function writeCatalog(dir: string, name: string, files: ArchiveFiles): void {
  mkdirSync(dir, { recursive: true });
  const lines: string[] = [];
  const bodies: Buffer[] = [];
  for (const [path, text] of Object.entries(files)) {
    const body = Buffer.from(text, "utf8");
    const md5 = body.length === 0 ? "0".repeat(32) : createHash("md5").update(body).digest("hex");
    lines.push(`${path} ${body.length} 1700000000 ${md5}`);
    bodies.push(body);
  }
  writeFileSync(join(dir, `${name}.cat`), lines.join("\n") + "\n");
  writeFileSync(join(dir, `${name}.dat`), Buffer.concat(bodies));
}

/** Writes a fake X4 install under a new temp directory and returns its path. */
export function writeInstall(spec: FixtureInstallSpec): string {
  const root = mkdtempSync(join(tmpdir(), "x4-install-"));
  writeFileSync(join(root, "version.dat"), spec.version);
  for (const [name, files] of Object.entries(spec.base)) writeCatalog(root, name, files);
  for (const [folder, ext] of Object.entries(spec.extensions)) {
    const dir = join(root, "extensions", folder);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "content.xml"), ext.content);
    for (const [name, files] of Object.entries(ext.catalogs)) writeCatalog(dir, name, files);
  }
  return root;
}

/** The config that matches {@link standardInstall}. */
export const fixtureConfig: ExtractConfig = {
  swiFolder: "fx_swi",
  expectedDependencies: ["fx_dlc_a", "fx_dlc_b"],
};

export function dlcContent(id: string, deps: string[] = []): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<content id="${id}" version="700" name="${id} name" enabled="1">
  <dependency version="600" />
${deps.map((d) => `  <dependency id="${d}" version="100" optional="true" />`).join("\n")}
</content>
`;
}

export function swiContent(deps: string[]): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<content id="FX SWI" name="FX SWI" description="Fixture Mod 1.2.3 HF" version="123" date="2026-01-02" enabled="0">
  <dependency version="700" />
${deps.map((d) => `  <dependency id="${d}" optional="false" name="${d} name"/>`).join("\n")}
</content>
`;
}

/**
 * A small install shaped like X4 + SWI, with no SWI content: two base
 * catalogs, two DLCs SWI depends on (declared out of load order), a DLC
 * and a stray mod it doesn't depend on, and a stand-in for SWI.
 */
export function standardInstall(): FixtureInstallSpec {
  return {
    version: "700",
    base: {
      "01": { "libraries/wares.xml": `<wares><ware id="w1"/></wares>` },
      "02": {},
    },
    extensions: {
      fx_dlc_a: { content: dlcContent("fx_dlc_a"), catalogs: { ext_01: {} } },
      fx_dlc_b: { content: dlcContent("fx_dlc_b", ["fx_dlc_a"]), catalogs: { ext_01: {} } },
      fx_dlc_mini: { content: dlcContent("fx_dlc_mini", ["fx_dlc_b"]), catalogs: { ext_01: {} } },
      stray_mod: { content: swiContent(["FX SWI"]), catalogs: { ext_01: {} } },
      fx_swi: { content: swiContent(["fx_dlc_b", "fx_dlc_a"]), catalogs: { ext_01: {}, subst_01: {} } },
    },
  };
}
