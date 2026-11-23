import { useId, useMemo, type ReactNode } from "react";
import type { Equipment, GameData, Ship, SlotKind } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import { shotDamage } from "../stats/firepower.ts";
import { DotIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "cn";
import { ComparisonPopover } from "./ComparisonPopover.tsx";
import { EquipmentSelect } from "./EquipmentSelect.tsx";
import { TooltipMark } from "./TooltipMark.tsx";
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

const MISSING = "Mandatory upgrade missing";
const CHANGED = "Changed since loading";

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
 * the thruster and the consumables. After them, a Software section, one row
 * per Software Family, and a Crew section for a Ship with crew capacity. Columns: Slot, Equipment, quantity,
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
    const equipmentSelect = (label: string, onPick: (id: string | null) => Edit) =>
      place && (
        <EquipmentSelect
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
                Engines <span className="text-muted-foreground">{rules.limit(loadout, place)}×</span>
              </>
            }
            missing={line.missing}
            equipment={equipmentSelect("Engines Equipment", (id) => rules.setEngine(loadout, id))}
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
                {slot.size.toUpperCase()} {KIND_LABEL[slot.kind]} <span className="text-muted-foreground">{slot.id}</span>
              </>
            }
            equipment={equipmentSelect(`${slot.id} Equipment`, (id) => rules.setSlot(loadout, slot.id, id))}
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
                {GROUP_KIND_LABEL[kind]} <span className="text-muted-foreground">{group}</span>
              </>
            }
            equipment={equipmentSelect(`${label} Equipment`, (id) => rules.setGroupEquipment(loadout, group, kind, id))}
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
            equipment={equipmentSelect("Thruster Equipment", (id) => rules.setThruster(loadout, id))}
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
      // Software has its own section, one row per Software Family, and the Crew theirs.
      case "software":
      case "crew":
        return null;
    }
  };

  const software = lines.filter((l) => l.place?.kind === "software");
  const crew = lines.filter((l) => l.place?.kind === "crew");
  return (
    <Table aria-label="Loadout">
      <TableHeader>
        <TableRow className="text-xs hover:bg-transparent [&>th]:text-muted-foreground">
          <TableHead scope="col">
            Slot
          </TableHead>
          <TableHead scope="col">
            Equipment
          </TableHead>
          <TableHead scope="col" className="text-right">
            Qty
          </TableHead>
          <TableHead scope="col">
            Key value
          </TableHead>
          <TableHead scope="col" className="text-right">
            Price (avg)
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{lines.map(row)}</TableBody>
      {rules.softwareFamilies().length > 0 && (
        <SoftwareSection rules={rules} loadout={loadout} lines={software} onChange={change} />
      )}
      {crew.length > 0 && (
        <CrewSection rules={rules} ship={ship} loadout={loadout} lines={crew} onChange={change} />
      )}
    </Table>
  );
}

/**
 * The software, after the other Equipment: one row per Software Family,
 * under the game's name for it and marked Mandatory when the Ship must fit
 * it. A family fits at most one ware, from those the Ship can fit. A
 * mandatory family is always fitted (ADR 0006): with one ware it has no
 * control, with several a choice with no None. An optional family is a
 * toggle with one ware, and a choice with None with several.
 */
