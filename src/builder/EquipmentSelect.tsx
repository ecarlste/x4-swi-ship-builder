import { useId, useState, type ReactNode } from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Equipment } from "../gameData.ts";

const EMPTY_LABEL = "— empty —";

/**
 * A Slot's Equipment Select in the Loadout table: plain names sorted by name, "— empty —" first,
 * the fitted item ticked. No search or grouping. It works by keyboard: Enter, Space or the arrow
 * keys open it, the arrow keys and typed letters move through it, Enter fits and Escape closes
 * it unchanged. Hovering an option shows `compare`'s popover for it beside the list.
 *
 * Each option takes real focus as it is highlighted (Base UI), so the popover can follow focus
 * by calling `show` from the option's `onFocus` too.
 */
export function EquipmentSelect({
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
  /** The option the comparison popover is shown for. */
  const [shown, setShown] = useState<Equipment | null>(null);
  const popoverId = useId();

  const sorted = [...options].sort((a, b) => a.name.localeCompare(b.name));
  const items: { value: string | null; label: string }[] = [
    { value: null, label: EMPTY_LABEL },
    ...sorted.map((e) => ({ value: e.id, label: e.name })),
  ];
  const fitted = sorted.find((e) => e.id === value) ?? null;
  const show = (option: Equipment | null) => setShown(compare ? option : null);

  return (
    <Select
      items={items}
      value={fitted?.id ?? null}
      onValueChange={(id: string | null) => {
        if (id !== value) onChange(id);
      }}
      onOpenChange={(open) => {
        if (!open) show(null);
      }}
    >
      <SelectTrigger aria-label={label} className="w-full min-w-56 data-placeholder:text-muted-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          alignItemWithTrigger={false}
          className="isolate z-50 flex items-start gap-1"
        >
          <SelectPrimitive.Popup className="max-h-[min(50vh,var(--available-height))] min-w-(--anchor-width) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <SelectPrimitive.List onMouseLeave={() => show(null)}>
              {items.map((item) => {
                const option = sorted.find((e) => e.id === item.value) ?? null;
                const selected = item.value === (fitted?.id ?? null);
                return (
                  <SelectItem
                    key={item.value ?? ""}
                    value={item.value}
                    label={item.label}
                    // The name alone: the tick isn't part of it.
                    aria-label={item.label}
                    aria-describedby={option !== null && option === shown ? popoverId : undefined}
                    className={option ? undefined : "text-muted-foreground"}
                    onMouseEnter={() => show(option)}
                  >
                    {item.label}
                    {/* The tick as text too, beside the drawn one, as the option has always had it. */}
                    {selected && <span className="sr-only">✓</span>}
                  </SelectItem>
                );
              })}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
          {shown && compare && (
            <div id={popoverId} role="tooltip" className="comparison-popover">
              {compare(shown)}
            </div>
          )}
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </Select>
  );
}
