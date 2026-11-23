import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

import { toasts } from "./helpers.ts";
const KEY = "swi-builder:saved-loadouts:v1";

const savedList = (page: Page) => page.getByRole("region", { name: "Saved Loadouts" });
const savedEntry = (page: Page, name: string | RegExp) => savedList(page).getByRole("listitem").filter({ hasText: name });
const toolbarButton = (page: Page, name: string) =>
  page.getByRole("toolbar").getByRole("button", { name, exact: true });

async function showSavedLoadouts(page: Page) {
  await toolbarButton(page, "Saved Loadouts").click();
  await expect(savedList(page)).toBeVisible();
}

const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key), KEY);

/** Puts these values in storage, then reloads so the app reads them. */
async function storeRaw(page: Page, value: unknown) {
  await page.evaluate(([key, raw]) => localStorage.setItem(key!, raw!), [KEY, JSON.stringify(value)]);
  await page.reload();
}

const savedLoadout = (over: Record<string, unknown> = {}) => ({
  format: 1,
  gameData: { swi: "999", x4: "9.99" },
  ship: "fx_courier",
  id: "6f1c1f2e-5d2b-4c1a-9a3e-0b7f6c2d9e11",
  name: "Escort",
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  ...over,
});

const escort = savedLoadout({ slots: { con_weapon_01: "fx_weapon_zephyr" } });
const freighter = savedLoadout({
  id: "11111111-2222-4333-8444-555555555555",
  name: "Freighter",
  ship: "fx_hauler",
});

const loadoutFile = (loadouts: unknown[], over: Record<string, unknown> = {}) =>
  JSON.stringify({ app: "x4-swi-ship-builder", format: 1, loadouts, ...over }, null, 2);

/** Picks this file through the toolbar's Import. */
async function importFile(page: Page, contents: string | Buffer, name = "loadouts.json") {
  const chooser = page.waitForEvent("filechooser");
  await toolbarButton(page, "Import").click();
  await (await chooser).setFiles({ name, mimeType: "application/json", buffer: Buffer.from(contents) });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("Export in the toolbar downloads every Saved Loadout as a Loadout File, leaving storage as it was", async ({ page }) => {
  await storeRaw(page, [escort, freighter]);
  const before = await stored(page);

  const download = page.waitForEvent("download");
  await toolbarButton(page, "Export").click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/\.json$/);
  const text = await readFile((await file.path())!, "utf8");
  expect(JSON.parse(text)).toEqual(JSON.parse(loadoutFile([escort, freighter])));
  expect(text).toMatch(/^\{\n {2}"app": "x4-swi-ship-builder",\n {2}"format": 1,/);
  expect(await stored(page)).toBe(before);
});

test("Export on one Saved Loadout downloads just that one", async ({ page }) => {
  await storeRaw(page, [escort, freighter]);
  await showSavedLoadouts(page);

  const download = page.waitForEvent("download");
  await savedEntry(page, "Freighter").getByRole("button", { name: "Export" }).click();
  const file = await download;

  expect(file.suggestedFilename()).toBe("Freighter.json");
  expect(JSON.parse(await readFile((await file.path())!, "utf8"))).toEqual({
    app: "x4-swi-ship-builder",
    format: 1,
    loadouts: [freighter],
  });
});

test("Import adds the file's Loadouts, and a clashing id gets a new one so both are kept", async ({ page }) => {
  await storeRaw(page, [escort]);

  await importFile(page, loadoutFile([{ ...escort, name: "Escort (theirs)" }, freighter]));

  await expect(toasts(page)).toContainText("Imported 2 Loadouts");
  await expect(savedList(page).getByRole("listitem")).toHaveText([/^Escort\b/, /Escort \(theirs\)/, /Freighter/]);

  const list = JSON.parse((await stored(page))!) as { id: string; name: string }[];
  expect(list[0]).toEqual(escort);
  expect(list[1]!.id).not.toBe(escort.id);
  expect(list[2]).toEqual(freighter);

  await page.reload();
  await showSavedLoadouts(page);
  await expect(savedList(page).getByRole("listitem")).toHaveCount(3);
});

test("an exported file imports into another browser", async ({ page, browser }) => {
  await storeRaw(page, [escort, freighter]);
  const download = page.waitForEvent("download");
  await toolbarButton(page, "Export").click();
  const text = await readFile((await (await download).path())!, "utf8");

  const other = await browser.newPage();
  await other.goto("/");
  await importFile(other, text);

  await expect(savedList(other).getByRole("listitem")).toHaveText([/Escort/, /Freighter/]);
  expect(JSON.parse((await stored(other))!)).toEqual([escort, freighter]);
  await other.close();
});

for (const [what, contents, error] of [
  ["a file that isn't JSON", "not json", /isn't a Loadout File/],
  ["a file with one bad Loadout", loadoutFile([freighter, { ...escort, name: "" }]), /isn't a Loadout File/],
  ["a newer-format file", loadoutFile([freighter], { format: 2 }), /made by a newer version of the builder/],
  ["a file over 5 MB", loadoutFile([{ ...freighter, name: "x".repeat(5 * 1024 * 1024) }]), /over 5 MB/],
] as const) {
  test(`${what} is rejected in full with a clear error`, async ({ page }) => {
    await storeRaw(page, [escort]);
    const before = await stored(page);

    await importFile(page, contents);

    await expect(toasts(page)).toContainText(error);
    expect(await stored(page)).toBe(before);
  });
}
