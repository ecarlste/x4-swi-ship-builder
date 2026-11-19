// PROTOTYPE — throwaway. Shared loadout state, stub stat maths, mandatory check,
// in-memory Saved Loadouts, Share Link and Loadout File. Every variant uses this,
// so the variants differ only in layout and flow.
import { useEffect, useMemo, useState } from "react";
import { CONSUMABLES, ConsumableKind, EQUIPMENT, GAME_DATA_VERSION, SHIPS, SOFTWARE, Ship, SlotKind, SoftwareGroup, byId } from "./data";

export interface Loadout {
  ship: string;
  slots: Record<string, string>; // slot id -> equipment id
  groups: Record<string, Partial<Record<"turret" | "shield", { eq: string; count: number }>>>;
  consumables: Record<string, number>;
  software: Partial<Record<SoftwareGroup, string>>;
}
export interface SavedLoadout { id: string; name: string; created: number; updated: number; loadout: Loadout }
export interface ImportReport { title: string; lines: string[] }

export const emptyLoadout = (ship: string): Loadout => ({ ship, slots: {}, groups: {}, consumables: {}, software: {} });

// ---- stats (stub maths, real row list from the game's config screen) ----
export interface StatRow { section: string; label: string; value: number; unit?: string; decimals?: number; tooltip?: string; range?: [number, number] }
const floor = (v: number, d = 0) => Math.floor(v * 10 ** d) / 10 ** d;

