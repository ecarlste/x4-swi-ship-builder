/**
 * The comparison popover's figures (#10, #23): one piece of Equipment's own
 * figures, by kind, each with its difference from the fitted item. Slot Group
 * items count as one unit. A launcher's figures are one row per missile it
 * can fire (#65, ADR 0002). Each kind lists a figure for every Stats panel
 * row it changes (#110), as the item's own, Ship-free figure where the row
 * also depends on the Ship.
 */
import type { Equipment, GameData } from "../gameData.ts";
import { indexGameData, type GameDataIndex } from "../gameDataIndex.ts";
import type { Loadout } from "../loadout/loadout.ts";
import { gunOutput, launcherMissile, missilesBestFirst, type Gun, type Missile } from "./firepower.ts";
import { compareFigure, comparePrice, shownPrice, shownValue, type Verdict } from "./figure.ts";

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
  /** The option's figures; for a launcher, whose output is in its missile rows, only its Missile Storage. */
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
  /** Whether a fall is better, as for the Stats panel's Recharge Delay. */
  lowerIsBetter?: boolean;
}

/** A gun's output as figures: a launcher's with `missile`, or with none. */
function outputFigures(gun: Gun, missile: Missile | undefined): RawFigure[] {
  const output = gunOutput(gun, missile);
  return [
    { label: "Burst Output", unit: "MW", decimals: 0, value: output.burst },
    { label: "Sustained Output", unit: "MW", decimals: 0, value: output.sustained },
  ];
}

/** A launcher's own missile storage, which adds to the Ship's Missiles; none for any other gun. */
function storageFigures(gun: Gun): RawFigure[] {
  return gun.missiles === null ? [] : [{ label: "Missile Storage", unit: "", decimals: 0, value: gun.missileStorage }];
}

/** An item's own figures, by kind, as the stats panel computes them for this Loadout. */
function figures(index: GameDataIndex, loadout: Loadout, item: Equipment): RawFigure[] {
  switch (item.kind) {
    case "weapon":
    case "turret":
      return [
        ...outputFigures(item, launcherMissile(item, loadout.consumables ?? {}, index)),
        ...storageFigures(item),
      ];
    case "shield":
      return [
        { label: "Shield Capacity", unit: "MJ", decimals: 0, value: item.capacity },
        { label: "Recharge Rate", unit: "MW", decimals: 0, value: item.rechargeRate },
        { label: "Recharge Delay", unit: "s", decimals: 2, value: item.rechargeDelay, lowerIsBetter: true },
      ];
    case "engine":
      return [
        // In kN, as the Encyclopedia shows them; Travel Thrust is its Max Travel Thrust (#63).
        { label: "Thrust", unit: "kN", decimals: 0, value: item.thrust.forward },
        { label: "Boost Thrust", unit: "kN", decimals: 0, value: item.thrust.forward * item.boost.thrust },
        // The Stats panel's rows of the same names, which the Ship doesn't change.
        { label: "Boost Capacity", unit: "s", decimals: 1, value: item.boost.duration },
        {
          label: "Boost Recharge Rate",
          unit: "%/s",
          decimals: 1,
          value: item.boost.recharge > 0 ? 100 / item.boost.recharge : 0,
        },
        { label: "Travel Thrust", unit: "kN", decimals: 0, value: item.thrust.forward * item.travel.thrust },
        { label: "Travel Charge Time", unit: "s", decimals: 1, value: item.travel.charge, lowerIsBetter: true },
      ];
    case "thruster":
      return [
        // Strafe Speed and Strafe Acceleration each scale with it, over the Ship's drag or mass.
        { label: "Strafe Thrust", unit: "kN", decimals: 0, value: item.thrust.strafe },
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
      const shown = shownValue(f.value, f.decimals);
      const other = theirs.find((t) => t.label === f.label);
      const otherShown = other ? shownValue(other.value, other.decimals) : 0;
      return { label: f.label, unit: f.unit, shown, ...compareFigure(shown, otherShown, f) };
    });
  const isLauncher = (option.kind === "weapon" || option.kind === "turret") && option.missiles !== null;
  return {
    // A launcher's output is in its missile rows, so its figures are only its storage.
    figures: against(isLauncher ? storageFigures(option) : figures(index, loadout, option)),
    missiles: isLauncher ? missileRows(index, loadout, option, against) : null,
    price: priceDifference(option, fitted),
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

function priceDifference(option: Equipment, fitted: Equipment | null): PriceDifference {
  const average = option.price.average;
  return { shown: shownPrice(average), ...comparePrice(average, fitted?.price.average ?? 0) };
}
