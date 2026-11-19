// Minimal X4 .cat/.dat reader (throwaway; see docs/research/swi-file-packaging.md on the
// research/swi-file-packaging branch). A .cat line is "<path> <size> <mtime> <md5>", and the
// matching .dat holds the files back to back, uncompressed, in .cat order.
import { readFileSync, readdirSync, openSync, readSync, closeSync, existsSync } from "node:fs";
import { join } from "node:path";

/** The .cat files of one directory, in load order (01.cat, 02.cat, ...; ext_01.cat, subst_01.cat, ...). */
export function catalogs(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".cat") && !f.endsWith("_sig.cat"))
    .sort()
    .map((f) => join(dir, f));
}

function findIn(cat, wanted) {
  let offset = 0;
  for (const line of readFileSync(cat, "utf8").split("\n")) {
    if (!line) continue;
    const parts = line.split(" ");
    const size = Number(parts[parts.length - 3]);
    const path = parts.slice(0, -3).join(" ");
    if (path === wanted) return { cat, offset, size };
    offset += size;
  }
  return null;
}

/** Read one packed file. Later catalogues in the same directory win, as in the game. */
export function readPacked(dir, path, { prefix } = {}) {
  let hit = null;
  for (const cat of catalogs(dir)) {
    if (prefix && !cat.split("/").pop().startsWith(prefix)) continue;
    hit = findIn(cat, path) ?? hit;
  }
  if (!hit) return null;
  const fd = openSync(hit.cat.replace(/\.cat$/, ".dat"), "r");
  try {
    const buf = Buffer.alloc(hit.size);
    readSync(fd, buf, 0, hit.size, hit.offset);
    return buf.toString("utf8").replace(/^﻿/, "");
  } finally {
    closeSync(fd);
  }
}

export function requireX4(x4) {
  if (!x4 || !existsSync(join(x4, "extensions", "starwarsmod_m1", "content.xml"))) {
    throw new Error(`Not an X4 install with SWI (starwarsmod_m1): ${x4}`);
  }
  return x4;
}
