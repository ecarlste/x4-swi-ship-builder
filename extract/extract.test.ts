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
  const report = () => readFileSync(join(cacheDir, "extract-report.md"), "utf8");
  return { result, cacheDir, readJson, report, exists: (path: string) => existsSync(join(cacheDir, path)) };
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
      { id: "x4", version: "700", catalogs: ["01.cat", "02.cat"] },
      {
        id: "fx_dlc_a",
        folder: "extensions/fx_dlc_a",
        version: "700",
        catalogs: ["ext_01.cat"],
      },
      {
        id: "fx_dlc_b",
        folder: "extensions/fx_dlc_b",
        version: "700",
        catalogs: ["ext_01.cat"],
      },
      {
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

    expect(readJson("files/libraries/wares.json")).toEqual({
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
    expect(readJson("files/t/0001-l044.json")).toEqual({
      language: { id: "44", page: [{ id: "1", t: [{ id: "1", "#text": "Hello & welcome" }] }] },
    });
  });

  it("converts only libraries, the macro and component index, ship and equipment assets, station module macros, and text", () => {
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
      "assets/structures/buildmodule/macros/fx_buildmodule_macro.xml",
      "t/0001.xml",
    ];
    const notNeeded = [
      "libraries/backup/ships.xml",
      "md/fx_script.xml",
      "aiscripts/fx_order.xml",
      "assets/environments/fx_rock.xml",
      "assets/structures/buildmodule/fx_buildmodule.xml",
      "assets/units/size_s/fx_ship.xmf",
      "t/0001-L049.xml",
      "index/mapdefaults.xml",
    ];
    spec.base["02"] = Object.fromEntries([...needed, ...notNeeded].map((path) => [path, "<x/>"]));

    const { exists, result } = run(spec);

    for (const path of needed) {
      expect(exists(`files/${path.toLowerCase().replace(/\.xml$/, ".json")}`), path).toBe(true);
    }
    for (const path of notNeeded) {
      expect(exists(`files/${path.toLowerCase().replace(/\.xml$/, ".json")}`), path).toBe(false);
    }
    expect(result.layers[0]).toEqual({ id: "x4", files: needed.length + 1, substFiles: 0 });
  });

  it("keeps SWI's overrides of files in its dependencies, but not of extensions outside the load order", () => {
    const spec = standardInstall();
    spec.extensions.fx_swi!.catalogs.ext_01 = {
      "extensions/fx_dlc_a/assets/units/size_s/macros/fx_a_macro.xml": "<macros/>",
      "extensions/fx_dlc_mini/assets/units/size_s/macros/fx_mini_macro.xml": "<macros/>",
    };

    const { exists } = run(spec);

    expect(exists("files/extensions/fx_dlc_a/assets/units/size_s/macros/fx_a_macro.json")).toBe(true);
    expect(exists("files/extensions/fx_dlc_mini/assets/units/size_s/macros/fx_mini_macro.json")).toBe(false);
  });

  it("keeps text exactly as written, dropping only whitespace between elements", () => {
    const spec = standardInstall();
    spec.base["01"] = { "t/0001.xml": `<language>\n  <page id="1">\n    <t id="1"> padded </t>\n  </page>\n</language>` };

    const { readJson } = run(spec);

    expect(readJson("files/t/0001.json")).toEqual({
      language: { page: [{ id: "1", t: [{ id: "1", "#text": " padded " }] }] },
    });
  });

  it("takes a file from the last catalog in a layer that holds it, matching paths case-insensitively", () => {
    const spec = standardInstall();
    spec.base["01"] = { "libraries/Wares.xml": `<wares from="01"/>` };
    spec.base["02"] = { "libraries/wares.xml": `<wares from="02"/>` };

    const { readJson } = run(spec);

    expect(readJson("files/libraries/wares.json")).toEqual({ wares: { from: "02" } });
  });

  it("fails, naming the archive and file, on XML that isn't well-formed", () => {
    const spec = standardInstall();
    spec.extensions.fx_dlc_b!.catalogs.ext_01 = { "libraries/ships.xml": "<ships><ship></ships>" };

    expect(() => run(spec)).toThrow(/ext_01\.cat: libraries\/ships\.xml isn't well-formed XML/);
  });

  it("keys an attribute as @name when a child element has the same name", () => {
    const spec = standardInstall();
    spec.base["01"] = { "libraries/ships.xml": `<ships><ship owner="a"><owner faction="b"/></ship></ships>` };

    const { readJson } = run(spec);

    expect(readJson("files/libraries/ships.json")).toEqual({
      ships: { ship: [{ "@owner": "a", owner: [{ faction: "b" }] }] },
    });
  });
});

