import { basename } from "node:path";
import { ExtractError } from "./errors.ts";
import type { Layer } from "./loadOrder.ts";
import { applyPatch } from "./patch.ts";
import type { XmlElement, XmlNode } from "./xml.ts";

/** One file read from a layer's archives. */
export interface LayerFile {
  /** The path inside its catalog, lowercased, with forward slashes. */
  path: string;
  /** Names the layer, catalog and file, for errors and the report. */
  source: string;
  root: XmlElement;
}

/** A layer's files: those from `ext_*` or base catalogs, and those from `subst_*` catalogs. */
export interface LayerFiles {
  layer: Layer;
  files: LayerFile[];
  subst: LayerFile[];
}

/**
 * What the merge did that rests on an assumed rule (#6), for the report.
 * Paths are game paths.
 */
export interface MergeLog {
  /** A library, index or text file without a `<diff>` root, merged into the earlier file. */
  merges: { path: string; source: string }[];
  /** An entry (`<tag> <id>`) defined again by a later file, which wins. */
  duplicates: { path: string; entry: string; earlier: string; later: string }[];
  /** A file replaced whole: a macro or component at a base-game path, or a subst catalog's copy. */
  replacements: { path: string; replaced: string; by: string }[];
  /** A `<diff>` file for a path no earlier layer has, so it patches nothing and is skipped. */
  orphanPatches: { path: string; source: string }[];
  /** A `<diff>` remove whose sel matched nothing: the node was already gone. */
  unmatchedRemovals: { path: string; source: string; sel: string }[];
}

export interface Merged {
  /** Game path (lowercased, forward slashes) → the merged file. */
  files: Map<string, XmlElement>;
  log: MergeLog;
}

/**
 * Merges the layers, in load order, into one file per game path. Within a
 * layer, files from `ext_*` (or base) catalogs go first, then `subst_*` ones.
 *
 * - A file with a `<diff>` root is passed to the patch step, or skipped
 *   (and logged) if no earlier layer has the file it patches.
 * - A library, index or text file is a collection: it's merged into the
 *   earlier file, and a duplicate id is won by the later definition.
 * - Any other file at a path that already has one (a macro or component at a
 *   base-game path) replaces it whole.
 * - A subst catalog's file replaces the file at its path whole.
 */
export function mergeLayers(layers: LayerFiles[]): Merged {
  const files = new Map<string, XmlElement>();
  // The last source to change each file, and the source of each collection entry.
  const fileSource = new Map<string, string>();
  const entrySource = new WeakMap<XmlElement, string>();
  const log: MergeLog = { merges: [], duplicates: [], replacements: [], orphanPatches: [], unmatchedRemovals: [] };

  const tagEntries = (root: XmlElement, source: string) => {
    for (const child of root.children) if (typeof child !== "string") entrySource.set(child, source);
  };
  const replace = (path: string, file: LayerFile) => {
    const replaced = fileSource.get(path);
    if (replaced !== undefined) log.replacements.push({ path, replaced, by: file.source });
    files.set(path, file.root);
    fileSource.set(path, file.source);
    tagEntries(file.root, file.source);
  };
  const merge = (path: string, earlier: XmlElement, file: LayerFile) => {
    if (file.root.tag !== earlier.tag) {
      throw new ExtractError(
        `${file.source} has a <${file.root.tag}> root, but the file it merges into has <${earlier.tag}>`,
      );
    }
    log.merges.push({ path, source: file.source });
    for (const { replaced, by } of mergeCollection(earlier, file.root)) {
      log.duplicates.push({
        path,
        entry: `${by.tag} ${by.attrs.id ?? by.attrs.name}`,
        earlier: entrySource.get(replaced) ?? fileSource.get(path)!,
        later: file.source,
      });
    }
    fileSource.set(path, file.source);
    tagEntries(file.root, file.source);
  };

  for (const layer of layers) {
    for (const file of layer.files) {
      const path = gamePath(layer.layer, file, files);
      const earlier = files.get(path);
      if (file.root.tag === "diff") {
        if (earlier === undefined) {
          log.orphanPatches.push({ path, source: file.source });
          continue;
        }
        const patched = applyPatch(earlier, file.root, file.source);
        files.set(path, patched.file);
        for (const sel of patched.unmatchedRemovals) log.unmatchedRemovals.push({ path, source: file.source, sel });
        fileSource.set(path, file.source);
      } else if (earlier && isCollection(path)) merge(path, earlier, file);
      else replace(path, file);
    }
    // A subst catalog's paths are relative to the game root, and nothing is merged into them.
    for (const file of layer.subst) replace(file.path, file);
  }
  return { files, log };
}

/** Library, index and text files gather entries from every layer. */
function isCollection(path: string): boolean {
  return /^(libraries|index|t)\//.test(path);
}

/**
 * Adds a collection file's entries to the earlier file's. An entry with the
 * same tag and id (or `name`, for entries without an id) as an earlier one
 * replaces it in place: the later definition wins. Returns those replacements.
 */
function mergeCollection(earlier: XmlElement, later: XmlElement): { replaced: XmlElement; by: XmlElement }[] {
  const replacements: { replaced: XmlElement; by: XmlElement }[] = [];
  const byKey = new Map<string, number>();
  earlier.children.forEach((child, i) => {
    const key = entryKey(child);
    if (key !== undefined && !byKey.has(key)) byKey.set(key, i);
  });
  for (const child of later.children) {
    const key = entryKey(child);
    const at = key === undefined ? undefined : byKey.get(key);
    if (at !== undefined) {
      replacements.push({ replaced: earlier.children[at] as XmlElement, by: child as XmlElement });
      earlier.children[at] = child;
    } else {
      if (key !== undefined) byKey.set(key, earlier.children.length);
      earlier.children.push(child);
    }
  }
  return replacements;
}

function entryKey(node: XmlNode): string | undefined {
  if (typeof node === "string") return undefined;
  const id = node.attrs.id ?? node.attrs.name;
  return id === undefined ? undefined : `${node.tag}\u0000${id}`;
}

/**
 * Where a file from an extension's `ext_*` catalog lands in the game. Library,
 * index and text files join the game's own; a path under `extensions/<folder>/`
 * targets that extension's file; any other file (a macro or component) at a
 * path the base game has is aimed at the base game's file, and otherwise stays
 * in the extension's own folder, where the index points to it.
 *
 * Another extension's library, index or text files were already merged into
 * the game's own, so a copy under `extensions/<folder>/` has nowhere to go:
 * that fails until a real case shows how the game handles it.
 */
function gamePath(layer: Layer, file: LayerFile, merged: ReadonlyMap<string, XmlElement>): string {
  const { path } = file;
  const override = /^extensions\/[^/]+\/(.*)$/.exec(path);
  if (override && isCollection(override[1]!)) {
    throw new ExtractError(
      `${file.source} overrides another extension's library, index or text file, which extraction doesn't handle yet`,
    );
  }
  if (!layer.folder || isCollection(path) || override || merged.has(path)) return path;
  return `extensions/${basename(layer.folder).toLowerCase()}/${path}`;
}
