import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { Equipment } from "../gameData.ts";

const EMPTY_LABEL = "— empty —";

/**
 * The custom Equipment dropdown used by the Loadout table: plain names sorted
 * by name, "— empty —" first, the fitted item ticked. No search or grouping.
 */
export function EquipmentDropdown({
  label,
  options,
  value,
  onChange,
}: {
  /** Accessible name, e.g. "con_weapon_01 Equipment". */
  label: string;
  options: Equipment[];
  /** The fitted item's ware id, or null when empty. */
  value: string | null;
  onChange: (equipment: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Close on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const sorted = [...options].sort((a, b) => a.name.localeCompare(b.name));
  const items: { id: string | null; name: string }[] = [{ id: null, name: EMPTY_LABEL }, ...sorted];
  const fitted = sorted.find((e) => e.id === value) ?? null;

  const pick = (id: string | null) => {
    setOpen(false);
    if (id !== value) onChange(id);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="equipment-dropdown" ref={ref} onKeyDown={onKeyDown}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={fitted ? "" : "empty"}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{fitted?.name ?? EMPTY_LABEL}</span>
        <span aria-hidden="true" className="dim">
          ▾
        </span>
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="equipment-list">
          {items.map((item) => {
            const selected = item.id === value || (item.id === null && !fitted);
            return (
              <li
                key={item.id ?? ""}
                role="option"
                aria-selected={selected}
                aria-label={item.name}
                className={item.id === null ? "dim" : undefined}
                onClick={() => pick(item.id)}
              >
                <span aria-hidden="true" className="tick">
                  {selected ? "✓" : ""}
                </span>
                {item.name}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
