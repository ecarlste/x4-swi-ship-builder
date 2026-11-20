import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileToJson, parseXml } from "../xml.ts";

/**
 * A small hand-made game world (no SWI content), as the merged game files
 * Stage 2 reads: wares, macros, components, factions, stations and text.
 * Tests describe Factions, stations and Ships, then write the world as a
 * fixture cache with {@link writeCache} (or put {@link FixtureWorld.files}
 * into a fixture install's archives).
 */
export class FixtureWorld {
  private factions: FactionSpec[] = [];
  private stations: StationSpec[] = [];
  private ships: ShipSpec[] = [];
  private extraText: { page: string; id: string; text: string }[] = [];
  /** Game path → extra XML files, written as given. */
  readonly extraFiles: Record<string, string> = {};

  faction(spec: FactionSpec): this {
    this.factions.push(spec);
    return this;
  }

  /** A station the faction runs, built from build modules for the given ship classes. */
  station(spec: StationSpec): this {
    this.stations.push(spec);
    return this;
  }

  ship(spec: ShipSpec): this {
    this.ships.push(spec);
    return this;
  }

  text(page: string, id: string, text: string): this {
    this.extraText.push({ page, id, text });
    return this;
  }

  /** Game path → XML text. */
  files(): Record<string, string> {
    const files: Record<string, string> = {};
    const macroIndex: [string, string][] = [];
    const componentIndex: [string, string][] = [];
    const text = new Map<string, Map<string, string>>();
    const addText = (page: string, id: string, value: string) => {
      if (!text.has(page)) text.set(page, new Map());
      text.get(page)!.set(id, value);
    };
    let textId = 0;
    const newText = (value: string) => {
      textId++;
      addText("900", String(textId), value);
      return `{900,${textId}}`;
    };

    // Factions and their licences.
    files["libraries/factions.xml"] = xml("factions", this.factions.map((f) => {
      const licences = (f.licences ?? []).map(
        (l) => `<licence type="${l.type}" name="${newText(l.name)}"${l.minrelation === undefined ? "" : ` minrelation="${l.minrelation}"`}/>`,
      );
      return `<faction id="${f.id}" name="${newText(f.name)}"><licences>${licences.join("")}</licences></faction>`;
    }));

    // Stations: god.xml → stations.xml → stationgroups.xml → constructionplans.xml → module macros.
    const god: string[] = [];
    const stationDefs: string[] = [];
    const groups: string[] = [];
    const plans: string[] = [];
    this.stations.forEach((s, i) => {
      const tag = s.tags ?? `fxstation${i}`;
      god.push(`<station id="god_${i}" owner="${s.faction}" race="argon"><station><select faction="${s.faction}" tags="[${tag}]"/></station></station>`);
      stationDefs.push(`<station id="def_${i}" group="group_${i}"><category tags="${tag}" faction="[${s.faction}]"/></station>`);
      groups.push(`<group name="group_${i}"><select constructionplan="plan_${i}"/></group>`);
      const entries = s.builds.map((classes, j) => {
        const name = `fx_buildmodule_${i}_${j}_macro`;
        const path = `assets/structures/buildmodule/macros/${name}`;
        macroIndex.push([name, path]);
        files[`${path}.xml`] = `<macros><macro name="${name}" class="buildmodule"><properties><builder classes="${classes}"/></properties></macro></macros>`;
        return `<entry index="${j + 1}" macro="${name}"/>`;
      });
      const habitat = "fx_habitat_macro";
      if (!macroIndex.some(([n]) => n === habitat)) {
        macroIndex.push([habitat, `assets/structures/habitat/macros/${habitat}`]);
        files[`assets/structures/habitat/macros/${habitat}.xml`] = `<macros><macro name="${habitat}" class="habitation"/></macros>`;
      }
      entries.push(`<entry index="${entries.length + 1}" macro="${habitat}"/>`);
      plans.push(`<plan id="plan_${i}">${entries.join("")}</plan>`);
    });
    files["libraries/god.xml"] = `<god><stations>${god.join("")}</stations></god>`;
    files["libraries/stations.xml"] = xml("stations", stationDefs);
    files["libraries/stationgroups.xml"] = xml("groups", groups);
    files["libraries/constructionplans.xml"] = xml("plans", plans);

    // Class defaults.
    files["libraries/defaults.xml"] = xml("defaults", Object.entries(CLASS_DEFAULTS).map(
      ([cls, d]) =>
        `<dataset class="${cls}"><properties><radar range="${d.radar}"/><people capacity="${d.crew}"/>` +
        `<storage countermeasure="${d.countermeasures}" deployable="${d.deployables}"/></properties></dataset>`,
    ));

    // Ships: ware → macro → component, and storage macros.
    const wares: string[] = [];
    for (const s of this.ships) {
      const size = s.size ?? "s";
      const macroName = s.macro ?? `${s.id}_macro`;
      const componentName = `${s.id}_component`;
      const nameRef = s.nameRef ?? newText(s.name ?? s.id);
      const price = s.price ?? { min: 80, average: 100, max: 120 };
      wares.push(
        `<ware id="${s.id}" name="${nameRef}" transport="ship" tags="${s.tags ?? "ship"}">` +
          `<price min="${price.min}" average="${price.average}" max="${price.max}"/>` +
          `<component ref="${macroName}" amount="1"/>` +
          (s.licence ? `<restriction licence="${s.licence}"/>` : "") +
          (s.owners ?? []).map((o) => `<owner faction="${o}"/>`).join("") +
          `</ware>`,
      );
      if (s.macro === undefined || s.writeMacro) {
        const macroPath = `assets/units/size_${size}/macros/${macroName}`;
        macroIndex.push([macroName, macroPath.replaceAll("/", "\\")]);
        const storageConnections = (s.storage ?? [{ capacity: 100, tags: "container" }]).map((st, k) => {
          const storageName = `${s.id}_storage_${k}_macro`;
          macroIndex.push([storageName, `assets/props/storagemodules/macros/${storageName}`]);
          files[`assets/props/storagemodules/macros/${storageName}.xml`] =
            `<macros><macro name="${storageName}" class="storage"><properties><cargo max="${st.capacity}" tags="${st.tags}"/></properties></macro></macros>`;
          return `<connection ref="con_storage_${k}"><macro ref="${storageName}" connection="ShipConnection"/></connection>`;
        });
        const p = s.properties ?? {};
        files[`${macroPath}.xml`] =
          `<macros><macro name="${macroName}" class="ship_${size}"><component ref="${componentName}"/><properties>` +
          `<identification name="${nameRef}"/>` +
          `<hull max="${p.hull ?? 3000}"/>` +
          `<purpose primary="${p.purpose ?? "fight"}"/>` +
          (p.crew === undefined ? "" : `<people capacity="${p.crew}"/>`) +
          `<storage ${Object.entries(p.storage ?? { missile: 4 }).map(([k, v]) => `${k}="${v}"`).join(" ")}/>` +
          `<physics mass="${p.mass ?? 10}">` +
          `<drag forward="1" reverse="2" horizontal="3" vertical="4" pitch="5" yaw="6" roll="7"/>` +
          (p.accfactors ? `<accfactors ${p.accfactors}/>` : "") +
          `</physics>` +
          (p.radar === undefined ? "" : `<radar range="${p.radar}"/>`) +
          (p.rotationspeed === undefined ? "" : `<rotationspeed max="${p.rotationspeed}"/>`) +
          `<thruster tags="small"/>` +
          `<ship type="${p.type ?? "fighter"}"/>` +
          `</properties><connections>${storageConnections.join("")}</connections></macro></macros>`;
        const componentPath = `assets/units/size_${size}/${componentName}`;
        componentIndex.push([componentName, componentPath.replaceAll("/", "\\")]);
        const connections = (s.slots ?? [{ name: "con_engine_01", tags: "engine small" }]).map(
          (c) => `<connection name="${c.name}" tags="${c.tags}"${c.group ? ` group="${c.group}"` : ""}/>`,
        );
        files[`${componentPath}.xml`] =
          `<components><component name="${componentName}" class="ship_${size}"><connections>` +
          `<connection name="container" tags="contents"/>${connections.join("")}` +
          `</connections></component></components>`;
      }
    }
    files["libraries/wares.xml"] = xml("wares", wares);
    files["index/macros.xml"] = xml("index", macroIndex.map(([n, v]) => `<entry name="${n}" value="${v}"/>`));
    files["index/components.xml"] = xml("index", componentIndex.map(([n, v]) => `<entry name="${n}" value="${v}"/>`));

    for (const t of this.extraText) addText(t.page, t.id, t.text);
    files["t/0001-l044.xml"] = `<language id="44">${[...text]
      .map(([page, ts]) => `<page id="${page}">${[...ts].map(([id, v]) => `<t id="${id}">${escape(v)}</t>`).join("")}</page>`)
      .join("")}</language>`;

    return { ...files, ...this.extraFiles };
  }
}

