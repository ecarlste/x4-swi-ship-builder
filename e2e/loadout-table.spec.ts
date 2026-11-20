import { expect, test, type Page } from "@playwright/test";
import { fit, loadoutTable, openShip, row } from "./helpers.ts";

/** Checks the open dropdown lists exactly these options, in order. */
async function expectOptions(page: Page, names: string[]) {
  const options = page.getByRole("listbox").getByRole("option");
  await expect(options).toHaveCount(names.length);
  for (const [i, name] of names.entries()) await expect(options.nth(i)).toHaveAccessibleName(name);
}

test("a Slot's dropdown lists only its compatible Equipment, sorted by name, with empty first", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  const weapon = row(page, /con_weapon_01/);
  await expect(weapon.getByRole("combobox")).toHaveText(/— empty —/);
  await weapon.getByRole("combobox").click();
  await expectOptions(page, ["— empty —", "Dart Launcher", "Pulse Blaster", "Torpedo Tube", "Zephyr Cannon"]);
  await expect(page.getByRole("option", { name: "— empty —" })).toHaveAttribute("aria-selected", "true");
});

test("filling a Slot shows its Equipment, quantity, key value and average price, and it can be emptied", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  await fit(page, /con_weapon_01/, "Zephyr Cannon");
  const weapon = row(page, /con_weapon_01/);
  await expect(weapon.getByRole("combobox")).toHaveText(/Zephyr Cannon/);
  await expect(weapon.getByRole("cell")).toHaveText([/Zephyr Cannon/, "1", "300 dmg/shot", "30,000 Cr"]);

  // The fitted item is ticked.
  await weapon.getByRole("combobox").click();
  await expect(page.getByRole("option", { name: "Zephyr Cannon" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("option", { name: "Zephyr Cannon" })).toContainText("✓");
  await page.getByRole("option", { name: "— empty —" }).click();

  await expect(weapon.getByRole("combobox")).toHaveText(/— empty —/);
  await expect(weapon.getByRole("cell")).toHaveText([/— empty —/, "", "", ""]);
  // The other Slots were never touched.
  await expect(row(page, /con_weapon_02/).getByRole("combobox")).toHaveText(/— empty —/);
});

test("a Slot with one compatible item still has a dropdown", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  await fit(page, /con_shield_01/, "Bubble Shield S");
  await expect(row(page, /con_shield_01/).getByRole("cell").nth(2)).toHaveText("1,000 MJ");
  await fit(page, /con_shield_01/, "— empty —");
  await expect(row(page, /con_shield_01/).getByRole("combobox")).toHaveText(/— empty —/);
});

test("picking another Ship opens it as an Empty Loadout", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Pulse Blaster");

  await page.getByRole("combobox", { name: "Ship" }).fill("Bramble");
  await page.keyboard.press("Enter");

  await expect(row(page, /con_weapon_01/).getByRole("combobox")).toHaveText(/— empty —/);
});

test("the thruster has its own row and dropdown", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  await fit(page, "Thruster", "Nimble Thruster S");
  await expect(row(page, "Thruster").getByRole("cell")).toHaveText([
    /Nimble Thruster S/,
    "1",
    "400 N strafe",
    "3,500 Cr",
  ]);
});

test("software is chosen from the Ship's software options", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  const scanner = page.getByRole("checkbox", { name: "Long Scanner" });
  const scannerRow = loadoutTable(page).getByRole("row").filter({ has: scanner });
  await expect(page.getByRole("checkbox", { name: "Flight Assist Mk1" })).not.toBeChecked();
  await expect(scanner).not.toBeChecked();

  await scanner.check();
  await expect(scannerRow.getByRole("cell").nth(3)).toHaveText("11,000 Cr");
  await scanner.uncheck();
  await expect(scannerRow.getByRole("cell").nth(3)).toHaveText("");
});

const countOf = (page: Page, item: string) => page.getByRole("spinbutton", { name: `${item} count` });
const rowOf = (page: Page, item: string) =>
  loadoutTable(page).getByRole("row").filter({ has: countOf(page, item) });

