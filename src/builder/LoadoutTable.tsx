import { useId, useMemo, type ReactNode } from "react";
import type { Equipment, GameData, Ship, SlotKind } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import { shotDamage } from "../stats/firepower.ts";
import { ComparisonPopover } from "./ComparisonPopover.tsx";
import { EquipmentDropdown } from "./EquipmentDropdown.tsx";
import { formatCredits, formatNumber } from "./format.ts";
import { CREW_ROLE_NAMES, crewCount, type ConsumableKind, type Loadout, type SlotGroupKind } from "../loadout/loadout.ts";
import { loadoutLines, type Held, type Line } from "../loadout/lines.ts";
import { loadoutRules, type Edit, type LoadoutRules } from "../loadout/rules.ts";

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
 * The editable Loadout table, one row per line of the Loadout: the Chassis
 * first, read-only; one row for all the Ship's engines, which take one engine
 * type between them (ADR 0001); one row per other Slot and per Slot Group kind;
 * the thruster, the consumables and the software. After the Equipment, a Crew
 * section for a Ship with crew capacity. Columns: Slot, Equipment, quantity,
 * key value and average price.
 *
 * Rows, prices, mandatory marks and "was" values come from the Loadout's
 * lines; every edit, option and limit from the Ship's `loadoutRules`. The
 * Repairs of the table's own edits aren't shown: the controls offer only what
 * fits, and removing a launcher drops its missiles silently.
 */
