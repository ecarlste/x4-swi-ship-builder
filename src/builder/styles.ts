/** Tailwind class sets the builder's panels share. */
import type { Verdict } from "../stats/stats.ts";

/** The Stats panel's small section headings (Ship, Stats, Price). */
export const PANEL_HEADING = "text-xs font-medium tracking-wider text-muted-foreground uppercase";

/** A difference's colour: `success` when better, `destructive` when worse, muted when the same. */
export function verdictClass(verdict: Verdict) {
  return verdict === "better" ? "text-success" : verdict === "worse" ? "text-destructive" : "text-muted-foreground";
}
