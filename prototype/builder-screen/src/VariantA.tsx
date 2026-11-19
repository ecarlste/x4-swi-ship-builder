// PROTOTYPE — Variant A: "Config screen". Like X4's own ship configuration menu.
// Left: ship list + Saved Loadouts. Middle: every Slot as a row. Right: stats;
// clicking a slot swaps the right pane for an equipment picker with stat deltas.
import { useState } from "react";
import { CONSUMABLES, EQUIPMENT, FACTIONS, SHIPS, SOFTWARE, Size, SlotKind, byId } from "./data";
import { Builder, Loadout, computeStats, cr, fmt, kindLabel } from "./model";
import { Credits, ImportButton, Report, ShareButton, askName } from "./bits";

type Pick = { type: "slot"; id: string; kind: SlotKind; compatible: string[] } | { type: "group"; id: string; kind: "turret" | "shield"; compatible: string[]; max: number };
const keyStat: Record<SlotKind, string> = { weapon: "Weapon Output (burst)", turret: "Avg. Turret Output", shield: "Shield", engine: "Max Speed", thruster: "Max Yaw / Pitch" };

export default function VariantA({ b }: { b: Builder }) {
  const [q, setQ] = useState(""); const [fac, setFac] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);
  const ships = SHIPS.filter(s => s.name.toLowerCase().includes(q.toLowerCase()) && (!fac || s.sellers.includes(fac)));
  const sizes: Size[] = ["S", "M", "L", "XL"];
  const l = b.loadout, ship = b.ship;
  const savedName = b.saved.find(s => s.id === b.openSavedId)?.name;

  return (
    <>
      <div className="a-top">
        <b>SWI Ship Builder</b>
        <span className="dim">{ship ? `${ship.name}${savedName ? ` · "${savedName}"${b.dirty ? " (unsaved changes)" : ""}` : " · new loadout"}` : "pick a ship"}</span>
        <span style={{ flex: 1 }} />
        <button className="primary" disabled={!l} onClick={() => { const n = askName(savedName ?? ship!.name); if (n) b.save(n); }}>{b.openSavedId ? "Save" : "Save…"}</button>
        {b.openSavedId && <button onClick={() => { const n = askName(savedName + " copy"); if (n) b.saveAsNew(n); }}>Save as new…</button>}
        <ShareButton b={b} />
        <button disabled={!l} onClick={() => { b.clear(); setPick(null); }}>Clear</button>
      </div>
      <div className="a">
        <section>
          <h3>Ships</h3>
          <input placeholder="Search ships" value={q} onChange={e => setQ(e.target.value)} style={{ width: "100%" }} />
          <select value={fac} onChange={e => setFac(e.target.value)} style={{ width: "100%", margin: "4px 0 8px" }}>
            <option value="">All sellers</option>{FACTIONS.map(f => <option key={f}>{f}</option>)}
          </select>
          {sizes.map(sz => {
            const xs = ships.filter(s => s.size === sz); if (!xs.length) return null;
            return <div key={sz}><div className="dim">{sz}</div>{xs.map(s => (
              <button key={s.id} className={"a-ship" + (ship?.id === s.id ? " on" : "")} onClick={() => { b.pickShip(s.id); setPick(null); }}>
                {s.name} <span className="dim">· {s.klass} · {s.sellers.join(", ")}</span>
              </button>))}</div>;
          })}
          <h3 style={{ marginTop: 16 }}>Saved loadouts</h3>
          {b.saved.length === 0 && <div className="dim">None yet. Saved loadouts live in this browser.</div>}
          {b.saved.map(s => (
            <div key={s.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <button className={"a-ship" + (b.openSavedId === s.id ? " on" : "")} onClick={() => { b.openSaved(s.id); setPick(null); }}>{s.name} <span className="dim">· {byId(SHIPS, s.loadout.ship)?.name}</span></button>
              <button title="Delete" onClick={() => confirm(`Delete "${s.name}"?`) && b.deleteSaved(s.id)}>✕</button>
            </div>))}
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}><button disabled={!b.saved.length} onClick={() => b.exportFile()}>Export all</button><ImportButton b={b} /></div>
        </section>

        <section>
          <Report b={b} />
          {!l || !ship ? <div className="dim">Pick a ship on the left. It opens as an Empty Loadout.</div> : <>
            <h2>{ship.name} <span className="dim">{ship.size} {ship.klass}</span></h2>
            <div className="dim" style={{ marginBottom: 8 }}>Sold by {ship.sellers.join(", ")}{ship.licence && ` · needs ${ship.licence}`}</div>
            {b.missing.length > 0 && <div className="missing" style={{ marginBottom: 8 }}>⚠ Missing mandatory upgrades: {b.missing.map(m => m.label).join(", ")}</div>}
            {(["weapon", "turret", "shield", "engine", "thruster"] as SlotKind[]).map(kind => {
              const slots = ship.slots.filter(s => s.kind === kind); if (!slots.length) return null;
              return <div key={kind} style={{ marginBottom: 10 }}><h3>{kindLabel[kind]}s</h3>{slots.map(s => {
                const eq = byId(EQUIPMENT, l.slots[s.id]);
                return <button key={s.id} className={"a-slot" + (s.mandatory && !eq ? " need" : "") + (pick?.id === s.id ? " sel" : "")} onClick={() => setPick({ type: "slot", id: s.id, kind, compatible: s.compatible })}>
                  <span className="dim">{s.size} {s.id.replace("con_", "")}{s.mandatory ? " *" : ""}</span>
                  <span>{eq ? eq.name : <span className="dim">— empty —</span>}</span>
                  <span className="dim">{eq ? cr(eq.price.avg) : ""}</span>
                </button>;
              })}</div>;
            })}
            {ship.groups.length > 0 && <div style={{ marginBottom: 10 }}><h3>Slot groups</h3>{ship.groups.map(g => (
              <div key={g.id} style={{ marginBottom: 6 }}><div>{g.name}</div>{g.parts.map(pt => {
                const v = l.groups[g.id]?.[pt.kind]; const eq = byId(EQUIPMENT, v?.eq);
                return <div key={pt.kind} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button className={"a-slot" + (pick?.id === g.id + pt.kind ? " sel" : "")} style={{ flex: 1 }} onClick={() => setPick({ type: "group", id: g.id, kind: pt.kind, compatible: pt.compatible, max: pt.max })}>
                    <span className="dim">{kindLabel[pt.kind]}s ×{pt.max}</span><span>{eq ? eq.name : <span className="dim">— empty —</span>}</span><span />
                  </button>
                  <input type="number" min={0} max={pt.max} disabled={!eq} value={v?.count ?? 0} style={{ width: 56 }} onChange={e => b.setGroup(g.id, pt.kind, eq ? { eq: eq.id, count: Math.min(pt.max, +e.target.value) } : null)} />
                  <span className="dim">/ {pt.max}</span>
                </div>;
              })}</div>))}</div>}
            <h3>Consumables</h3>
            <table><tbody>{CONSUMABLES.filter(c => ship.capacity[c.kind] > 0).map(c => (
              <tr key={c.id}><td>{c.name}</td><td className="dim">{c.kind}</td><td className="num"><input type="number" min={0} max={ship.capacity[c.kind]} value={l.consumables[c.id] ?? 0} style={{ width: 64 }} onChange={e => b.setConsumable(c.id, Math.min(ship.capacity[c.kind], +e.target.value))} /></td><td className="dim">cap {ship.capacity[c.kind]}</td></tr>))}</tbody></table>
            <h3 style={{ marginTop: 10 }}>Software</h3>
            <table><tbody>{ship.software.map(s => (
              <tr key={s.group} style={s.mandatoryDefault && !l.software[s.group] ? { outline: "1px solid var(--warn)" } : undefined}><td>{s.group}{s.mandatoryDefault ? " *" : ""}</td><td>
                <select value={l.software[s.group] ?? ""} onChange={e => b.setSoftware(s.group, e.target.value || null)}><option value="">— none —</option>{s.options.map(o => <option key={o} value={o}>{byId(SOFTWARE, o)?.name}</option>)}</select>
              </td></tr>))}</tbody></table>
          </>}
        </section>

        <section>
          {pick && l ? <Picker b={b} l={l} pick={pick} close={() => setPick(null)} /> : <>
            <h3>Statistics</h3>
            {!l && <div className="dim">—</div>}
            {groupBy(b.stats).map(([sec, rows]) => <div key={sec} style={{ marginBottom: 10 }}><div className="dim">{sec}</div>{rows.map(r => (
              <div key={r.label} className="a-stat" title={r.tooltip}><span>{r.label}{r.tooltip ? " ⓘ" : ""}</span><span className="num">{fmt(r)} {r.unit}{r.range && <div className="dim" style={{ fontSize: 11 }}>{cr(r.range[0])} – {cr(r.range[1])}</div>}</span></div>))}</div>)}
          </>}
        </section>
      </div>
      <Credits />
    </>
  );
}

