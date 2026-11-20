import type { ReactNode } from "react";
import type { Equipment, GameData, Ship, SlotKind } from "../gameData.ts";
import { EquipmentDropdown } from "./EquipmentDropdown.tsx";
import { setSlot, type Loadout } from "./loadout.ts";

const KIND_LABEL: Record<SlotKind, string> = {
  weapon: "Weapon",
  turret: "Turret",
  shield: "Shield",
  engine: "Engine",
};

const number = (n: number) => n.toLocaleString("en");
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
      </tbody>
    </table>
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
