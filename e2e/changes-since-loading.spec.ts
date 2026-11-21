import { expect, test, type Page } from "@playwright/test";
import { fit, loadoutTable, pickShip, row } from "./helpers.ts";

const stats = (page: Page) => page.getByRole("complementary", { name: "Stats" });
/** The cells of the first Stats row with this label: its value, then its change once there is one. */
const statCells = (page: Page, label: string) =>
  stats(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) })
    .first()
    .getByRole("cell");

/** Every "was: …" line in the Loadout table. */
const wasLines = (page: Page) => loadoutTable(page).getByText(/^was: /);
/** Every Loadout table row marked as changed since loading. */
const changedMarks = (page: Page) => loadoutTable(page).getByTitle("Changed since loading");

const saveButton = (page: Page) => page.getByRole("toolbar").getByRole("button", { name: "Save", exact: true });

async function saveAs(page: Page, name: string) {
  await saveButton(page).click();
  const dialog = page.getByRole("dialog", { name: "Save Loadout" });
  await dialog.getByRole("textbox", { name: "Name" }).fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
}

async function openSaved(page: Page, name: string) {
  await page.getByRole("button", { name: "Saved Loadouts" }).click();
  await page
    .getByRole("region", { name: "Saved Loadouts" })
    .getByRole("listitem")
    .filter({ hasText: name })
    .getByRole("button", { name: "Open" })
    .click();
}

/** Stores a Saved Loadout of the Swiftwing Courier with a Bubble Shield S fitted, then reloads. */
async function storeCourierWithShield(page: Page) {
  await page.evaluate(() =>
    localStorage.setItem(
      "swi-builder:saved-loadouts:v1",
      JSON.stringify([
        {
          format: 1,
          gameData: { swi: "999", x4: "9.99" },
          ship: "fx_courier",
          slots: { con_shield_01: "fx_shield_s" },
          id: "6f1c1f2e-5d2b-4c1a-9a3e-0b7f6c2d9e11",
          name: "Shielded Courier",
          createdAt: "2026-11-01T10:00:00.000Z",
          updatedAt: "2026-11-01T10:00:00.000Z",
        },
      ]),
    ),
  );
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("editing an opened Saved Loadout shows the change column and a was line on the changed row", async ({ page }) => {
  await storeCourierWithShield(page);
  await openSaved(page, "Shielded Courier");

  await expect(statCells(page, "Shield (MJ)")).toHaveText(["1,000"]);
  await expect(wasLines(page)).toHaveCount(0);

  await fit(page, /con_shield_01/, "— empty —");

  await expect(statCells(page, "Shield (MJ)")).toHaveText(["0", "−1,000"]);
  await expect(statCells(page, "Shield (MJ)").nth(1)).toHaveClass(/worse/);
  await expect(statCells(page, "Recharge Rate (MW)")).toHaveText(["0", "−100"]);
  // Rows the edit left alone get an empty change cell.
  await expect(statCells(page, "Hull (MJ)")).toHaveText(["3,000", ""]);
  await expect(stats(page).getByRole("region", { name: "Price" })).toContainText("−9,000 Cr");
  // A lower Price is better.
  await expect(stats(page).getByRole("region", { name: "Price" }).getByText("−9,000 Cr")).toHaveClass(/better/);

  await expect(row(page, /con_shield_01/)).toContainText("was: Bubble Shield S");
  await expect(changedMarks(page)).toHaveCount(1);
  await expect(row(page, /con_shield_01/).getByTitle("Changed since loading")).toBeVisible();
});

test("a Slot Group row shows what it held, with its count", async ({ page }) => {
  await pickShip(page, "L", "Ironback Hauler");
  await fit(page, /Shields group_front/, "Bubble Shield M");
  await saveAs(page, "Hauler");

  await row(page, /Shields group_front/).getByRole("spinbutton").fill("1");

  await expect(row(page, /Shields group_front/)).toContainText("was: Bubble Shield M ×2");
  await expect(statCells(page, "Avg. Group Shield (MJ)")).toHaveText(["5,000", "−5,000"]);
});
