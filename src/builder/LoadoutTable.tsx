import { useId, type ReactNode } from "react";
import type { Equipment, GameData, Ship, SlotKind } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import { shotDamage } from "../stats/firepower.ts";
import { ComparisonPopover } from "./ComparisonPopover.tsx";
import { EquipmentDropdown } from "./EquipmentDropdown.tsx";
import { formatCredits, formatNumber } from "./format.ts";
import {
  CREW_ROLE_NAMES,
  CREW_ROLES,
  crewCount,
  consumableOptions,
  setConsumable,
  setCrew,
  setEngine,
  setGroup,
  setSlot,
  setSoftware,
  setThruster,
  shipEngines,
  withoutUncarriedConsumables,
  type ConsumableKind,
  type Loadout,
  type SlotGroupKind,
} from "./loadout.ts";

const CONSUMABLE_LABEL: Record<ConsumableKind, string> = {
  missile: "Missiles",
  drone: "Drones",
  deployable: "Deployables",
  countermeasure: "Countermeasures",
};

const KIND_LABEL: Record<SlotKind, string> = {
  weapon: "Weapon",
  turret: "Turret",
  shield: "Shield",
  engine: "Engine",
};

const SLOT_GROUP_KINDS: SlotGroupKind[] = ["turret", "shield"];
const GROUP_KIND_LABEL: Record<SlotGroupKind, string> = {
  turret: "Turrets",
  shield: "Shields",
};


/** The one figure the table shows for an item, from its raw inputs. */
function keyValue(item: Equipment): string {
  switch (item.kind) {
    case "weapon":
    case "turret":
      return `${formatNumber(shotDamage(item))} dmg/shot`;
    case "shield":
      return `${formatNumber(item.capacity)} MJ`;
    case "engine":
      return `${formatNumber(item.thrust.forward)} N`;
    case "thruster":
      return `${formatNumber(item.thrust.strafe)} N strafe`;
    case "missile":
      return `${formatNumber(item.explosionDamage + item.hullDamage)} dmg`;
    default:
      return "";
  }
}

/**
 * The editable Loadout table: one row for all the Ship's engines, which take
 * one engine type between them (ADR 0001), then one row per other Slot.
 * After the Equipment, a Crew section for a Ship with crew capacity.
 * Columns: Slot, Equipment, quantity, key value and average price.
 */
