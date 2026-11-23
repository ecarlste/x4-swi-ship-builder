/**
 * The Game Data shape, shared by the extraction pipeline and the app.
 *
 * A snapshot is seven JSON files. Ids are the game's own (ware ids, connection
 * names, group names, faction ids); Game Data holds raw inputs in game units
 * and no computed stats. See GLOSSARY.md and issue #7 for the decisions.
 */
import { z } from "zod";

const id = z.string().min(1);
const nonNegative = z.number().nonnegative();
const count = z.number().int().nonnegative();

export const sizeSchema = z.enum(["s", "m", "l", "xl"]);
export type Size = z.infer<typeof sizeSchema>;

/**
 * A price as the game files give it, for a Ship, a piece of Equipment or a
 * member of the Crew. Usually min <= average <= max, but SWI has a few that
 * break that; they are kept as written and listed in the extraction report.
 */
const priceSchema = z.object({ min: nonNegative, average: nonNegative, max: nonNegative }).strict();
export type Price = z.infer<typeof priceSchema>;

/** Fields every Ship and piece of Equipment has. */
const tradeableFields = {
  id,
  /** English display name. */
  name: z.string().min(1),
  /** The game's text id the name was resolved from, e.g. "{20101,1234}". */
  nameId: z.string().min(1),
  price: priceSchema,
  licence: id.nullable(),
  sellers: z.array(id),
};

// ---------------------------------------------------------------- manifest

export const manifestSchema = z
  .object({
    swi: z
      .object({
        /** The extension's version, e.g. "091". */
        version: z.string().min(1),
        /** The release label, e.g. "0.9.1 HF". */
        label: z.string().min(1),
        date: z.iso.date(),
      })
      .strict(),
    x4: z.object({ version: z.string().min(1) }).strict(),
    dlcs: z.array(z.object({ id, version: z.string().min(1) }).strict()),
    extractedAt: z.iso.datetime(),
    pipelineCommit: z.string().min(1),
    contentHash: z.string().min(1),
  })
  .strict();
export type Manifest = z.infer<typeof manifestSchema>;

// ---------------------------------------------------------------- ships

export const slotKindSchema = z.enum(["weapon", "turret", "shield", "engine"]);
export type SlotKind = z.infer<typeof slotKindSchema>;

export const slotSchema = z
  .object({
    /** The connection name, e.g. "con_weapon_01". */
    id,
    kind: slotKindSchema,
    size: sizeSchema,
    mandatory: z.boolean(),
    fitList: id,
  })
  .strict();
export type Slot = z.infer<typeof slotSchema>;

export const slotGroupKindSchema = z.enum(["turret", "shield", "engine"]);
export type SlotGroupKind = z.infer<typeof slotGroupKindSchema>;

const slotGroupEntrySchema = z
  .object({
    /** How many Slots of this kind the group has. */
    count: z.number().int().positive(),
    fitList: id,
  })
  .strict();

export const slotGroupSchema = z
  .object({
    /** The group name, e.g. "left-niche-front". */
    id,
    kinds: z
      .object({
        turret: slotGroupEntrySchema.optional(),
        shield: slotGroupEntrySchema.optional(),
        engine: slotGroupEntrySchema.optional(),
      })
      .strict()
      .refine((k) => Object.keys(k).length > 0, { message: "a Slot Group takes at least one kind" }),
  })
  .strict();
export type SlotGroup = z.infer<typeof slotGroupSchema>;

/** A storage's transport type, from its `<cargo tags>`. */
export const cargoTypeSchema = z.enum(["container", "solid", "liquid", "condensate"]);
export type CargoType = z.infer<typeof cargoTypeSchema>;

export const shipSchema = z
  .object({
    ...tradeableFields,
    size: sizeSchema,
    /** The Ship Type, e.g. "fighter", "frigate". */
    type: z.string().min(1),
    purpose: z.string().min(1),
    stats: z
      .object({
        hull: nonNegative,
        mass: z.number().positive(),
        radarRange: nonNegative,
        drag: z
          .object({
            forward: z.number().positive(),
            reverse: z.number().positive(),
            horizontal: z.number().positive(),
            vertical: z.number().positive(),
            pitch: z.number().positive(),
            yaw: z.number().positive(),
            roll: z.number().positive(),
          })
          .strict(),
        accFactors: z
          .object({
            forward: z.number().positive(),
            reverse: z.number().positive(),
            horizontal: z.number().positive(),
            vertical: z.number().positive(),
          })
          .strict(),
        /** `rotationspeed@max`, if the ship sets one. */
        maxRotationSpeed: z.number().positive().nullable(),
      })
      .strict(),
    capacities: z
      .object({
        missiles: count,
        drones: count,
        deployables: count,
        countermeasures: count,
        crew: count,
        /** Total cargo capacity of the Ship's storage, in m³. */
        cargo: count,
      })
      .strict(),
    /** The kinds of cargo the Ship's storage takes, sorted; empty when it has no storage. */
    cargoTypes: z.array(cargoTypeSchema),
    slots: z.array(slotSchema),
    slotGroups: z.array(slotGroupSchema),
    thrusters: id,
    software: z
      .object({
        fitList: id,
        /** Software the game marks `default="1"`. */
        mandatory: z.array(id),
      })
      .strict(),
    drones: id,
    deployables: id,
    countermeasures: id,
  })
  .strict();
export type Ship = z.infer<typeof shipSchema>;

