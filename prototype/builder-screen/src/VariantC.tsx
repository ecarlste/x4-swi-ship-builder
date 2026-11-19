// PROTOTYPE — Variant C: "One sheet". Ship chosen from a type-ahead in the toolbar;
// the whole loadout is one dense editable table (every Slot, Slot Group, consumable, software row
// with its price); stats sit beside it and can show a delta against a pinned baseline.
import { useState } from "react";
import { CONSUMABLES, EQUIPMENT, SHIPS, SOFTWARE, byId } from "./data";
import { Builder, StatRow, cr, fmt } from "./model";
import { Credits, ImportButton, Report, ShareButton, askName } from "./bits";

export default function VariantC({ b }: { b: Builder }) {
  const [shipText, setShipText] = useState(b.ship?.name ?? "");
  const [baseline, setBaseline] = useState<{ name: string; stats: StatRow[] } | null>(null);
  const l = b.loadout, ship = b.ship;
  const savedName = b.saved.find(s => s.id === b.openSavedId)?.name;
  const eqRow = (id?: string) => byId(EQUIPMENT, id);

  return (
    <>
      <div className="c-top">
        <label className="dim">Ship</label>
        <input list="c-ships" placeholder="Search ships…" value={shipText} style={{ width: 180 }}
          onFocus={e => e.target.select()}
          onChange={e => { setShipText(e.target.value); const s = SHIPS.find(x => x.name === e.target.value); if (s) b.pickShip(s.id); }} />
        <datalist id="c-ships">{SHIPS.map(s => <option key={s.id} value={s.name}>{s.size} · {s.klass} · {s.sellers.join(", ")}</option>)}</datalist>
        <select value={ship?.id ?? ""} onChange={e => { const s = byId(SHIPS, e.target.value); if (s) { b.pickShip(s.id); setShipText(s.name); } }}>
          <option value="" disabled>Choose a ship…</option>
          {(["S", "M", "L", "XL"] as const).map(sz => SHIPS.some(s => s.size === sz) && (
            <optgroup key={sz} label={`${sz} ships`}>{SHIPS.filter(s => s.size === sz).map(s => <option key={s.id} value={s.id}>{s.name} · {s.klass} · {s.sellers.join(", ")}</option>)}</optgroup>))}
        </select>
        <span className="proto-sep" style={{ background: "var(--line)" }} />
        <select value={b.openSavedId ?? ""} onChange={e => { if (e.target.value) { b.openSaved(e.target.value); setShipText(byId(SHIPS, b.saved.find(s => s.id === e.target.value)!.loadout.ship)!.name); } }}>
          <option value="">Saved loadouts ({b.saved.length})…</option>{b.saved.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="primary" disabled={!l} onClick={() => { const n = askName(savedName ?? ship!.name); if (n) (b.openSavedId && n !== savedName ? b.saveAsNew(n) : b.save(n)); }}>Save{b.dirty ? " •" : ""}</button>
        <ShareButton b={b} label="Copy link" />
        <button disabled={!b.saved.length} onClick={() => b.exportFile()}>Export</button>
        <ImportButton b={b} />
        <span style={{ flex: 1 }} />
        {b.missing.length > 0 && <span className="warn" title={b.missing.map(m => m.label).join("\n")}>⚠ {b.missing.length} mandatory missing</span>}
        <button disabled={!l} onClick={() => setBaseline({ name: savedName ?? "pinned", stats: b.stats })}>Pin as baseline</button>
        {baseline && <button onClick={() => setBaseline(null)}>Unpin “{baseline.name}”</button>}
      </div>
      <div style={{ padding: "0 12px" }}><Report b={b} /></div>
      {!l || !ship ? <div className="c dim">Choose a ship in the toolbar. It opens as an Empty Loadout.</div> :
        <div className="c">
          <div>
            <div className="dim" style={{ marginBottom: 6 }}><b style={{ color: "var(--text)" }}>{ship.name}</b> · {ship.size} {ship.klass} · sold by {ship.sellers.join(", ")}{ship.licence && ` · needs ${ship.licence}`}</div>
            <table>
              <thead><tr><th>Slot</th><th>Equipment</th><th className="num">Qty</th><th>Key value</th><th className="num">Price (avg)</th></tr></thead>
              <tbody>
                <tr className="sect"><td colSpan={5}>Slots</td></tr>
                {ship.slots.map(s => { const e = eqRow(l.slots[s.id]); return (
                  <tr key={s.id} className={s.mandatory && !e ? "need" : ""}>
                    <td>{s.size} {s.kind} <span className="dim">{s.id.replace("con_", "")}</span>{s.mandatory && <span className="warn"> *</span>}</td>
                    <td><select value={e?.id ?? ""} onChange={ev => b.setSlot(s.id, ev.target.value || null)} style={{ width: "100%" }}><option value="">—</option>{s.compatible.map(id => <option key={id} value={id}>{eqRow(id)!.name}</option>)}</select></td>
                    <td className="num">{e ? 1 : ""}</td>
                    <td className="dim">{e && (e.dps != null ? `${e.dps} MW` : e.shield != null ? `${e.shield} MJ` : e.thrust != null ? `${e.thrust} N` : `${e.torque} torque`)}</td>
                    <td className="num">{e && cr(e.price.avg)}</td></tr>); })}
                {ship.groups.length > 0 && <tr className="sect"><td colSpan={5}>Slot groups</td></tr>}
                {ship.groups.flatMap(g => g.parts.map(pt => { const v = l.groups[g.id]?.[pt.kind]; const e = eqRow(v?.eq); return (
                  <tr key={g.id + pt.kind}>
                    <td>{g.name} <span className="dim">{pt.kind}s</span></td>
                    <td><select value={e?.id ?? ""} onChange={ev => b.setGroup(g.id, pt.kind, ev.target.value ? { eq: ev.target.value, count: v?.count || pt.max } : null)} style={{ width: "100%" }}><option value="">—</option>{pt.compatible.map(id => <option key={id} value={id}>{eqRow(id)!.name}</option>)}</select></td>
                    <td className="num"><input type="number" min={0} max={pt.max} disabled={!e} value={v?.count ?? 0} style={{ width: 52 }} onChange={ev => e && b.setGroup(g.id, pt.kind, { eq: e.id, count: Math.min(pt.max, +ev.target.value) })} /> /{pt.max}</td>
                    <td className="dim">{e && (e.dps != null ? `${e.dps * (v?.count ?? 0)} MW total` : `${(e.shield ?? 0) * (v?.count ?? 0)} MJ total`)}</td>
                    <td className="num">{e && cr(e.price.avg * (v?.count ?? 0))}</td></tr>); }))}
                <tr className="sect"><td colSpan={5}>Consumables</td></tr>
                {CONSUMABLES.filter(c => ship.capacity[c.kind] > 0).map(c => (
                  <tr key={c.id}><td className="dim">{c.kind} <span>(cap {ship.capacity[c.kind]})</span></td><td>{c.name}</td>
                    <td className="num"><input type="number" min={0} max={ship.capacity[c.kind]} value={l.consumables[c.id] ?? 0} style={{ width: 52 }} onChange={ev => b.setConsumable(c.id, Math.min(ship.capacity[c.kind], +ev.target.value))} /></td>
                    <td /><td className="num">{l.consumables[c.id] ? cr(c.price.avg * l.consumables[c.id]) : ""}</td></tr>))}
                <tr className="sect"><td colSpan={5}>Software</td></tr>
                {ship.software.map(s => (
                  <tr key={s.group} className={s.mandatoryDefault && !l.software[s.group] ? "need" : ""}><td>{s.group}{s.mandatoryDefault && <span className="warn"> *</span>}</td>
                    <td><select value={l.software[s.group] ?? ""} onChange={ev => b.setSoftware(s.group, ev.target.value || null)} style={{ width: "100%" }}><option value="">—</option>{s.options.map(o => <option key={o} value={o}>{byId(SOFTWARE, o)?.name}</option>)}</select></td>
                    <td /><td /><td className="num">{l.software[s.group] && cr(byId(SOFTWARE, l.software[s.group])!.price.avg)}</td></tr>))}
              </tbody>
            </table>
            <button style={{ marginTop: 8 }} onClick={b.clear}>Clear loadout</button>
          </div>
          <div className="c-stats">
            <h3>Stats{baseline && <span className="dim"> · Δ vs “{baseline.name}”</span>}</h3>
            <table><tbody>{b.stats.map(r => {
              const base = baseline?.stats.find(x => x.label === r.label); const d = base ? r.value - base.value : 0;
              return <tr key={r.label} title={r.tooltip}><td>{r.label}{r.tooltip && " ⓘ"}</td><td className="num">{fmt(r)} <span className="dim">{r.unit}</span>
                {r.range && <div className="dim" style={{ fontSize: 11 }}>{cr(r.range[0])} – {cr(r.range[1])}</div>}</td>
                <td className={"num c-delta " + (d > 0 ? "up" : d < 0 ? "down" : "")}>{base && d !== 0 ? (d > 0 ? "+" : "") + d.toLocaleString("en", { maximumFractionDigits: r.decimals ?? 0 }) : ""}</td></tr>;
            })}</tbody></table>
          </div>
        </div>}
      <Credits />
    </>
  );
}
