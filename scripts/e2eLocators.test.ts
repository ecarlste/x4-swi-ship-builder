import { describe, expect, it } from "vitest";
import { findMarkupLocators } from "./e2eLocators.ts";

describe("findMarkupLocators", () => {
  it("finds a getByTitle call, with its line", () => {
    const source = ['import { test } from "@playwright/test";', "", '  await page.getByTitle("Shield").click();'].join("\n");
    expect(findMarkupLocators(source)).toEqual([{ line: 3, text: 'await page.getByTitle("Shield").click();' }]);
  });

  it.each([
    ['await expect(slot).toHaveAttribute("title", "Shield");'],
    ["await expect(slot).toHaveAttribute('title', 'Shield');"],
    ['await expect(slot).toHaveClass(/selected/);'],
    ['await page.getByRole("combobox").selectOption("Shield");'],
  ])("finds %s", (line) => {
    expect(findMarkupLocators(line)).toEqual([{ line: 1, text: line }]);
  });

  it("finds a title assertion whose arguments start on the next line, at the line the call starts", () => {
    const source = ["await expect(slot).toHaveAttribute(", '  "title",', '  "Shield",', ");"].join("\n");
    expect(findMarkupLocators(source)).toEqual([{ line: 1, text: "await expect(slot).toHaveAttribute(" }]);
  });

  it("leaves other attribute assertions alone", () => {
    const source = [
      'await expect(link).toHaveAttribute("href", "https://example.com");',
      'await expect(option).toHaveAttribute("aria-selected", "true");',
      'await expect(option).not.toHaveAttribute("aria-describedby");',
    ].join("\n");
    expect(findMarkupLocators(source)).toEqual([]);
  });

  it.each([
    ['const slot = page.locator(".slot-row");'],
    ["const slot = page.locator('#weapons');"],
    ['const slot = page.locator("[data-slot=shield]");'],
    ['const slot = page.locator("div.slot-row");'],
    ['const slot = table.locator("tr > td.name");'],
  ])("finds the markup selector in %s", (line) => {
    expect(findMarkupLocators(line)).toEqual([{ line: 1, text: line }]);
  });

  it("leaves a locator alone whose string is not a markup selector", () => {
    const source = ['const footer = page.locator("footer");', 'const body = page.locator("body");'].join("\n");
    expect(findMarkupLocators(source)).toEqual([]);
  });

  it("reports one finding per call, even when several patterns match it", () => {
    const source = 'await expect(page.locator(".slot")).toHaveClass(/on/);';
    expect(findMarkupLocators(source)).toHaveLength(2);
  });
});
