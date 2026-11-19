// PROTOTYPE — throwaway. Hand-made STUB Game Data shaped like the decided model
// (Ships with Slots and Slot Groups, precomputed compatibility, game-style ids).
// Names are illustrative; numbers are invented. Not real SWI Game Data.

export type Size = "S" | "M" | "L" | "XL";
export type SlotKind = "weapon" | "turret" | "shield" | "engine" | "thruster";
export type ConsumableKind = "missile" | "drone" | "countermeasure" | "deployable";
export type SoftwareGroup = "docking" | "flight" | "targeting" | "scanner" | "trading";

export interface Price { min: number; avg: number; max: number }

export interface Equipment {
  id: string; name: string; kind: SlotKind; size: Size; price: Price;
  sellers: string[];
  dps?: number; sustained?: number; // weapons/turrets
  shield?: number; recharge?: number; delay?: number; // shields
  thrust?: number; boost?: number; travel?: number; // engines
  torque?: number; // thrusters
}
export interface Consumable { id: string; name: string; kind: ConsumableKind; price: Price; sellers: string[] }
export interface Software { id: string; name: string; group: SoftwareGroup; price: Price }

export interface Slot { id: string; kind: SlotKind; size: Size; mandatory: boolean; compatible: string[] }
export interface SlotGroupPart { kind: "turret" | "shield"; max: number; compatible: string[] }
export interface SlotGroup { id: string; name: string; parts: SlotGroupPart[] }

export interface Ship {
  id: string; name: string; size: Size; klass: string; sellers: string[]; licence?: string;
  price: Price; hull: number; mass: number; drag: number; inertia: number; radar: number;
  slots: Slot[]; groups: SlotGroup[];
  capacity: Record<ConsumableKind, number>;
  software: { group: SoftwareGroup; options: string[]; mandatoryDefault?: string }[];
}

const p = (avg: number): Price => ({ min: Math.round(avg * 0.85), avg, max: Math.round(avg * 1.15) });

export const EQUIPMENT: Equipment[] = [
  // S weapons
  { id: "weapon_sw_l85_s", name: "L-s9.3 Laser Cannon", kind: "weapon", size: "S", price: p(41200), sellers: ["Rebel Alliance"], dps: 412, sustained: 268 },
  { id: "weapon_sw_ky28_s", name: "KY28 Laser Cannon", kind: "weapon", size: "S", price: p(38900), sellers: ["Galactic Empire"], dps: 389, sustained: 301 },
  { id: "weapon_sw_ion_s", name: "Ion Cannon Mk1", kind: "weapon", size: "S", price: p(52000), sellers: ["Rebel Alliance", "Black Sun"], dps: 220, sustained: 220 },
  { id: "weapon_sw_protorp_s", name: "Proton Torpedo Launcher", kind: "weapon", size: "S", price: p(64000), sellers: ["Rebel Alliance"], dps: 150, sustained: 150 },
  // M weapons
  { id: "weapon_sw_quadlaser_m", name: "Quad Laser Cannon", kind: "weapon", size: "M", price: p(118000), sellers: ["Black Sun", "Rebel Alliance"], dps: 1240, sustained: 790 },
  { id: "weapon_sw_heavylaser_m", name: "Heavy Laser Cannon", kind: "weapon", size: "M", price: p(132000), sellers: ["Galactic Empire"], dps: 1380, sustained: 860 },
  // turrets
  { id: "turret_sw_pointdef_m", name: "Point-Defence Laser Turret", kind: "turret", size: "M", price: p(96000), sellers: ["Galactic Empire", "Rebel Alliance"], dps: 640, sustained: 640 },
  { id: "turret_sw_quadturret_m", name: "Quad Laser Turret", kind: "turret", size: "M", price: p(141000), sellers: ["Rebel Alliance"], dps: 1120, sustained: 820 },
  { id: "turret_sw_turbolaser_l", name: "Heavy Turbolaser Turret", kind: "turret", size: "L", price: p(612000), sellers: ["Galactic Empire"], dps: 4800, sustained: 3100 },
  { id: "turret_sw_ionturret_l", name: "Ion Cannon Turret", kind: "turret", size: "L", price: p(540000), sellers: ["Rebel Alliance", "Galactic Empire"], dps: 2600, sustained: 2600 },
  // shields
  { id: "shield_sw_s_mk1", name: "Deflector Shield S Mk1", kind: "shield", size: "S", price: p(21000), sellers: ["Galactic Empire", "Rebel Alliance", "Black Sun"], shield: 820, recharge: 96, delay: 0.5 },
  { id: "shield_sw_s_mk2", name: "Deflector Shield S Mk2", kind: "shield", size: "S", price: p(48000), sellers: ["Rebel Alliance"], shield: 1100, recharge: 120, delay: 0.5 },
  { id: "shield_sw_m_mk1", name: "Deflector Shield M Mk1", kind: "shield", size: "M", price: p(88000), sellers: ["Galactic Empire", "Rebel Alliance"], shield: 4200, recharge: 210, delay: 1.2 },
  { id: "shield_sw_l_mk1", name: "Deflector Shield L Mk1", kind: "shield", size: "L", price: p(520000), sellers: ["Galactic Empire", "Rebel Alliance"], shield: 26000, recharge: 410, delay: 2 },
  // engines
  { id: "engine_sw_s_combat", name: "Ion Engine S Combat", kind: "engine", size: "S", price: p(33000), sellers: ["Galactic Empire", "Rebel Alliance"], thrust: 2100, boost: 6, travel: 9 },
  { id: "engine_sw_s_allround", name: "Ion Engine S All-round", kind: "engine", size: "S", price: p(29000), sellers: ["Black Sun", "Rebel Alliance"], thrust: 1800, boost: 5, travel: 12 },
  { id: "engine_sw_m_combat", name: "Ion Engine M Combat", kind: "engine", size: "M", price: p(98000), sellers: ["Galactic Empire", "Rebel Alliance", "Black Sun"], thrust: 6200, boost: 5, travel: 8 },
  { id: "engine_sw_l_allround", name: "Ion Engine L All-round", kind: "engine", size: "L", price: p(410000), sellers: ["Galactic Empire", "Rebel Alliance"], thrust: 31000, boost: 3, travel: 6 },
  // thrusters
  { id: "thruster_gen_s_allround_01_mk1", name: "S All-round Thrusters Mk1", kind: "thruster", size: "S", price: p(9000), sellers: ["(everyone)"], torque: 60 },
  { id: "thruster_gen_s_combat_01_mk1", name: "S Combat Thrusters Mk1", kind: "thruster", size: "S", price: p(19000), sellers: ["(everyone)"], torque: 85 },
  { id: "thruster_gen_m_allround_01_mk1", name: "M All-round Thrusters Mk1", kind: "thruster", size: "M", price: p(31000), sellers: ["(everyone)"], torque: 380 },
  { id: "thruster_gen_l_allround_01_mk1", name: "L All-round Thrusters Mk1", kind: "thruster", size: "L", price: p(140000), sellers: ["(everyone)"], torque: 9500 },
];

