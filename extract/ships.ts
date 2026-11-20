import type { CargoType, Ship, Size, Slot, SlotGroup, SlotGroupKind, SlotKind } from "../shared/game-data/schema.ts";
import { cargoTypeSchema } from "../shared/game-data/schema.ts";
import { ExtractError } from "./errors.ts";
import { attr, child, children, list, numberAttr, type GameFiles } from "./gameFiles.ts";
import type { TextResolver } from "./text.ts";
import type { JsonElement } from "./xml.ts";

/** Ware tags that keep a Ship out of the builder (#15). */
export const EXCLUSION_TAGS = ["noplayerbuild", "missiononly", "blueprintsaleonly", "limited"] as const;

/**
 * The fit list every Slot, Slot Group kind and option list points at until
 * compatibility is computed, and the id of the empty fit list.
 */
export const EMPTY_FIT_LIST = "empty";

/**
 * What a Ship's equipment must match, kept beside the Ship so compatibility
 * can be computed once all Equipment is read.
 */
export interface ShipFittings {
  /** The macro's class: `ship_s`, `ship_m`, ... */
  shipClass: string;
  /** Slot id → the connection's tags. */
  slots: Map<string, string[]>;
  /** Slot Group id → kind → the tags of each of its connections of that kind. */
  groups: Map<string, Partial<Record<SlotGroupKind, string[][]>>>;
  /** The tags of each of the macro's `<thruster>` elements. */
  thrusters: string[][];
  /** The macro's `<software>` list; `default="1"` software is mandatory. */
  software: { ware: string; mandatory: boolean }[];
}

export interface LeftOut {
  ware: string;
  reason: string;
}

export interface ShipsResult {
  /** Buildable Ships, with names not yet made unique, and every fit list {@link EMPTY_FIT_LIST}. */
  ships: Ship[];
  /** By Ship id. */
  fittings: Map<string, ShipFittings>;
  leftOut: LeftOut[];
  /** Things worth a look in the report that don't stop the extraction. */
  warnings: string[];
}

const SIZES: Record<string, Size> = { ship_s: "s", ship_m: "m", ship_l: "l", ship_xl: "xl" };
const SIZE_TAGS: Record<string, Size> = { small: "s", medium: "m", large: "l", extralarge: "xl" };
const SLOT_KINDS: SlotKind[] = ["weapon", "turret", "shield", "engine"];
const GROUP_KINDS: SlotGroupKind[] = ["turret", "shield", "engine"];

/**
 * Reads every ship ware (a ware tagged `ship`) and applies the buildable-Ship
 * rule (#15, #20): a Ship is in if it has a Seller and none of the
 * {@link EXCLUSION_TAGS}. A Seller is a Faction that owns the ware and runs
 * a station whose build modules cover the Ship's size (`builders`).
 */
export function readShips(files: GameFiles, text: TextResolver, builders: Map<string, Set<string>>): ShipsResult {
  const ships: Ship[] = [];
  const fittings = new Map<string, ShipFittings>();
  const leftOut: LeftOut[] = [];
  const warnings: string[] = [];
  const defaults = classDefaults(files);

  for (const ware of children(files.requireFile("libraries/wares.xml"), "ware")) {
    if (!list(attr(ware, "tags")).includes("ship")) continue;
    const id = attr(ware, "id")!;
    const where = `ware ${id}`;
    const componentRef = attr(child(ware, "component"), "ref");
    if (componentRef === undefined) throw new ExtractError(`${where} has no <component ref>`);
    const macro = files.macro(componentRef, where).element;
    const shipClass = attr(macro, "class") ?? "";
    const size = SIZES[shipClass];

    const exclusions = EXCLUSION_TAGS.filter((t) => list(attr(ware, "tags")).includes(t));
    if (exclusions.length > 0) {
      leftOut.push({ ware: id, reason: `tagged ${exclusions.join(", ")}` });
      continue;
    }
    if (size === undefined) {
      leftOut.push({ ware: id, reason: `its macro's class "${shipClass}" isn't a Ship size` });
      continue;
    }
    const owners = children(ware, "owner").flatMap((o) => attr(o, "faction") ?? []);
    const sellers = [...new Set(owners.filter((f) => builders.get(f)?.has(shipClass)))].sort();
    if (sellers.length === 0) {
      const reason =
        owners.length === 0
          ? "no Faction owns it"
          : `owned by ${owners.join(", ")}, and none runs a station that builds ${shipClass}`;
      leftOut.push({ ware: id, reason: `no Seller: ${reason}` });
      continue;
    }

    const read = readShip(files, text, { ware, macro, size, shipClass, sellers, defaults, warnings });
    ships.push(read.ship);
    fittings.set(id, read.fittings);
  }
  return { ships, fittings, leftOut, warnings };
}

