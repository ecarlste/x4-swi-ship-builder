import { afterEach, describe, expect, test, vi } from "vitest";
import type { SharedLoadout } from "./loadout.ts";
import { readShareLink, shareLinkUrl } from "./shareLink.ts";

const shared: SharedLoadout = {
  format: 1,
  gameData: { swi: "091", x4: "8.00" },
  ship: "ship_xwing",
  name: "Escort",
  slots: { con_weapon_01: "weapon_laser" },
  groups: { group_front: { turret: { equipment: "turret_quad", count: 3 } } },
  thruster: "thruster_s",
  software: ["software_dock"],
  consumables: { missile_proton: 20 },
};

const BASE = "http://localhost:5173/";

/** The fragment of a Share Link, as `location.hash` gives it. */
const hashOf = (url: string) => new URL(url).hash;

/** Builds a fragment carrying these raw bytes, the way a Share Link carries its Loadout. */
async function fragmentOf(bytes: Uint8Array<ArrayBuffer>, { compress = true } = {}) {
  const data = compress
    ? new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer())
    : bytes;
  const base64url = btoa(String.fromCharCode(...data)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return `#l=${base64url}`;
}

const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Share Links", () => {
  test("a Loadout with its name survives the trip through a Share Link", async () => {
    const url = await shareLinkUrl(BASE, shared);
    expect(url.startsWith(`${BASE}#l=`)).toBe(true);
    expect(await readShareLink(hashOf(url))).toEqual({ ok: true, loadout: shared });
  });

  test("an Empty Loadout without a name survives the trip too", async () => {
    const { name: _n, slots: _s, groups: _g, thruster: _t, software: _w, consumables: _c, ...empty } = shared;
    expect(await readShareLink(hashOf(await shareLinkUrl(BASE, empty)))).toEqual({ ok: true, loadout: empty });
  });

  test("a fragment without a Share Link isn't one", async () => {
    expect(await readShareLink("")).toBeNull();
    expect(await readShareLink("#")).toBeNull();
    expect(await readShareLink("#section-2")).toBeNull();
  });

  test("rejects a link whose text was cut or tampered with", async () => {
    const hash = hashOf(await shareLinkUrl(BASE, shared));
    const bad = { ok: false, error: "This Share Link is damaged or incomplete, so its Loadout couldn't be opened." };
    expect(await readShareLink(hash.slice(0, hash.length - 8))).toEqual(bad);
    expect(await readShareLink("#l=")).toEqual(bad);
    expect(await readShareLink("#l=not*base64!")).toEqual(bad);
    expect(await readShareLink(await fragmentOf(json(shared), { compress: false }))).toEqual(bad);
    expect(await readShareLink(await fragmentOf(new TextEncoder().encode("{ not json")))).toEqual(bad);
  });

  test("rejects a link whose Loadout fails the schema", async () => {
    const result = await readShareLink(await fragmentOf(json({ ...shared, ship: 7 })));
    expect(result?.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("isn't a valid Loadout") });
    expect((await readShareLink(await fragmentOf(json({ ...shared, name: "  " }))))?.ok).toBe(false);
  });

  test("rejects a newer format as made by a newer version of the builder", async () => {
    expect(await readShareLink(await fragmentOf(json({ ...shared, format: 2 })))).toEqual({
      ok: false,
      error: "This Loadout was made by a newer version of the builder.",
    });
  });

  test("warns in the console about a link over 2,000 characters, and still makes it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await shareLinkUrl(BASE, shared);
    expect(warn).not.toHaveBeenCalled();

    // Random ids don't compress, so this Loadout's link is well over 2,000 characters.
    const software = Array.from({ length: 80 }, () => crypto.randomUUID());
    const long = { ...shared, software };
    const url = await shareLinkUrl(BASE, long);
    expect(url.length).toBeGreaterThan(2000);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain("2000");
    expect(await readShareLink(hashOf(url))).toEqual({ ok: true, loadout: long });
  });
});
