// PROTOTYPE — Variant B: "Guided steps". 1 Ship → 2 Equipment (tabbed by kind) → 3 Review & keep.
// One thing at a time; headline stats follow you in a sticky strip; full stats on the review step.
import { useState } from "react";
import { CONSUMABLES, EQUIPMENT, FACTIONS, SHIPS, SOFTWARE, Size, byId } from "./data";
import { Builder, cr, fmt } from "./model";
import { Credits, ImportButton, Report, ShareButton } from "./bits";
import { groupBy } from "./VariantA";

type Tab = "weapon" | "turret" | "shield" | "propulsion" | "consumables" | "software";
const HEADLINE = ["Hull", "Shield", "Weapon Output (burst)", "Avg. Turret Output", "Max Speed", "Total Price (avg)"];

export default function VariantB({ b }: { b: Builder }) {
  const [step, setStep] = useState(b.loadout ? 2 : 1);
  const [tab, setTab] = useState<Tab>("weapon");
  const [sort, setSort] = useState<"name" | "size" | "hull" | "price">("size");
  const [fac, setFac] = useState(""); const [size, setSize] = useState<Size | "">("");
  const [name, setName] = useState("");
  const l = b.loadout, ship = b.ship;

  const missingIn = (t: Tab) => b.missing.filter(m => {
    if (m.key.startsWith("sw:")) return t === "software";
    const s = ship?.slots.find(x => x.id === m.key); if (!s) return false;
    return t === (s.kind === "engine" || s.kind === "thruster" ? "propulsion" : s.kind);
  }).length;

  const tabs: { t: Tab; label: string; show: boolean }[] = ship ? [
    { t: "weapon", label: "Weapons", show: ship.slots.some(s => s.kind === "weapon") },
    { t: "turret", label: "Turrets", show: ship.slots.some(s => s.kind === "turret") || ship.groups.length > 0 },
    { t: "shield", label: "Shields", show: true },
    { t: "propulsion", label: "Engines & thrusters", show: true },
    { t: "consumables", label: "Consumables", show: true },
    { t: "software", label: "Software", show: true },
  ] : [];

  const sorted = SHIPS.filter(s => (!fac || s.sellers.includes(fac)) && (!size || s.size === size)).sort((x, y) =>
    sort === "name" ? x.name.localeCompare(y.name) : sort === "size" ? "SMLX".indexOf(x.size[0]) - "SMLX".indexOf(y.size[0]) : sort === "hull" ? y.hull - x.hull : y.price.avg - x.price.avg);

  return (
    <div className="b">
      <div className="b-steps">
        <button className={step === 1 ? "on" : ""} onClick={() => setStep(1)}>1 · Ship {ship && <span className="dim">({ship.name})</span>}</button>
        <button className={step === 2 ? "on" : ""} disabled={!l} onClick={() => setStep(2)}>2 · Equipment {b.missing.length > 0 && <span className="b-badge">{b.missing.length} missing</span>}</button>
        <button className={step === 3 ? "on" : ""} disabled={!l} onClick={() => setStep(3)}>3 · Review & keep</button>
      </div>
      <Report b={b} />

      {step === 1 && <>
        {b.saved.length > 0 && <div className="b-card"><h3>Continue a saved loadout</h3>{b.saved.map(s => (
          <button key={s.id} style={{ margin: 2 }} onClick={() => { b.openSaved(s.id); setName(s.name); setStep(2); }}>{s.name} · {byId(SHIPS, s.loadout.ship)?.name}</button>))}</div>}
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <select value={fac} onChange={e => setFac(e.target.value)}><option value="">Any seller</option>{FACTIONS.map(f => <option key={f}>{f}</option>)}</select>
          <select value={size} onChange={e => setSize(e.target.value as Size)}><option value="">Any size</option>{["S", "M", "L", "XL"].map(s => <option key={s}>{s}</option>)}</select>
          <span style={{ flex: 1 }} /><ImportButton b={b} />
        </div>
        <table><thead><tr>
          {(["name", "size", "hull", "price"] as const).map(c => <th key={c} style={{ cursor: "pointer" }} onClick={() => setSort(c)}>{c}{sort === c ? " ▾" : ""}</th>)}
          <th>Class</th><th>Sold by</th><th>Licence</th><th /></tr></thead>
          <tbody>{sorted.map(s => <tr key={s.id}>
            <td>{s.name}</td><td>{s.size}</td><td className="num">{s.hull.toLocaleString()}</td><td className="num">{cr(s.price.avg)}</td>
            <td>{s.klass}</td><td>{s.sellers.join(", ")}</td><td className="dim">{s.licence ?? "—"}</td>
            <td><button className="primary" onClick={() => { b.pickShip(s.id); setName(""); setTab("weapon"); setStep(2); }}>Build</button></td></tr>)}</tbody></table>
      </>}

      {step === 2 && l && ship && <>
        <h2>{ship.name}</h2>
        <div className="b-tabs">{tabs.filter(t => t.show).map(t => <button key={t.t} className={tab === t.t ? "on" : ""} onClick={() => setTab(t.t)}>{t.label}{missingIn(t.t) > 0 && <span className="b-badge">{missingIn(t.t)}</span>}</button>)}</div>

        {(tab === "weapon" || tab === "turret" || tab === "shield" || tab === "propulsion") && (() => {
          const kinds = tab === "propulsion" ? ["engine", "thruster"] : [tab];
          const slots = ship.slots.filter(s => kinds.includes(s.kind));
          const compat = [...new Set(slots.flatMap(s => s.compatible))];
          return <>
            {slots.length > 1 && <div className="b-card">Fill every empty {tab} slot with{" "}
              <select value="" onChange={e => slots.forEach(s => !l.slots[s.id] && s.compatible.includes(e.target.value) && b.setSlot(s.id, e.target.value))}><option value="">choose…</option>{compat.map(id => <option key={id} value={id}>{byId(EQUIPMENT, id)?.name}</option>)}</select></div>}
            {slots.map(s => {
              const eq = byId(EQUIPMENT, l.slots[s.id]);
              return <div key={s.id} className="b-card" style={s.mandatory && !eq ? { borderColor: "var(--warn)" } : undefined}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <b style={{ width: 160 }}>{s.size} {s.kind} <span className="dim">{s.id.replace("con_", "")}</span></b>
                  <select style={{ flex: 1 }} value={eq?.id ?? ""} onChange={e => b.setSlot(s.id, e.target.value || null)}>
                    <option value="">— empty —</option>{s.compatible.map(id => { const e = byId(EQUIPMENT, id)!; return <option key={id} value={id}>{e.name} · {cr(e.price.avg)}</option>; })}
                  </select>
                  {s.mandatory && !eq && <span className="warn">required</span>}
                </div>
                {eq && <div className="dim" style={{ marginTop: 4 }}>{eq.dps != null && `${eq.dps} MW burst · ${eq.sustained} sustained`}{eq.shield != null && `${eq.shield} MJ · ${eq.recharge} MW`}{eq.thrust != null && `${eq.thrust} thrust`}{eq.torque != null && `${eq.torque} torque`} · sold by {eq.sellers.join(", ")}</div>}
              </div>;
            })}
            {(tab === "turret" || tab === "shield") && ship.groups.map(g => g.parts.filter(pt => pt.kind === tab).map(pt => {
              const v = l.groups[g.id]?.[pt.kind];
              return <div key={g.id + pt.kind} className="b-card"><b>{g.name}</b> <span className="dim">· slot group, up to {pt.max} {pt.kind}s</span>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <select style={{ flex: 1 }} value={v?.eq ?? ""} onChange={e => b.setGroup(g.id, pt.kind, e.target.value ? { eq: e.target.value, count: v?.count || pt.max } : null)}>
                    <option value="">— empty —</option>{pt.compatible.map(id => <option key={id} value={id}>{byId(EQUIPMENT, id)?.name}</option>)}
                  </select>
                  <input type="range" min={0} max={pt.max} disabled={!v} value={v?.count ?? 0} onChange={e => v && b.setGroup(g.id, pt.kind, { eq: v.eq, count: +e.target.value })} />
                  <span>{v?.count ?? 0} / {pt.max}</span>
                </div></div>;
            }))}
          </>;
        })()}

        {tab === "consumables" && (["missile", "countermeasure", "drone", "deployable"] as const).map(k => {
          const cap = ship.capacity[k]; const used = CONSUMABLES.filter(c => c.kind === k).reduce((a, c) => a + (l.consumables[c.id] ?? 0), 0);
          return <div key={k} className="b-card"><b>{k}s</b> <span className={used > cap ? "warn" : "dim"}>{used} / {cap}</span>
            {cap === 0 ? <div className="dim">This ship carries none.</div> : CONSUMABLES.filter(c => c.kind === k).map(c => (
              <div key={c.id} style={{ display: "flex", gap: 8, marginTop: 4 }}><span style={{ flex: 1 }}>{c.name} <span className="dim">{cr(c.price.avg)}</span></span>
                <input type="number" min={0} max={cap} value={l.consumables[c.id] ?? 0} style={{ width: 70 }} onChange={e => b.setConsumable(c.id, Math.min(cap, +e.target.value))} />
                <button onClick={() => b.setConsumable(c.id, cap - used + (l.consumables[c.id] ?? 0))}>max</button></div>))}</div>;
        })}

        {tab === "software" && ship.software.map(s => (
          <div key={s.group} className="b-card" style={s.mandatoryDefault && !l.software[s.group] ? { borderColor: "var(--warn)" } : undefined}>
            <b>{s.group}</b>{s.mandatoryDefault && <span className="dim"> · required</span>}
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button className={!l.software[s.group] ? "primary" : ""} onClick={() => b.setSoftware(s.group, null)}>None</button>
              {s.options.map(o => <button key={o} className={l.software[s.group] === o ? "primary" : ""} onClick={() => b.setSoftware(s.group, o)}>{byId(SOFTWARE, o)?.name}</button>)}
            </div></div>))}

        <div className="b-strip">
          {b.stats.filter(r => HEADLINE.includes(r.label)).map(r => <div key={r.label}><div className="dim">{r.label}</div><b>{fmt(r)}</b> {r.unit}</div>)}
          <span style={{ flex: 1 }} /><button className="primary" onClick={() => setStep(3)}>Review →</button>
        </div>
      </>}

      {step === 3 && l && ship && <>
        <h2>{ship.name}</h2>
        {b.missing.length > 0 ? <div className="missing">⚠ Missing mandatory upgrades: {b.missing.map(m => m.label).join(", ")} <button onClick={() => setStep(2)}>Fix</button></div> : <div className="ok">All mandatory upgrades fitted.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
          {groupBy(b.stats).map(([sec, rows]) => <div key={sec} className="b-card"><h3>{sec}</h3><table><tbody>{rows.map(r => <tr key={r.label} title={r.tooltip}><td>{r.label}{r.tooltip && " ⓘ"}</td><td className="num">{fmt(r)} {r.unit}{r.range && <div className="dim">{cr(r.range[0])} – {cr(r.range[1])}</div>}</td></tr>)}</tbody></table></div>)}
        </div>
        <div className="b-card" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input placeholder="Loadout name" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} />
          <button className="primary" disabled={!name} onClick={() => b.save(name)}>{b.openSavedId ? "Update saved" : "Save"}</button>
          {b.openSavedId && <button disabled={!name} onClick={() => b.saveAsNew(name)}>Save as new</button>}
          <ShareButton b={b} />
          <button disabled={!b.openSavedId} onClick={() => b.exportFile([b.openSavedId!])}>Download file</button>
        </div>
        {b.saved.length > 0 && <div className="b-card"><h3>Saved in this browser</h3>{b.saved.map(s => <div key={s.id}>{s.name} <span className="dim">· {byId(SHIPS, s.loadout.ship)?.name}</span> <button onClick={() => b.deleteSaved(s.id)}>delete</button></div>)}<button onClick={() => b.exportFile()}>Export all</button></div>}
      </>}
      <Credits />
    </div>
  );
}
