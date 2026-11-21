/**
 * Flight figures of one piece of Equipment, which the Stats panel and the
 * comparison popover both show.
 */
import type { Equipment } from "../gameData.ts";

/** An engine's Boost Recharge Rate in %/s: `boost@recharge` is the seconds for a full recharge. */
export const boostRechargeRate = (engine: Extract<Equipment, { kind: "engine" }>): number =>
  engine.boost.recharge > 0 ? 100 / engine.boost.recharge : 0;