function Picker({ b, l, pick, close }: { b: Builder; l: Loadout; pick: Pick; close: () => void }) {
  const stat = pick.type === "group" && pick.kind === "shield" ? "Avg. Group Shield" : keyStat[pick.kind];
  const val = (lo: Loadout) => computeStats(lo).find(r => r.label === stat)?.value ?? 0;
  const base = val(l);
  const current = pick.type === "slot" ? l.slots[pick.id] : l.groups[pick.id]?.[pick.kind]?.eq;
  const tryEq = (eq: string | null): Loadout => pick.type === "slot"
    ? { ...l, slots: eq ? { ...l.slots, [pick.id]: eq } : Object.fromEntries(Object.entries(l.slots).filter(([k]) => k !== pick.id)) }
    : { ...l, groups: { ...l.groups, [pick.id]: { ...l.groups[pick.id], [pick.kind]: eq ? { eq, count: l.groups[pick.id]?.[pick.kind]?.count || pick.max } : undefined } } };
  const choose = (eq: string | null) => {
    if (pick.type === "slot") b.setSlot(pick.id, eq);
    else b.setGroup(pick.id, pick.kind, eq ? { eq, count: l.groups[pick.id]?.[pick.kind]?.count || pick.max } : null);
  };
  return <>
    <div style={{ display: "flex", justifyContent: "space-between" }}><h3>Choose {kindLabel[pick.kind]} · {pick.id}</h3><button onClick={close}>Back to stats</button></div>
    <div className="dim" style={{ marginBottom: 6 }}>Δ shows the change to <b>{stat}</b></div>
    <table><thead><tr><th>Equipment</th><th className="num">Δ</th><th className="num">Price</th></tr></thead><tbody>
      <tr onClick={() => choose(null)} style={{ cursor: "pointer" }}><td className="dim">— empty —</td><td /><td /></tr>
      {pick.compatible.map(id => byId(EQUIPMENT, id)!).map(e => {
        const d = Math.round(val(tryEq(e.id)) - base);
        return <tr key={e.id} onClick={() => choose(e.id)} style={{ cursor: "pointer", background: current === e.id ? "#24405a" : undefined }}>
          <td>{e.name}<div className="dim" style={{ fontSize: 11 }}>{e.size} · {e.sellers.join(", ")}</div></td>
          <td className={"num " + (d > 0 ? "ok" : d < 0 ? "warn" : "dim")}>{d > 0 ? "+" : ""}{d}</td>
          <td className="num">{cr(e.price.avg)}</td>
        </tr>;
      })}
    </tbody></table>
  </>;
}

export function groupBy<T extends { section: string }>(rows: T[]): [string, T[]][] {
  const m = new Map<string, T[]>(); rows.forEach(r => m.set(r.section, [...(m.get(r.section) ?? []), r])); return [...m];
}
