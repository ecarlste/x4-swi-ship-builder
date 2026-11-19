import { copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openCatalog } from "./catalog.ts";

const tinyCat = join(import.meta.dirname, "../fixtures/archives/tiny.cat");

describe("openCatalog", () => {
  it("lists every entry of the plain-text index, keeping paths with spaces whole", () => {
    const catalog = openCatalog(tinyCat);

    expect(catalog.entries.map((e) => [e.path, e.size])).toEqual([
      ["Libraries/Alpha.xml", 9],
      ["empty.txt", 0],
      ["assets/rooms/my room - BKUP.xml", 17],
    ]);
  });

  it("reads each entry's bytes from the .dat at the offset given by the earlier sizes", () => {
    const catalog = openCatalog(tinyCat);
    const [alpha, empty, room] = catalog.entries;

    expect(catalog.read(alpha!).toString("utf8")).toBe("<alpha/>\n");
    expect(catalog.read(empty!).length).toBe(0);
    expect(catalog.read(room!).toString("utf8")).toBe('<room name="b"/>\n');
  });

  it("fails when an entry's bytes don't match its MD5", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-"));
    copyFileSync(tinyCat, join(dir, "bad.cat"));
    writeFileSync(join(dir, "bad.dat"), "<alpha/>\n" + '<room name="X"/>\n');
    const catalog = openCatalog(join(dir, "bad.cat"));

    expect(() => catalog.read(catalog.entries[2]!)).toThrow(
      /bad\.cat: "assets\/rooms\/my room - BKUP\.xml" doesn't match its MD5/,
    );
  });

  it("marks deletion entries (size 0, mtime 0)", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-"));
    writeFileSync(join(dir, "del.cat"), "gone.xml 0 0 00000000000000000000000000000000\n");
    writeFileSync(join(dir, "del.dat"), "");

    expect(openCatalog(join(dir, "del.cat")).entries).toEqual([
      expect.objectContaining({ path: "gone.xml", deleted: true }),
    ]);
  });

  it("fails on an index line it can't parse", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-"));
    writeFileSync(join(dir, "broken.cat"), "only-a-path\n");
    writeFileSync(join(dir, "broken.dat"), "");

    expect(() => openCatalog(join(dir, "broken.cat"))).toThrow(/broken\.cat line 1/);
  });
});
