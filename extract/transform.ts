import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Equipment, Faction, FitList, Licence, Manifest, Ship, Size, Price } from "../shared/game-data/schema.ts";
import { SNAPSHOT_FILES, validateSnapshot, type RawSnapshot } from "../shared/game-data/validateSnapshot.ts";
import { ExtractError } from "./errors.ts";
import { attr, child, children, numberAttr, GameFiles } from "./gameFiles.ts";
import type { MergeLog } from "./merge.ts";
import { diffSnapshots, renderDiff, type DiffableSnapshot } from "./diff.ts";
import { renderReport, table } from "./report.ts";
import { readEquipment } from "./equipment.ts";
import { readShips, type LeftOut } from "./ships.ts";
import { stationClasses } from "./stations.ts";
import { TextResolver } from "./text.ts";

export interface TransformOptions {
  /** The cache Stage 1 wrote. */
  cacheDir: string;
  /** The folder snapshots are written to, with its `current` pointer (the repo's `game-data/`). */
  gameDataDir: string;
  /** The extraction pipeline's git commit, for the manifest. */
  pipelineCommit: string;
  /** The extraction time, for the manifest; defaults to now. */
  now?: Date;
}

export interface TransformResult {
  snapshotDir: string;
  ships: Record<Size, number>;
  /** Equipment in the snapshot, and how many Equipment wares have a Seller before the "fits a buildable Ship" filter. */
  equipment: { included: number; withSeller: number };
  reportPath: string;
  /** `snapshot-diff.md`, beside the report: the diff against the snapshot `current` pointed at before. */
  diffPath: string;
}

/** What Stage 1 recorded in `layers.json`. */
interface LayersJson {
  x4: { version: string };
  swi: { id: string; version: string; label: string; date: string };
  layers: { id: string; version: string }[];
}

/**
 * Stage 2: reads the merged game files from the cache and writes a Game Data
 * snapshot to `<gameDataDir>/<swi-version>_x4-<x4-version>/`, then points
 * `<gameDataDir>/current` at it. The snapshot is validated by the shared
 * schema and integrity pass before anything is written. `extract-report.md`
 * in the cache gets the merge log plus every Ship left out and why, and
 * `snapshot-diff.md` beside it the Ships and Equipment added, removed and
 * changed since the snapshot `current` pointed at before.
 */
