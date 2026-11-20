import type { Licence } from "../gameData.ts";

/** "Fixture Arms Licence (+10)", or just the name when the reputation isn't known. */
export function licenceText(licence: Licence | undefined): string {
  if (!licence) return "no Licence needed";
  if (licence.reputation === null) return licence.name;
  const sign = licence.reputation >= 0 ? "+" : "";
  return `${licence.name} (${sign}${licence.reputation})`;
}
