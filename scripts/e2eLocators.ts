/**
 * Keeps e2e tests acting like the user (#153): by role, name, keyboard and
 * pointer, never by class names, titles or DOM structure. Review missed this
 * for months (#121, #124), so CI fails on the fixed patterns instead.
 *
 * Runs under plain `node` (type stripping), so it imports only Node built-ins.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** A forbidden call: the 1-based line it starts on and that line, trimmed. */
export type Finding = { line: number; text: string };

const FORBIDDEN = [
  /\bgetByTitle\(/g,
  /\btoHaveAttribute\(\s*["'`]title["'`]/g,
  /\btoHaveClass\(/g,
  /\bselectOption\(/g,
];

/** A `locator()` call with a quoted string; group 2 is the selector. */
const LOCATOR = /\blocator\(\s*(["'`])(.*?)\1/g;

/**
 * A selector that names a class, id or attribute: `.slot`, `#weapons`,
 * `[data-x]`, or a tag with one (`div.slot`, `tr > td.name`). The tag must
 * start a selector token, so text in `text=Saved.` or the name filter in
 * `role=button[name="Save"]` isn't taken for one.
 */
const MARKUP_SELECTOR = /^[.#[]|(?:^|[\s>+~,(])[a-z][a-z0-9-]*[.#[]/i;

/** Every call in an e2e source file that locates or asserts by markup. */
export function findMarkupLocators(source: string): Finding[] {
  const lines = source.split(/\r?\n/);
  const starts: number[] = [];
  for (const pattern of FORBIDDEN) {
    for (const match of source.matchAll(pattern)) starts.push(match.index);
  }
  for (const match of source.matchAll(LOCATOR)) {
    if (MARKUP_SELECTOR.test(match[2])) starts.push(match.index);
  }
  return starts
    .sort((a, b) => a - b)
    .map((index) => {
      const line = source.slice(0, index).split("\n").length;
      return { line, text: lines[line - 1].trim() };
    });
}

/** Every `.ts` file under `dir`, at any depth, in a stable order. */
function tsFilesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".ts"))
    .sort()
    .map((path) => join(dir, path));
}

const USAGE = "usage: node scripts/e2eLocators.ts [dir]";

function main([dir = "e2e", ...rest]: string[]): number {
  if (rest.length > 0) {
    console.error(USAGE);
    return 2;
  }
  const findings = tsFilesUnder(dir).flatMap((file) =>
    findMarkupLocators(readFileSync(file, "utf8")).map(({ line, text }) => `${file}:${line}: ${text}`),
  );
  if (findings.length === 0) return 0;
  console.error("e2e tests locate or assert by markup. Use getByRole, getByLabel or getByText, and assert what the user sees:");
  for (const finding of findings) console.error(`  ${finding}`);
  return 1;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
