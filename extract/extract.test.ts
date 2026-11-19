import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extract } from "./extract.ts";
import { fixtureConfig, swiContent, standardInstall, writeInstall, type FixtureInstallSpec } from "./testing/fixtureInstall.ts";

function run(spec: FixtureInstallSpec = standardInstall()) {
  const x4Dir = writeInstall(spec);
  const cacheDir = mkdtempSync(join(tmpdir(), "extract-cache-"));
  const result = extract({ x4Dir, cacheDir, config: fixtureConfig });
  const readJson = (path: string) => JSON.parse(readFileSync(join(cacheDir, path), "utf8"));
  return { result, cacheDir, readJson, exists: (path: string) => existsSync(join(cacheDir, path)) };
}

describe("extract: load order", () => {
  it("reads base X4, then SWI's dependencies in dependency order, then SWI", () => {
    const { readJson } = run();

    const layers = readJson("layers.json");
    expect(layers.x4).toEqual({ version: "700" });
    expect(layers.swi).toEqual({
      id: "FX SWI",
      folder: "fx_swi",
      version: "123",
      label: "Fixture Mod 1.2.3 HF",
      date: "2026-01-02",
    });
    expect(layers.layers).toEqual([
      { dir: "layers/00_x4", id: "x4", version: "700", catalogs: ["01.cat", "02.cat"] },
      {
        dir: "layers/01_fx_dlc_a",
        id: "fx_dlc_a",
        folder: "extensions/fx_dlc_a",
        version: "700",
        catalogs: ["ext_01.cat"],
      },
      {
        dir: "layers/02_fx_dlc_b",
        id: "fx_dlc_b",
        folder: "extensions/fx_dlc_b",
        version: "700",
        catalogs: ["ext_01.cat"],
      },
      {
        dir: "layers/03_fx_swi",
        id: "FX SWI",
        folder: "extensions/fx_swi",
        version: "123",
        catalogs: ["ext_01.cat", "subst_01.cat"],
      },
    ]);
  });
});