export function LoadoutTable({
  gameData,
  ship,
  loadout,
  missing,
  was = null,
  onChange,
}: {
  gameData: GameData;
  ship: Ship;
  loadout: Loadout;
  /** Rows of mandatory upgrades the Loadout lacks, as `missingMandatory` names them. */
  missing: Set<string>;
  /** The Loadout as it was opened or last saved, given only while the current one differs from it. */
  was?: Loadout | null;
  onChange: (loadout: Loadout) => void;
}) {
  const { equipment, fitListEquipment: options } = indexGameData(gameData);
  const nameOf = (id: string | undefined) => (id ? (equipment.get(id)?.name ?? id) : "empty");
  /** The row's "was: …" text when it differs from the loaded Loadout, else undefined. */
  const wasText = (before: string, now: string) => (was && before !== now ? before : undefined);
  const groupText = (entry: { equipment: string; count: number } | undefined) =>
    entry ? `${nameOf(entry.equipment)} ×${entry.count}` : "empty";
  const engines = shipEngines(ship);
  const engine = equipment.get(loadout.engine ?? "") ?? null;
  const thruster = equipment.get(loadout.thruster ?? "") ?? null;
  const consumables = consumableOptions(gameData, ship, loadout);
  /** Applies an edit, dropping consumables it leaves the Ship unable to carry. */
  const change = (next: Loadout) => onChange(withoutUncarriedConsumables(gameData, ship, next));
  /** The comparison popover of a hovered option against what is fitted (one unit for Slot Groups). */
  const compareWith = (fitted: Equipment | null) => (option: Equipment) => (
    <ComparisonPopover gameData={gameData} loadout={loadout} option={option} fitted={fitted} />
  );

  return (
    <table className="loadout-table" aria-label="Loadout">
      <thead>
        <tr>
          <th scope="col">Slot</th>
          <th scope="col">Equipment</th>
          <th scope="col" className="num">
            Qty
          </th>
          <th scope="col">Key value</th>
          <th scope="col" className="num">
            Price (avg)
          </th>
        </tr>
      </thead>
      <tbody>
        {engines && (
          <Row
            label={
              <>
                Engines <span className="dim">{engines.count}×</span>
              </>
            }
            missing={missing.has("engine")}
            equipment={
              <EquipmentDropdown
                label="Engines Equipment"
                options={options(engines.fitList)}
                value={engine?.id ?? null}
                onChange={(id) => change(setEngine(loadout, id))}
                compare={compareWith(engine)}
              />
            }
            quantity={engine ? formatNumber(engines.count) : ""}
            keyValue={engine ? keyValue(engine) : ""}
            price={engine ? formatCredits(engine.price.average * engines.count) : ""}
            was={wasText(nameOf(was?.engine), nameOf(loadout.engine))}
          />
        )}
        {ship.slots.filter((slot) => slot.kind !== "engine").map((slot) => {
          const fitted = equipment.get(loadout.slots?.[slot.id] ?? "") ?? null;
          return (
            <Row
              key={slot.id}
              missing={missing.has(`slot:${slot.id}`)}
              label={
                <>
                  {slot.size.toUpperCase()} {KIND_LABEL[slot.kind]} <span className="dim">{slot.id}</span>
                </>
              }
              equipment={
                <EquipmentDropdown
                  label={`${slot.id} Equipment`}
                  options={options(slot.fitList)}
                  value={fitted?.id ?? null}
                  onChange={(id) => change(setSlot(loadout, slot.id, id))}
                  compare={compareWith(fitted)}
                />
              }
              quantity={fitted ? "1" : ""}
              keyValue={fitted ? keyValue(fitted) : ""}
              price={fitted ? formatCredits(fitted.price.average) : ""}
              was={wasText(nameOf(was?.slots?.[slot.id]), nameOf(loadout.slots?.[slot.id]))}
            />
          );
        })}
        {ship.slotGroups.flatMap((group) =>
          SLOT_GROUP_KINDS.flatMap((kind) => {
            const part = group.kinds[kind];
            if (!part) return [];
            const entry = loadout.groups?.[group.id]?.[kind];
            const fitted = equipment.get(entry?.equipment ?? "") ?? null;
            const count = fitted ? (entry?.count ?? 0) : 0;
            const label = `${group.id} ${GROUP_KIND_LABEL[kind]}`;
            return (
              <Row
                key={`${group.id}/${kind}`}
                missing={missing.has(`group:${group.id}:${kind}`)}
                label={
                  <>
                    {GROUP_KIND_LABEL[kind]} <span className="dim">{group.id}</span>
                  </>
                }
                equipment={
                  <EquipmentDropdown
                    label={`${label} Equipment`}
                    options={options(part.fitList)}
                    value={fitted?.id ?? null}
                    compare={compareWith(fitted)}
                    onChange={(id) =>
                      change(
                        setGroup(loadout, group.id, kind, id ? { equipment: id, count: count || part.count } : null),
                      )
                    }
                  />
                }
                quantity={
                  <CountInput
                    label={`${label} count`}
                    value={count}
                    max={part.count}
                    limit={part.count}
                    disabled={!fitted}
                    onChange={(n) => fitted && change(setGroup(loadout, group.id, kind, { equipment: fitted.id, count: n }))}
                  />
                }
                keyValue={fitted ? keyValue(fitted) : ""}
                price={fitted ? formatCredits(fitted.price.average * count) : ""}
                was={wasText(groupText(was?.groups?.[group.id]?.[kind]), groupText(entry))}
              />
            );
          }),
        )}
        <Row
          label="Thruster"
          missing={missing.has("thruster")}
          equipment={
            <EquipmentDropdown
              label="Thruster Equipment"
              options={options(ship.thrusters)}
              value={thruster?.id ?? null}
              onChange={(id) => change(setThruster(loadout, id))}
              compare={compareWith(thruster)}
            />
          }
          quantity={thruster ? "1" : ""}
          keyValue={thruster ? keyValue(thruster) : ""}
          price={thruster ? formatCredits(thruster.price.average) : ""}
          was={wasText(nameOf(was?.thruster), nameOf(loadout.thruster))}
        />
        {consumables.flatMap((group) => {
          const used = group.items.reduce((sum, item) => sum + (loadout.consumables?.[item.id] ?? 0), 0);
          return group.items.map((item) => {
            const count = loadout.consumables?.[item.id] ?? 0;
            return (
              <Row
                key={item.id}
                label={CONSUMABLE_LABEL[group.kind]}
                equipment={item.name}
                quantity={
                  <CountInput
                    label={`${item.name} count`}
                    value={count}
                    max={group.capacity}
                    // Every item of a kind shares the Ship's capacity for it.
                    limit={group.capacity - (used - count)}
                    onChange={(n) => change(setConsumable(loadout, item.id, n))}
                  />
                }
                keyValue={count > 0 ? keyValue(item) : ""}
                price={count > 0 ? formatCredits(item.price.average * count) : ""}
                was={wasText(formatNumber(was?.consumables?.[item.id] ?? 0), formatNumber(count))}
              />
            );
          });
        })}
        {options(ship.software.fitList).map((item) => {
          const fitted = loadout.software?.includes(item.id) ?? false;
          return (
            <Row
              key={item.id}
              label="Software"
              missing={missing.has(`software:${item.id}`)}
              equipment={
                <label className="software">
                  <input
                    type="checkbox"
                    checked={fitted}
                    onChange={(e) => change(setSoftware(loadout, item.id, e.target.checked))}
                  />{" "}
                  {item.name}
                </label>
              }
              quantity={fitted ? "1" : ""}
              keyValue=""
              price={fitted ? formatCredits(item.price.average) : ""}
              was={wasText(
                was?.software?.includes(item.id) ? "fitted" : "not fitted",
                fitted ? "fitted" : "not fitted",
              )}
            />
          );
        })}
      </tbody>
      {ship.capacities.crew > 0 && (
        <CrewSection
          capacity={ship.capacities.crew}
          crewPrice={gameData.crewPrice.average}
          loadout={loadout}
          was={was}
          onChange={change}
        />
      )}
    </table>
  );
}

