import { expect, test, type Locator, type Page } from "@playwright/test";

const toolbarButton = (page: Page, name: string) =>
  page.getByRole("toolbar").getByRole("button", { name, exact: true });
const shipPicker = (page: Page) => page.getByRole("combobox", { name: "Ship" });
const shipOptions = (page: Page) => page.getByRole("listbox", { name: "Ships" }).getByRole("option");

/** Moves focus forward with Tab until it lands on this control, as a keyboard user would. */
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 30; presses++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === el.ownerDocument.activeElement)) return;
  }
  throw new Error("Tab never reached the control");
}

/** Picks a Ship with the keyboard only: Tab to the picker, type part of its name, Enter. */
async function pickShipByKeyboard(page: Page, typed: string) {
  await tabTo(page, shipPicker(page));
  await page.keyboard.type(typed);
  await page.keyboard.press("Enter");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("Size is picked with the keyboard: open it, move with the arrow keys, pick with Enter", async ({ page }) => {
  const size = page.getByRole("combobox", { name: "Size" });
  await tabTo(page, size);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "S", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(size).toHaveText("M");
  await shipPicker(page).click();
  await expect(shipOptions(page)).toHaveText([/^Lancer Gunship \(Corsair Clans\)/, /^Lancer Gunship \(Freight Guild\)/]);
});

test("Seller is picked with the keyboard, opening it with the arrow keys", async ({ page }) => {
  const seller = page.getByRole("combobox", { name: "Seller" });
  await tabTo(page, seller);
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Any", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(seller).toHaveText("Corsair Clans");
  await shipPicker(page).click();
  await expect(shipOptions(page)).toHaveText([/^Bramble Fighter/, /^Needle Striker/]);
});

test("a Ship is picked with the keyboard: type to search, move with the arrow keys, pick with Enter", async ({ page }) => {
  await tabTo(page, shipPicker(page));
  await page.keyboard.type("i");
  // Bramble Fighter, Swiftwing Courier, then Needle Striker in the next group.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(shipPicker(page)).toHaveValue("Needle Striker");
  await expect(page.getByRole("heading", { name: "Needle Striker" })).toBeVisible();
});

test("Escape closes the Ship picker without changing the Ship", async ({ page }) => {
  await pickShipByKeyboard(page, "swiftwing");
  await expect(page.getByRole("heading", { name: "Swiftwing Courier" })).toBeVisible();

  await page.keyboard.press("Control+a");
  await page.keyboard.type("needle");
  await expect(shipOptions(page)).toHaveCount(1);
  await page.keyboard.press("Escape");

  await expect(page.getByRole("listbox", { name: "Ships" })).toBeHidden();
  await expect(shipPicker(page)).toHaveValue("Swiftwing Courier");
  await expect(page.getByRole("heading", { name: "Swiftwing Courier" })).toBeVisible();
  await expect(page).toHaveTitle("Swiftwing Courier · X4: SWI Ship Builder");
});

test("toolbar actions are triggered from the keyboard with Enter or Space", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // One Saved Loadout, so Export has something to download.
  await page.evaluate(
    (value) => localStorage.setItem("swi-builder:saved-loadouts:v1", value),
    JSON.stringify([
      {
        format: 1,
        gameData: { swi: "999", x4: "9.99" },
        ship: "fx_courier",
        id: "6f1c1f2e-5d2b-4c1a-9a3e-0b7f6c2d9e11",
        name: "Escort",
        createdAt: "2026-11-01T10:00:00.000Z",
        updatedAt: "2026-11-01T10:00:00.000Z",
      },
    ]),
  );
  await page.reload();

  // Saved Loadouts opens with Enter and closes with Space.
  const saved = toolbarButton(page, "Saved Loadouts");
  await tabTo(page, saved);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Saved Loadouts" })).toBeVisible();
  await page.keyboard.press(" ");
  await expect(page.getByRole("region", { name: "Saved Loadouts" })).toBeHidden();

  // Export downloads a Loadout File.
  const download = page.waitForEvent("download");
  await tabTo(page, toolbarButton(page, "Export"));
  await page.keyboard.press("Enter");
  expect((await download).suggestedFilename()).toMatch(/\.json$/);

  // Import asks for a file.
  const chooser = page.waitForEvent("filechooser");
  await tabTo(page, toolbarButton(page, "Import"));
  await page.keyboard.press(" ");
  await chooser;

  await page.goto("/");
  await pickShipByKeyboard(page, "swiftwing");

  // Copy link copies a Share Link.
  await tabTo(page, toolbarButton(page, "Copy link"));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Link copied");

  // Save asks for a name.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(toolbarButton(page, "Save")).toBeFocused();
  await page.keyboard.press(" ");
  await expect(page.getByRole("dialog", { name: "Save Loadout" })).toBeVisible();
});

test("disabled toolbar actions don't respond and Tab passes over them", async ({ page }) => {
  await expect(toolbarButton(page, "Save")).toBeDisabled();
  await expect(toolbarButton(page, "Copy link")).toBeDisabled();

  await tabTo(page, toolbarButton(page, "Saved Loadouts"));
  await page.keyboard.press("Tab");
  await expect(toolbarButton(page, "Export")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(toolbarButton(page, "Import")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(toolbarButton(page, "Copy link")).not.toBeFocused();

  await toolbarButton(page, "Save").click({ force: true });
  await expect(page.getByRole("dialog", { name: "Save Loadout" })).toBeHidden();
});