test("consumable counts can't exceed the Ship's capacities", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  // The Courier carries no drones or deployables, so it gets no rows for them.
  await expect(loadoutTable(page).getByRole("rowheader", { name: "Drones" })).toHaveCount(0);
  await expect(loadoutTable(page).getByRole("rowheader", { name: "Deployables" })).toHaveCount(0);

  const flares = countOf(page, "Glare Flare");
  await expect(rowOf(page, "Glare Flare").getByRole("rowheader")).toHaveText("Countermeasures");
  await expect(rowOf(page, "Glare Flare").getByRole("cell").nth(1)).toContainText("/ 5");
  await expect(flares).toHaveValue("0");

  await flares.fill("3");
  await expect(rowOf(page, "Glare Flare").getByRole("cell").nth(3)).toHaveText("180 Cr");
  await flares.fill("9");
  await expect(flares).toHaveValue("5");

  // A Ship with drone and deployable capacity lists them.
  await page.getByRole("combobox", { name: "Size" }).selectOption("L");
  await page.getByRole("combobox", { name: "Ship" }).fill("Ironback");
  await page.keyboard.press("Enter");
  await expect(rowOf(page, "Porter Drone").getByRole("cell").nth(1)).toContainText("/ 20");
  await expect(rowOf(page, "Marker Beacon").getByRole("cell").nth(1)).toContainText("/ 10");
  await countOf(page, "Porter Drone").fill("25");
  await expect(countOf(page, "Porter Drone")).toHaveValue("20");
});

test("missiles are limited to those a fitted launcher can fire, sharing the Ship's missile capacity", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  // No launcher, no missiles.
  await expect(loadoutTable(page).getByRole("rowheader", { name: "Missiles" })).toHaveCount(0);

  // Only Corsair Clans sell the Dart Launcher, and only the Freight Guild sells the
  // Courier: any compatible Equipment fits whatever its Faction.
  await fit(page, /con_weapon_01/, "Dart Launcher");
  await expect(row(page, /con_weapon_01/).getByRole("combobox")).toHaveText(/Dart Launcher/);
  await expect(rowOf(page, "Dart Missile").getByRole("rowheader")).toHaveText("Missiles");
  await expect(rowOf(page, "Dart Missile").getByRole("cell").nth(1)).toContainText("/ 10");
  await expect(countOf(page, "Heavy Torpedo")).toHaveCount(0);

  await fit(page, /con_weapon_02/, "Torpedo Tube");
  await countOf(page, "Dart Missile").fill("6");
  await countOf(page, "Heavy Torpedo").fill("9");
  // 10 missiles in all: 6 Darts leave room for 4 Torpedoes.
  await expect(countOf(page, "Heavy Torpedo")).toHaveValue("4");
  await expect(rowOf(page, "Heavy Torpedo").getByRole("cell").nth(3)).toHaveText("10,000 Cr");

  // Removing the Dart Launcher removes its missiles from the Loadout.
  await fit(page, /con_weapon_01/, "— empty —");
  await expect(countOf(page, "Dart Missile")).toHaveCount(0);
  await countOf(page, "Heavy Torpedo").fill("10");
  await expect(countOf(page, "Heavy Torpedo")).toHaveValue("10");

  // Fitting it again starts from none.
  await fit(page, /con_weapon_01/, "Dart Launcher");
  await expect(countOf(page, "Dart Missile")).toHaveValue("0");
});

const MISSING = "Mandatory upgrade missing";