/**
 * The Crew, after the Equipment: service crew and marines, sharing the Ship's
 * crew capacity, each at the crew price. The Captain is free and not a count
 * (ADR 0004).
 */
function CrewSection({
  capacity,
  crewPrice,
  loadout,
  was,
  onChange,
}: {
  capacity: number;
  crewPrice: number;
  loadout: Loadout;
  was: Loadout | null;
  onChange: (loadout: Loadout) => void;
}) {
  const headingId = useId();
  const used = crewCount(loadout);
  return (
    <tbody aria-labelledby={headingId}>
      <tr className="section">
        <th scope="col" colSpan={5} id={headingId}>
          Crew{" "}
          <span className="dim">
            {formatNumber(used)} / {formatNumber(capacity)}
          </span>
        </th>
      </tr>
      {CREW_ROLES.map((role) => {
        const label = CREW_ROLE_NAMES[role];
        const count = loadout.crew?.[role] ?? 0;
        const before = was?.crew?.[role] ?? 0;
        return (
          <Row
            key={role}
            label={label}
            equipment=""
            quantity={
              <CountInput
                label={`${label} count`}
                value={count}
                // Service crew and marines share the Ship's crew capacity, which the header shows.
                limit={capacity - (used - count)}
                onChange={(n) => onChange(setCrew(loadout, role, n))}
              />
            }
            keyValue=""
            price={count > 0 ? formatCredits(crewPrice * count) : ""}
            was={was && before !== count ? formatNumber(before) : undefined}
          />
        );
      })}
    </tbody>
  );
}

/**
 * A count, shown as "count / max" when given a max. Typed values are clamped
 * to 0..limit; limit is lower than max when other items share the capacity.
 */
function CountInput({
  label,
  value,
  max,
  limit,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max?: number;
  limit: number;
  disabled?: boolean;
  onChange: (count: number) => void;
}) {
  return (
    <span className="count">
      <input
        type="number"
        aria-label={label}
        min={0}
        max={limit}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value));
          onChange(Number.isFinite(n) ? Math.max(0, Math.min(limit, n)) : 0);
        }}
      />
      {max !== undefined && <> / {formatNumber(max)}</>}
    </span>
  );
}

function Row({
  label,
  missing = false,
  equipment,
  quantity,
  keyValue,
  price,
  was,
}: {
  label: ReactNode;
  missing?: boolean;
  equipment: ReactNode;
  quantity: ReactNode;
  keyValue: string;
  price: string;
  /** What the row held when the Loadout was opened or last saved, when that differs from now. */
  was?: string;
}) {
  const classes = [missing && "missing", was !== undefined && "changed"].filter(Boolean).join(" ");
  return (
    <tr className={classes || undefined}>
      <th scope="row">
        {label}
        {missing && (
          <>
            {" "}
            <span className="missing-mark" title="Mandatory upgrade missing">
              *
            </span>
          </>
        )}
        {was !== undefined && (
          <>
            {" "}
            <span className="changed-mark" title="Changed since loading">
              ●
            </span>
          </>
        )}
      </th>
      <td>
        {equipment}
        {was !== undefined && <div className="was">was: {was}</div>}
      </td>
      <td className="num">{quantity}</td>
      <td className="dim">{keyValue}</td>
      <td className="num">{price}</td>
    </tr>
  );
}
