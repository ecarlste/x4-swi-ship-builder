import { expect, test, type Page } from "@playwright/test";
import { loadoutTable, openShip } from "./helpers.ts";

/** Checks the open dropdown lists exactly these options, in order. */
async function expectOptions(page: Page, names: string[]) {
  const options = page.getByRole("listbox").getByRole("option");
  await expect(options).toHaveCount(names.length);
  for (const [i, name] of names.entries()) await expect(options.nth(i)).toHaveAccessibleName(name);
}

/** The Software section of the Loadout table. */
const softwareSection = (page: Page) =>
  loadoutTable(page).getByRole("rowgroup", { name: "Software" });

/** The Software section's row for a Software Family, by the game's name for it. */
const family = (page: import("@playwright/test").Page, name: string) =>
  softwareSection(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${name}`) }) });

test("software is grouped under the game's Software Family names, mandatory ones marked", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  await expect(softwareSection(page).getByRole("rowheader")).toHaveText([
    "Flight Assist Software Mandatory",
    "Docking Software",
    "Long Range Scanner Software",
    "Trading Software",
  ]);
});

test("a mandatory family of one ware is fitted, with no control", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  const flightAssist = family(page, "Flight Assist Software");
  await expect(flightAssist.getByRole("cell")).toHaveText(["Flight Assist Mk1", "1", "", "0 Cr"]);
  await expect(flightAssist.getByRole("checkbox")).toHaveCount(0);
  await expect(flightAssist.getByRole("combobox")).toHaveCount(0);
});

test("a mandatory family of several wares starts on the Ship's default, with no None, and adds it to the Price", async ({ page }) => {
  await openShip(page, "S", "Bramble Fighter");

  const docking = family(page, "Docking Software");
  await expect(docking.getByRole("rowheader")).toHaveText("Docking Software Mandatory");
  const choice = docking.getByRole("combobox", { name: "Docking Software Equipment" });
  await expect(choice).toHaveText(/Docking Computer Mk1/);
  await expect(docking.getByRole("cell").nth(3)).toHaveText("2,500 Cr");
  await expect(page.getByRole("complementary", { name: "Stats" }).getByRole("region", { name: "Price" })).toContainText(
    "102,500 Cr",
  );

  await choice.click();
  await expectOptions(page, ["Docking Computer Mk1", "Docking Computer Mk2"]);
  await page.getByRole("option", { name: "Docking Computer Mk2" }).click();
  await expect(choice).toHaveText(/Docking Computer Mk2/);
  await expect(docking.getByRole("cell").nth(3)).toHaveText("10,000 Cr");
});

test("a mandatory family starts on the Ship's default ware and doesn't offer the wares before it", async ({ page }) => {
  // The Needle's default is the Docking Computer Mk2, and the Mk1 is on its fit list too, as on the Y-wing Longprobe.
  await openShip(page, "S", "Needle Striker");

  const docking = family(page, "Docking Software");
  await expect(docking.getByRole("cell")).toHaveText(["Docking Computer Mk2", "1", "", "10,000 Cr"]);
  await expect(docking.getByRole("combobox")).toHaveCount(0);
  await expect(softwareSection(page)).not.toContainText("Docking Computer Mk1");
});

test("an optional family of one ware is a toggle", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  const scanner = family(page, "Long Range Scanner Software");
  const toggle = scanner.getByRole("checkbox", { name: "Long Scanner" });
  await expect(toggle).not.toBeChecked();
  await expect(scanner.getByRole("cell").nth(3)).toHaveText("");

  await toggle.check();
  await expect(scanner.getByRole("cell").nth(3)).toHaveText("11,000 Cr");
  await toggle.uncheck();
  await expect(scanner.getByRole("cell").nth(3)).toHaveText("");
});

test("an optional family of several wares starts at None and fits at most one", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  const trading = family(page, "Trading Software");
  const choice = trading.getByRole("combobox", { name: "Trading Software Equipment" });
  await expect(choice).toHaveText(/None/);

  await choice.click();
  await expectOptions(page, ["None", "Trading Computer Mk1", "Trading Computer Mk2"]);
  await page.getByRole("option", { name: "Trading Computer Mk2" }).click();
  await expect(trading.getByRole("cell").nth(3)).toHaveText("50,000 Cr");

  await choice.click();
  await page.getByRole("option", { name: "Trading Computer Mk1" }).click();
  await expect(choice).toHaveText(/Trading Computer Mk1/);
  await expect(trading.getByRole("cell").nth(3)).toHaveText("25,000 Cr");

  await choice.click();
  await page.getByRole("option", { name: "None" }).click();
  await expect(choice).toHaveText(/None/);
  await expect(trading.getByRole("cell").nth(3)).toHaveText("");
});

test("software never shows the mandatory-missing mark", async ({ page }) => {
  await openShip(page, "S", "Bramble Fighter");

  // Only the engines and the thruster are missing: mandatory software is always fitted (ADR 0006).
  await expect(page.getByRole("toolbar").getByRole("button", { name: /2 mandatory missing/ })).toBeVisible();
  await expect(softwareSection(page).getByLabel("Mandatory upgrade missing")).toHaveCount(0);
});
