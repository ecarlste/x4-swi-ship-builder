import { createHash } from "node:crypto";
import type { Equipment, EquipmentKind, FitList, Ship, Size, SlotGroupKind } from "../shared/game-data/schema.ts";
import { ExtractError } from "./errors.ts";
import { attr, child, children, list, numberAttr, type GameFiles } from "./gameFiles.ts";
import { classDefaults, EMPTY_FIT_LIST, type GroupConnection, type LeftOut, type ShipFittings } from "./ships.ts";
import type { StationClasses } from "./stations.ts";
import type { TextResolver } from "./text.ts";
import type { JsonElement } from "./xml.ts";

export interface EquipmentResult {
  /** The Ships, with every fit list id filled in. */
  ships: Ship[];
  /** Equipment that has a Seller and fits at least one buildable Ship, sorted by id. */
  equipment: Equipment[];
  /** Deduplicated, sorted by id. */
  fitLists: FitList[];
  leftOut: LeftOut[];
  warnings: string[];
  /** How many Equipment wares have a Seller before the "fits a buildable Ship" filter (#18). */
  withSeller: number;
}

/** A ware that is Equipment, with what compatibility needs from it. */
interface Candidate {
  id: string;
  kind: EquipmentKind;
  ware: JsonElement;
  /** The ware's macro, for the kinds whose raw inputs or tags come from it. */
  macro: JsonElement | undefined;
  /** The type connection's tags, but for `component`; null for kinds without one. */
  connectionTags: string[] | null;
  size: Size | null;
  /** A launcher's `<ammunition tags>`; null if it isn't a launcher. */
  ammunitionTags: string[] | null;
  /** A missile's `<missile tags>`. */
  missileTags: string[];
  owners: string[];
}

const SLOT_KINDS = new Set<EquipmentKind>(["weapon", "turret", "shield", "engine", "thruster"]);
const SIZE_TAGS: Record<string, Size> = { small: "s", medium: "m", large: "l", extralarge: "xl" };
const DEPLOYABLE_TAGS = ["satellite", "mine", "lasertower", "navbeacon", "resourceprobe"];
const LAUNCHER_CLASSES = ["missilelauncher", "missileturret"];

/**
 * The Equipment kind of a ware, from its tags (and group, for software), as
 * the game's ship configuration menu groups them; undefined if the ware isn't
 * Equipment. Spacesuit items (`transport="inventory"`) are not Equipment.
 */
function kindOf(ware: JsonElement): EquipmentKind | undefined {
  const transport = attr(ware, "transport");
  if (transport !== "equipment" && transport !== "software") return undefined;
  const tags = list(attr(ware, "tags"));
  if (tags.includes("software") || attr(ware, "group") === "software") return "software";
  if (DEPLOYABLE_TAGS.some((t) => tags.includes(t))) return "deployable";
  const kinds: EquipmentKind[] = ["missile", "countermeasure", "drone", "thruster", "engine", "shield", "turret", "weapon"];
  return kinds.find((k) => tags.includes(k));
}

