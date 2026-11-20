import { table } from "./report.ts";

/** An item of a snapshot: a Ship or a piece of Equipment, as written. */
interface Item {
  id: string;
  name: string;
  [field: string]: unknown;
}

/** What the diff reads from a snapshot: the manifest's versions and the Ships and Equipment. */
export interface DiffableSnapshot {
  manifest: { swi: { label: string }; x4: { version: string } };
  ships: Item[];
  equipment: Item[];
}

export interface ItemRef {
  id: string;
  name: string;
}

export interface ItemDiff {
  added: ItemRef[];
  removed: ItemRef[];
  /** Items whose data changed, with the paths of the fields that did (e.g. `price.average`). */
  changed: (ItemRef & { fields: string[] })[];
}

export interface SnapshotDiff {
  ships: ItemDiff;
  equipment: ItemDiff;
}

/**
 * The Ships and Equipment added, removed and changed from one snapshot to the
 * next, matched by id. Fit-list ids hash their contents, so a change in what
 * fits a Slot shows as a change to the Ship.
 */
export function diffSnapshots(previous: DiffableSnapshot, next: DiffableSnapshot): SnapshotDiff {
  return { ships: diffItems(previous.ships, next.ships), equipment: diffItems(previous.equipment, next.equipment) };
}

function diffItems(previous: Item[], next: Item[]): ItemDiff {
  const before = new Map(previous.map((item) => [item.id, item]));
  const after = new Map(next.map((item) => [item.id, item]));
  const ref = ({ id, name }: Item): ItemRef => ({ id, name });
  return {
    added: next.filter((item) => !before.has(item.id)).map(ref).sort(byId),
    removed: previous.filter((item) => !after.has(item.id)).map(ref).sort(byId),
    changed: next
      .flatMap((item) => {
        const old = before.get(item.id);
        const fields = old ? changedFields(old, item) : [];
        return fields.length > 0 ? [{ ...ref(item), fields }] : [];
      })
      .sort(byId),
  };
}

/**
 * Dotted paths of the fields that differ, going into objects, and into arrays
 * whose items all have ids (Slots, Slot Groups) by id: `slotGroups[enginegroup].kinds.engine.count`.
 * Other arrays are compared whole.
 */
function changedFields(a: unknown, b: unknown, prefix = ""): string[] {
  if (isObject(a) && isObject(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return keys.flatMap((key) => changedFields(a[key], b[key], prefix ? `${prefix}.${key}` : key));
  }
  const byIdA = itemsById(a);
  const byIdB = itemsById(b);
  if (byIdA && byIdB) {
    const ids = [...new Set([...byIdA.keys(), ...byIdB.keys()])].sort();
    return ids.flatMap((id) => {
      const key = /^[\w-]+$/.test(id) ? id : JSON.stringify(id);
      return changedFields(byIdA.get(id), byIdB.get(id), `${prefix}[${key}]`);
    });
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [prefix];
}

/** An array's items by id, if every item has a string id and none repeats. */
function itemsById(value: unknown): Map<string, unknown> | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = new Map<string, unknown>();
  for (const item of value) {
    if (!isObject(item) || typeof item.id !== "string" || items.has(item.id)) return undefined;
    items.set(item.id, item);
  }
  return items;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Renders `snapshot-diff.md`, written beside `extract-report.md`. With no
 * previous snapshot, it says so.
 */
export function renderDiff(
  diff: SnapshotDiff | undefined,
  previous: DiffableSnapshot | undefined,
  next: DiffableSnapshot,
): string {
  const version = (s: DiffableSnapshot) => `SWI ${s.manifest.swi.label} on X4 ${s.manifest.x4.version}`;
  if (!diff || !previous) {
    return ["# Snapshot diff", "", `No previous snapshot to diff against: ${version(next)} is the first.`, ""].join("\n");
  }
  const refs = (items: ItemRef[]) => table(["Id", "Name"], items.map((i) => [i.id, i.name]));
  const section = (title: string, items: ItemDiff) => [
    `### ${title} added`,
    "",
    ...refs(items.added),
    `### ${title} removed`,
    "",
    ...refs(items.removed),
    `### ${title} changed`,
    "",
    ...table(
      ["Id", "Name", "Changed"],
      items.changed.map((i) => [i.id, i.name, i.fields.join(", ")]),
    ),
  ];
  const count = (title: string, items: ItemDiff) =>
    [title, items.added.length, items.removed.length, items.changed.length].map(String);
  return [
    "# Snapshot diff",
    "",
    `From ${version(previous)} to ${version(next)}.`,
    "",
    ...table(["", "Added", "Removed", "Changed"], [count("Ships", diff.ships), count("Equipment", diff.equipment)]),
    "## Ships",
    "",
    ...section("Ships", diff.ships),
    "## Equipment",
    "",
    ...section("Equipment", diff.equipment),
  ].join("\n");
}

const byId = (a: ItemRef, b: ItemRef) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
