/**
 * The Repairs notice as a warning Alert (#128): the notice shown when a Loadout opens repaired
 * against the Game Data is announced as an alert and drawn in the theme's `warning` token.
 */
import { expect, test, type Page } from "@playwright/test";
import { tokenColour } from "./helpers.ts";

const KEY = "swi-builder:saved-loadouts:v1";

/** Made with older Game Data; two entries no longer fit the fixture snapshot. */
const escort = {
  format: 1,
  gameData: { swi: "091", x4: "8.00" },
  ship: "fx_courier",
  id: "6f1c1f2e-5d2b-4c1a-9a3e-0b7f6c2d9e11",
  name: "Escort",
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  slots: { con_weapon_01: "fx_pulse_s", con_weapon_09: "fx_cannon_s" },
  consumables: { fx_flare: 9 },
};

async function openEscort(page: Page) {
  await page.goto("/");
  await page.evaluate(([key, raw]) => localStorage.setItem(key!, raw!), [KEY, JSON.stringify([escort])]);
  await page.reload();
  await page.getByRole("toolbar").getByRole("button", { name: "Saved Loadouts", exact: true }).click();
  await page.getByRole("region", { name: "Saved Loadouts" }).getByRole("button", { name: "Open" }).click();
}

test("the Repairs notice is an alert listing the Repairs, drawn in the warning colour", async ({ page }) => {
  await openEscort(page);

  const alert = page.getByRole("alert").filter({ hasText: "This Loadout changed with the Game Data" });
  await expect(alert.getByRole("listitem")).toHaveText([
    /Zephyr Cannon in con_weapon_09: dropped/,
    /Glare Flare in consumables: count cut from 9 to 5/,
  ]);
  await expect(alert.getByText("This Loadout changed with the Game Data")).toHaveCSS(
    "color",
    await tokenColour(page, "warning"),
  );
});
