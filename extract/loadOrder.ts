import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtractConfig } from "./config.ts";
import { ExtractError } from "./errors.ts";
import { parseXml, type XmlElement } from "./xml.ts";

/** One source of game files, in load order: base X4 or an extension. */
export interface Layer {
  id: string;
  /** The extension's folder relative to the install, or none for base X4. */
  folder?: string;
  version: string;
  /** Absolute paths of the catalogs to read, in the order they override each other. */
  catalogPaths: string[];
}

export interface LoadOrder {
  x4: { version: string };
  swi: { id: string; folder: string; version: string; label: string; date: string };
  layers: Layer[];
}

interface ContentXml {
  id: string;
  version: string;
  description: string;
  date: string;
  /** Ids of the extensions it depends on (the game-version dependency has no id). */
  dependencies: string[];
}

/**
 * Works out which layers to read and in what order: base X4, then the DLCs
 * SWI's `content.xml` declares as dependencies (each after its own
 * dependencies, ties broken by id), then SWI. Nothing else in
 * `extensions/` is read. Fails if SWI's dependencies don't match the config.
 */
export function resolveLoadOrder(x4Dir: string, config: ExtractConfig): LoadOrder {
  const versionFile = join(x4Dir, "version.dat");
  if (!existsSync(versionFile)) {
    throw new ExtractError(`${x4Dir} doesn't look like an X4 install: it has no version.dat`);
  }
  const x4Version = readFileSync(versionFile, "utf8").trim();

  const swiFolder = join("extensions", config.swiFolder);
  if (!existsSync(join(x4Dir, swiFolder, "content.xml"))) {
    throw new ExtractError(`SWI isn't installed: ${join(x4Dir, swiFolder, "content.xml")} doesn't exist`);
  }
  const swi = readContentXml(x4Dir, swiFolder);
  checkDependencies(swi, config);

  const dlcs = new Map(swi.dependencies.map((id) => [id, readDependency(x4Dir, id)]));
  const ordered = dependencyOrder(dlcs);

  return {
    x4: { version: x4Version },
    swi: { id: swi.id, folder: config.swiFolder, version: swi.version, label: swi.description, date: swi.date },
    layers: [
      { id: "x4", version: x4Version, catalogPaths: baseCatalogs(x4Dir) },
      ...ordered.map((id) => extensionLayer(x4Dir, join("extensions", id), dlcs.get(id)!)),
      extensionLayer(x4Dir, swiFolder, swi),
    ],
  };
}

function checkDependencies(swi: ContentXml, config: ExtractConfig): void {
  const declared = new Set(swi.dependencies);
  const expected = new Set(config.expectedDependencies);
  const missing = [...expected].filter((id) => !declared.has(id));
  const unexpected = [...declared].filter((id) => !expected.has(id));
  if (missing.length === 0 && unexpected.length === 0) return;

  const problems = [
    ...(unexpected.length ? [`it now also depends on ${unexpected.join(", ")}`] : []),
    ...(missing.length ? [`it no longer depends on ${missing.join(", ")}`] : []),
  ];
  throw new ExtractError(
    `SWI's dependencies don't match the expected list in extract/config.ts: ${problems.join("; ")}. ` +
      `Update expectedDependencies on purpose if this is right.`,
  );
}

function readDependency(x4Dir: string, id: string): ContentXml {
  const folder = join("extensions", id);
  if (!existsSync(join(x4Dir, folder, "content.xml"))) {
    throw new ExtractError(`SWI depends on ${id}, but ${join(x4Dir, folder)} isn't installed`);
  }
  const content = readContentXml(x4Dir, folder);
  if (content.id !== id) {
    throw new ExtractError(`${join(folder, "content.xml")} has id "${content.id}", expected "${id}"`);
  }
  return content;
}

/** Orders extensions so each comes after the ones it depends on; ties go by id. */
function dependencyOrder(extensions: Map<string, ContentXml>): string[] {
  const ordered: string[] = [];
  const pending = new Set([...extensions.keys()].sort());
  while (pending.size > 0) {
    const next = [...pending].find((id) =>
      extensions.get(id)!.dependencies.every((dep) => !pending.has(dep)),
    );
    if (next === undefined) {
      throw new ExtractError(`SWI's dependencies depend on each other in a cycle: ${[...pending].join(", ")}`);
    }
    ordered.push(next);
    pending.delete(next);
  }
  return ordered;
}

function readContentXml(x4Dir: string, folder: string): ContentXml {
  const source = join(folder, "content.xml");
  const root = parseXml(readFileSync(join(x4Dir, source), "utf8"), source);
  const attr = (name: string) => root.attrs[name] ?? "";
  return {
    id: attr("id"),
    version: attr("version"),
    description: attr("description"),
    date: attr("date"),
    dependencies: root.children
      .filter((c): c is XmlElement => typeof c !== "string" && c.tag === "dependency")
      .map((c) => c.attrs.id)
      .filter((id): id is string => id !== undefined),
  };
}

/** `01.cat` upwards, stopping at the first missing number; later ones override earlier ones. */
function baseCatalogs(x4Dir: string): string[] {
  const paths: string[] = [];
  for (let n = 1; ; n++) {
    const path = join(x4Dir, `${String(n).padStart(2, "0")}.cat`);
    if (!existsSync(path)) break;
    paths.push(path);
  }
  if (paths.length === 0) throw new ExtractError(`${x4Dir} has no base catalogs (01.cat, 02.cat, ...)`);
  return paths;
}

/**
 * An extension's `ext_NN.cat` files, then its `subst_NN.cat` files, each in
 * number order. Signature catalogs are skipped; any other catalog is a kind
 * this pipeline doesn't handle yet, so it fails rather than guess.
 */
function extensionLayer(x4Dir: string, folder: string, content: ContentXml): Layer {
  const names = readdirSync(join(x4Dir, folder)).filter((n) => /\.cat$/i.test(n) && !/_sig\.cat$/i.test(n));
  const unknown = names.filter((n) => !/^(ext|subst)_\d+\.cat$/i.test(n));
  if (unknown.length > 0) {
    throw new ExtractError(`${folder} has catalogs extraction doesn't handle yet: ${unknown.join(", ")}`);
  }
  const byNumber = (prefix: string) =>
    names
      .filter((n) => n.toLowerCase().startsWith(prefix))
      .sort((a, b) => parseInt(a.slice(prefix.length), 10) - parseInt(b.slice(prefix.length), 10));
  return {
    id: content.id,
    folder,
    version: content.version,
    catalogPaths: [...byNumber("ext_"), ...byNumber("subst_")].map((n) => join(x4Dir, folder, n)),
  };
}
