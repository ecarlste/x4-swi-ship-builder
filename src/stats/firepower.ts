/**
 * Weapon and turret output, from the formulas confirmed in game (#12, #8, #39).
 * Damage is against hull: a bullet's `value + noshield`, a missile's
 * `explosiondamage value + hull`, times the barrels.
 */
import type { Equipment } from "../gameData.ts";
import { type GameDataIndex } from "../gameDataIndex.ts";

type Gun = Extract<Equipment, { kind: "weapon" | "turret" }>;
type Missile = Extract<Equipment, { kind: "missile" }>;

/** One weapon's or turret's output. */
export interface GunOutput {
  /** Shots per second. */
  rateOfFire: number;
  /** Damage per second while it fires. */
  burst: number;
  /** Damage per second over fire-until-overheated and cool-down-to-zero cycles. */
  sustained: number;
}

/**
 * A gun's output. A missile launcher fires `missile`, and does nothing
 * without one; it has no heat, so its sustained output equals its burst.
 */
export function gunOutput(gun: Gun, missile?: Missile): GunOutput {
  if (gun.missiles !== null) {
    if (!missile) return { rateOfFire: 0, burst: 0, sustained: 0 };
    // Each shot fires `missile@barrelamount` missiles (#39: the Light Rocket's 3).
    const rateOfFire = 1 / missile.reloadTime;
    const burst = (missile.explosionDamage + missile.hullDamage) * missile.barrelAmount * rateOfFire;
    return { rateOfFire, burst, sustained: burst };
  }
  // With a magazine, the reload between magazines counts. A turret macro's own reload is ignored.
  const rateOfFire = gun.magazine
    ? gun.magazine.size / (gun.magazine.reloadTime + gun.magazine.size / gun.fireRate)
    : gun.fireRate;
  const burst = (gun.damage.value + gun.damage.noShield) * gun.barrelAmount * rateOfFire;
  return { rateOfFire, burst, sustained: burst * heatUptime(gun, rateOfFire) };
}

/**
 * The missile a launcher fires from the Loadout's consumables: the first
 * loaded missile in the launcher's fit list.
 */
export function launcherMissile(
  gun: Gun,
  consumables: Record<string, number>,
  { fitLists, equipment }: GameDataIndex,
): Missile | undefined {
  if (gun.missiles === null) return undefined;
  const id = (fitLists.get(gun.missiles) ?? []).find((m) => (consumables[m] ?? 0) > 0);
  const item = id === undefined ? undefined : equipment.get(id);
  return item?.kind === "missile" ? item : undefined;
}

/**
 * The share of time a gun fires: it fires until overheated, then cools from
 * `overheat` all the way to 0 after `cooldelay`. It doesn't cool while firing.
 */
function heatUptime(gun: Gun, rateOfFire: number): number {
  if (!gun.heat || gun.heat.perShot === 0) return 1;
  const tFire = gun.heat.overheat / (gun.heat.perShot * rateOfFire);
  const tCool = gun.heat.coolDelay + gun.heat.overheat / gun.heat.coolRate;
  return tFire / (tFire + tCool);
}
