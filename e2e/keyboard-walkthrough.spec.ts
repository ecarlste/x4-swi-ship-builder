/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";
import { fit, openShip } from "./helpers.ts";

/** Where a focused control sits on the page, in reading order. */
type Area = "toolbar" | "saved" | "table" | "stats" | "footer" | "other";

interface Stop {
  area: Area;
  name: string;
  ring: boolean;
}

/** Describes the focused control: its area of the page, its name, and whether it shows a focus ring. */
function focused(page: Page): Promise<Stop | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const section = el.closest("section");
    const saved = section?.querySelector("h2, h3")?.textContent?.trim() === "Saved Loadouts";
    const area = el.closest('[role="toolbar"]')
      ? "toolbar"
      : saved
        ? "saved"
        : el.closest("aside")
          ? "stats"
          : el.closest("table")
            ? "table"
            : el.closest("footer")
              ? "footer"
              : "other";
    // A ring is something focus adds: compare the control focused with the same control blurred.
    const look = () => {
      const style = getComputedStyle(el);
      return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor} | ${style.boxShadow}`;
    };
    const withFocus = look();
    el.blur();
    const without = look();
    el.focus();
    const name = el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 40);
    return { area, name: `${el.tagName.toLowerCase()} ${name}`, ring: withFocus !== without };
  }) as Promise<Stop | null>;
}

/** Presses Tab through the whole page once, recording every control focus lands on. */
async function walk(page: Page): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let presses = 0; presses < 200; presses++) {
    await page.keyboard.press("Tab");
    const stop = await focused(page);
    if (!stop) {
      if (stops.length > 0) break; // focus left the page: the walk is done
      continue;
    }
    const same = (other?: Stop) => other?.area === stop.area && other.name === stop.name;
    if (same(stops.at(-1))) continue;
    if (same(stops[0])) break; // focus wrapped round to the first control
    stops.push(stop);
  }
  return stops;
}

test("Tab reaches every control in reading order, each with a visible focus ring", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Pulse Blaster");
  await page.getByRole("toolbar").getByRole("button", { name: "Save", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Save Loadout" });
  await dialog.getByRole("textbox").fill("Walk-through");
  await dialog.getByRole("button", { name: "Save" }).click();
  await fit(page, /con_weapon_01/, "Zephyr Cannon"); // a change since loading adds a row mark
  await page.getByRole("button", { name: "Saved Loadouts" }).click();
  await expect(page.getByRole("region", { name: "Saved Loadouts" })).toBeVisible();

  // Rings fade in; without transitions a ring shows the moment focus lands, so it can be measured.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; }" });
  await page.mouse.click(1, 1); // start the walk from the top of the page
  const stops = await walk(page);

  // The page reads top to bottom: toolbar, the Saved Loadouts list under it, the Loadout table,
  // the stats beside it, then the footer.
  const order: Area[] = ["toolbar", "saved", "table", "stats", "footer"];
  const areas = stops.map((s) => s.area);
  expect(areas).not.toContain("other");
  for (const area of ["toolbar", "saved", "table", "footer"] as const) expect(areas).toContain(area);
  const ranks = areas.map((a) => order.indexOf(a));
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

  expect(stops.filter((s) => !s.ring)).toEqual([]);
});