export function computeStats(l: Loadout): StatRow[] {
  const ship = byId(SHIPS, l.ship)!;
  const fitted = Object.values(l.slots).map(id => byId(EQUIPMENT, id)!).filter(Boolean);
  const groupParts = Object.values(l.groups).flatMap(g => Object.values(g)).filter(Boolean) as { eq: string; count: number }[];
  const grouped = groupParts.flatMap(gp => Array(gp.count).fill(byId(EQUIPMENT, gp.eq)!));
  const sum = (xs: typeof fitted, k: "dps" | "sustained" | "shield" | "recharge" | "thrust" | "torque") => xs.reduce((a, e) => a + (e[k] ?? 0), 0);
  const weapons = fitted.filter(e => e.kind === "weapon");
  const turrets = [...fitted.filter(e => e.kind === "turret"), ...grouped.filter(e => e.kind === "turret")];
  const mainShields = fitted.filter(e => e.kind === "shield");
  const groupShields = grouped.filter(e => e.kind === "shield");
  const engines = fitted.filter(e => e.kind === "engine");
  const thrusters = fitted.filter(e => e.kind === "thruster");
  const thrust = sum(engines, "thrust");
  const speed = thrust / ship.drag;
  const boost = engines.length ? speed * (engines.reduce((a, e) => a + (e.boost ?? 0), 0) / engines.length) : 0;
  const travel = engines.length ? speed * (engines.reduce((a, e) => a + (e.travel ?? 0), 0) / engines.length) : 0;
  const torque = sum(thrusters, "torque");
  const delays = [...mainShields, ...groupShields].map(e => e.delay ?? 0);
  const nGroups = ship.groups.length;
  const price = { min: ship.price.min, avg: ship.price.avg, max: ship.price.max };
  const addP = (pp: { min: number; avg: number; max: number }, n = 1) => { price.min += pp.min * n; price.avg += pp.avg * n; price.max += pp.max * n; };
  [...fitted, ...grouped].forEach(e => addP(e.price));
  Object.entries(l.consumables).forEach(([id, n]) => { const c = byId(CONSUMABLES, id); if (c) addP(c.price, n); });
  Object.values(l.software).forEach(id => { const s = byId(SOFTWARE, id); if (s) addP(s.price); });
  const cap = (k: ConsumableKind) => Object.entries(l.consumables).filter(([id]) => byId(CONSUMABLES, id)?.kind === k).reduce((a, [, n]) => a + n, 0);

  const rows: StatRow[] = [
    { section: "Defence", label: "Hull", value: ship.hull, unit: "MJ" },
    { section: "Defence", label: "Shield", value: sum(mainShields, "shield"), unit: "MJ" },
    { section: "Defence", label: "Shield Recharge Rate", value: sum(mainShields, "recharge"), unit: "MW" },
    { section: "Defence", label: "Shield Recharge Delay", value: delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0, unit: "s", decimals: 2 },
  ];
  if (nGroups) rows.push({ section: "Defence", label: "Avg. Group Shield", value: sum(groupShields, "shield") / nGroups, unit: "MJ", tooltip: "Per-group average (formula pending in-game check)" });
  rows.push(
    { section: "Offence", label: "Weapon Output (burst)", value: sum(weapons, "dps"), unit: "MW" },
    { section: "Offence", label: "Weapon Output (sustained)", value: sum(weapons, "sustained"), unit: "MW" },
    { section: "Offence", label: "Avg. Turret Output", value: sum(turrets, "dps") / 6, unit: "MW", tooltip: "All turrets' damage averaged over six directions" },
    { section: "Offence", label: "Missile Storage", value: cap("missile"), unit: `/ ${ship.capacity.missile}` },
    { section: "Mobility", label: "Max Speed", value: speed, unit: "m/s" },
    { section: "Mobility", label: "Max Acceleration", value: thrust / ship.mass, unit: "m/s²" },
    { section: "Mobility", label: "Boost Speed", value: boost, unit: "m/s" },
    { section: "Mobility", label: "Travel Speed", value: travel, unit: "m/s" },
    { section: "Mobility", label: "Max Yaw / Pitch", value: torque / ship.inertia, unit: "°/s", decimals: 1 },
    { section: "Other", label: "Radar Range", value: ship.radar / 1000, unit: "km" },
    { section: "Other", label: "Countermeasures", value: cap("countermeasure"), unit: `/ ${ship.capacity.countermeasure}` },
    { section: "Other", label: "Drones", value: cap("drone"), unit: `/ ${ship.capacity.drone}` },
    { section: "Other", label: "Deployables", value: cap("deployable"), unit: `/ ${ship.capacity.deployable}` },
    { section: "Price", label: "Total Price (avg)", value: price.avg, unit: "Cr", range: [price.min, price.max] },
  );
  return rows.map(r => ({ ...r, value: floor(r.value, r.decimals ?? 0) }));
}
export const fmt = (r: StatRow) => r.value.toLocaleString("en", { minimumFractionDigits: r.decimals ?? 0, maximumFractionDigits: r.decimals ?? 0 });
export const cr = (n: number) => n.toLocaleString("en") + " Cr";

// ---- mandatory-upgrade warning ----
export interface Missing { key: string; label: string }
export function missingMandatory(l: Loadout): Missing[] {
  const ship = byId(SHIPS, l.ship)!;
  const out: Missing[] = ship.slots.filter(s => s.mandatory && !l.slots[s.id]).map(s => ({ key: s.id, label: `${kindLabel[s.kind]} (${s.id})` }));
  ship.software.filter(s => s.mandatoryDefault && !l.software[s.group]).forEach(s => out.push({ key: "sw:" + s.group, label: `Software: ${s.group}` }));
  return out;
}
export const kindLabel: Record<SlotKind, string> = { weapon: "Weapon", turret: "Turret", shield: "Shield", engine: "Engine", thruster: "Thruster" };

