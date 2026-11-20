/**
 * Weapon and turret output, from the formulas confirmed in game (#12, #8, #39).
 * Damage is against hull: a bullet's `value + noshield + hull` (#63, #67), a missile's
 * `explosiondamage value + hull`, times the barrels.
 */
import type { Equipment } from "../gameData.ts";
import { type GameDataIndex } from "../gameDataIndex.ts";

export type Gun = Extract<Equipment, { kind: "weapon" | "turret" }>;
export type Missile = Extract<Equipment, { kind: "missile" }>;

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
  // With a magazine, the reload between magazines counts (#63: the KV22's 1,744).
  // A turret macro's own reload is ignored.
  const rateOfFire = gun.magazine
    ? gun.magazine.size / (gun.magazine.reloadTime + gun.magazine.size / gun.fireRate)
    : gun.fireRate;
  // Each shot fires the bullet's `barrelamount` (#63: the QD Quad's 4).
  const burst = shotDamage(gun) * gun.barrelAmount * rateOfFire;
  return { rateOfFire, burst, sustained: burst * heatUptime(gun, rateOfFire) };
}

/**
 * A bullet's damage per shot and barrel against hull: `value + noshield + hull`.
 * `hull` confirmed in game by the Mining Beam Turret (#63, #67).
 * unconfirmed (#77): a bullet with both `hull` and `noshield`, such as
 * `turret_l_mando_massdriver`. No reference gun has both.
 */
export function shotDamage(gun: Gun): number {
  return gun.damage.value + gun.damage.noShield + gun.damage.hull;
}

/**
 * The missiles a launcher can fire, highest output first, in its fit list's
 * order on a tie; none for a gun.
 */
export function missilesBestFirst(gun: Gun, { fitLists, equipment }: GameDataIndex): Missile[] {
  if (gun.missiles === null) return [];
  return (fitLists.get(gun.missiles) ?? [])
    .flatMap((id) => {
      const item = equipment.get(id);
      return item?.kind === "missile" ? [{ missile: item, burst: gunOutput(gun, item).burst }] : [];
    })
    .sort((a, b) => b.burst - a.burst)
    .map(({ missile }) => missile);
}

/**
 * The missile a launcher fires from the Loadout's consumables: its loaded
 * compatible missile with the highest output, the first in its fit list on a
 * tie, or none. This is the builder's rule, not the game's, which fires the
 * last compatible missile by ware id whatever is loaded (ADR 0002).
 */
export function launcherMissile(gun: Gun, consumables: Record<string, number>, index: GameDataIndex): Missile | undefined {
  return missilesBestFirst(gun, index).find((m) => (consumables[m.id] ?? 0) > 0);
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