export function transform({ cacheDir, gameDataDir, pipelineCommit, now = new Date() }: TransformOptions): TransformResult {
  const layers = readJson<LayersJson>(join(cacheDir, "layers.json"), "Run the merge stage first.");
  const files = new GameFiles(cacheDir);
  const text = new TextResolver(files);

  const stations = stationClasses(files);
  const builders = new Map([...stations].map(([faction, classes]) => [faction, classes.build]));
  const { ships: shipsRead, fittings, leftOut, warnings } = readShips(files, text, builders);
  if (shipsRead.length === 0) throw new ExtractError("No buildable Ships found: no ware tagged ship has a Seller and no exclusion tag");

  const fitted = readEquipment(files, text, shipsRead, fittings, stations);
  if (fitted.equipment.length === 0) {
    throw new ExtractError("No Equipment found: no Equipment ware has a Seller and fits a buildable Ship");
  }
  warnings.push(...fitted.warnings);
  const { equipment } = fitted;

  const factions = readFactions(files, text, [...fitted.ships, ...equipment]);
  const ships = disambiguateNames(fitted.ships, factions).sort(byId);
  const licences = readLicences(files, [...ships, ...equipment], warnings);
  const crewPrice = readWarePrice(files, "crew");

  const content = {
    ships,
    equipment,
    "fit-lists": fitted.fitLists,
    factions,
    licences,
    "crew-price": crewPrice,
  };
  const manifest: Manifest = {
    swi: { version: layers.swi.version, label: releaseLabel(layers.swi.label), date: layers.swi.date },
    x4: { version: layers.x4.version },
    dlcs: layers.layers
      .filter((l) => l.id !== "x4" && l.id !== layers.swi.id)
      .map((l) => ({ id: l.id, version: l.version })),
    extractedAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    pipelineCommit,
    contentHash: contentHash(content),
  };
  const snapshot: RawSnapshot = { manifest, ...content };

  const validation = validateSnapshot(snapshot);
  if (!validation.ok) {
    throw new ExtractError(`The snapshot failed validation:\n${validation.errors.map((e) => `  ${e}`).join("\n")}`);
  }

  const current = join(gameDataDir, "current");
  const previous = readPrevious(current);

  const folder = `${manifest.swi.version}_x4-${manifest.x4.version}`;
  const snapshotDir = join(gameDataDir, folder);
  rmSync(snapshotDir, { recursive: true, force: true });
  mkdirSync(snapshotDir, { recursive: true });
  for (const file of SNAPSHOT_FILES) {
    writeFileSync(join(snapshotDir, `${file}.json`), JSON.stringify(snapshot[file], null, 2) + "\n");
  }
  if (existsSync(current) || isSymlink(current)) rmSync(current, { recursive: true, force: true });
  symlinkSync(folder, current, "dir");

  const reportPath = join(cacheDir, "extract-report.md");
  const mergeLog = existsSync(join(cacheDir, "merge-log.json"))
    ? readJson<MergeLog>(join(cacheDir, "merge-log.json"), "")
    : undefined;
  const capped = bindingRotationCaps(ships, equipment, fitted.fitLists);
  writeFileSync(reportPath, renderReport(mergeLog, transformReport(leftOut, fitted.leftOut, warnings, capped)));

  const next: DiffableSnapshot = { manifest, ships, equipment };
  const diffPath = join(cacheDir, "snapshot-diff.md");
  writeFileSync(diffPath, renderDiff(previous && diffSnapshots(previous, next), previous, next));

  const counts: Record<Size, number> = { s: 0, m: 0, l: 0, xl: 0 };
  for (const ship of ships) counts[ship.size]++;
  return {
    snapshotDir,
    ships: counts,
    equipment: { included: equipment.length, withSeller: fitted.withSeller },
    reportPath,
    diffPath,
  };
}

/**
 * The snapshot `current` points at, read before it is replaced: only what
 * the diff needs, so a snapshot from an older schema still diffs. Undefined
 * if there is none.
 */
function readPrevious(current: string): DiffableSnapshot | undefined {
  const read = (file: string) => JSON.parse(readFileSync(join(current, `${file}.json`), "utf8"));
  if (!existsSync(join(current, "manifest.json"))) return undefined;
  return { manifest: read("manifest"), ships: read("ships"), equipment: read("equipment") };
}

interface RotationCap {
  ship: string;
  max: number;
  /** Each thruster that would turn the Ship faster than `max`, with the axes it binds on and thrust / drag on each. */
  thrusters: { id: string; axes: { axis: string; speed: number }[] }[];
}

/**
 * Ships where `rotationspeed@max` would bind: for some thruster that fits
 * the Ship, thrust / drag on an axis is above it (#12). The stats engine
 * applies the cap as min(thrust / drag, max).
 */
function bindingRotationCaps(ships: Ship[], equipment: Equipment[], fitLists: FitList[]): RotationCap[] {
  const lists = new Map(fitLists.map((f) => [f.id, f.equipment]));
  const thrusters = new Map(
    equipment.flatMap((e) => (e.kind === "thruster" ? [[e.id, e] as const] : [])),
  );
  return ships.flatMap((ship) => {
    const max = ship.stats.maxRotationSpeed;
    if (max === null) return [];
    const binding = (lists.get(ship.thrusters) ?? []).flatMap((id) => {
      const thruster = thrusters.get(id);
      if (!thruster) return [];
      const axes = (["pitch", "yaw", "roll"] as const)
        .map((axis) => ({ axis, speed: thruster.thrust[axis] / ship.stats.drag[axis] }))
        .filter(({ speed }) => speed > max);
      return axes.length > 0 ? [{ id, axes }] : [];
    });
    return binding.length > 0 ? [{ ship: ship.id, max, thrusters: binding }] : [];
  });
}