describe("extract: merging layers", () => {
  it("merges a library file without a <diff> root into the earlier file", () => {
    const spec = standardInstall();
    spec.base["01"] = { "libraries/ships.xml": `<ships><ship id="s1"/></ships>` };
    spec.extensions.fx_dlc_a!.catalogs.ext_01 = { "libraries/ships.xml": `<ships><ship id="s2"/><ship id="s3"/></ships>` };

    const { readJson, report } = run(spec);

    expect(readJson("files/libraries/ships.json")).toEqual({
      ships: { ship: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] },
    });
    expect(report()).toContain(
      "| libraries/ships.xml | fx_dlc_a ext_01.cat: libraries/ships.xml |",
    );
  });

  it("keeps the later definition of a duplicate id or index name, in the earlier one's place", () => {
    const spec = standardInstall();
    spec.base["01"] = {
      "libraries/ships.xml": `<ships><ship id="s1" v="base"/><ship id="s2" v="base"/></ships>`,
      "index/macros.xml": `<index><entry name="m1" value="base"/></index>`,
    };
    spec.extensions.fx_dlc_a!.catalogs.ext_01 = {
      "libraries/ships.xml": `<ships><ship id="s1" v="a"/><ship id="s3" v="a"/></ships>`,
      "index/macros.xml": `<index><entry name="m1" value="a"/></index>`,
    };

    const { readJson, report } = run(spec);

    expect(readJson("files/libraries/ships.json")).toEqual({
      ships: { ship: [{ id: "s1", v: "a" }, { id: "s2", v: "base" }, { id: "s3", v: "a" }] },
    });
    expect(readJson("files/index/macros.json")).toEqual({ index: { entry: [{ name: "m1", value: "a" }] } });
    expect(report()).toContain(
      "| libraries/ships.xml | ship s1 | x4 01.cat: libraries/ships.xml | fx_dlc_a ext_01.cat: libraries/ships.xml |",
    );
    expect(report()).toContain(
      "| index/macros.xml | entry m1 | x4 01.cat: index/macros.xml | fx_dlc_a ext_01.cat: index/macros.xml |",
    );
  });

  it("replaces a macro or component file at a base-game path whole, and keeps new ones in the extension's folder", () => {
    const spec = standardInstall();
    spec.base["01"] = {
      "assets/props/Engines/macros/fx_engine_macro.xml": `<macros><macro name="fx_engine" v="base"/><macro name="fx_extra"/></macros>`,
      "assets/props/Engines/fx_engine.xml": `<components><component name="fx_engine" v="base"/></components>`,
    };
    spec.extensions.fx_dlc_a!.catalogs.ext_01 = {
      "assets/props/engines/macros/fx_engine_macro.xml": `<macros><macro name="fx_engine" v="a"/></macros>`,
      "assets/props/engines/fx_engine.xml": `<components><component name="fx_engine" v="a"/></components>`,
      "assets/props/engines/macros/fx_new_macro.xml": `<macros><macro name="fx_new"/></macros>`,
    };

    const { readJson, exists, report } = run(spec);

    expect(report()).toContain(
      "| assets/props/engines/macros/fx_engine_macro.xml | x4 01.cat: assets/props/Engines/macros/fx_engine_macro.xml | fx_dlc_a ext_01.cat: assets/props/engines/macros/fx_engine_macro.xml |",
    );
    expect(report()).not.toContain("fx_new_macro");
    expect(readJson("files/assets/props/engines/macros/fx_engine_macro.json")).toEqual({
      macros: { macro: [{ name: "fx_engine", v: "a" }] },
    });
    expect(readJson("files/assets/props/engines/fx_engine.json")).toEqual({
      components: { component: [{ name: "fx_engine", v: "a" }] },
    });
    expect(readJson("files/extensions/fx_dlc_a/assets/props/engines/macros/fx_new_macro.json")).toEqual({
      macros: { macro: [{ name: "fx_new" }] },
    });
    expect(exists("files/assets/props/engines/macros/fx_new_macro.json")).toBe(false);
  });

  it("replaces a file whole with a subst catalog's copy, taking the catalog that loads last", () => {
    const spec = standardInstall();
    spec.base["01"] = { "libraries/ships.xml": `<ships><ship id="s1"/></ships>` };
    spec.extensions.fx_dlc_a!.catalogs = {
      ext_01: { "libraries/ships.xml": `<ships><ship id="s2"/></ships>` },
      subst_01: { "libraries/ships.xml": `<ships><ship id="from_a"/></ships>` },
    };
    spec.extensions.fx_swi!.catalogs = {
      ext_01: {},
      subst_01: { "libraries/ships.xml": `<ships><ship id="from_swi_01"/></ships>` },
      subst_02: {
        "libraries/ships.xml": `<ships><ship id="from_swi_02"/></ships>`,
        "extensions/fx_dlc_a/assets/units/size_s/macros/fx_a_macro.xml": `<macros><macro name="fx_a" v="swi"/></macros>`,
      },
    };

    const { readJson, report } = run(spec);

    expect(readJson("files/libraries/ships.json")).toEqual({ ships: { ship: [{ id: "from_swi_02" }] } });
    expect(report()).toContain(
      "| libraries/ships.xml | fx_dlc_a ext_01.cat: libraries/ships.xml | fx_dlc_a subst_01.cat: libraries/ships.xml |",
    );
    expect(report()).toContain(
      "| libraries/ships.xml | fx_dlc_a subst_01.cat: libraries/ships.xml | FX SWI subst_02.cat: libraries/ships.xml |",
    );
    expect(readJson("files/extensions/fx_dlc_a/assets/units/size_s/macros/fx_a_macro.json")).toEqual({
      macros: { macro: [{ name: "fx_a", v: "swi" }] },
    });
  });

  it("merges an extension after the extensions it depends on, and SWI last", () => {
    const spec = standardInstall();
    // SWI declares fx_dlc_b first, but fx_dlc_b depends on fx_dlc_a.
    spec.extensions.fx_swi!.catalogs.ext_01 = { "libraries/ships.xml": `<ships><ship id="s2" v="swi"/></ships>` };
    spec.extensions.fx_dlc_b!.catalogs.ext_01 = {
      "libraries/ships.xml": `<ships><ship id="s1" v="b"/><ship id="s2" v="b"/></ships>`,
    };
    spec.extensions.fx_dlc_a!.catalogs.ext_01 = { "libraries/ships.xml": `<ships><ship id="s1" v="a"/></ships>` };

    const { readJson } = run(spec);

    expect(readJson("files/libraries/ships.json")).toEqual({
      ships: { ship: [{ id: "s1", v: "b" }, { id: "s2", v: "swi" }] },
    });
  });

  it("fails when a library file to merge has a different root element from the earlier file", () => {
    const spec = standardInstall();
    spec.base["01"] = { "libraries/ships.xml": `<ships/>` };
    spec.extensions.fx_dlc_a!.catalogs.ext_01 = { "libraries/ships.xml": `<macros><macro name="m"/></macros>` };

    expect(() => run(spec)).toThrow(
      /fx_dlc_a ext_01\.cat: libraries\/ships\.xml has a <macros> root, but the file it merges into has <ships>/,
    );
  });

  it("fails on an extension's copy of another extension's library, index or text file, which it can't place", () => {
    const spec = standardInstall();
    spec.extensions.fx_swi!.catalogs.ext_01 = { "extensions/fx_dlc_a/libraries/ships.xml": `<ships/>` };

    expect(() => run(spec)).toThrow(
      /FX SWI ext_01\.cat: extensions\/fx_dlc_a\/libraries\/ships\.xml overrides another extension's library, index or text file/,
    );
  });

  it("applies <diff> patches to the merged file, in load order", () => {
    const spec = standardInstall();
    spec.base["01"] = {
      "libraries/wares.xml": `<wares><ware id="w1" price="1"/></wares>`,
      "assets/props/engines/macros/fx_engine_macro.xml": `<macros><macro name="fx_engine"><thrust forward="1"/></macro></macros>`,
    };
    spec.extensions.fx_dlc_a!.catalogs.ext_01 = {
      "libraries/wares.xml": `<diff><add sel="/wares"><ware id="w2" price="2"/></add></diff>`,
    };
    spec.extensions.fx_dlc_b!.catalogs.ext_01 = {
      "libraries/wares.xml": `<diff><replace sel="/wares/ware[@id='w2']/@price">3</replace></diff>`,
    };
    spec.extensions.fx_swi!.catalogs.ext_01 = {
      "libraries/wares.xml": `<diff><remove sel="/wares/ware[@id='w1']"/></diff>`,
      "assets/props/Engines/macros/fx_engine_macro.xml": `<diff><replace sel="//thrust/@forward">5</replace></diff>`,
    };

    const { readJson } = run(spec);

    expect(readJson("files/libraries/wares.json")).toEqual({ wares: { ware: [{ id: "w2", price: "3" }] } });
    expect(readJson("files/assets/props/engines/macros/fx_engine_macro.json")).toEqual({
      macros: { macro: [{ name: "fx_engine", thrust: [{ forward: "5" }] }] },
    });
  });

  it("applies an extension's language-neutral t/0001.xml to the English text when it has no t/0001-l044.xml", () => {
    const spec = standardInstall();
    spec.base["01"] = { "t/0001-L044.xml": `<language id="44"><page id="1"><t id="1">Base</t></page></language>` };
    spec.extensions.fx_dlc_a!.catalogs.ext_01 = {
      "t/0001.xml": `<diff><add sel="/language"><page id="2"><t id="1">Neutral A</t></page></add></diff>`,
      "t/0001-L044.xml": `<diff><add sel="/language"><page id="3"><t id="1">English A</t></page></add></diff>`,
    };
    spec.extensions.fx_swi!.catalogs.ext_01 = {
      "t/0001.xml": `<diff><add sel="/language"><page id="4"><t id="1">Neutral SWI</t></page></add></diff>`,
    };

    const { readJson, exists } = run(spec);

    const pages = readJson("files/t/0001-l044.json").language.page.map((p: { id: string }) => p.id);
    expect(pages).toEqual(["1", "3", "4"]);
    expect(exists("files/t/0001.json")).toBe(false);
  });

  it("skips a <diff> for a file no earlier layer has, and lists it in the report", () => {
    const spec = standardInstall();
    spec.extensions.fx_swi!.catalogs.ext_01 = {
      "assets/fx/weaponfx/backup/fx_bullet.xml": `<diff><replace sel="//components"><components/></replace></diff>`,
    };

    const { exists, report } = run(spec);

    expect(exists("files/extensions/fx_swi/assets/fx/weaponfx/backup/fx_bullet.json")).toBe(false);
    expect(exists("files/assets/fx/weaponfx/backup/fx_bullet.json")).toBe(false);
    expect(report()).toContain(
      "| extensions/fx_swi/assets/fx/weaponfx/backup/fx_bullet.xml | FX SWI ext_01.cat: assets/fx/weaponfx/backup/fx_bullet.xml |",
    );
  });

  it("lists a <diff> remove whose sel matches nothing in the report", () => {
    const spec = standardInstall();
    spec.base["01"] = { "libraries/wares.xml": `<wares/>` };
    spec.extensions.fx_swi!.catalogs.ext_01 = {
      "libraries/wares.xml": `<diff><remove sel="/wares/ware[@id='gone']"/></diff>`,
    };

    const { report } = run(spec);

    expect(report()).toContain("| libraries/wares.xml | FX SWI ext_01.cat: libraries/wares.xml | /wares/ware[@id='gone'] |");
  });

  it("fails, naming the patch and selector, when a <diff> sel matches nothing", () => {
    const spec = standardInstall();
    spec.base["01"] = { "libraries/wares.xml": `<wares/>` };
    spec.extensions.fx_swi!.catalogs.ext_01 = {
      "libraries/wares.xml": `<diff><replace sel="/wares/ware[@id='gone']/@price">1</replace></diff>`,
    };

    expect(() => run(spec)).toThrow(
      `FX SWI ext_01.cat: libraries/wares.xml: sel "/wares/ware[@id='gone']/@price" matches nothing`,
    );
  });
});
