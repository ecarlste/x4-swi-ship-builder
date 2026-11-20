import type { MergeLog } from "./merge.ts";

/**
 * Renders `extract-report.md`: what the maintainer should review after an
 * extraction. The merge log comes from Stage 1; Stage 2 adds its own
 * sections (already rendered lines) after it.
 */
export function renderReport(log: MergeLog | undefined, sections: string[] = []): string {
  return [
    "# Extraction report",
    "",
    ...(log ? mergeLog(log) : []),
    ...sections,
  ].join("\n");
}

function mergeLog(log: MergeLog): string[] {
  return [
    "## Merge log",
    "",
    "These merges follow rules assumed in #6, not checked in game. Check in game only if a Ship or",
    "Equipment we care about is affected.",
    "",
    "### Library files merged without a `<diff>` root",
    "",
    ...table(
      ["File", "Merged from"],
      log.merges.map((m) => [m.path, m.source]),
    ),
    "### Duplicate ids (the later definition wins)",
    "",
    ...table(
      ["File", "Entry", "Earlier definition", "Later definition"],
      log.duplicates.map((d) => [d.path, d.entry, d.earlier, d.later]),
    ),
    "### Whole-file replacements",
    "",
    ...table(
      ["File", "Replaced", "By"],
      log.replacements.map((r) => [r.path, r.replaced, r.by]),
    ),
    "### Patches skipped: no earlier layer has the file (allowlisted in extract/config.ts)",
    "",
    ...table(
      ["File", "Patch"],
      log.orphanPatches.map((p) => [p.path, p.source]),
    ),
    "### Patch removals that matched nothing (allowlisted in extract/config.ts)",
    "",
    ...table(
      ["File", "Patch", "Selector"],
      log.unmatchedRemovals.map((r) => [r.path, r.source, r.sel]),
    ),
  ];
}

/** A Markdown table, or "None." when there are no rows. */
export function table(headers: string[], rows: string[][]): string[] {
  if (rows.length === 0) return ["None.", ""];
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => cell.replaceAll("|", "\\|")).join(" | ")} |`),
    "",
  ];
}