interface ShipContext {
  ware: JsonElement;
  macro: JsonElement;
  size: Size;
  shipClass: string;
  sellers: string[];
  defaults: Map<string, JsonElement>;
  warnings: string[];
}

function readShip(files: GameFiles, text: TextResolver, ctx: ShipContext): { ship: Ship; fittings: ShipFittings } {
  const { ware, macro, size, shipClass, sellers, defaults, warnings } = ctx;
  const id = attr(ware, "id")!;
  const where = `ware ${id}`;
  const props = child(macro, "properties");
  const classProps = defaults.get(shipClass);
  /** A macro property's attribute, falling back to the class default in libraries/defaults.xml. */
  const prop = (tag: string, name: string): number | undefined =>
    numberAttr(child(props, tag), name, `${where} macro <${tag}>`) ??
    numberAttr(child(classProps, tag), name, `defaults.xml ${shipClass} <${tag}>`);
  const required = (tag: string, name: string): number => {
    const value = prop(tag, name);
    if (value === undefined) throw new ExtractError(`${where}: its macro has no ${tag}@${name}`);
    return value;
  };

  const nameId = attr(ware, "name");
  if (nameId === undefined) throw new ExtractError(`${where} has no name`);
  const price = child(ware, "price");
  const physics = child(props, "physics");
  const drag = child(physics, "drag");
  const acc = child(physics, "accfactors");
  const dragValue = (d: string) => {
    const v = numberAttr(drag, d, `${where} macro <drag>`);
    if (v === undefined) throw new ExtractError(`${where}: its macro has no drag@${d}`);
    return v;
  };
  const accValue = (d: string) => numberAttr(acc, d, `${where} macro <accfactors>`) ?? 1;

  const cargo = readCargo(files, macro, where);
  const componentRef = attr(child(macro, "component"), "ref");
  if (componentRef === undefined) throw new ExtractError(`${where}: its macro has no <component ref>`);
  const component = files.component(componentRef, `${where} macro`).element;
  const { slots, slotGroups, slotTags, groupTags } = readSlots(component, size, id, warnings);
  const prices = {
    min: numberAttr(price, "min", `${where} <price>`) ?? 0,
    average: numberAttr(price, "average", `${where} <price>`) ?? 0,
    max: numberAttr(price, "max", `${where} <price>`) ?? 0,
  };
  if (!(prices.min <= prices.average && prices.average <= prices.max)) {
    warnings.push(`${id}: price isn't min <= average <= max (${prices.min}, ${prices.average}, ${prices.max})`);
  }

  const fittings: ShipFittings = {
    shipClass,
    slots: slotTags,
    groups: groupTags,
    thrusters: children(props, "thruster").map((t) => list(attr(t, "tags"))),
    software: children(child(props, "software"), "software").flatMap((s) => {
      const softwareWare = attr(s, "ware");
      return softwareWare === undefined ? [] : [{ ware: softwareWare, mandatory: attr(s, "default") === "1" }];
    }),
  };

  const ship: Ship = {
    id,
    name: text.resolve(nameId, where),
    nameId,
    price: prices,
    licence: attr(child(ware, "restriction"), "licence") ?? null,
    sellers,
    size,
    type: attr(child(props, "ship"), "type") ?? "",
    purpose: attr(child(props, "purpose"), "primary") ?? "",
    stats: {
      hull: required("hull", "max"),
      mass: required("physics", "mass"),
      radarRange: prop("radar", "range") ?? 0,
      drag: {
        forward: dragValue("forward"),
        reverse: dragValue("reverse"),
        horizontal: dragValue("horizontal"),
        vertical: dragValue("vertical"),
        pitch: dragValue("pitch"),
        yaw: dragValue("yaw"),
        roll: dragValue("roll"),
      },
      accFactors: {
        forward: accValue("forward"),
        reverse: accValue("reverse"),
        horizontal: accValue("horizontal"),
        vertical: accValue("vertical"),
      },
      maxRotationSpeed: numberAttr(child(props, "rotationspeed"), "max", `${where} macro <rotationspeed>`) ?? null,
    },
    capacities: {
      missiles: prop("storage", "missile") ?? 0,
      drones: prop("storage", "unit") ?? 0,
      deployables: prop("storage", "deployable") ?? 0,
      countermeasures: prop("storage", "countermeasure") ?? 0,
      crew: prop("people", "capacity") ?? 0,
      cargo: cargo.capacity,
    },
    cargoTypes: cargo.types,
    slots,
    slotGroups,
    thrusters: EMPTY_FIT_LIST,
    software: { fitList: EMPTY_FIT_LIST, mandatory: [] },
    drones: EMPTY_FIT_LIST,
    deployables: EMPTY_FIT_LIST,
    countermeasures: EMPTY_FIT_LIST,
  };
  return { ship, fittings };
}