function SoftwareSection({
  rules,
  loadout,
  lines,
  onChange,
}: {
  rules: LoadoutRules;
  loadout: Loadout;
  /** The software's lines, one per ware. */
  lines: Line[];
  onChange: (edit: Edit) => void;
}) {
  const headingId = useId();
  return (
    <TableBody aria-labelledby={headingId}>
      <TableRow className="hover:bg-transparent">
        <TableHead scope="col" colSpan={5} id={headingId} className="pt-4 font-semibold">
          Software
        </TableHead>
      </TableRow>
      {rules.softwareFamilies().map((family) => {
        const ids = new Set(family.wares.map((e) => e.id));
        const own = lines.filter((l) => l.place?.kind === "software" && ids.has(l.place.equipment));
        const fitted = own.find((l) => l.count > 0) ?? null;
        const ware = fitted?.equipment ?? null;
        // The ware the Loaded Loadout had, when the family's lines differ from it.
        const changed = own.some((l) => l.was !== undefined);
        const before = own.find((l) => (l.was === undefined ? l.count > 0 : l.was !== null))?.place;
        const beforeName = family.wares.find((e) => before?.kind === "software" && e.id === before.equipment)?.name;
        const [only] = family.wares;
        const set = (id: string | null) => {
          if (id !== null) onChange(rules.setSoftware(loadout, id, true));
          else if (ware) onChange(rules.setSoftware(loadout, ware.id, false));
        };
        let control: ReactNode;
        if (family.wares.length > 1) {
          control = (
            <EquipmentSelect
              label={`${family.name} Equipment`}
              options={family.wares}
              value={ware?.id ?? null}
              onChange={set}
              emptyLabel={family.mandatory ? null : "None"}
            />
          );
        } else if (family.mandatory) {
          control = only!.name;
        } else {
          control = (
            <label className="flex items-center gap-2">
              <Checkbox checked={ware !== null} onCheckedChange={(checked) => set(checked ? only!.id : null)} />
              {only!.name}
            </label>
          );
        }
        return (
          <Row
            key={family.id}
            label={
              <>
                {family.name}
                {family.mandatory && (
                  <>
                    {" "}
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Mandatory</span>
                  </>
                )}
              </>
            }
            equipment={control}
            quantity={ware ? "1" : ""}
            keyValue=""
            price={fitted && ware ? formatCredits(fitted.price.average) : ""}
            was={changed ? (beforeName ?? "not fitted") : undefined}
          />
        );
      })}
    </TableBody>
  );
}

/**
 * The Crew, after the Equipment: the Captain first, then service crew and
 * marines, sharing the Ship's crew capacity, each at the crew price. The
 * Captain is a fixed, free display row, not a Place or part of the Loadout
 * (ADR 0004); its seat sits on top of the crew capacity, and the heading
 * counts it, as the game's Crew figure does.
 */
function CrewSection({
  rules,
  ship,
  loadout,
  lines,
  onChange,
}: {
  rules: LoadoutRules;
  ship: Ship;
  loadout: Loadout;
  /** The Crew's lines, one per role. */
  lines: Line[];
  onChange: (edit: Edit) => void;
}) {
  const headingId = useId();
  // The Captain's seat, on top of the crew capacity.
  const used = crewCount(loadout) + 1;
  const capacity = ship.capacities.crew + 1;
  const captain = ship.size === "s" || ship.size === "m" ? "Pilot" : "Captain";
  return (
    <TableBody aria-labelledby={headingId}>
      <TableRow className="hover:bg-transparent">
        <TableHead scope="col" colSpan={5} id={headingId} className="pt-4 font-semibold">
          Crew{" "}
          <span className="text-muted-foreground">
            {formatNumber(used)} / {formatNumber(capacity)}
          </span>
        </TableHead>
      </TableRow>
      <Row label={captain} equipment="" quantity="1" keyValue="" price="Free" />
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
    </TableBody>
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
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Input
        type="number"
        className="h-7 w-18 text-right text-foreground"
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
      {max !== undefined && <>/ {formatNumber(max)}</>}
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
  return (
    <TableRow className={cn(missing && "bg-warning/10 hover:bg-warning/15")}>
      <TableHead scope="row" className={cn("font-normal", missing && "text-warning")}>
        {label}
        {missing && (
          <>
            {" "}
            <TooltipMark explanation={MISSING} label={MISSING} className="font-bold text-warning">
              *
            </TooltipMark>
          </>
        )}
        {was !== undefined && (
          <>
            {" "}
            <TooltipMark explanation={CHANGED} label={CHANGED} className="text-warning">
              <DotIcon aria-hidden="true" className="size-4" strokeWidth={6} />
            </TooltipMark>
          </>
        )}
      </TableHead>
      <TableCell>
        {equipment}
        {was !== undefined && <div className="text-xs text-muted-foreground">was: {was}</div>}
      </TableCell>
      <TableCell className="text-right">{quantity}</TableCell>
      <TableCell className="text-muted-foreground">{keyValue}</TableCell>
      <TableCell className="text-right">{price}</TableCell>
    </TableRow>
  );
}