// ---- validation for share links / imports (decided rules: unknown ship fails, stale equipment dropped+reported) ----
export function revive(raw: Loadout): { loadout: Loadout | null; dropped: string[] } {
  const ship = byId(SHIPS, raw.ship);
  if (!ship) return { loadout: null, dropped: [`Ship "${raw.ship}" is not in Game Data ${GAME_DATA_VERSION.swi}`] };
  const l = emptyLoadout(ship.id); const dropped: string[] = [];
  for (const [sid, eq] of Object.entries(raw.slots ?? {})) {
    const s = ship.slots.find(x => x.id === sid);
    if (s && s.compatible.includes(eq)) l.slots[sid] = eq; else dropped.push(`${eq} in ${sid} (gone or no longer fits)`);
  }
  for (const [gid, parts] of Object.entries(raw.groups ?? {})) {
    const g = ship.groups.find(x => x.id === gid);
    for (const [kind, v] of Object.entries(parts ?? {})) {
      const part = g?.parts.find(pp => pp.kind === kind);
      if (!part || !v || !part.compatible.includes(v.eq)) { dropped.push(`${v?.eq} in ${gid}`); continue; }
      if (v.count > part.max) dropped.push(`${gid} ${kind}: count clamped ${v.count} → ${part.max}`);
      (l.groups[gid] ??= {})[kind as "turret"] = { eq: v.eq, count: Math.min(v.count, part.max) };
    }
  }
  for (const [id, n] of Object.entries(raw.consumables ?? {})) {
    const c = byId(CONSUMABLES, id);
    if (!c) { dropped.push(`${id} (consumable gone)`); continue; }
    const max = ship.capacity[c.kind];
    if (n > max) dropped.push(`${c.name}: count clamped ${n} → ${max}`);
    if (max > 0) l.consumables[id] = Math.min(n, max);
  }
  for (const [g, id] of Object.entries(raw.software ?? {})) {
    if (ship.software.find(s => s.group === g)?.options.includes(id!)) l.software[g as SoftwareGroup] = id; else dropped.push(`${id} (software)`);
  }
  return { loadout: l, dropped };
}

const enc = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const dec = (s: string) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))));

