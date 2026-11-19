import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { openCatalog, type Catalog, type CatalogEntry } from "./catalog.ts";
import { extractConfig, type ExtractConfig } from "./config.ts";
import { resolveLoadOrder, type Layer } from "./loadOrder.ts";
import { isNeededFile } from "./neededFiles.ts";
import { parseXml, toJson } from "./xml.ts";

export interface ExtractOptions {
  /** The X4 install folder. */
  x4Dir: string;
  /** The gitignored folder the layers are written to. */
  cacheDir: string;
  config?: ExtractConfig;
}

export interface ExtractResult {
  layers: { id: string; files: number; substFiles: number }[];
}

/**
 * Stage 1, first half: reads every layer's archives in load order and writes
 * the files later stages need to `<cacheDir>/layers/<NN>_<layer>/`, as JSON at
 * paths that mirror the game's (lowercased, `.xml` → `.json`). Files from
 * `ext_*` or base catalogs go under `files/`, files from `subst_*` catalogs
 * under `subst/`. `layers.json` records the load order and versions.
 * Layers aren't merged yet.
 */
export function extract({ x4Dir, cacheDir, config = extractConfig }: ExtractOptions): ExtractResult {
  const order = resolveLoadOrder(x4Dir, config);

  rmSync(join(cacheDir, "layers"), { recursive: true, force: true });
  rmSync(join(cacheDir, "layers.json"), { force: true });

  const loadedFolders = new Set(order.layers.flatMap((l) => (l.folder ? [basename(l.folder).toLowerCase()] : [])));
  const layerDirs = order.layers.map((layer, i) => `layers/${String(i).padStart(2, "0")}_${dirName(layer)}`);
  const result: ExtractResult = {
    layers: order.layers.map((layer, i) => {
      const counts = writeLayer(layer, join(cacheDir, layerDirs[i]!), loadedFolders);
      return { id: layer.id, ...counts };
    }),
  };

  const layersJson = {
    x4: order.x4,
    swi: order.swi,
    layers: order.layers.map((layer, i) => ({
      dir: layerDirs[i],
      id: layer.id,
      ...(layer.folder ? { folder: layer.folder.replaceAll("\\", "/") } : {}),
      version: layer.version,
      catalogs: layer.catalogPaths.map((p) => basename(p)),
    })),
  };
  writeJson(join(cacheDir, "layers.json"), layersJson);
  return result;
}

function dirName(layer: Layer): string {
  return layer.folder ? basename(layer.folder) : layer.id;
}

interface Located {
  catalog: Catalog;
  entry: CatalogEntry;
}

function writeLayer(
  layer: Layer,
  outDir: string,
  loadedFolders: ReadonlySet<string>,
): { files: number; substFiles: number } {
  // Lowercased path → where its latest copy is. A later catalog overrides an earlier one.
  const files = new Map<string, Located>();
  const subst = new Map<string, Located>();
  for (const catPath of layer.catalogPaths) {
    const catalog = openCatalog(catPath);
    const target = /^subst_/i.test(basename(catPath)) ? subst : files;
    for (const entry of catalog.entries) {
      const key = entry.path.toLowerCase().replaceAll("\\", "/");
      if (entry.deleted) target.delete(key);
      else target.set(key, { catalog, entry });
    }
  }
  return {
    files: writeFiles(files, join(outDir, "files"), loadedFolders),
    substFiles: writeFiles(subst, join(outDir, "subst"), loadedFolders),
  };
}

function writeFiles(files: Map<string, Located>, outDir: string, loadedFolders: ReadonlySet<string>): number {
  let count = 0;
  for (const [path, { catalog, entry }] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!isNeededFile(path, loadedFolders)) continue;
    const source = `${basename(catalog.catPath)}: ${entry.path}`;
    const root = parseXml(catalog.read(entry).toString("utf8"), source);
    writeJson(join(outDir, path.replace(/\.xml$/, ".json")), { [root.tag]: toJson(root) });
    count++;
  }
  return count;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
