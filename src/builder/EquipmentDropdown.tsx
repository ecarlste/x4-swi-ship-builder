import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Equipment } from "../gameData.ts";

const EMPTY_LABEL = "— empty —";

/**
 * The custom Equipment dropdown used by the Loadout table: plain names sorted
 * by name, "— empty —" first, the fitted item ticked. No search or grouping.
 * Hovering an option shows `compare`'s popover for it beside the list.
 */
export function EquipmentDropdown({
  label,
  options,
  value,
  onChange,
  compare,
}: {
  /** Accessible name, e.g. "con_weapon_01 Equipment". */
  label: string;
  options: Equipment[];
  /** The fitted item's Equipment id, or null when empty. */
  value: string | null;
  onChange: (equipment: string | null) => void;
  /** The comparison popover's content for a hovered option. */
  compare?: (option: Equipment) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<Equipment | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const popoverId = useId();

  // Close on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const sorted = [...options].sort((a, b) => a.name.localeCompare(b.name));
  const items: { id: string | null; name: string }[] = [{ id: null, name: EMPTY_LABEL }, ...sorted];
  const fitted = sorted.find((e) => e.id === value) ?? null;

  const close = () => {
    setOpen(false);
    setHovered(null);
  };
  const pick = (id: string | null) => {
    close();
    if (id !== value) onChange(id);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
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
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span>{fitted?.name ?? EMPTY_LABEL}</span>
        <span aria-hidden="true" className="dim">
          ▾
        </span>
      </button>
      {open && (
        <div className="equipment-popup">
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="equipment-list"
            onMouseLeave={() => setHovered(null)}
          >
            {items.map((item) => {
              const selected = item.id === value || (item.id === null && !fitted);
              const option = sorted.find((e) => e.id === item.id) ?? null;
              const described = compare !== undefined && option !== null && option === hovered;
              return (
                <li
                  key={item.id ?? ""}
                  role="option"
                  aria-selected={selected}
                  aria-label={item.name}
                  aria-describedby={described ? popoverId : undefined}
                  className={item.id === null ? "dim" : undefined}
                  onClick={() => pick(item.id)}
                  onMouseEnter={() => setHovered(option)}
                >
                  <span aria-hidden="true" className="tick">
                    {selected ? "✓" : ""}
                  </span>
                  {item.name}
                </li>
              );
            })}
          </ul>
          {hovered && compare && (
            <div id={popoverId} role="tooltip" className="comparison-popover">
              {compare(hovered)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
