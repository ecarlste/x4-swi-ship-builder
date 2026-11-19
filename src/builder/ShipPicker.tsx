import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import type { Faction, Ship, Size } from "../gameData.ts";
import { shipTypeLabel } from "./shipTypes.ts";

const SIZES: { value: Size; label: string }[] = [
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
];

interface ShipGroup {
  type: string;
  label: string;
  ships: Ship[];
}

/** Ships grouped under their Ship Type, groups and Ships each sorted by display name. */
function groupByType(ships: Ship[]): ShipGroup[] {
  const groups = new Map<string, Ship[]>();
  for (const ship of ships) {
    groups.set(ship.type, [...(groups.get(ship.type) ?? []), ship]);
  }
  return [...groups]
    .map(([type, list]) => ({
      type,
      label: shipTypeLabel(type),
      ships: list.sort((a, b) => a.name.localeCompare(b.name)),
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
  /** A Faction id, or "" for any Seller. */
  const [seller, setSeller] = useState("");
  const [open, setOpen] = useState(false);
  /** What the user has typed since opening the list, or null to list everything. */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const optionId = (ship: Ship) => `${listId}-${ship.id}`;

  const factionName = useMemo(() => new Map(factions.map((f) => [f.id, f.name])), [factions]);
  const sellerNames = (ship: Ship) => ship.sellers.map((id) => factionName.get(id) ?? id).join(", ");
  /** Factions that sell at least one Ship, by name. */
  const shipSellers = useMemo(() => {
    const ids = new Set(ships.flatMap((s) => s.sellers));
    return factions.filter((f) => ids.has(f.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [ships, factions]);

  const groups = useMemo(() => {
    const typed = query?.trim().toLowerCase() ?? "";
    return groupByType(
      ships.filter(
        (s) =>
          s.size === size &&
          (seller === "" || s.sellers.includes(seller)) &&
          s.name.toLowerCase().includes(typed),
      ),
    );
  }, [ships, size, seller, query]);
  const listed = groups.flatMap((g) => g.ships);
  const activeShip = open ? listed[Math.min(active, listed.length - 1)] : undefined;
  const activeOptionId = activeShip ? optionId(activeShip) : undefined;

  // Keep the option the arrow keys reach visible in a long list.
  useEffect(() => {
    if (activeOptionId) document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId]);

  const close = () => {
    setOpen(false);
    setQuery(null);
  };
  const pick = (ship: Ship) => {
    onPick(ship);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => Math.max(0, Math.min(listed.length - 1, Math.min(i, listed.length - 1) + step)));
    } else if (e.key === "Enter" && activeShip) {
      e.preventDefault();
      pick(activeShip);
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    <div className="ship-picker">
      <label>
        Size{" "}
        <select value={size} onChange={(e) => setSize(e.target.value as Size)}>
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Seller{" "}
        <select value={seller} onChange={(e) => setSeller(e.target.value)}>
          <option value="">Any</option>
          {shipSellers.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <div className="ship-combobox">
        <label htmlFor={`${listId}-input`}>Ship</label>{" "}
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          placeholder="Choose a Ship…"
          value={query ?? (open ? "" : (value?.name ?? ""))}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={close}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {open && (
          <div className="ship-list">
            <div id={listId} role="listbox" aria-label="Ships">
              {groups.map((group) => (
                <div key={group.type} role="group" aria-labelledby={`${listId}-${group.type}`}>
                  <div id={`${listId}-${group.type}`} className="ship-group-label" role="presentation">
                    {group.label}
                  </div>
                  {group.ships.map((ship) => (
                    <div
                      key={ship.id}
                      id={optionId(ship)}
                      role="option"
                      aria-selected={ship.id === value?.id}
                      aria-label={ship.name}
                      aria-describedby={`${optionId(ship)}-sellers`}
                      className={ship === activeShip ? "ship-option active" : "ship-option"}
                      // Keep focus in the input so its blur doesn't close the list first.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(ship)}
                    >
                      <span>{ship.name}</span>
                      <span id={`${optionId(ship)}-sellers`} className="ship-option-sellers">
                        {sellerNames(ship)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {listed.length === 0 && <p className="ship-list-empty">No Ships match.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
