/**
 * The comparison popover's figures (#10, #23): one piece of Equipment's own
 * figures, by kind, each with its difference from the fitted item. Slot Group
 * items count as one unit.
 */
import type { Equipment, GameData } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import type { Loadout } from "../builder/loadout.ts";
import { gunOutput, launcherMissile } from "./firepower.ts";

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

export interface Comparison {
  figures: Figure[];
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

/** An item's own figures, by kind. */
function figures(gameData: GameData, loadout: Loadout, item: Equipment): RawFigure[] {
  switch (item.kind) {
    case "weapon":
    case "turret": {
      const output = gunOutput(item, launcherMissile(item, loadout.consumables ?? {}, indexGameData(gameData)));
      return [
        { label: "Burst Output", unit: "MW", decimals: 0, value: output.burst },
        { label: "Sustained Output", unit: "MW", decimals: 0, value: output.sustained },
      ];
    }
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
  const mine = figures(gameData, loadout, option);
  const theirs = fitted ? figures(gameData, loadout, fitted) : [];
  return {
    figures: mine.map((f) => {
      const shown = floorTo(f.value, f.decimals);
      const other = theirs.find((t) => t.label === f.label);
      // Rounded to the figure's decimals, so float noise never shows as a difference.
      const scale = 10 ** f.decimals;
      const difference = Math.round((shown - (other ? floorTo(other.value, other.decimals) : 0)) * scale) / scale;
      return { label: f.label, unit: f.unit, shown, difference, verdict: verdict(difference) };
    }),
    price: {
      shown: option.price.average,
      difference: option.price.average - (fitted?.price.average ?? 0),
      verdict: verdict((fitted?.price.average ?? 0) - option.price.average),
    },
  };
}

function verdict(difference: number): Verdict {
  return difference > 0 ? "better" : difference < 0 ? "worse" : "same";
}