export const CONSUMABLES: Consumable[] = [
  { id: "missile_sw_concussion", name: "Concussion Missile", kind: "missile", price: p(2100), sellers: ["Rebel Alliance", "Galactic Empire"] },
  { id: "missile_sw_protontorp", name: "Proton Torpedo", kind: "missile", price: p(4800), sellers: ["Rebel Alliance"] },
  { id: "countermeasure_flares_01", name: "Flares", kind: "countermeasure", price: p(120), sellers: ["(everyone)"] },
  { id: "ship_gen_xs_cargodrone_empty_01_a", name: "Cargo Drone", kind: "drone", price: p(9000), sellers: ["(everyone)"] },
  { id: "ship_gen_xs_repairdrone_01_a", name: "Repair Drone", kind: "drone", price: p(12000), sellers: ["(everyone)"] },
  { id: "eq_arg_satellite_01", name: "Basic Satellite", kind: "deployable", price: p(6000), sellers: ["(everyone)"] },
  { id: "weapon_gen_mine_01", name: "Mine", kind: "deployable", price: p(3000), sellers: ["(everyone)"] },
];

export const SOFTWARE: Software[] = [
  { id: "software_dockmk1", name: "Docking Computer Mk1", group: "docking", price: p(200) },
  { id: "software_dockmk2", name: "Docking Computer Mk2", group: "docking", price: p(6000) },
  { id: "software_flightassistmk1", name: "Flight Assist Mk1", group: "flight", price: p(300) },
  { id: "software_targetmk1", name: "Targeting Computer Mk1", group: "targeting", price: p(4000) },
  { id: "software_scannerlongrangemk1", name: "Long-range Scanner Mk1", group: "scanner", price: p(500) },
  { id: "software_scannerlongrangemk2", name: "Long-range Scanner Mk2", group: "scanner", price: p(14000) },
  { id: "software_trademk1", name: "Trading Computer Mk1", group: "trading", price: p(9000) },
];

