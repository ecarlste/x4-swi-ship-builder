import { readFileSync } from "node:fs";
import { expect, test, type Locator } from "@playwright/test";
import { fit, openShip, row } from "./helpers.ts";

/** The fixture snapshot's Equipment, as Game Data. */
const equipment: { id: string; name: string; boltColour: string | null }[] = JSON.parse(
  readFileSync(new URL("../fixtures/game-data/tiny/equipment.json", import.meta.url), "utf8"),
);

/** The fixture's red Flak Turret: its name and its Game Data bolt colour (`AARRGGBB`). */
const red = equipment.find((e) => e.id === "fx_turret_m_red")!;

/** An `AARRGGBB` colour in the form the browser reports a computed `color`. */
function computed(argb: string) {
  const [a, r, g, b] = [0, 2, 4, 6].map((i) => parseInt(argb.slice(i, i + 2), 16));
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(3))})`;
}

/** The colour variant's letter, the last word of its name, within `scope`. */
const letter = (scope: Locator) => scope.getByText(red.name.split(" ").at(-1)!, { exact: true });

test("a colour variant's letter is drawn in its Game Data bolt colour, in the options and the fitted value", async ({ page }) => {
  expect(red.boltColour).not.toBeNull();
  await openShip(page, "L", "Ironback Hauler");
  const turrets = row(page, /Turrets group_front/);

  await turrets.getByRole("combobox").click();
  const list = page.getByRole("listbox");
  const option = list.getByRole("option", { name: red.name, exact: true });
  await expect(letter(option)).toHaveCSS("color", computed(red.boltColour!));

  // Equipment without a colour looks as it did: drawn in the same colour as the variant's base name.
  const plain = list.getByRole("option", { name: "Flak Turret", exact: true });
  const plainColour = await plain.evaluate((el) => getComputedStyle(el).color);
  await expect(option.getByText("Flak Turret", { exact: false }).first()).toHaveCSS("color", plainColour);
  await expect(plain.getByText("R", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await fit(page, /Turrets group_front/, red.name);
  const fitted = turrets.getByRole("combobox");
  await expect(fitted).toHaveText(red.name);
  await expect(letter(fitted)).toHaveCSS("color", computed(red.boltColour!));
});

test("the comparison popover draws a colour variant's letter in its bolt colour", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");
  await row(page, /Turrets group_front/).getByRole("combobox").click();
  await page.getByRole("listbox").getByRole("option", { name: red.name, exact: true }).hover();
  const popover = page.getByRole("tooltip");
  await expect(popover).toBeVisible();

  await expect(letter(popover).first()).toHaveCSS("color", computed(red.boltColour!));
});
