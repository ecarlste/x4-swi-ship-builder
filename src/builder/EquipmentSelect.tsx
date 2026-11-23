import { useId, useState, type ReactNode } from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "cn";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Equipment } from "../gameData.ts";

const EMPTY_LABEL = "— empty —";

/** The surface the list and the comparison popover beside it share: shadcn's popover. */
const SURFACE = "rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10";

/**
 * A Slot's Equipment Select in the Loadout table: plain names sorted by name, "— empty —" first,
 * the fitted item ticked. No search or grouping. It works by keyboard: Enter, Space or the arrow
 * keys open it, the arrow keys and typed letters move through it, Enter fits and Escape closes
 * it unchanged. The highlighted option, hovered or arrowed to, shows `compare`'s popover beside
 * the list: each option takes real focus as it is highlighted (Base UI), so the popover follows focus.
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
  /** The comparison popover's content for the highlighted option. */
  compare?: (option: Equipment) => ReactNode;
}) {
  /** The option the comparison popover compares with the fitted item, if it shows. */
  const [compared, setCompared] = useState<Equipment | null>(null);
  const popoverId = useId();

  const sorted = [...options].sort((a, b) => a.name.localeCompare(b.name));
  const items: { value: string | null; label: string }[] = [
    { value: null, label: EMPTY_LABEL },
    ...sorted.map((e) => ({ value: e.id, label: e.name })),
  ];
  const fitted = sorted.find((e) => e.id === value) ?? null;
  const show = (option: Equipment | null) => setCompared(compare ? option : null);

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
          <SelectPrimitive.Popup
            className={cn(SURFACE, "max-h-[min(50vh,var(--available-height))] min-w-(--anchor-width) overflow-y-auto p-1")}
          >
            <SelectPrimitive.List onMouseLeave={() => show(null)}>
              {items.map((item) => {
                const option = sorted.find((e) => e.id === item.value) ?? null;
                return (
                  <SelectItem
                    key={item.value ?? ""}
                    value={item.value}
                    label={item.label}
                    aria-describedby={option !== null && option === compared ? popoverId : undefined}
                    className={option ? undefined : "text-muted-foreground"}
                    // Highlighting an option, by hover or by key, focuses it. The hover is kept too, so
                    // coming back onto the option the list left still focused shows it again.
                    onFocus={() => show(option)}
                    onMouseEnter={() => show(option)}
                  >
                    {item.label}
                  </SelectItem>
                );
              })}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
          {compared && compare && (
            <div
              id={popoverId}
              role="tooltip"
              className={cn(SURFACE, "p-3 text-sm whitespace-nowrap")}
            >
              {compare(compared)}
            </div>
          )}
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </Select>
  );
}