function readCandidates(files: GameFiles): Candidate[] {
  const candidates: Candidate[] = [];
  for (const ware of children(files.requireFile("libraries/wares.xml"), "ware")) {
    const kind = kindOf(ware);
    if (kind === undefined) continue;
    const id = attr(ware, "id")!;
    const where = `ware ${id}`;
    // Drones, deployables, countermeasures and software have no raw inputs and match no tags.
    const needsMacro = SLOT_KINDS.has(kind) || kind === "missile";
    const macroRef = attr(child(ware, "component"), "ref");
    if (macroRef === undefined && needsMacro) throw new ExtractError(`${where} has no <component ref>`);
    const macro = macroRef === undefined || !needsMacro ? undefined : files.macro(macroRef, where).element;
    const props = child(macro, "properties");

    let connectionTags: string[] | null = null;
    if (SLOT_KINDS.has(kind)) {
      const componentRef = attr(child(macro, "component"), "ref");
      if (componentRef === undefined) throw new ExtractError(`${where}: its macro has no <component ref>`);
      const component = files.component(componentRef, `${where} macro`).element;
      // The type connection is the one tagged with the item's kind.
      const typeConnections = children(child(component, "connections"), "connection").filter((c) =>
        list(attr(c, "tags")).includes(kind),
      );
      if (typeConnections.length === 1) {
        connectionTags = list(attr(typeConnections[0], "tags")).filter((t) => t !== "component");
      }
    }
    const sizes = [...new Set((connectionTags ?? []).flatMap((t) => SIZE_TAGS[t] ?? []))];
    const isLauncher = (kind === "weapon" || kind === "turret") && LAUNCHER_CLASSES.includes(attr(macro, "class") ?? "");

    candidates.push({
      id,
      kind,
      ware,
      macro,
      connectionTags,
      size: sizes.length === 1 ? sizes[0]! : null,
      ammunitionTags: isLauncher ? list(attr(child(props, "ammunition"), "tags")) : null,
      missileTags: kind === "missile" ? list(attr(child(props, "missile"), "tags")) : [],
      owners: children(ware, "owner").flatMap((o) => attr(o, "faction") ?? []),
    });
  }
  return candidates;
}

/** A software ware's `<software predecessor>`: the software it replaces, or null. */
const predecessorOf = (ware: JsonElement) => attr(child(ware, "software"), "predecessor") ?? null;

/** Every tag of `needed` is in `offered`. */
const allIn = (needed: string[], offered: string[]) => needed.every((t) => offered.includes(t));

/** The Equipment in every one of the given lists. */
const fitsAll = (lists: string[][]) => lists.reduce((a, b) => a.filter((id) => b.includes(id)));

/**
 * Reads every Equipment ware, computes what fits each Ship's Slots, Slot
 * Groups, thruster, software, drones, deployables and countermeasures and
 * each launcher's missiles, applies the Equipment Seller rule (#18), and
 * keeps only Equipment that has a Seller and fits at least one Ship.
 *
 * - **Slots**: an item fits a Slot of its kind if every tag of its type
 *   connection (the component connection tagged with its kind), but for
 *   `component`, is on the Slot's connection. A Slot Group kind takes what fits
 *   all its connections of that kind.
 * - **Thruster**: a thruster fits if its type connection's tags, but for
 *   `component` and `thruster`, are all in the ship macro's `<thruster tags>`.
 * - **Software**: the ship macro's `<software>` list; `default="1"` is mandatory.
 *   Each software ware's `<software predecessor>` chains it into its Software Family.
 * - **Drones, deployables, countermeasures**: all of them, if the Ship can carry any.
 * - **Missiles**: a launcher (a `missilelauncher` or `missileturret` macro)
 *   fires the missiles whose `<missile tags>` are all in its `<ammunition tags>`.
 * - **Seller**: a Faction that owns the ware, or any Faction if the ware has
 *   no owner, and runs a station whose modules' `<equip classes>` cover a
 *   class of Ship the item fits. A missile fits the Ships its launchers fit.
 */