// ---- the hook every variant uses ----
let nextId = 1;
export function useBuilder() {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [saved, setSaved] = useState<SavedLoadout[]>([]);
  const [openSavedId, setOpenSavedId] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  // The loadout as it was when loaded (from Saved Loadouts or a Share Link) or last saved.
  // Variants diff the current loadout against it. A freshly picked ship has none.
  const [origin, setOrigin] = useState<{ label: string; loadout: Loadout } | null>(null);

  // open a Share Link from the URL fragment
  useEffect(() => {
    const m = location.hash.match(/#l=(.+)/);
    if (!m) return;
    try {
      const { loadout: l, dropped } = revive(dec(m[1]).loadout);
      if (l) { setLoadout(l); setOrigin({ label: "the Share Link", loadout: l }); }
      setReport({ title: l ? "Opened a Share Link" : "This Share Link can't be opened", lines: dropped.length ? dropped : ["Everything fitted as saved."] });
    } catch { setReport({ title: "Broken Share Link", lines: ["The link could not be read."] }); }
  }, []);

  const stats = useMemo(() => (loadout ? computeStats(loadout) : []), [loadout]);
  const missing = useMemo(() => (loadout ? missingMandatory(loadout) : []), [loadout]);
  const ship = loadout ? byId(SHIPS, loadout.ship)! : null;
  const dirty = !!openSavedId && JSON.stringify(saved.find(s => s.id === openSavedId)?.loadout) !== JSON.stringify(loadout);
  const changed = !!origin && !!loadout && JSON.stringify(origin.loadout) !== JSON.stringify(loadout);

  const api = {
    loadout, ship, stats, missing, saved, openSavedId, dirty, report, origin, changed,
    dismissReport: () => setReport(null),
    pickShip: (id: string) => { setLoadout(emptyLoadout(id)); setOpenSavedId(null); setOrigin(null); },
    setSlot: (slotId: string, eq: string | null) => setLoadout(l => { if (!l) return l; const slots = { ...l.slots }; if (eq) slots[slotId] = eq; else delete slots[slotId]; return { ...l, slots }; }),
    setGroup: (gid: string, kind: "turret" | "shield", v: { eq: string; count: number } | null) =>
      setLoadout(l => { if (!l) return l; const g = { ...(l.groups[gid] ?? {}) }; if (v && v.count > 0) g[kind] = v; else delete g[kind];
      const groups = { ...l.groups, [gid]: g }; if (!Object.keys(g).length) delete groups[gid]; return { ...l, groups }; }),
    setConsumable: (id: string, n: number) => setLoadout(l => { if (!l) return l; const c = { ...l.consumables }; if (n > 0) c[id] = n; else delete c[id]; return { ...l, consumables: c }; }),
    setSoftware: (g: SoftwareGroup, id: string | null) => setLoadout(l => { if (!l) return l; const s = { ...l.software }; if (id) s[g] = id; else delete s[g]; return { ...l, software: s }; }),
    clear: () => setLoadout(l => (l ? emptyLoadout(l.ship) : l)),
    save: (name: string) => {
      if (!loadout) return;
      const now = Date.now();
      setOrigin({ label: `“${name}”`, loadout });
      if (openSavedId) { setSaved(xs => xs.map(s => (s.id === openSavedId ? { ...s, name, updated: now, loadout } : s))); return; }
      const id = "s" + nextId++; setSaved(xs => [...xs, { id, name, created: now, updated: now, loadout }]); setOpenSavedId(id);
    },
    saveAsNew: (name: string) => { if (!loadout) return; setOrigin({ label: `“${name}”`, loadout }); const id = "s" + nextId++; const now = Date.now(); setSaved(xs => [...xs, { id, name, created: now, updated: now, loadout }]); setOpenSavedId(id); },
    openSaved: (id: string) => { const s = saved.find(x => x.id === id); if (s) { setLoadout(s.loadout); setOpenSavedId(id); setOrigin({ label: `“${s.name}”`, loadout: s.loadout }); } },
    deleteSaved: (id: string) => { setSaved(xs => xs.filter(x => x.id !== id)); if (openSavedId === id) setOpenSavedId(null); },
    shareLink: () => (loadout ? `${location.origin}${location.pathname}${location.search}#l=${enc({ format: 1, version: GAME_DATA_VERSION, loadout })}` : ""),
    exportFile: (ids?: string[]) => {
      const items = saved.filter(s => !ids || ids.includes(s.id));
      const blob = new Blob([JSON.stringify({ format: 1, version: GAME_DATA_VERSION, loadouts: items }, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "swi-loadouts.json"; a.click();
    },
    importFile: async (file: File) => {
      const env = JSON.parse(await file.text()) as { loadouts: SavedLoadout[] };
      const lines: string[] = []; const added: SavedLoadout[] = [];
      for (const s of env.loadouts) {
        const { loadout: l, dropped } = revive(s.loadout);
        if (!l) { lines.push(`"${s.name}": skipped, ${dropped[0]}`); continue; }
        added.push({ ...s, id: "s" + nextId++, loadout: l });
        lines.push(dropped.length ? `"${s.name}": added, dropped ${dropped.length} (${dropped.join("; ")})` : `"${s.name}": added`);
      }
      setSaved(xs => [...xs, ...added]);
      setReport({ title: `Imported ${added.length} of ${env.loadouts.length} loadouts`, lines });
    },
    // scenario helper for the prototype bar: a link made against older Game Data
    staleLink: () => `${location.pathname}${location.search}#l=${enc({ format: 1, version: { swi: "0.9.0", x4: "7.60" }, loadout: { ship: "ship_sw_rebel_s_xwing_t65b_01_a", slots: { con_weapon_01: "weapon_sw_l85_s", con_weapon_02: "weapon_sw_kx9_s_removed", con_shield_01: "shield_sw_m_mk1", con_engine_01: "engine_sw_s_combat" }, groups: {}, consumables: { missile_sw_concussion: 30 }, software: { flight: "software_flightassistmk1" } } })}`,
  };
  return api;
}
export type Builder = ReturnType<typeof useBuilder>;