/** Class properties from libraries/defaults.xml, by class (`ship_s`, ...). */
function classDefaults(files: GameFiles): Map<string, JsonElement> {
  const defaults = new Map<string, JsonElement>();
  for (const dataset of children(files.file("libraries/defaults.xml"), "dataset")) {
    const cls = attr(dataset, "class");
    const props = child(dataset, "properties");
    if (cls !== undefined && props) defaults.set(cls, props);
  }
  return defaults;
}

/** The capacity and cargo types of the storage macros connected to the ship macro. */
function readCargo(files: GameFiles, macro: JsonElement, where: string): { capacity: number; types: CargoType[] } {
  let capacity = 0;
  const types = new Set<CargoType>();
  for (const connection of children(child(macro, "connections"), "connection")) {
    for (const ref of children(connection, "macro")) {
      const name = attr(ref, "ref");
      if (name === undefined) continue;
      const connected = files.extractedMacro(name, `${where} macro`)?.element;
      if (attr(connected, "class") !== "storage") continue;
      const cargo = child(child(connected, "properties"), "cargo");
      capacity += numberAttr(cargo, "max", `storage macro ${name} <cargo>`) ?? 0;
      for (const tag of list(attr(cargo, "tags"))) {
        const type = cargoTypeSchema.safeParse(tag);
        if (!type.success) throw new ExtractError(`storage macro ${name} has an unknown cargo type "${tag}"`);
        types.add(type.data);
      }
    }
  }
  return { capacity, types: [...types].sort() };
}

/**
 * Slots are the component's connections tagged weapon, turret, shield or
 * engine; those with a `group` make up Slot Groups instead. A slot with no
 * size tag takes the Ship's size, and is listed as a warning.
 */
function readSlots(
  component: JsonElement,
  shipSize: Size,
  shipId: string,
  warnings: string[],
): {
  slots: Slot[];
  slotGroups: SlotGroup[];
  slotTags: ShipFittings["slots"];
  groupTags: ShipFittings["groups"];
} {
  const slots: Slot[] = [];
  const slotTags: ShipFittings["slots"] = new Map();
  const groupTags: ShipFittings["groups"] = new Map();
  const groups = new Map<string, SlotGroup["kinds"]>();
  for (const connection of children(child(component, "connections"), "connection")) {
    const tags = list(attr(connection, "tags"));
    const kinds = SLOT_KINDS.filter((k) => tags.includes(k));
    if (kinds.length === 0) continue;
    const name = attr(connection, "name")!;
    if (kinds.length > 1) {
      throw new ExtractError(`ware ${shipId}: connection ${name} is tagged as more than one kind (${kinds.join(", ")})`);
    }
    const kind = kinds[0]!;
    const sizes = [...new Set(tags.flatMap((t) => SIZE_TAGS[t] ?? []))];
    if (sizes.length > 1) {
      throw new ExtractError(`ware ${shipId}: connection ${name} has more than one size tag`);
    }
    const size = sizes[0] ?? shipSize;
    if (sizes.length === 0) warnings.push(`${shipId}: ${kind} slot ${name} has no size tag; it takes the Ship's size`);

    const group = attr(connection, "group");
    if (group === undefined) {
      slots.push({ id: name, kind, size, mandatory: tags.includes("mandatory"), fitList: EMPTY_FIT_LIST });
      slotTags.set(name, tags);
      continue;
    }
    if (kind === "weapon") {
      throw new ExtractError(`ware ${shipId}: weapon connection ${name} is in group ${group}; groups take turrets, shields and engines`);
    }
    if (group !== group.trim() && !groups.has(group)) {
      warnings.push(`${shipId}: Slot Group "${group}" has spaces around its name`);
    }
    const kindsOfGroup = groups.get(group) ?? {};
    const entry = kindsOfGroup[kind];
    kindsOfGroup[kind] = { count: (entry?.count ?? 0) + 1, fitList: EMPTY_FIT_LIST };
    groups.set(group, kindsOfGroup);
    const tagsOfGroup = groupTags.get(group) ?? {};
    tagsOfGroup[kind] = [...(tagsOfGroup[kind] ?? []), tags];
    groupTags.set(group, tagsOfGroup);
  }
  const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const slotGroups = [...groups].map(([id, kinds]) => ({
    id,
    kinds: Object.fromEntries(GROUP_KINDS.flatMap((k) => (kinds[k] ? [[k, kinds[k]]] : []))),
  }));
  return { slots: slots.sort(byId), slotGroups: slotGroups.sort(byId), slotTags, groupTags };
}