describe("extract: dependency check", () => {
  function withModDependencies(deps: string[]): FixtureInstallSpec {
    const spec = standardInstall();
    spec.extensions.fx_swi!.content = swiContent(deps);
    return spec;
  }

  it("fails, naming the new dependency, when SWI depends on one the config doesn't expect", () => {
    expect(() => run(withModDependencies(["fx_dlc_a", "fx_dlc_b", "fx_dlc_mini"]))).toThrow(
      /dependencies don't match.*now also depends on fx_dlc_mini/,
    );
  });

  it("fails, naming the dropped dependency, when SWI no longer depends on one the config expects", () => {
    expect(() => run(withModDependencies(["fx_dlc_b"]))).toThrow(
      /dependencies don't match.*no longer depends on fx_dlc_a/,
    );
  });

  it("fails when a dependency isn't installed", () => {
    const spec = standardInstall();
    delete spec.extensions.fx_dlc_a;

    expect(() => run(spec)).toThrow(/depends on fx_dlc_a, but .*extensions\/fx_dlc_a isn't installed/);
  });

  it("fails when SWI isn't installed", () => {
    const spec = standardInstall();
    delete spec.extensions.fx_swi;

    expect(() => run(spec)).toThrow(/SWI isn't installed/);
  });
});

describe("extract: layer files", () => {
  it("writes each needed XML file as JSON at a lowercased path mirroring the game's", () => {
    const spec = standardInstall();
    spec.base["01"] = {
      "libraries/wares.xml": `<?xml version="1.0" encoding="utf-8"?>
<!-- a comment -->
<wares>
  <ware id="w1" name="{20101,1}">
    <price min="1" average="2" max="3"/>
    <owner faction="fx_a"/>
    <owner faction="fx_b"/>
  </ware>
  <ware id="w2"/>
</wares>`,
      "t/0001-L044.xml": `<language id="44"><page id="1"><t id="1">Hello &amp; welcome</t></page></language>`,
    };

    const { readJson } = run(spec);

    expect(readJson("layers/00_x4/files/libraries/wares.json")).toEqual({
      wares: {
        ware: [
          {
            id: "w1",
            name: "{20101,1}",
            price: [{ min: "1", average: "2", max: "3" }],
            owner: [{ faction: "fx_a" }, { faction: "fx_b" }],
          },
          { id: "w2" },
        ],
      },
    });
    expect(readJson("layers/00_x4/files/t/0001-l044.json")).toEqual({
      language: { id: "44", page: [{ id: "1", t: [{ id: "1", "#text": "Hello & welcome" }] }] },
    });
  });

  it("converts only libraries, the macro and component index, ship and equipment assets, and text", () => {
    const spec = standardInstall();
    const needed = [
      "libraries/ships.xml",
      "index/macros.xml",
      "index/components.xml",
      "assets/units/size_s/macros/fx_ship_macro.xml",
      "assets/units/size_s/fx_ship.xml",
      "assets/props/Engines/macros/fx_engine_macro.xml",
      "assets/fx/weaponFx/macros/fx_bullet_macro.xml",
      "assets/wares/macros/fx_satellite_macro.xml",
      "t/0001.xml",
      "extensions/fx_dlc_a/libraries/wares.xml",
    ];
    const notNeeded = [
      "libraries/backup/ships.xml",
      "md/fx_script.xml",
      "aiscripts/fx_order.xml",
      "assets/environments/fx_rock.xml",
      "assets/units/size_s/fx_ship.xmf",
      "t/0001-L049.xml",
      "index/mapdefaults.xml",
    ];
    spec.extensions.fx_swi!.catalogs.ext_01 = Object.fromEntries(
      [...needed, ...notNeeded].map((path) => [path, "<x/>"]),
    );

    const { exists, result } = run(spec);

    for (const path of needed) {
      expect(exists(`layers/03_fx_swi/files/${path.toLowerCase().replace(/\.xml$/, ".json")}`), path).toBe(true);
    }
    for (const path of notNeeded) {
      expect(exists(`layers/03_fx_swi/files/${path.toLowerCase().replace(/\.xml$/, ".json")}`), path).toBe(false);
    }
    expect(result.layers.at(-1)).toEqual({ id: "FX SWI", files: needed.length, substFiles: 0 });
  });

  it("keeps SWI's overrides of files in its dependencies, but not of extensions outside the load order", () => {
    const spec = standardInstall();
    spec.extensions.fx_swi!.catalogs.ext_01 = {
      "extensions/fx_dlc_a/libraries/wares.xml": "<wares/>",
      "extensions/fx_dlc_mini/libraries/wares.xml": "<wares/>",
    };

    const { exists } = run(spec);

    expect(exists("layers/03_fx_swi/files/extensions/fx_dlc_a/libraries/wares.json")).toBe(true);
    expect(exists("layers/03_fx_swi/files/extensions/fx_dlc_mini/libraries/wares.json")).toBe(false);
  });

  it("keeps text exactly as written, dropping only whitespace between elements", () => {
    const spec = standardInstall();
    spec.base["01"] = { "t/0001.xml": `<language>\n  <page id="1">\n    <t id="1"> padded </t>\n  </page>\n</language>` };

    const { readJson } = run(spec);

    expect(readJson("layers/00_x4/files/t/0001.json")).toEqual({
      language: { page: [{ id: "1", t: [{ id: "1", "#text": " padded " }] }] },
    });
  });

  it("takes a file from the last catalog in a layer that holds it, matching paths case-insensitively", () => {
    const spec = standardInstall();
    spec.base["01"] = { "libraries/Wares.xml": `<wares from="01"/>` };
    spec.base["02"] = { "libraries/wares.xml": `<wares from="02"/>` };

    const { readJson } = run(spec);

    expect(readJson("layers/00_x4/files/libraries/wares.json")).toEqual({ wares: { from: "02" } });
  });

  it("keeps subst catalog files apart from ext catalog files", () => {
    const spec = standardInstall();
    spec.extensions.fx_swi!.catalogs = {
      ext_01: { "libraries/wares.xml": `<diff from="ext"/>` },
      subst_01: { "libraries/wares.xml": `<wares from="subst"/>` },
    };

    const { readJson } = run(spec);

    expect(readJson("layers/03_fx_swi/files/libraries/wares.json")).toEqual({ diff: { from: "ext" } });
    expect(readJson("layers/03_fx_swi/subst/libraries/wares.json")).toEqual({ wares: { from: "subst" } });
  });

  it("fails, naming the archive and file, on XML that isn't well-formed", () => {
    const spec = standardInstall();
    spec.extensions.fx_dlc_b!.catalogs.ext_01 = { "libraries/ships.xml": "<ships><ship></ships>" };

    expect(() => run(spec)).toThrow(/ext_01\.cat: libraries\/ships\.xml isn't well-formed XML/);
  });

  it("keeps a diff file's operations, and what each one adds, in document order", () => {
    const spec = standardInstall();
    spec.extensions.fx_swi!.catalogs.ext_01 = {
      "libraries/wares.xml": `<?xml version="1.0" encoding="utf-8"?>
<diff>
  <remove sel="//ware[@id='w1']"/>
  <add sel="/wares">
    <ware id="w1"><price max="9"/><owner faction="fx_a"/></ware>
    <comment-free id="x"/>
    <ware id="w3"/>
  </add>
  <replace sel="//ware[@id='w3']/@name">New name</replace>
  <remove sel="//ware[@id='w2']" silent="true"/>
</diff>`,
    };

    const { readJson } = run(spec);

    expect(readJson("layers/03_fx_swi/files/libraries/wares.json")).toEqual({
      diff: {
        "#children": [
          { remove: { sel: "//ware[@id='w1']" } },
          {
            add: {
              sel: "/wares",
              "#children": [
                { ware: { id: "w1", price: [{ max: "9" }], owner: [{ faction: "fx_a" }] } },
                { "comment-free": { id: "x" } },
                { ware: { id: "w3" } },
              ],
            },
          },
          { replace: { sel: "//ware[@id='w3']/@name", "#text": "New name" } },
          { remove: { sel: "//ware[@id='w2']", silent: "true" } },
        ],
      },
    });
  });

  it("keys an attribute as @name when a child element has the same name", () => {
    const spec = standardInstall();
    spec.base["01"] = { "libraries/ships.xml": `<ships><ship owner="a"><owner faction="b"/></ship></ships>` };

    const { readJson } = run(spec);

    expect(readJson("layers/00_x4/files/libraries/ships.json")).toEqual({
      ships: { ship: [{ "@owner": "a", owner: [{ faction: "b" }] }] },
    });
  });
});
