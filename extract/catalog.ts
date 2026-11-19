import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, readSync } from "node:fs";
import { basename } from "node:path";
import { ExtractError } from "./errors.ts";

/** One file listed in a `.cat` index. */
export interface CatalogEntry {
  /** The path as written in the index, original case kept. */
  path: string;
  size: number;
  mtime: number;
  md5: string;
  /** Where the file's bytes start in the `.dat`: the sum of the earlier sizes. */
  offset: number;
  /** A deletion marker (size 0, mtime 0) rather than a file. */
  deleted: boolean;
}

export interface Catalog {
  catPath: string;
  entries: CatalogEntry[];
  /** Reads one entry's bytes from the `.dat` and checks them against the index MD5. */
  read(entry: CatalogEntry): Buffer;
}

/**
 * Opens an X4 cat/dat archive. The `.cat` is a text index, one
 * `<path> <size> <mtime> <md5>` line per file; the `.dat` is the files' bytes
 * concatenated in index order, with no header, padding or compression.
 * The `.dat` can be many GB, so entries are read with positioned reads.
 */
export function openCatalog(catPath: string): Catalog {
  const name = basename(catPath);
  const datPath = catPath.replace(/\.cat$/i, ".dat");
  const lines = readFileSync(catPath, "utf8").split(/\r?\n/);

  const entries: CatalogEntry[] = [];
  let offset = 0;
  lines.forEach((line, i) => {
    if (line.trim() === "") return;
    // Paths can hold spaces, so the last three fields are split off the right.
    const match = /^(.+) (\d+) (\d+) ([0-9a-fA-F]{32})$/.exec(line);
    if (!match) throw new ExtractError(`${name} line ${i + 1} isn't "<path> <size> <mtime> <md5>": ${line}`);
    const [, path, size, mtime, md5] = match as unknown as [string, string, string, string, string];
    const entry: CatalogEntry = {
      path,
      size: Number(size),
      mtime: Number(mtime),
      md5: md5.toLowerCase(),
      offset,
      deleted: size === "0" && mtime === "0",
    };
    entries.push(entry);
    offset += entry.size;
  });

  return {
    catPath,
    entries,
    read(entry) {
      const bytes = Buffer.alloc(entry.size);
      if (entry.size > 0) {
        const fd = openSync(datPath, "r");
        try {
          const got = readSync(fd, bytes, 0, entry.size, entry.offset);
          if (got !== entry.size) {
            throw new ExtractError(`${name}: "${entry.path}" runs past the end of ${basename(datPath)}`);
          }
        } finally {
          closeSync(fd);
        }
      }
      // An empty file's index MD5 is all zeros, so only non-empty files are checked.
      if (entry.size > 0 && createHash("md5").update(bytes).digest("hex") !== entry.md5) {
        throw new ExtractError(`${name}: "${entry.path}" doesn't match its MD5 (the archive may be damaged)`);
      }
      return bytes;
    },
  };
}
