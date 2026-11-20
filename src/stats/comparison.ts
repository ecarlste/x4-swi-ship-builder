/**
 * The comparison popover's figures (#10, #23): one piece of Equipment's own
 * figures, by kind, each with its difference from the fitted item. Slot Group
 * items count as one unit. A launcher's figures are one row per missile it
 * can fire (#65, ADR 0002).
 */
import type { Equipment, GameData } from "../gameData.ts";
import { indexGameData, type GameDataIndex } from "../gameDataIndex.ts";
import type { Loadout } from "../builder/loadout.ts";
import { gunOutput, launcherMissile, missilesBestFirst, type Gun, type Missile } from "./firepower.ts";

export type Verdict = "better" | "worse" | "same";

export interface Figure {
  label: string;
  unit: string;
  /** The option's value, rounded down like the stat rows. */
  shown: number;
  /** The option's shown value minus the fitted item's (0 when nothing is fitted). */
  difference: number;
  verdict: Verdict;
}

/** The option's average price against the fitted item's; a lower price is better. */
export interface PriceDifference {
  shown: number;
  difference: number;
  verdict: Verdict;
}

/** A hovered launcher's output with one missile it can fire, or with none. */
export interface MissileRow {
  /** The missile, or null for the "No missile" row. */
  missile: Missile | null;
  /** Whether this is the row the stats panel would use: the best loaded missile, or none. */
  loaded: boolean;
  /** Burst and Sustained Output, each with its difference from the fitted item. */
  figures: Figure[];
}

export interface Comparison {
  /** The option's figures; empty for a launcher, whose figures are its missile rows. */
  figures: Figure[];
  /** For a launcher, its missiles best first, then "No missile"; null for anything else. */
  missiles: MissileRow[] | null;
  price: PriceDifference;
}

interface RawFigure {
  label: string;
  unit: string;
  decimals: number;
  value: number;
}

function floorTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.floor(value * scale) / scale;
}

/** A gun's output as figures: a launcher's with `missile`, or with none. */
function outputFigures(gun: Gun, missile: Missile | undefined): RawFigure[] {
  const output = gunOutput(gun, missile);
  return [
    { label: "Burst Output", unit: "MW", decimals: 0, value: output.burst },
    { label: "Sustained Output", unit: "MW", decimals: 0, value: output.sustained },
  ];
}

/** An item's own figures, by kind, as the stats panel computes them for this Loadout. */
function figures(index: GameDataIndex, loadout: Loadout, item: Equipment): RawFigure[] {
  switch (item.kind) {
    case "weapon":
    case "turret":
      return outputFigures(item, launcherMissile(item, loadout.consumables ?? {}, index));
    case "shield":
      return [
        { label: "Shield Capacity", unit: "MJ", decimals: 0, value: item.capacity },
        { label: "Recharge Rate", unit: "MW", decimals: 0, value: item.rechargeRate },
      ];
    case "engine":
      return [
        { label: "Thrust", unit: "N", decimals: 0, value: item.thrust.forward },
        // unconfirmed (#63): no in-game screen has been checked for this figure.
        { label: "Travel Thrust", unit: "N", decimals: 0, value: item.thrust.forward * item.travel.thrust },
      ];
    case "thruster":
      return [
        { label: "Yaw Torque", unit: "", decimals: 1, value: item.thrust.yaw },
        { label: "Pitch Torque", unit: "", decimals: 1, value: item.thrust.pitch },
        { label: "Roll Torque", unit: "", decimals: 1, value: item.thrust.roll },
      ];
    default:
      return [];
  }
}

/** Compares `option` with the `fitted` item, or with nothing when the Slot is empty. */
export function compareEquipment(
  gameData: GameData,
  loadout: Loadout,
  option: Equipment,
  fitted: Equipment | null,
): Comparison {
  const index = indexGameData(gameData);
  const theirs = fitted ? figures(index, loadout, fitted) : [];
  const against = (mine: RawFigure[]): Figure[] =>
    mine.map((f) => {
      const shown = floorTo(f.value, f.decimals);
      const other = theirs.find((t) => t.label === f.label);
      // Rounded to the figure's decimals, so float noise never shows as a difference.
      const scale = 10 ** f.decimals;
      const difference = Math.round((shown - (other ? floorTo(other.value, other.decimals) : 0)) * scale) / scale;
      return { label: f.label, unit: f.unit, shown, difference, verdict: verdict(difference) };
    });
  const isLauncher = (option.kind === "weapon" || option.kind === "turret") && option.missiles !== null;
  return {
    figures: isLauncher ? [] : against(figures(index, loadout, option)),
    missiles: isLauncher ? missileRows(index, loadout, option, against) : null,
    price: {
      shown: option.price.average,
      difference: option.price.average - (fitted?.price.average ?? 0),
      verdict: verdict((fitted?.price.average ?? 0) - option.price.average),
    },
  };
}

/** A launcher's missiles, best first (fit-list order on a tie), then "No missile". */
function missileRows(
  index: GameDataIndex,
  loadout: Loadout,
  launcher: Gun,
  against: (mine: RawFigure[]) => Figure[],
): MissileRow[] {
  const loaded = launcherMissile(launcher, loadout.consumables ?? {}, index) ?? null;
  return [...missilesBestFirst(launcher, index), null].map((missile) => ({
    missile,
    loaded: missile?.id === loaded?.id,
    figures: against(outputFigures(launcher, missile ?? undefined)),
  }));
}

function verdict(difference: number): Verdict {
  return difference > 0 ? "better" : difference < 0 ? "worse" : "same";
}
