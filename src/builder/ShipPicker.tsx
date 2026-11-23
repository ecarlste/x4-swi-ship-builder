import { useEffect, useId, useMemo, useState } from "react";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Faction, Ship, Size } from "../gameData.ts";
import { shipTypeLabel } from "./shipTypes.ts";

const SIZES: { value: Size; label: string }[] = [
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
];

/** A Ship Type's Ships, in the shape the Combobox takes groups: a `value` and its `items`. */
interface ShipGroup {
  value: string;
  label: string;
  items: Ship[];
}

/** Ships grouped under their Ship Type, groups and Ships each sorted by display name. */
function groupByType(ships: Ship[]): ShipGroup[] {
  const groups = new Map<string, Ship[]>();
  for (const ship of ships) {
    groups.set(ship.type, [...(groups.get(ship.type) ?? []), ship]);
  }
  return [...groups]
    .map(([type, list]) => ({
      value: type,
      label: shipTypeLabel(type),
      items: list.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The toolbar's left side: Size, then an optional Seller filter, then a
 * type-to-filter Ship combobox grouped by Ship Type. The filters only narrow
 * what the combobox lists.
 */
export function ShipPicker({
  ships,
  factions,
  value,
  onPick,
}: {
  ships: Ship[];
  factions: Faction[];
  value: Ship | null;
  onPick: (ship: Ship) => void;
}) {
  const [size, setSize] = useState<Size>(value?.size ?? "s");
  /** A Faction id, or null for any Seller. */
  const [seller, setSeller] = useState<string | null>(null);
  // A Ship opened from elsewhere (a Saved Loadout) brings its size with it.
  const valueSize = value?.size;
  useEffect(() => {
    if (valueSize) setSize(valueSize);
  }, [value?.id, valueSize]);
  const labelIdPrefix = useId();

  /** Factions that sell at least one Ship, by name. */
  const sellerOptions = useMemo(() => {
    const ids = new Set(ships.flatMap((s) => s.sellers));
    return [
      { value: null, label: "Any" },
      ...factions
        .filter((f) => ids.has(f.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({ value: f.id, label: f.name })),
    ];
  }, [ships, factions]);

  const groups = useMemo(
    () => groupByType(ships.filter((s) => s.size === size && (seller === null || s.sellers.includes(seller)))),
    [ships, size, seller],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterSelect
        label="Size"
        labelId={`${labelIdPrefix}-size`}
        items={SIZES}
        value={size}
        onValueChange={(next) => next && setSize(next)}
      />
      <FilterSelect
        label="Seller"
        labelId={`${labelIdPrefix}-seller`}
        items={sellerOptions}
        value={seller}
        onValueChange={setSeller}
      />
      <div className="flex items-center gap-2">
        <label htmlFor={`${labelIdPrefix}-ship`}>Ship</label>
        <Combobox
          items={groups}
          value={value}
          onValueChange={(ship) => ship && onPick(ship)}
          itemToStringLabel={(ship) => ship.name}
          isItemEqualToValue={(a, b) => a.id === b.id}
          autoHighlight
        >
          <ComboboxInput id={`${labelIdPrefix}-ship`} placeholder="Choose a Ship…" className="w-88 max-w-[70vw]" />
          <ComboboxContent>
            <ComboboxEmpty>No Ships match.</ComboboxEmpty>
            <ComboboxList aria-label="Ships">
              {(group: ShipGroup) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  <ComboboxLabel>{group.label}</ComboboxLabel>
                  <ComboboxCollection>
                    {(ship: Ship) => (
                      <ComboboxItem key={ship.id} value={ship}>
                        {ship.name}
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxGroup>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
  );
}

/** One of the picker's filters: its label, then a Select of its options. */
function FilterSelect<T extends string | null>({
  label,
  labelId,
  items,
  value,
  onValueChange,
}: {
  label: string;
  labelId: string;
  items: { value: T; label: string }[];
  value: T;
  onValueChange: (value: T | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span id={labelId}>{label}</span>
      <Select items={items} value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value ?? ""} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