// ---------------------------------------------------------------- equipment

/**
 * An item's size, from its type connection's size tag. Null when it has none
 * (SWI's astromech shields, say): then only its other tags say what it fits.
 */
const equipmentSize = sizeSchema.nullable();

const gunFields = {
  /**
   * A colour variant's bolt colour, `AARRGGBB` as the game's colour markup on
   * the variant's R, G, O or B letter writes it; null for Equipment without one.
   */
  boltColour: z.string().nullable(),
  size: equipmentSize,
  /** Bullet `damage`: `value`, `noshield` and `hull` all count against hull (#67). */
  damage: z.object({ value: nonNegative, noShield: nonNegative, hull: nonNegative }).strict(),
  barrelAmount: z.number().int().positive(),
  /** Bullet `reload@rate`: shots per second without a magazine. */
  fireRate: z.number().positive(),
  magazine: z
    .object({ size: z.number().int().positive(), reloadTime: z.number().positive() })
    .strict()
    .nullable(),
  heat: z
    .object({
      perShot: nonNegative,
      overheat: z.number().positive(),
      coolDelay: nonNegative,
      coolRate: z.number().positive(),
    })
    .strict()
    .nullable(),
  /**
   * Fit list of the missiles a launcher can fire; null if it isn't a launcher.
   * A launcher's damage, rate and heat are its missile's, so its own gun
   * fields are zero damage, one barrel, a rate of 1, and no magazine or heat.
   */
  missiles: id.nullable(),
  /**
   * A launcher's own missile storage (`storage@capacity`), which adds to the
   * Ship's Missiles (#39); 0 for other guns and for launchers without one.
   */
  missileStorage: count,
};

export const equipmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("weapon"), ...tradeableFields, ...gunFields }).strict(),
  z.object({ kind: z.literal("turret"), ...tradeableFields, ...gunFields }).strict(),
  z
    .object({
      kind: z.literal("shield"),
      ...tradeableFields,
      size: equipmentSize,
      capacity: nonNegative,
      rechargeRate: nonNegative,
      rechargeDelay: nonNegative,
    })
    .strict(),
  z
    .object({
      kind: z.literal("engine"),
      ...tradeableFields,
      size: equipmentSize,
      thrust: z.object({ forward: nonNegative, reverse: nonNegative }).strict(),
      boost: z
        .object({
          thrust: nonNegative,
          acceleration: nonNegative,
          duration: nonNegative,
          recharge: nonNegative,
        })
        .strict(),
      travel: z
        .object({ thrust: nonNegative, charge: nonNegative, attack: nonNegative })
        .strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("thruster"),
      ...tradeableFields,
      size: equipmentSize,
      thrust: z
        .object({ strafe: nonNegative, pitch: nonNegative, yaw: nonNegative, roll: nonNegative })
        .strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("missile"),
      ...tradeableFields,
      explosionDamage: nonNegative,
      hullDamage: nonNegative,
      /** `missile@barrelamount`: missiles fired per shot (#39); 1 when not given. */
      barrelAmount: z.number().int().positive(),
      reloadTime: z.number().positive(),
    })
    .strict(),
  z.object({ kind: z.literal("drone"), ...tradeableFields }).strict(),
  z.object({ kind: z.literal("deployable"), ...tradeableFields }).strict(),
  z.object({ kind: z.literal("countermeasure"), ...tradeableFields }).strict(),
  z
    .object({
      kind: z.literal("software"),
      ...tradeableFields,
      /**
       * The software this one replaces (`<software predecessor>`), or null. A
       * chain of predecessors is one Software Family, and a Ship fits at most
       * one of a family.
       */
      predecessor: id.nullable(),
      /**
       * The name the game gives this software's Software Family, e.g.
       * "Docking Software": the `factoryname` of the oldest ware in its chain
       * of predecessors, as the buy screen heads the family's group.
       */
      familyName: z.string(),
    })
    .strict(),
]);
export type Equipment = z.infer<typeof equipmentSchema>;
export type EquipmentKind = Equipment["kind"];

// ---------------------------------------------------------------- tables

export const fitListSchema = z.object({ id, equipment: z.array(id) }).strict();
export type FitList = z.infer<typeof fitListSchema>;

export const factionSchema = z.object({ id, name: z.string().min(1) }).strict();
export type Faction = z.infer<typeof factionSchema>;

/** A Faction's own copy of a licence type: each Faction names it, and sets its reputation, itself. */
export const licenceSchema = z
  .object({
    /** The licence type a ware's `licence` names, e.g. "capitalship". */
    id,
    /** The Faction that defines this copy. */
    faction: id,
    name: z.string().min(1),
    /** Reputation the licence needs, if extraction can read it. */
    reputation: z.number().nullable(),
  })
  .strict();
export type Licence = z.infer<typeof licenceSchema>;

// ---------------------------------------------------------------- snapshot

export const snapshotSchema = z
  .object({
    manifest: manifestSchema,
    ships: z.array(shipSchema),
    equipment: z.array(equipmentSchema),
    "fit-lists": z.array(fitListSchema),
    factions: z.array(factionSchema),
    licences: z.array(licenceSchema),
    /** What each member of the Crew, service crew or marine, costs (ADR 0004). */
    "crew-price": priceSchema,
  })
  .strict();

/** A snapshot that passed the schema, keyed by file name. */
export type SnapshotData = z.infer<typeof snapshotSchema>;
