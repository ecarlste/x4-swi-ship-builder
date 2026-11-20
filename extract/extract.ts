import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { openCatalog, type Catalog, type CatalogEntry } from "./catalog.ts";
import { extractConfig, type ExtractConfig } from "./config.ts";
import { resolveLoadOrder, type Layer } from "./loadOrder.ts";
import { mergeLayers, type LayerFile, type LayerFiles } from "./merge.ts";
import { isNeededFile } from "./neededFiles.ts";
import { renderReport } from "./report.ts";
import { fileToJson, parseXml } from "./xml.ts";

export interface ExtractOptions {
  /** The X4 install folder. */
  x4Dir: string;
  /** The gitignored folder the merged files and report are written to. */
  cacheDir: string;
  config?: ExtractConfig;
}

export interface ExtractResult {
  layers: { id: string; files: number; substFiles: number }[];
  /** How many merged game files were written. */
  files: number;
  reportPath: string;
}

/**
 * Stage 1: reads every layer's archives in load order, merges the layers
 * (see {@link mergeLayers}) and writes one JSON file per game path to
 * `<cacheDir>/files/`, at paths that mirror the game's (lowercased,
 * `.xml` → `.json`). `layers.json` records the load order and versions, and
 * `extract-report.md` lists the merges the maintainer should review.
 */
export function extract({ x4Dir, cacheDir, config = extractConfig }: ExtractOptions): ExtractResult {
  const order = resolveLoadOrder(x4Dir, config);

  for (const old of ["layers", "files", "layers.json", REPORT, MERGE_LOG]) {
    rmSync(join(cacheDir, old), { recursive: true, force: true });
  }

  const loadedFolders = new Set(order.layers.flatMap((l) => (l.folder ? [basename(l.folder).toLowerCase()] : [])));
  const layerFiles = order.layers.map((layer) => readLayer(layer, loadedFolders));
  const merged = mergeLayers(layerFiles, config.patchAllowlist);
  for (const [path, root] of [...merged.files].sort(([a], [b]) => (a < b ? -1 : 1))) {
    writeJson(join(cacheDir, "files", path.replace(/\.xml$/, ".json")), fileToJson(root));
  }
  writeFileSync(join(cacheDir, REPORT), renderReport(merged.log));
  // Kept so Stage 2 can re-render the report without merging again.
  writeJson(join(cacheDir, MERGE_LOG), merged.log);

  const layersJson = {
    x4: order.x4,
    swi: order.swi,
    layers: order.layers.map((layer) => ({
      id: layer.id,
      ...(layer.folder ? { folder: layer.folder.replaceAll("\\", "/") } : {}),
      version: layer.version,
      catalogs: layer.catalogPaths.map((p) => basename(p)),
    })),
  };
  writeJson(join(cacheDir, "layers.json"), layersJson);
  return {
    layers: layerFiles.map(({ layer, files, subst }) => ({ id: layer.id, files: files.length, substFiles: subst.length })),
    files: merged.files.size,
    reportPath: join(cacheDir, REPORT),
  };
}

const REPORT = "extract-report.md";
const MERGE_LOG = "merge-log.json";

interface Located {
  catalog: Catalog;
  entry: CatalogEntry;
}

/** Reads the needed files of one layer. Within a layer, a later catalog overrides an earlier one. */
function readLayer(layer: Layer, loadedFolders: ReadonlySet<string>): LayerFiles {
  // Lowercased path → where its latest copy is.
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
  return { layer, files: readFiles(layer, files, loadedFolders), subst: readFiles(layer, subst, loadedFolders) };
}

function readFiles(layer: Layer, files: Map<string, Located>, loadedFolders: ReadonlySet<string>): LayerFile[] {
  return [...files]
    .filter(([path]) => isNeededFile(path, loadedFolders))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([path, { catalog, entry }]) => {
      const source = `${layer.id} ${basename(catalog.catPath)}: ${entry.path}`;
      return { path, source, root: parseXml(catalog.read(entry).toString("utf8"), source) };
    });
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