test("the toolbar counts missing mandatory upgrades and the table marks their rows", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  // Engines, the thruster and default software are mandatory; weapons aren't.
  const warning = page.getByText(/mandatory missing/);
  await expect(warning).toHaveText("⚠ 3 mandatory missing");
  await expect(warning).toHaveAttribute("title", "Engine con_engine_01\nThruster\nFlight Assist Mk1");
  await expect(row(page, /con_engine_01/).getByTitle(MISSING)).toHaveText("*");
  await expect(row(page, "Thruster").getByTitle(MISSING)).toBeVisible();
  const flightAssist = page.getByRole("checkbox", { name: "Flight Assist Mk1" });
  await expect(loadoutTable(page).getByRole("row").filter({ has: flightAssist }).getByTitle(MISSING)).toBeVisible();
  await expect(row(page, /con_weapon_01/).getByTitle(MISSING)).toHaveCount(0);
  await expect(loadoutTable(page).getByTitle(MISSING)).toHaveCount(3);

  // Nothing is blocked: other rows can still be filled.
  await fit(page, /con_weapon_01/, "Pulse Blaster");
  await expect(warning).toHaveText("⚠ 3 mandatory missing");

  await fit(page, /con_engine_01/, "Sprint Engine S");
  await expect(warning).toHaveText("⚠ 2 mandatory missing");
  await expect(row(page, /con_engine_01/).getByTitle(MISSING)).toHaveCount(0);

  await fit(page, "Thruster", "Nimble Thruster S");
  await flightAssist.check();
  await expect(warning).toBeHidden();
  await expect(loadoutTable(page).getByTitle(MISSING)).toHaveCount(0);

  // Emptying a mandatory row brings the warning back.
  await fit(page, "Thruster", "— empty —");
  await expect(warning).toHaveText("⚠ 1 mandatory missing");
  await expect(warning).toHaveAttribute("title", "Thruster");
});

test("Slots tagged mandatory and engine Slot Groups count as mandatory upgrades", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");

  const warning = page.getByText(/mandatory missing/);
  await expect(warning).toHaveText("⚠ 4 mandatory missing");
  await expect(warning).toHaveAttribute(
    "title",
    "Shield con_shield_01\nEngines enginegroup\nThruster\nFlight Assist Mk1",
  );
  await expect(row(page, /con_shield_01/).getByTitle(MISSING)).toBeVisible();
  await expect(row(page, /Engines enginegroup/).getByTitle(MISSING)).toBeVisible();
  // Turret and shield groups aren't mandatory.
  await expect(row(page, /Turrets group_front/).getByTitle(MISSING)).toHaveCount(0);

  // An engine group is missing until every one of its Slots is filled.
  await fit(page, /Engines enginegroup/, "Haul Engine L");
  await expect(warning).toHaveText("⚠ 3 mandatory missing");
  await page.getByRole("spinbutton", { name: "enginegroup Engines count" }).fill("1");
  await expect(warning).toHaveText("⚠ 4 mandatory missing");
});

test("a Slot Group has one row per kind, with an Equipment choice and a count up to the group's size", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");

  // Rows for every kind of every group, after the Slots.
  await expect(loadoutTable(page).getByRole("rowheader").first()).toContainText("con_shield_01");
  await expect(row(page, /Turrets group_front/)).toBeVisible();
  await expect(row(page, /Shields group_front/)).toBeVisible();
  await expect(row(page, /Engines enginegroup/)).toBeVisible();

  const turrets = row(page, /Turrets group_front/);
  const count = turrets.getByRole("spinbutton");
  await expect(count).toHaveValue("0");
  await expect(count).toBeDisabled();
  await expect(turrets.getByRole("cell").nth(1)).toContainText("/ 4");

  // Picking Equipment fills the whole group; the count then narrows it.
  await fit(page, /Turrets group_front/, "Flak Turret");
  await expect(count).toHaveValue("4");
  await expect(turrets.getByRole("cell").nth(3)).toHaveText("180,000 Cr");

  await count.fill("2");
  await expect(count).toHaveValue("2");
  await expect(turrets.getByRole("cell").nth(3)).toHaveText("90,000 Cr");

  // Never more than the group's size.
  await count.fill("9");
  await expect(count).toHaveValue("4");

  // The other kinds of the same group are separate.
  await expect(row(page, /Shields group_front/).getByRole("combobox")).toHaveText(/— empty —/);

  // A count of 0 empties the row.
  await count.fill("0");
  await expect(turrets.getByRole("combobox")).toHaveText(/— empty —/);
  await expect(count).toHaveValue("0");
  await expect(turrets.getByRole("cell").nth(3)).toHaveText("");
});
