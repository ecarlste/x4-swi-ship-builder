import type { MergeLog } from "./merge.ts";

/** Renders `extract-report.md`: what the maintainer should review after an extraction. */
export function renderReport(log: MergeLog): string {
  return [
    "# Extraction report",
    "",
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
  ].join("\n");
}

function table(headers: string[], rows: string[][]): string[] {
  if (rows.length === 0) return ["None.", ""];
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => cell.replaceAll("|", "\\|")).join(" | ")} |`),
    "",
  ];
}
