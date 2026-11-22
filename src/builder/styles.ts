/** Tailwind class sets the builder's panels share. */
import type { Verdict } from "../stats/stats.ts";

/** The Stats panel's small section headings (Ship, Stats, Price). */
export const PANEL_HEADING = "text-xs font-medium tracking-wider text-muted-foreground uppercase";

/**
 * A difference's colour: `success` when better, `destructive` when worse, muted when the same.
 * The verdict also stays on as a plain class name ("better", "worse"), which the e2e specs read.
 */
export function verdictClass(verdict: Verdict) {
  return verdict === "better" ? "better text-success" : verdict === "worse" ? "worse text-destructive" : "same text-muted-foreground";
}