export function readEquipment(
  files: GameFiles,
  text: TextResolver,
  ships: Ship[],
  fittings: Map<string, ShipFittings>,
  stations: Map<string, StationClasses>,
): EquipmentResult {
  const candidates = readCandidates(files);
  const defaults = classDefaults(files);
  const leftOut: LeftOut[] = [];
  const warnings: string[] = [];
  const ofKind = (kind: EquipmentKind) => candidates.filter((c) => c.kind === kind);
  const known = new Map(candidates.map((c) => [c.id, c]));

  // What fits each Ship, before the Seller rule.
  const slotFit = (kind: EquipmentKind, tags: string[]) =>
    ofKind(kind)
      .filter((c) => c.connectionTags !== null && allIn(c.connectionTags, tags))
      .map((c) => c.id);
  interface ShipFits {
    slots: Map<string, string[]>;
    groups: Map<string, Partial<Record<SlotGroupKind, string[]>>>;
    thrusters: string[];
    software: string[];
    mandatorySoftware: string[];
    drones: string[];
    deployables: string[];
    countermeasures: string[];
  }
  const shipFits = new Map<string, ShipFits>();
  for (const ship of ships) {
    const fitting = fittings.get(ship.id)!;
    const slots = new Map(ship.slots.map((slot) => [slot.id, slotFit(slot.kind, fitting.slots.get(slot.id) ?? [])]));
    const groups = new Map<string, Partial<Record<SlotGroupKind, string[]>>>();
    for (const [groupId, kinds] of fitting.groups) {
      const fitsOfGroup: Partial<Record<SlotGroupKind, string[]>> = {};
      for (const [kind, connections] of Object.entries(kinds) as [SlotGroupKind, GroupConnection[]][]) {
        const perConnection = connections.map((c) => slotFit(kind, c.tags));
        const common = fitsAll(perConnection);
        // Groups merged by name (#52) must agree on what fits them, or the merge is a guess.
        const byWrittenName = new Map<string, string[][]>();
        for (const c of connections) {
          byWrittenName.set(c.writtenAs, [...(byWrittenName.get(c.writtenAs) ?? []), slotFit(kind, c.tags)]);
        }
        if (new Set([...byWrittenName.values()].map((fits) => fitsAll(fits).join(" "))).size > 1) {
          const names = [...byWrittenName.keys()].sort().map((n) => `"${n}"`).join(", ");
          throw new ExtractError(
            `ware ${ship.id}: Slot Groups ${names} are one Slot Group "${groupId}" in game, ` +
              `but their ${kind}s take different Equipment`,
          );
        }
        if (perConnection.some((fits) => fits.length !== common.length)) {
          warnings.push(
            `${ship.id}: the ${kind} connections of Slot Group "${groupId}" don't all take the same Equipment; ` +
              `the group takes only what fits them all`,
          );
        }
        fitsOfGroup[kind] = common;
      }
      groups.set(groupId, fitsOfGroup);
    }
    const thrusters = ofKind("thruster")
      .filter((c) => {
        const tags = (c.connectionTags ?? []).filter((t) => t !== "thruster");
        return c.connectionTags !== null && fitting.thrusters.some((offered) => allIn(tags, offered));
      })
      .map((c) => c.id);
    const software: string[] = [];
    const mandatorySoftware: string[] = [];
    for (const entry of fitting.software) {
      if (known.get(entry.ware)?.kind !== "software") {
        warnings.push(`${ship.id}: its software list has "${entry.ware}", which isn't a software ware`);
        continue;
      }
      software.push(entry.ware);
      if (entry.mandatory) mandatorySoftware.push(entry.ware);
    }
    const all = (kind: EquipmentKind, capacity: number) => (capacity > 0 ? ofKind(kind).map((c) => c.id) : []);
    shipFits.set(ship.id, {
      slots,
      groups,
      thrusters,
      software,
      mandatorySoftware,
      drones: all("drone", ship.capacities.drones),
      deployables: all("deployable", ship.capacities.deployables),
      countermeasures: all("countermeasure", ship.capacities.countermeasures),
    });
  }

  // The classes of Ship each item fits.
  const fitClasses = new Map<string, Set<string>>();
  const addClass = (id: string, cls: string) => fitClasses.set(id, (fitClasses.get(id) ?? new Set()).add(cls));
  for (const ship of ships) {
    const fits = shipFits.get(ship.id)!;
    const cls = fittings.get(ship.id)!.shipClass;
    const lists = [
      ...fits.slots.values(),
      ...[...fits.groups.values()].flatMap((g) => Object.values(g)),
      fits.thrusters,
      fits.software,
      fits.drones,
      fits.deployables,
      fits.countermeasures,
    ];
    for (const id of lists.flat()) addClass(id, cls);
  }

  const equipFactions = [...stations].filter(([, c]) => c.equip.size > 0).map(([f]) => f).sort();
  let withSeller = 0;
  const included = new Map<string, Equipment>();
  const launcherMissiles = new Map<string, string[]>();

  const consider = (candidate: Candidate) => {
    const { id, kind, owners } = candidate;
    const potential = owners.length === 0 ? equipFactions : equipFactions.filter((f) => owners.includes(f));
    if (potential.length === 0) {
      const reason =
        owners.length === 0
          ? "no Faction runs a station that equips ships"
          : `owned by ${owners.join(", ")}, and none runs a station that equips ships`;
      leftOut.push({ ware: id, reason: `no Seller: ${reason}` });
      return;
    }
    withSeller++;
    const classes = fitClasses.get(id);
    if (!classes || classes.size === 0) {
      const reason =
        kind === "missile" ? "no launcher on a buildable Ship fires it" : `fits no buildable Ship`;
      leftOut.push({ ware: id, reason });
      if (SLOT_KINDS.has(kind)) warnings.push(`${id} has a Seller but no compatible Slot on any buildable Ship`);
      return;
    }
    const sellers = potential.filter((f) => [...classes].some((cls) => stations.get(f)!.equip.has(cls)));
    if (sellers.length === 0) {
      leftOut.push({
        ware: id,
        reason: `no Seller: ${potential.join(", ")} equip none of the classes it fits (${[...classes].sort().join(", ")})`,
      });
      return;
    }
    const item = readItem(files, text, candidate, sellers, defaults);
    if (typeof item === "string") {
      leftOut.push({ ware: id, reason: item });
      warnings.push(`${id}: ${item}`);
      return;
    }
    const { min, average, max } = item.price;
    if (!(min <= average && average <= max)) {
      warnings.push(`${id}: price isn't min <= average <= max (${min}, ${average}, ${max})`);
    }
    included.set(id, item);
  };

  for (const candidate of candidates) if (candidate.kind !== "missile") consider(candidate);

  // Missiles fit the classes of the Ships their (included) launchers fit.
  for (const launcher of candidates) {
    if (launcher.ammunitionTags === null || !included.has(launcher.id)) continue;
    const missiles = ofKind("missile")
      .filter((m) => m.missileTags.length > 0 && allIn(m.missileTags, launcher.ammunitionTags!))
      .map((m) => m.id);
    launcherMissiles.set(launcher.id, missiles);
    for (const missile of missiles) for (const cls of fitClasses.get(launcher.id) ?? []) addClass(missile, cls);
  }
  for (const candidate of ofKind("missile")) consider(candidate);

  // Fit lists: only included Equipment, sorted, identical lists shared.
  const fitListTable = new Map<string, FitList>([[EMPTY_FIT_LIST, { id: EMPTY_FIT_LIST, equipment: [] }]]);
  const fitList = (kind: EquipmentKind, ids: string[]): string => {
    const equipment = [...new Set(ids.filter((id) => included.has(id)))].sort();
    if (equipment.length === 0) return EMPTY_FIT_LIST;
    const hash = createHash("sha256").update(equipment.join("\n")).digest("hex").slice(0, 10);
    const id = `${kind}-${hash}`;
    fitListTable.set(id, { id, equipment });
    return id;
  };

  /**
   * A Software Family is kept whole when a ware in its chain is left out: the
   * predecessor is the nearest one up the chain that is in the Game Data.
   */
  const includedPredecessor = (id: string, predecessor: string | null): string | null => {
    const seen = new Set([id]);
    let at = predecessor;
    while (at !== null && !included.has(at) && !seen.has(at)) {
      seen.add(at);
      const ware = known.get(at)?.ware;
      at = ware ? predecessorOf(ware) : null;
    }
    const kept = at !== null && included.has(at) ? at : null;
    if (predecessor !== null && kept !== predecessor) {
      warnings.push(
        `${id}: its predecessor ${predecessor} isn't in the Game Data, so its predecessor is ${kept ?? "none"}`,
      );
    }
    return kept;
  };

  const equipment = [...included.values()].map((item) => {
    if ((item.kind === "weapon" || item.kind === "turret") && launcherMissiles.has(item.id)) {
      return { ...item, missiles: fitList("missile", launcherMissiles.get(item.id)!) };
    }
    if (item.kind === "software") return { ...item, predecessor: includedPredecessor(item.id, item.predecessor) };
    return item;
  });

  const withFitLists = ships.map((ship): Ship => {
    const fits = shipFits.get(ship.id)!;
    const mandatory = fits.mandatorySoftware.filter((id) => {
      if (included.has(id)) return true;
      warnings.push(`${ship.id}: mandatory software ${id} has no Seller, so it isn't marked mandatory`);
      return false;
    });
    return {
      ...ship,
      slots: ship.slots.map((slot) => ({ ...slot, fitList: fitList(slot.kind, fits.slots.get(slot.id) ?? []) })),
      slotGroups: ship.slotGroups.map((group) => ({
        ...group,
        kinds: Object.fromEntries(
          Object.entries(group.kinds).map(([kind, entry]) => [
            kind,
            { ...entry, fitList: fitList(kind as SlotGroupKind, fits.groups.get(group.id)?.[kind as SlotGroupKind] ?? []) },
          ]),
        ),
      })),
      thrusters: fitList("thruster", fits.thrusters),
      software: { fitList: fitList("software", fits.software), mandatory: [...new Set(mandatory)].sort() },
      drones: fitList("drone", fits.drones),
      deployables: fitList("deployable", fits.deployables),
      countermeasures: fitList("countermeasure", fits.countermeasures),
    };
  });

  const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    ships: withFitLists,
    equipment: equipment.sort(byId),
    fitLists: [...fitListTable.values()].sort(byId),
    leftOut,
    warnings,
    withSeller,
  };
}