/** "Star Wars 0.9.1 HF" → "0.9.1 HF": the release label from the first version number on. */
function releaseLabel(description: string): string {
  return /\d+(\.\d+)+.*$/.exec(description)?.[0].trim() ?? description;
}

/** A hash of everything but the manifest, so two extractions of the same data match. */
function contentHash(content: object): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(content)).digest("hex")}`;
}

/** The Factions that sell at least one Ship or piece of Equipment, with their English names. */
function readFactions(files: GameFiles, text: TextResolver, items: (Ship | Equipment)[]): Faction[] {
  const definitions = new Map(
    children(files.requireFile("libraries/factions.xml"), "faction").map((f) => [attr(f, "id"), f]),
  );
  const ids = [...new Set(items.flatMap((s) => s.sellers))].sort();
  return ids.map((id) => {
    const definition = definitions.get(id);
    const nameId = attr(definition, "name");
    if (!definition || nameId === undefined) {
      throw new ExtractError(`Faction "${id}" sells Ships or Equipment but libraries/factions.xml doesn't define it with a name`);
    }
    return { id, name: text.resolve(nameId, `faction ${id}`) };
  });
}

/**
 * The price of a ware that is neither a Ship nor Equipment, such as `crew`,
 * which Crew is bought as (ADR 0004). It is read from the merged files, so a
 * patch to it is picked up.
 */
function readWarePrice(files: GameFiles, id: string): Price {
  const ware = children(files.requireFile("libraries/wares.xml"), "ware").find((w) => attr(w, "id") === id);
  if (!ware) throw new ExtractError(`libraries/wares.xml has no ware "${id}"`);
  const price = child(ware, "price");
  const where = `ware ${id} <price>`;
  return {
    min: numberAttr(price, "min", where) ?? 0,
    average: numberAttr(price, "average", where) ?? 0,
    max: numberAttr(price, "max", where) ?? 0,
  };
}

/** Display names for the licence types, which the game only names per Faction. */
const LICENCE_NAMES: Record<string, string> = {
  generaluseship: "General Use Ship Licence",
  militaryship: "Military Ship Licence",
  capitalship: "Capital Ship Licence",
  generaluseequipment: "General Use Equipment Licence",
  militaryequipment: "Military Equipment Licence",
  capitalequipment: "Capital Equipment Licence",
};

/**
 * The Licences Ships and Equipment need. Each Faction defines its own copy of a licence
 * type, with its own name and `minrelation`, in libraries/factions.xml. The
 * reputation is given only when every Seller that defines the licence asks
 * for the same one; otherwise it is null, and listed as a warning.
 */
function readLicences(files: GameFiles, ships: (Ship | Equipment)[], warnings: string[]): Licence[] {
  const factions = new Map(
    children(files.requireFile("libraries/factions.xml"), "faction").map((f) => [attr(f, "id"), f]),
  );
  const types = [...new Set(ships.flatMap((s) => (s.licence === null ? [] : [s.licence])))].sort();
  return types.map((type) => {
    const sellers = [...new Set(ships.filter((s) => s.licence === type).flatMap((s) => s.sellers))].sort();
    const thresholds = new Map<number, string[]>();
    for (const seller of sellers) {
      const definition = children(child(factions.get(seller), "licences"), "licence").find((l) => attr(l, "type") === type);
      const relation = numberAttr(definition, "minrelation", `faction ${seller} licence ${type}`);
      if (relation === undefined) continue;
      const reputation = relationToReputation(relation);
      thresholds.set(reputation, [...(thresholds.get(reputation) ?? []), seller]);
    }
    let reputation: number | null = null;
    if (thresholds.size === 1) reputation = [...thresholds.keys()][0]!;
    else if (thresholds.size > 1) {
      const byValue = [...thresholds].map(([rep, fs]) => `${rep} (${fs.join(", ")})`).join("; ");
      warnings.push(`Licence ${type} needs a different reputation per Seller, so none is given: ${byValue}`);
    }
    return { id: type, name: LICENCE_NAMES[type] ?? type, reputation };
  });
}

