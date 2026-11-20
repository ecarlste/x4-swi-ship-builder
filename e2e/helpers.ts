/** Helpers shared by the e2e specs. */
import type { Page } from "@playwright/test";

type Size = "S" | "M" | "L" | "XL";

/** Picks a Ship through the toolbar's picker, on the page as it is. */
export async function pickShip(page: Page, size: Size, name: string) {
  await page.getByRole("combobox", { name: "Size" }).selectOption(size);
  await page.getByRole("combobox", { name: "Ship" }).fill(name);
  await page.getByRole("option", { name }).click();
}

/** Loads the app, then picks a Ship through the toolbar's picker. */
export async function openShip(page: Page, size: Size, name: string) {
  await page.goto("/");
  await pickShip(page, size, name);
}

export const loadoutTable = (page: Page) => page.getByRole("table", { name: "Loadout" });

/** The Loadout table row whose header matches the label. */
export const row = (page: Page, label: string | RegExp) =>
  loadoutTable(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label }) });

/** Picks an option from a Loadout table row's Equipment dropdown. */
export async function fit(page: Page, label: string | RegExp, equipment: string) {
  await row(page, label).getByRole("combobox").click();
  await page.getByRole("listbox").getByRole("option", { name: equipment, exact: true }).click();
}

/** A Share Link fragment carrying this value, built in the page the way the app builds one. */
export async function fragmentFor(page: Page, value: unknown) {
  return page.evaluate(async (json) => {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const base64url = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    return `#l=${base64url}`;
  }, JSON.stringify(value));
}