export interface FactionSpec {
  id: string;
  name: string;
  licences?: { type: string; name: string; minrelation?: string }[];
}

export interface StationSpec {
  faction: string;
  /** One build module per entry, each with its `<builder classes>`, e.g. "ship_s ship_m". */
  builds: string[];
  /** The station's tag in god.xml and stations.xml; made up if not given. */
  tags?: string;
}

export interface ShipSpec {
  id: string;
  name?: string;
  /** Use this text reference for the name instead of making one up. */
  nameRef?: string;
  size?: "s" | "m" | "l" | "xl";
  owners?: string[];
  tags?: string;
  licence?: string;
  price?: { min: number; average: number; max: number };
  /** Point the ware at this macro; no macro file is written unless writeMacro is set. */
  macro?: string;
  writeMacro?: boolean;
  properties?: {
    hull?: number;
    mass?: number;
    purpose?: string;
    type?: string;
    crew?: number;
    radar?: number;
    rotationspeed?: number;
    /** Attributes of `<storage>`, e.g. { missile: 4, unit: 10 }. */
    storage?: Record<string, number>;
    /** Attributes of `<accfactors>`, as written in XML. */
    accfactors?: string;
  };
  storage?: { capacity: number; tags: string }[];
  slots?: { name: string; tags: string; group?: string }[];
}