const ids = (kind: SlotKind, size: Size) => EQUIPMENT.filter(e => e.kind === kind && e.size === size).map(e => e.id);
const sw = (mandatory: boolean) => [
  { group: "docking" as const, options: ["software_dockmk1", "software_dockmk2"], mandatoryDefault: mandatory ? "software_dockmk1" : undefined },
  { group: "flight" as const, options: ["software_flightassistmk1"], mandatoryDefault: "software_flightassistmk1" },
  { group: "targeting" as const, options: ["software_targetmk1"] },
  { group: "scanner" as const, options: ["software_scannerlongrangemk1", "software_scannerlongrangemk2"], mandatoryDefault: "software_scannerlongrangemk1" },
];
const slot = (id: string, kind: SlotKind, size: Size, mandatory = false, compatible = ids(kind, size)): Slot => ({ id, kind, size, mandatory, compatible });

export const SHIPS: Ship[] = [
  {
    id: "ship_sw_rebel_s_xwing_t65b_01_a", name: "T-65B X-wing", size: "S", klass: "Fighter", sellers: ["Rebel Alliance"],
    price: p(412000), hull: 4800, mass: 9.2, drag: 7.1, inertia: 1.4, radar: 30000,
    slots: [
      slot("con_weapon_01", "weapon", "S"), slot("con_weapon_02", "weapon", "S"),
      slot("con_weapon_03", "weapon", "S"), slot("con_weapon_04", "weapon", "S"),
      slot("con_weapon_05", "weapon", "S", false, ["weapon_sw_protorp_s"]),
      slot("con_shield_01", "shield", "S", true), slot("con_engine_01", "engine", "S", true), slot("con_dynamic_01", "thruster", "S", true),
    ],
    groups: [], capacity: { missile: 12, drone: 0, countermeasure: 20, deployable: 0 }, software: sw(false),
  },
  {
    id: "ship_sw_emp_s_tiefighter_01_a", name: "TIE/ln Fighter", size: "S", klass: "Fighter", sellers: ["Galactic Empire"],
    price: p(188000), hull: 2600, mass: 6.1, drag: 5.4, inertia: 0.9, radar: 30000,
    slots: [slot("con_weapon_01", "weapon", "S"), slot("con_weapon_02", "weapon", "S"), slot("con_engine_01", "engine", "S", true), slot("con_dynamic_01", "thruster", "S", true)],
    groups: [], capacity: { missile: 0, drone: 0, countermeasure: 10, deployable: 0 }, software: sw(false),
  },
  {
    id: "ship_sw_blacksun_m_yt1300_01_a", name: "YT-1300 Light Freighter", size: "M", klass: "Corvette", sellers: ["Black Sun"], licence: "Black Sun: Capital ship licence (+20)",
    price: p(2140000), hull: 21000, mass: 48, drag: 38, inertia: 22, radar: 40000,
    slots: [
      slot("con_weapon_01", "weapon", "M"), slot("con_weapon_02", "weapon", "M"),
      slot("con_turret_01", "turret", "M"), slot("con_turret_02", "turret", "M"),
      slot("con_shield_01", "shield", "M", true), slot("con_shield_02", "shield", "M"),
      slot("con_engine_01", "engine", "M", true), slot("con_dynamic_01", "thruster", "M", true),
    ],
    groups: [], capacity: { missile: 40, drone: 4, countermeasure: 30, deployable: 10 }, software: sw(true),
  },
  {
    id: "ship_sw_rebel_l_nebulonb_01_a", name: "EF76 Nebulon-B Frigate", size: "L", klass: "Frigate", sellers: ["Rebel Alliance"], licence: "Rebel Alliance: Capital ship licence",
    price: p(19800000), hull: 310000, mass: 900, drag: 520, inertia: 700, radar: 50000,
    slots: [
      slot("con_shield_main_01", "shield", "L", true), slot("con_shield_main_02", "shield", "L"),
      slot("con_engine_01", "engine", "L", true), slot("con_engine_02", "engine", "L", true), slot("con_dynamic_01", "thruster", "L", true),
    ],
    groups: [
      { id: "group_fore_up", name: "Fore dorsal battery", parts: [{ kind: "turret", max: 6, compatible: [...ids("turret", "M"), ...ids("turret", "L")] }, { kind: "shield", max: 2, compatible: ids("shield", "M") }] },
      { id: "group_aft_down", name: "Aft ventral battery", parts: [{ kind: "turret", max: 4, compatible: ids("turret", "M") }, { kind: "shield", max: 2, compatible: ids("shield", "M") }] },
    ],
    capacity: { missile: 120, drone: 20, countermeasure: 60, deployable: 40 }, software: [...sw(true), { group: "trading", options: ["software_trademk1"] }],
  },
];

export const FACTIONS = ["Galactic Empire", "Rebel Alliance", "Black Sun"];
export const ALL = { EQUIPMENT, CONSUMABLES, SOFTWARE, SHIPS };
export const byId = <T extends { id: string }>(xs: T[], id: string | undefined) => xs.find(x => x.id === id);
export const GAME_DATA_VERSION = { swi: "0.9.1 HF", x4: "8.00" };
