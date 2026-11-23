import { expect, test, type Locator, type Page } from "@playwright/test";
import { explanationOf, fit, loadoutTable, openShip, row } from "./helpers.ts";

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
  await page.getByRole("option", { name: "— empty —" }).click();

  await expect(weapon.getByRole("combobox")).toHaveText(/— empty —/);
  await expect(weapon.getByRole("cell")).toHaveText([/— empty —/, "", "", ""]);
  // The other Slots were never touched.
  await expect(row(page, /con_weapon_02/).getByRole("combobox")).toHaveText(/— empty —/);
});

test("the Chassis is the first row: the Ship's own price, read-only, quantity 1", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  await expect(loadoutTable(page).getByRole("rowheader").first()).toHaveText("Chassis");
  const chassis = row(page, "Chassis");
  await expect(chassis.getByRole("cell")).toHaveText(["Swiftwing Courier", "1", "", "100,000 Cr"]);
  await expect(chassis.getByRole("combobox")).toHaveCount(0);
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

  const flares = countOf(page, "Glare Flare");
  await expect(rowOf(page, "Glare Flare").getByRole("rowheader")).toHaveText("Countermeasures");
  await expect(rowOf(page, "Glare Flare").getByRole("cell").nth(1)).toContainText("/ 5");
  await expect(flares).toHaveValue("0");

  await flares.fill("3");
  await expect(rowOf(page, "Glare Flare").getByRole("cell").nth(3)).toHaveText("180 Cr");
  await flares.fill("9");
  await expect(flares).toHaveValue("5");
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

  await fit(page, /con_weapon_02/, "Torpedo Tube");
  await countOf(page, "Dart Missile").fill("6");
  await countOf(page, "Heavy Torpedo").fill("9");
  // 10 missiles in all: 6 Darts leave room for 4 Torpedoes.
  await expect(countOf(page, "Heavy Torpedo")).toHaveValue("4");
  await expect(rowOf(page, "Heavy Torpedo").getByRole("cell").nth(3)).toHaveText("10,000 Cr");

  // Removing the Dart Launcher removes its missiles from the Loadout.
  await fit(page, /con_weapon_01/, "— empty —");
  await expect(countOf(page, "Dart Missile")).toHaveCount(0);
});

const MISSING = "Mandatory upgrade missing";
/** The toolbar's count of missing mandatory upgrades. */
const missingCount = (page: Page) => page.getByRole("toolbar").getByRole("button", { name: /mandatory missing/ });
/** The marks on rows missing a mandatory upgrade, within `scope`. */
const missingMarks = (scope: Locator) => scope.getByRole("button", { name: MISSING, exact: true });

test("the toolbar counts missing mandatory upgrades and the table marks their rows", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  // Engines, the thruster and default software are mandatory; weapons aren't.
  const count = missingCount(page);
  await expect(count).toHaveAccessibleName("3 mandatory missing");
  const explanation = await explanationOf(count);
  await expect.poll(() => explanation.innerText()).toBe("Engines\nThruster\nFlight Assist Mk1");
  await expect(missingMarks(row(page, /^Engines/))).toHaveText("*");
  await expect(missingMarks(row(page, "Thruster"))).toBeVisible();
  const flightAssist = page.getByRole("checkbox", { name: "Flight Assist Mk1" });
  await expect(missingMarks(loadoutTable(page).getByRole("row").filter({ has: flightAssist }))).toBeVisible();
  await expect(missingMarks(row(page, /con_weapon_01/))).toHaveCount(0);
  await expect(missingMarks(loadoutTable(page))).toHaveCount(3);

  // Nothing is blocked: other rows can still be filled.
  await fit(page, /con_weapon_01/, "Pulse Blaster");
  await expect(count).toHaveAccessibleName("3 mandatory missing");

  await fit(page, /^Engines/, "Sprint Engine S");
  await expect(count).toHaveAccessibleName("2 mandatory missing");
  await expect(missingMarks(row(page, /^Engines/))).toHaveCount(0);

  await fit(page, "Thruster", "Nimble Thruster S");
  await flightAssist.check();
  await expect(count).toBeHidden();
  await expect(missingMarks(loadoutTable(page))).toHaveCount(0);

  // Emptying a mandatory row brings the warning back.
  await fit(page, "Thruster", "— empty —");
  await expect(count).toHaveAccessibleName("1 mandatory missing");
  const stillMissing = await explanationOf(count);
  await expect.poll(() => stillMissing.innerText()).toBe("Thruster");
});