/**
 * The game's reputation (shown from -30 to 30) for a relation (-1 to 1): it
 * is logarithmic, with 0.01 → 10, 0.1 → 20 and 1 → 30, and the same below 0.
 */
function relationToReputation(relation: number): number {
  const magnitude = Math.abs(relation);
  if (magnitude < 0.001) return 0;
  return Math.sign(relation) * Math.round(10 * Math.log10(magnitude * 1000));
}

/**
 * Where Ships share a display name, adds the Sellers that tell each apart,
 * e.g. "Venator-class Star Destroyer (Hutt Cartel)". Fails if the names
 * still collide.
 */
function disambiguateNames(ships: Ship[], factions: Faction[]): Ship[] {
  const factionNames = new Map(factions.map((f) => [f.id, f.name]));
  const byName = new Map<string, Ship[]>();
  for (const ship of ships) byName.set(ship.name, [...(byName.get(ship.name) ?? []), ship]);

  const named = ships.map((ship) => {
    const group = byName.get(ship.name)!;
    if (group.length === 1) return ship;
    const shared = group.map((s) => new Set(s.sellers)).reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
    const distinguishing = ship.sellers.filter((s) => !shared.has(s)).map((s) => factionNames.get(s) ?? s);
    return distinguishing.length === 0 ? ship : { ...ship, name: `${ship.name} (${distinguishing.join(", ")})` };
  });

  const seen = new Map<string, string[]>();
  for (const ship of named) seen.set(ship.name, [...(seen.get(ship.name) ?? []), ship.id]);
  const clashes = [...seen].filter(([, ids]) => ids.length > 1);
  if (clashes.length > 0) {
    throw new ExtractError(
      `Sellers don't tell these Ships apart: ${clashes.map(([name, ids]) => `"${name}" (${ids.join(", ")})`).join("; ")}`,
    );
  }
  return named;
}

function transformReport(
  shipsLeftOut: LeftOut[],
  equipmentLeftOut: LeftOut[],
  warnings: string[],
  rotationCaps: RotationCap[],
): string[] {
  const leftOutTable = (leftOut: LeftOut[]) =>
    table(
      ["Ware", "Reason"],
      [...leftOut].sort((a, b) => (a.ware < b.ware ? -1 : 1)).map((l) => [l.ware, l.reason]),
    );
  return [
    "## Ships left out",
    "",
    ...leftOutTable(shipsLeftOut),
    "## Equipment left out",
    "",
    ...leftOutTable(equipmentLeftOut),
    "## Ships where rotationspeed@max binds",
    "",
    "Turning is min(thrust / drag, `rotationspeed@max`). These Ships turn slower than thrust / drag with the thrusters listed.",
    "",
    ...table(
      ["Ship", "rotationspeed@max", "thrust / drag above it"],
      rotationCaps.map((c) => [
        c.ship,
        String(c.max),
        c.thrusters.map((t) => `${t.id}: ${t.axes.map((a) => `${a.axis} ${round(a.speed)}`).join(", ")}`).join("; "),
      ]),
    ),
    "## Warnings",
    "",
    ...(warnings.length === 0 ? ["None.", ""] : [...warnings.map((w) => `- ${w}`), ""]),
  ];
}

const round = (n: number) => String(Math.round(n * 1000) / 1000);

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function readJson<T>(path: string, hint: string): T {
  if (!existsSync(path)) throw new ExtractError(`${path} doesn't exist. ${hint}`.trim());
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
