import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExtractError } from "./errors.ts";
import { isNeededFile } from "./neededFiles.ts";
import type { JsonElement } from "./xml.ts";

/** The first `<tag>` child of an element, if any. */
export function child(element: JsonElement | undefined, tag: string): JsonElement | undefined {
  return children(element, tag)[0];
}

/** Every `<tag>` child of an element, in document order. */
export function children(element: JsonElement | undefined, tag: string): JsonElement[] {
  const value = element?.[tag];
  return Array.isArray(value) ? value : [];
}

/** An attribute of an element (keyed `@name` when a child shares its name; see `toJson`). */
export function attr(element: JsonElement | undefined, name: string): string | undefined {
  if (!element) return undefined;
  const at = element[`@${name}`];
  if (typeof at === "string") return at;
  const value = element[name];
  return typeof value === "string" ? value : undefined;
}

/** A numeric attribute; undefined when missing, and an error naming `where` when not a number. */
export function numberAttr(element: JsonElement | undefined, name: string, where: string): number | undefined {
  const value = attr(element, name);
  if (value === undefined) return undefined;
  const n = Number(value);
  if (value.trim() === "" || !Number.isFinite(n)) {
    throw new ExtractError(`${where}: ${name}="${value}" isn't a number`);
  }
  return n;
}

/** Splits a list attribute such as `"[argon, paranid]"`, `"argon"` or `"ship_s ship_m"`. */
export function list(value: string | undefined): string[] {
  if (value === undefined) return [];
  return value
    .replace(/^\s*\[|\]\s*$/g, "")
    .split(/[\s,]+/)
    .filter((v) => v !== "");
}

/** A macro or component found through the index, with the game path it came from. */
export interface Indexed {
  name: string;
  path: string;
  element: JsonElement;
}

/**
 * Read access to the merged game files Stage 1 left in the cache: one JSON
 * file per game path under `<cacheDir>/files/`. Macros and components are
 * found through `index/macros.xml` and `index/components.xml`; a reference
 * that doesn't resolve is a hard failure.
 */
export class GameFiles {
  private readonly cache = new Map<string, JsonElement | undefined>();
  private macroIndex?: Map<string, string>;
  private componentIndex?: Map<string, string>;

  private readonly cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
  }

  /** The root element of a game file (path as in the game, e.g. `libraries/wares.xml`), if it exists. */
  file(path: string): JsonElement | undefined {
    const key = path.toLowerCase().replaceAll("\\", "/").replace(/\.xml$/, "");
    if (!this.cache.has(key)) {
      const jsonPath = join(this.cacheDir, "files", `${key}.json`);
      const root = existsSync(jsonPath)
        ? (Object.values(JSON.parse(readFileSync(jsonPath, "utf8")) as Record<string, JsonElement>)[0] ?? {})
        : undefined;
      this.cache.set(key, root);
    }
    return this.cache.get(key);
  }

  /** The root element of a game file that must exist. */
  requireFile(path: string): JsonElement {
    const root = this.file(path);
    if (!root) throw new ExtractError(`The cache has no ${path}. Run the merge stage first.`);
    return root;
  }

  macro(name: string, referencedBy: string): Indexed {
    this.macroIndex ??= this.readIndex("index/macros.xml");
    return this.resolve(this.macroIndex, "macros", "macro", name, referencedBy);
  }

  component(name: string, referencedBy: string): Indexed {
    this.componentIndex ??= this.readIndex("index/components.xml");
    return this.resolve(this.componentIndex, "components", "component", name, referencedBy);
  }

  /**
   * Like {@link macro}, but a macro whose file is of a kind Stage 1 doesn't
   * extract (a cockpit or an interior, say) gives undefined instead of failing.
   */
  extractedMacro(name: string, referencedBy: string): Indexed | undefined {
    this.macroIndex ??= this.readIndex("index/macros.xml");
    const value = this.macroIndex.get(name.toLowerCase());
    if (value !== undefined) {
      const path = `${value.replaceAll("\\", "/")}.xml`.toLowerCase();
      const folder = /^extensions\/([^/]+)\//.exec(path)?.[1];
      if (!isNeededFile(path, new Set(folder ? [folder] : []))) return undefined;
    }
    return this.macro(name, referencedBy);
  }

  private readIndex(path: string): Map<string, string> {
    const index = new Map<string, string>();
    for (const entry of children(this.requireFile(path), "entry")) {
      const name = attr(entry, "name");
      const value = attr(entry, "value");
      if (name !== undefined && value !== undefined) index.set(name.toLowerCase(), value);
    }
    return index;
  }

  private resolve(
    index: Map<string, string>,
    kind: "macros" | "components",
    tag: "macro" | "component",
    name: string,
    referencedBy: string,
  ): Indexed {
    const value = index.get(name.toLowerCase());
    if (value === undefined) {
      throw new ExtractError(`${referencedBy} refers to ${tag} "${name}", which index/${kind}.xml doesn't list`);
    }
    // An extension's copy of a base-game file was merged in at the base-game path
    // (see mergeLayers), so an index entry under extensions/<folder>/ may find it there.
    const indexed = `${value.replaceAll("\\", "/")}.xml`;
    const basePath = indexed.replace(/^extensions\/[^/]+\//i, "");
    const path = this.file(indexed) === undefined && this.file(basePath) !== undefined ? basePath : indexed;
    const root = this.file(path);
    const element =
      children(root, tag).find((e) => attr(e, "name")?.toLowerCase() === name.toLowerCase()) ?? children(root, tag)[0];
    if (!element) {
      throw new ExtractError(`${referencedBy} refers to ${tag} "${name}", but ${path.toLowerCase()} isn't in the cache`);
    }
    return { name, path: path.toLowerCase(), element };
  }
}
