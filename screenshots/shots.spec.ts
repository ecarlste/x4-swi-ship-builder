import { expect, test, type Page } from "@playwright/test";
import { join, resolve } from "node:path";
import { fit, openShip, row } from "../e2e/helpers.ts";
import { STATES, shotFile, type Phase, type StateKey } from "../scripts/prScreenshots.ts";

/**
 * The PR screenshots (#150): one full-page PNG per state, driven the way the e2e specs drive the
 * page. The same spec runs against the PR's base build and its head build, so a step the base's UI
 * can't take fails that state's "before" only.
 */

const PHASE = (process.env.SHOTS_PHASE ?? "after") as Phase;
const OUT = resolve(process.env.SHOTS_OUT ?? "test-results/shots");

const saveButton = (page: Page) => page.getByRole("toolbar").getByRole("button", { name: "Save", exact: true });
const saveDialog = (page: Page) => page.getByRole("dialog", { name: "Save Loadout" });

/** A small fitted Loadout on the Swiftwing Courier, from the fixture snapshot. */
async function fittedLoadout(page: Page) {
  await openShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Pulse Blaster");
  await fit(page, /^Engines/, "Sprint Engine S");
}

async function openSaveDialog(page: Page) {
  await saveButton(page).click();
  await saveDialog(page).getByRole("textbox", { name: "Name" }).fill("Courier strike");
}

/** Brings the page to each state. */
const drive: Record<StateKey, (page: Page) => Promise<void>> = {
  empty: async (page) => {
    await page.goto("/");
    await expect(page.getByRole("combobox", { name: "Ship" })).toBeVisible();
  },
  "loadout-popover": async (page) => {
    await fittedLoadout(page);
    await row(page, /con_weapon_01/).getByRole("combobox").click();
    await page.getByRole("listbox").getByRole("option", { name: "Zephyr Cannon", exact: true }).hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
  },
  "saved-loadouts": async (page) => {
    await fittedLoadout(page);
    await openSaveDialog(page);
    await saveDialog(page).getByRole("button", { name: "Save" }).click();
    await expect(saveDialog(page)).toBeHidden();
    await page.getByRole("button", { name: "Saved Loadouts" }).click();
    await expect(page.getByRole("region", { name: "Saved Loadouts" })).toBeVisible();
  },
  "save-dialog": async (page) => {
    await fittedLoadout(page);
    await openSaveDialog(page);
    await expect(saveDialog(page)).toBeVisible();
  },
};

for (const { key, label } of STATES) {
  test(label, async ({ page }) => {
    await drive[key](page);
    await page.screenshot({ path: join(OUT, shotFile(PHASE, key)), fullPage: true, animations: "disabled" });
  });
}