export function LoadoutTable({
  gameData,
  ship,
  loadout,
  was = null,
  onChange,
}: {
  gameData: GameData;
  ship: Ship;
  loadout: Loadout;
  /** The Loadout as it was opened or last saved, given only while the current one differs from it. */
  was?: Loadout | null;
  onChange: (loadout: Loadout) => void;
}) {
  const { equipment } = indexGameData(gameData);
  const rules = useMemo(() => loadoutRules(gameData, ship), [gameData, ship]);
  const lines = loadoutLines(gameData, ship, loadout, was);
  const slots = new Map(ship.slots.map((s) => [s.id, s]));
  const consumables = rules.consumables(loadout);
  const nameOf = (id: string | null) => (id ? (equipment.get(id)?.name ?? id) : "empty");
  /** Applies an edit, discarding its Repairs. */
  const change = (edit: Edit) => onChange(edit.loadout);
  /** The comparison popover of a hovered option against what is fitted (one unit for Slot Groups). */
  const compareWith = (fitted: Equipment | null) => (option: Equipment) => (
    <ComparisonPopover gameData={gameData} loadout={loadout} option={option} fitted={fitted} />
  );

  const row = (line: Line): ReactNode => {
    const { place, equipment: fitted, count } = line;
    const price = fitted && count > 0 ? formatCredits(line.price.average) : "";
    /** The row's "was: …" text, when the line differs from the Loaded Loadout. */
    const wasText = (text: (held: Held | null) => string) => (line.was === undefined ? undefined : text(line.was));
    const wasNamed = wasText((held) => nameOf(held?.equipment ?? null));
    const dropdown = (label: string, onPick: (id: string | null) => Edit) =>
      place && (
        <EquipmentDropdown
          label={label}
          options={rules.options(loadout, place)}
          value={fitted?.id ?? null}
          onChange={(id) => change(onPick(id))}
          compare={compareWith(fitted)}
        />
      );
    switch (place?.kind) {
      case undefined:
        return (
          <Row
            key="chassis"
            label="Chassis"
            equipment={ship.name}
            quantity="1"
            keyValue=""
            price={formatCredits(line.price.average)}
          />
        );
      case "engine":
        return (
          <Row
            key="engine"
            label={
              <>
                Engines <span className="dim">{rules.limit(loadout, place)}×</span>
              </>
            }
            missing={line.missing}
            equipment={dropdown("Engines Equipment", (id) => rules.setEngine(loadout, id))}
            quantity={fitted ? formatNumber(count) : ""}
            keyValue={fitted ? keyValue(fitted) : ""}
            price={price}
            was={wasNamed}
          />
        );
      case "slot": {
        const slot = slots.get(place.slot)!;
        return (
          <Row
            key={`slot/${slot.id}`}
            missing={line.missing}
            label={
              <>
                {slot.size.toUpperCase()} {KIND_LABEL[slot.kind]} <span className="dim">{slot.id}</span>
              </>
            }
            equipment={dropdown(`${slot.id} Equipment`, (id) => rules.setSlot(loadout, slot.id, id))}
            quantity={fitted ? "1" : ""}
            keyValue={fitted ? keyValue(fitted) : ""}
            price={price}
            was={wasNamed}
          />
        );
      }
      case "group": {
        const { group, groupKind: kind } = place;
        const size = rules.limit(loadout, place);
        const label = `${group} ${GROUP_KIND_LABEL[kind]}`;
        return (
          <Row
            key={`group/${group}/${kind}`}
            missing={line.missing}
            label={
              <>
                {GROUP_KIND_LABEL[kind]} <span className="dim">{group}</span>
              </>
            }
            equipment={dropdown(`${label} Equipment`, (id) => rules.setGroupEquipment(loadout, group, kind, id))}
            quantity={
              <CountInput
                label={`${label} count`}
                value={fitted ? count : 0}
                max={size}
                limit={size}
                disabled={!fitted}
                onChange={(n) => change(rules.setGroupCount(loadout, group, kind, n))}
              />
            }
            keyValue={fitted ? keyValue(fitted) : ""}
            price={price}
            was={wasText((held) => (held ? `${nameOf(held.equipment)} ×${held.count}` : "empty"))}
          />
        );
      }
      case "thruster":
        return (
          <Row
            key="thruster"
            label="Thruster"
            missing={line.missing}
            equipment={dropdown("Thruster Equipment", (id) => rules.setThruster(loadout, id))}
            quantity={fitted ? "1" : ""}
            keyValue={fitted ? keyValue(fitted) : ""}
            price={price}
            was={wasNamed}
          />
        );
      case "consumable": {
        const kind = consumables.find((o) => o.items.some((e) => e.id === place.equipment))!;
        const item = kind.items.find((e) => e.id === place.equipment)!;
        return (
          <Row
            key={`consumable/${item.id}`}
            label={CONSUMABLE_LABEL[kind.kind]}
            missing={line.missing}
            equipment={item.name}
            quantity={
              <CountInput
                label={`${item.name} count`}
                value={count}
                max={kind.capacity}
                // Every item of a kind shares the Ship's capacity for it.
                limit={rules.limit(loadout, place)}
                onChange={(n) => change(rules.setConsumable(loadout, item.id, n))}
              />
            }
            keyValue={count > 0 ? keyValue(item) : ""}
            price={price}
            was={wasText((held) => formatNumber(held?.count ?? 0))}
          />
        );
      }
      case "software":
        return (
          <Row
            key={`software/${place.equipment}`}
            label="Software"
            missing={line.missing}
            equipment={
              <label className="software">
                <input
                  type="checkbox"
                  checked={count > 0}
                  onChange={(e) => change(rules.setSoftware(loadout, place.equipment, e.target.checked))}
                />{" "}
                {nameOf(place.equipment)}
              </label>
            }
            quantity={count > 0 ? "1" : ""}
            keyValue=""
            price={price}
            was={wasText((held) => (held ? "fitted" : "not fitted"))}
          />
        );
      case "crew":
        return null;
    }
  };

  const crew = lines.filter((l) => l.place?.kind === "crew");
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
      <tbody>{lines.map(row)}</tbody>
      {crew.length > 0 && (
        <CrewSection rules={rules} capacity={ship.capacities.crew} loadout={loadout} lines={crew} onChange={change} />
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
  rules,
  capacity,
  loadout,
  lines,
  onChange,
}: {
  rules: LoadoutRules;
  capacity: number;
  loadout: Loadout;
  /** The Crew's lines, one per role. */
  lines: Line[];
  onChange: (edit: Edit) => void;
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
      {lines.map((line) => {
        if (line.place?.kind !== "crew") return null;
        const place = line.place;
        const label = CREW_ROLE_NAMES[place.role];
        return (
          <Row
            key={place.role}
            label={label}
            equipment=""
            quantity={
              <CountInput
                label={`${label} count`}
                value={line.count}
                // Service crew and marines share the Ship's crew capacity, which the header shows.
                limit={rules.limit(loadout, place)}
                onChange={(n) => onChange(rules.setCrew(loadout, place.role, n))}
              />
            }
            keyValue=""
            price={line.count > 0 ? formatCredits(line.price.average) : ""}
            was={line.was === undefined ? undefined : formatNumber(line.was?.count ?? 0)}
          />
        );
      })}
    </tbody>
  );
}

/**
 * A count, shown as "count / max" when given a max. The input stops at
 * limit, which is lower than max when other items share the capacity; the
 * edit itself clamps a typed value over it.
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
          onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
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