test("Slots tagged mandatory and the engines in a Slot Group count as mandatory upgrades", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");

  const count = missingCount(page);
  await expect(count).toHaveAccessibleName("4 mandatory missing");
  const explanation = await explanationOf(count);
  await expect.poll(() => explanation.innerText()).toBe("Engines\nShield con_shield_01\nThruster\nFlight Assist Mk1");
  await expect(missingMarks(row(page, /con_shield_01/))).toBeVisible();
  await expect(missingMarks(row(page, /^Engines/))).toBeVisible();
  // Turret and shield groups aren't mandatory.
  await expect(missingMarks(row(page, /Turrets group_front/))).toHaveCount(0);

  await fit(page, /^Engines/, "Haul Engine L");
  await expect(count).toHaveAccessibleName("3 mandatory missing");
});

test("one Engines row fits one engine type to all of the Ship's engines (#50)", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");

  // The Hauler's two engines are in a Slot Group; they get one row, after the Chassis, and no group row.
  const engines = row(page, /^Engines/);
  await expect(loadoutTable(page).getByRole("rowheader").nth(1)).toHaveText(/^Engines 2×/);
  await expect(row(page, /Engines enginegroup/)).toHaveCount(0);
  await expect(engines.getByRole("spinbutton")).toHaveCount(0);

  // Picking an engine fits it to every engine, and prices it per engine.
  await fit(page, /^Engines/, "Haul Engine L");
  await expect(engines.getByRole("cell").nth(1)).toHaveText("2");
  await expect(engines.getByRole("cell").nth(3)).toHaveText("440,000 Cr");

  // Emptying it removes them all.
  await fit(page, /^Engines/, "— empty —");
  await expect(engines.getByRole("cell").nth(1)).toHaveText("");
  await expect(engines.getByRole("cell").nth(3)).toHaveText("");
});

test("a Slot Group has one row per kind, with an Equipment choice and a count up to the group's size", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");

  // Rows for every turret and shield kind of every group, after the Slots. Engines have their own row.
  await expect(loadoutTable(page).getByRole("rowheader").nth(2)).toContainText("con_shield_01");
  await expect(row(page, /Turrets group_front/)).toBeVisible();
  await expect(row(page, /Shields group_front/)).toBeVisible();

  const turrets = row(page, /Turrets group_front/);
  const count = turrets.getByRole("spinbutton");
  await expect(count).toHaveValue("0");
  await expect(count).toBeDisabled();
  await expect(turrets.getByRole("cell").nth(1)).toContainText("/ 4");

  // Picking Equipment fills the whole group; the count then narrows it, never past the group's size.
  await fit(page, /Turrets group_front/, "Flak Turret");
  await expect(count).toHaveValue("4");
  await expect(turrets.getByRole("cell").nth(3)).toHaveText("180,000 Cr");

  await count.fill("2");
  await expect(count).toHaveValue("2");
  await expect(turrets.getByRole("cell").nth(3)).toHaveText("90,000 Cr");
  await count.fill("9");
  await expect(count).toHaveValue("4");
});

test("service crew and marines share the Ship's crew capacity, and Price adds each at the crew price", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");
  const crew = loadoutTable(page).getByRole("rowgroup", { name: /^Crew/ });
  const price = page.getByRole("complementary", { name: "Stats" }).getByRole("region", { name: "Price" });

  // A new Loadout has no Crew, only the Captain, who isn't a count.
  await expect(crew.getByRole("rowheader")).toHaveText(["Service crew", "Marines"]);
  await expect(crew.getByRole("columnheader")).toHaveText(/^Crew\s*0 \/ 20$/);
  await expect(countOf(page, "Service crew")).toHaveValue("0");
  await expect(countOf(page, "Marines")).toHaveValue("0");
  // The header carries the shared capacity; a count beside it would read as that much more free.
  await expect(rowOf(page, "Service crew").getByRole("cell").nth(1)).not.toContainText("/");
  await expect(loadoutTable(page)).not.toContainText(/captain/i);
  await expect(price).toContainText("2,500,000 Cr");

  // The fixture's crew price averages 6,000 Cr.
  await countOf(page, "Service crew").fill("12");
  await expect(rowOf(page, "Service crew").getByRole("cell").nth(3)).toHaveText("72,000 Cr");
  await expect(crew.getByRole("columnheader")).toHaveText(/12 \/ 20$/);
  await expect(price).toContainText("2,572,000 Cr");

  // Marines get only what the service crew leave, and the reverse.
  await countOf(page, "Marines").fill("15");
  await expect(countOf(page, "Marines")).toHaveValue("8");
  await expect(rowOf(page, "Marines").getByRole("cell").nth(3)).toHaveText("48,000 Cr");
  await expect(crew.getByRole("columnheader")).toHaveText(/20 \/ 20$/);
  await expect(price).toContainText("2,620,000 Cr");
});

test("a Ship with no crew capacity has no Crew section", async ({ page }) => {
  await openShip(page, "S", "Needle Striker");

  await expect(row(page, "Thruster")).toBeVisible();
  await expect(loadoutTable(page).getByRole("rowgroup", { name: /^Crew/ })).toHaveCount(0);
  await expect(countOf(page, "Service crew")).toHaveCount(0);
});
