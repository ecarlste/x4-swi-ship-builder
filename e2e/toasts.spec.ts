/**
 * Status messages and errors appear as toasts: status toasts stack and close by themselves, error
 * toasts stay until dismissed, and neither takes focus. The Repairs notice stays an Alert on the page.
 */
import { expect, test, type Page } from "@playwright/test";
import { pickShip, toasts } from "./helpers.ts";

const toolbarButton = (page: Page, name: string) =>
  page.getByRole("toolbar").getByRole("button", { name, exact: true });

/** The toast reading this text. */
const toast = (page: Page, text: string | RegExp) => toasts(page).getByRole("dialog").filter({ hasText: text });

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.clock.install();
  await page.goto("/");
});

test("status toasts stack, and each closes by itself after a few seconds", async ({ page }) => {
  await pickShip(page, "S", "Swiftwing Courier");
  await toolbarButton(page, "Save").click();
  await page.getByRole("dialog", { name: "Save Loadout" }).getByRole("button", { name: "Save" }).click();
  await toolbarButton(page, "Copy link").click();

  await expect(toast(page, "Saved “Swiftwing Courier”.")).toBeVisible();
  await expect(toast(page, "Link copied to the clipboard.")).toBeVisible();

  await page.clock.runFor(10_000);
  await expect(toasts(page).getByRole("dialog")).toHaveCount(0);
});

test("a status toast is announced politely without taking focus", async ({ page }) => {
  await pickShip(page, "S", "Swiftwing Courier");
  const copyLink = toolbarButton(page, "Copy link");
  await copyLink.click();

  await expect(toast(page, "Link copied")).toBeVisible();
  await expect(toasts(page)).toHaveAttribute("aria-live", "polite");
  await expect(copyLink).toBeFocused();
});

test("an error toast stays until it's dismissed by keyboard", async ({ page }) => {
  const exportButton = toolbarButton(page, "Export");
  await exportButton.click();
  const error = toast(page, "There are no Saved Loadouts to export.");
  await expect(error).toBeVisible();
  await expect(exportButton).toBeFocused();

  await page.clock.runFor(60_000);
  await expect(error).toBeVisible();

  // F6 moves focus into the toast region; Tab reaches the toast, then its Dismiss button.
  await page.keyboard.press("F6");
  await page.keyboard.press("Tab");
  await expect(error).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(error.getByRole("button", { name: "Dismiss" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(error).toBeHidden();
});
