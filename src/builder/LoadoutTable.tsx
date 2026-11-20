import type { ReactNode } from "react";
import type { Equipment, GameData, Ship, SlotKind } from "../gameData.ts";
import { EquipmentDropdown } from "./EquipmentDropdown.tsx";
import { setGroup, setSlot, setSoftware, setThruster, type Loadout, type SlotGroupKind } from "./loadout.ts";

const KIND_LABEL: Record<SlotKind, string> = {
  weapon: "Weapon",
  turret: "Turret",
  shield: "Shield",
  engine: "Engine",
};

const SLOT_GROUP_KINDS: SlotGroupKind[] = ["turret", "shield", "engine"];
const GROUP_KIND_LABEL: Record<SlotGroupKind, string> = {
  turret: "Turrets",
  shield: "Shields",
  engine: "Engines",
};

const number =(n: number) => n.toLocaleString("en");
const credits = (n: number) => `${number(n)} Cr`;

/** The one figure the table shows for an item, from its raw inputs. */
function keyValue(item: Equipment): string {
  switch (item.kind) {
    case "weapon":
    case "turret":
      return `${number(item.damage.value + item.damage.noShield)} dmg/shot`;
    case "shield":
      return `${number(item.capacity)} MJ`;
    case "engine":
      return `${number(item.thrust.forward)} N`;
    case "thruster":
      return `${number(item.thrust.strafe)} N strafe`;
    case "missile":
      return `${number(item.explosionDamage + item.hullDamage)} dmg`;
    default:
      return "";
  }
}

/**
 * The editable Loadout table: one row per Slot. Columns: Slot, Equipment,
 * quantity, key value and average price.
 */
export function LoadoutTable({
  gameData,
  ship,
  loadout,
  onChange,
}: {
  gameData: GameData;
  ship: Ship;
  loadout: Loadout;
  onChange: (loadout: Loadout) => void;
}) {
  const equipment = new Map(gameData.equipment.map((e) => [e.id, e]));
  const fitList = new Map(gameData.fitLists.map((f) => [f.id, f.equipment]));
  const options = (fitListId: string) =>
    (fitList.get(fitListId) ?? []).flatMap((id) => equipment.get(id) ?? []);
  const thruster = equipment.get(loadout.thruster ?? "") ?? null;

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
        {ship.slots.map((slot) => {
          const fitted = equipment.get(loadout.slots?.[slot.id] ?? "") ?? null;
          return (
            <Row
              key={slot.id}
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
                  onChange={(id) => onChange(setSlot(loadout, slot.id, id))}
                />
              }
              quantity={fitted ? "1" : ""}
              keyValue={fitted ? keyValue(fitted) : ""}
              price={fitted ? credits(fitted.price.average) : ""}
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
                    onChange={(id) =>
                      onChange(
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
                    disabled={!fitted}
                    onChange={(n) => fitted && onChange(setGroup(loadout, group.id, kind, { equipment: fitted.id, count: n }))}
                  />
                }
                keyValue={fitted ? keyValue(fitted) : ""}
                price={fitted ? credits(fitted.price.average * count) : ""}
              />
            );
          }),
        )}
        <Row
          label="Thruster"
          equipment={
            <EquipmentDropdown
              label="Thruster Equipment"
              options={options(ship.thrusters)}
              value={thruster?.id ?? null}
              onChange={(id) => onChange(setThruster(loadout, id))}
            />
          }
          quantity={thruster ? "1" : ""}
          keyValue={thruster ? keyValue(thruster) : ""}
          price={thruster ? credits(thruster.price.average) : ""}
        />
        {options(ship.software.fitList).map((item) => {
          const fitted = loadout.software?.includes(item.id) ?? false;
          return (
            <Row
              key={item.id}
              label="Software"
              equipment={
                <label className="software">
                  <input
                    type="checkbox"
                    checked={fitted}
                    onChange={(e) => onChange(setSoftware(loadout, item.id, e.target.checked))}
                  />{" "}
                  {item.name}
                </label>
              }
              quantity={fitted ? "1" : ""}
              keyValue=""
              price={fitted ? credits(item.price.average) : ""}
            />
          );
        })}
      </tbody>
    </table>
  );
}

/** A count from 0 to `max`, shown as "count / max". Typed values are clamped. */
function CountInput({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (count: number) => void;
}) {
  return (
    <span className="count">
      <input
        type="number"
        aria-label={label}
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value));
          onChange(Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0);
        }}
      />{" "}
      / {number(max)}
    </span>
  );
}

function Row({
  label,
  equipment,
  quantity,
  keyValue,
  price,
}: {
  label: ReactNode;
  equipment: ReactNode;
  quantity: ReactNode;
  keyValue: string;
  price: string;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{equipment}</td>
      <td className="num">{quantity}</td>
      <td className="dim">{keyValue}</td>
      <td className="num">{price}</td>
    </tr>
  );
}