/** Class defaults the fixture's `libraries/defaults.xml` sets. */
export const CLASS_DEFAULTS = {
  ship_s: { radar: 20000, crew: 1, countermeasures: 8, deployables: 5 },
  ship_m: { radar: 30000, crew: 5, countermeasures: 16, deployables: 15 },
  ship_l: { radar: 40000, crew: 70, countermeasures: 25, deployables: 40 },
  ship_xl: { radar: 50000, crew: 100, countermeasures: 30, deployables: 60 },
};

/** The layers.json Stage 1 writes, for a fixture cache. */
export const FIXTURE_LAYERS = {
  x4: { version: "700" },
  swi: { id: "FX SWI", folder: "fx_swi", version: "123", label: "Fixture Mod 1.2.3 HF", date: "2026-01-02" },
  layers: [
    { id: "x4", version: "700", catalogs: ["01.cat"] },
    { id: "fx_dlc_a", folder: "extensions/fx_dlc_a", version: "710", catalogs: ["ext_01.cat"] },
    { id: "fx_dlc_b", folder: "extensions/fx_dlc_b", version: "720", catalogs: ["ext_01.cat"] },
    { id: "FX SWI", folder: "extensions/fx_swi", version: "123", catalogs: ["ext_01.cat"] },
  ],
};

/**
 * Writes the world as a Stage 1 cache under a new temp directory, the way
 * Stage 1 does: one JSON file per game path, `layers.json`, and an empty merge log.
 */
export function writeCache(world: FixtureWorld, layers: unknown = FIXTURE_LAYERS): string {
  const cacheDir = mkdtempSync(join(tmpdir(), "fixture-cache-"));
  for (const [path, text] of Object.entries(world.files())) {
    const out = join(cacheDir, "files", path.toLowerCase().replace(/\.xml$/, ".json"));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(fileToJson(parseXml(text, path))));
  }
  writeFileSync(join(cacheDir, "layers.json"), JSON.stringify(layers));
  writeFileSync(
    join(cacheDir, "merge-log.json"),
    JSON.stringify({ merges: [], duplicates: [], replacements: [], orphanPatches: [], unmatchedRemovals: [] }),
  );
  return cacheDir;
}

/** A world with one Faction running a wharf (S/M) and one buildable S Ship. */
export function oneShipWorld(): FixtureWorld {
  return new FixtureWorld()
    .faction({ id: "fx_guild", name: "Freight Guild", licences: [{ type: "generaluseship", name: "Guild Ship Licence", minrelation: "-0.01" }] })
    .station({ faction: "fx_guild", builds: ["ship_s ship_m"] })
    .ship({ id: "fx_fighter", name: "Fixture Fighter", owners: ["fx_guild"], licence: "generaluseship" });
}

function xml(root: string, children: string[]): string {
  return `<${root}>${children.join("")}</${root}>`;
}

function escape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}