/**
 * An included item's name, price, licence, Sellers and raw inputs; or, when
 * its data breaks our rules, the reason it is left out.
 */
function readItem(
  files: GameFiles,
  text: TextResolver,
  c: Candidate,
  sellers: string[],
  defaults: Map<string, JsonElement>,
): Equipment | string {
  const where = `ware ${c.id}`;
  const nameId = attr(c.ware, "name");
  if (nameId === undefined) throw new ExtractError(`${where} has no name`);
  const price = child(c.ware, "price");
  const common = {
    id: c.id,
    name: text.resolve(nameId, where),
    nameId,
    price: {
      min: numberAttr(price, "min", `${where} <price>`) ?? 0,
      average: numberAttr(price, "average", `${where} <price>`) ?? 0,
      max: numberAttr(price, "max", `${where} <price>`) ?? 0,
    },
    licence: attr(child(c.ware, "restriction"), "licence") ?? null,
    sellers: [...sellers].sort(),
  };
  const props = child(c.macro, "properties");
  const num = (element: JsonElement | undefined, tag: string, name: string, fallback = 0) =>
    numberAttr(child(element, tag), name, `${where} <${tag}>`) ?? fallback;

  switch (c.kind) {
    case "weapon":
    case "turret": {
      if (c.ammunitionTags !== null) {
        return {
          kind: c.kind,
          ...common,
          size: c.size,
          damage: { value: 0, noShield: 0, hull: 0 },
          barrelAmount: 1,
          fireRate: 1,
          magazine: null,
          heat: null,
          missiles: EMPTY_FIT_LIST,
          missileStorage: num(props, "storage", "capacity"),
        };
      }
      const bulletRef = attr(child(props, "bullet"), "class");
      if (bulletRef === undefined) return "its macro has no <bullet class>";
      const bullet = child(files.macro(bulletRef, `${where} macro`).element, "properties");
      const rate = numberAttr(child(bullet, "reload"), "rate", `${where} bullet <reload>`);
      // With no reload@rate the game shows one shot a second and ignores reload@time (#63). Every such
      // bullet in 091_x4-800 has attach="1", so "an attached bullet deals its damage per second" fits too.
      const fireRate = rate !== undefined && rate > 0 ? rate : 1;
      const ammunition = child(bullet, "ammunition");
      const magazineSize = numberAttr(ammunition, "value", `${where} bullet <ammunition>`);
      const magazineReload = numberAttr(ammunition, "reload", `${where} bullet <ammunition>`);
      const heat = child(props, "heat");
      const overheat = numberAttr(heat, "overheat", `${where} <heat>`);
      const coolRate = numberAttr(heat, "coolrate", `${where} <heat>`);
      return {
        kind: c.kind,
        ...common,
        size: c.size,
        damage: {
          value: num(bullet, "damage", "value"),
          noShield: num(bullet, "damage", "noshield"),
          hull: num(bullet, "damage", "hull"),
        },
        barrelAmount: num(bullet, "bullet", "barrelamount", 1),
        fireRate,
        magazine:
          magazineSize !== undefined && magazineSize > 0 && magazineReload !== undefined && magazineReload > 0
            ? { size: magazineSize, reloadTime: magazineReload }
            : null,
        heat:
          overheat !== undefined && overheat > 0 && coolRate !== undefined && coolRate > 0
            ? { perShot: num(bullet, "heat", "value"), overheat, coolDelay: num(props, "heat", "cooldelay"), coolRate }
            : null,
        missiles: null,
        missileStorage: 0,
      };
    }
    case "shield":
      return {
        kind: "shield",
        ...common,
        size: c.size,
        capacity: num(props, "recharge", "max"),
        rechargeRate: num(props, "recharge", "rate"),
        rechargeDelay: num(props, "recharge", "delay"),
      };
    case "engine": {
      // A boost attribute the macro leaves out comes from its class's dataset in
      // libraries/defaults.xml (the game's engine one has recharge 30 s), and a
      // missing acceleration is 1: what the game shows for SWI's Gozanti Engine (#39).
      const cls = attr(c.macro, "class") ?? "engine";
      const classBoost = child(defaults.get(cls), "boost");
      const boost = (name: string, fallback: number) =>
        numberAttr(child(props, "boost"), name, `${where} <boost>`) ??
        numberAttr(classBoost, name, `defaults.xml ${cls} <boost>`) ??
        fallback;
      return {
        kind: "engine",
        ...common,
        size: c.size,
        thrust: { forward: num(props, "thrust", "forward"), reverse: num(props, "thrust", "reverse") },
        boost: {
          thrust: boost("thrust", 0),
          acceleration: boost("acceleration", 1),
          duration: boost("duration", 0),
          recharge: boost("recharge", 0),
        },
        travel: {
          thrust: num(props, "travel", "thrust"),
          charge: num(props, "travel", "charge"),
          attack: num(props, "travel", "attack"),
        },
      };
    }
    case "thruster":
      return {
        kind: "thruster",
        ...common,
        size: c.size,
        thrust: {
          strafe: num(props, "thrust", "strafe"),
          pitch: num(props, "thrust", "pitch"),
          yaw: num(props, "thrust", "yaw"),
          roll: num(props, "thrust", "roll"),
        },
      };
    case "missile": {
      const reloadTime = num(props, "reload", "time");
      if (reloadTime <= 0) return "its macro has no reload@time";
      return {
        kind: "missile",
        ...common,
        explosionDamage: num(props, "explosiondamage", "value"),
        hullDamage: num(props, "explosiondamage", "hull"),
        barrelAmount: num(props, "missile", "barrelamount", 1),
        reloadTime,
      };
    }
    case "drone":
    case "deployable":
    case "countermeasure":
      return { kind: c.kind, ...common };
    case "software":
      return { kind: "software", ...common, predecessor: predecessorOf(c.ware) };
  }
}
