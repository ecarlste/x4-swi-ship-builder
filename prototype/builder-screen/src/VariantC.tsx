// PROTOTYPE — Variant C: "One sheet". Ship chosen by size, then ship, in the toolbar;
// the whole loadout is one dense editable table (every Slot, Slot Group, consumable, software row
// with its price); stats sit beside it. Once a loaded loadout (saved or Share Link) is changed, rows
// and stats show the difference from it as loaded (or as last saved). Equipment dropdowns show each option's difference from what's fitted.
import { useEffect, useMemo, useState } from "react";
import { CONSUMABLES, EQUIPMENT, Equipment, SHIPS, SOFTWARE, Size, byId } from "./data";
import { Builder, computeStats, cr, fmt } from "./model";

const SIZES: Size[] = ["S", "M", "L", "XL"];
const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n).toLocaleString("en");

// The figures shown for one piece of Equipment, by kind.
const figures = (e: Equipment): [string, number, string][] =>
  e.dps != null ? [["burst", e.dps, "MW"], ["sustained", e.sustained ?? 0, "MW"]]
  : e.shield != null ? [["shield", e.shield, "MJ"], ["recharge", e.recharge ?? 0, "MW"]]
  : e.thrust != null ? [["thrust", e.thrust, "N"], ["travel ×", e.travel ?? 0, ""]]
  : [["torque", e.torque ?? 0, ""]];

// Option label: the candidate's figures, each with its difference from the fitted item.
function optionLabel(cand: Equipment, fitted?: Equipment) {
  if (fitted?.id === cand.id) return `✓ ${cand.name} (fitted)`;
  const base = fitted ? figures(fitted) : [];
  const parts = figures(cand).map(([k, v, u], i) => `${v.toLocaleString("en")}${u ? " " + u : ""} ${k} (${signed(v - (base[i]?.[1] ?? 0))})`);
  parts.push(`${cr(cand.price.avg)} (${signed(cand.price.avg - (fitted?.price.avg ?? 0))})`);
  return `${cand.name} · ${parts.join(" · ")}`;
}
import { Credits, ImportButton, Report, ShareButton, askName } from "./bits";

export default function VariantC({ b }: { b: Builder }) {
  const [size, setSize] = useState<Size | "">(b.ship?.size ?? "");
  useEffect(() => { if (b.ship) setSize(b.ship.size); }, [b.ship?.id]); // opening a saved loadout or link follows its size
  const l = b.loadout, ship = b.ship;
  const savedOpen = b.saved.find(s => s.id === b.openSavedId);
  const savedName = savedOpen?.name;
  const was = b.changed ? b.origin?.loadout : undefined; // the loaded/last-saved version, once anything has changed
  const savedStats = useMemo(() => (was ? computeStats(was) : null), [was]);
  const Was = ({ changed, text }: { changed: boolean; text: string }) => changed ? <div className="c-was">was: {text}</div> : null;
  const eqRow = (id?: string) => byId(EQUIPMENT, id);

  return (
    <>
      <div className="c-top">
        <label className="dim">Size</label>
        <select value={size} onChange={e => setSize(e.target.value as Size)}>
          <option value="" disabled>Choose…</option>
          {SIZES.map(sz => <option key={sz} value={sz} disabled={!SHIPS.some(s => s.size === sz)}>{sz}</option>)}
        </select>
        <label className="dim">Ship</label>
        <select value={ship && ship.size === size ? ship.id : ""} disabled={!size} onChange={e => b.pickShip(e.target.value)}>
          <option value="" disabled>{size ? `Choose a ${size} ship…` : "Choose a size first"}</option>
          {SHIPS.filter(s => s.size === size).map(s => <option key={s.id} value={s.id}>{s.name} · {s.klass} · {s.sellers.join(", ")}</option>)}
        </select>
        <span className="proto-sep" style={{ background: "var(--line)" }} />
        <select value={b.openSavedId ?? ""} onChange={e => { if (e.target.value) b.openSaved(e.target.value); }}>
          <option value="">Saved loadouts ({b.saved.length})…</option>{b.saved.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="primary" disabled={!l} onClick={() => { const n = askName(savedName ?? ship!.name); if (n) (b.openSavedId && n !== savedName ? b.saveAsNew(n) : b.save(n)); }}>Save{b.dirty ? " •" : ""}</button>
        <ShareButton b={b} label="Copy link" />
        <button disabled={!b.saved.length} onClick={() => b.exportFile()}>Export</button>
        <ImportButton b={b} />
        <span style={{ flex: 1 }} />
        {b.missing.length > 0 && <span className="warn" title={b.missing.map(m => m.label).join("\n")}>⚠ {b.missing.length} mandatory missing</span>}
      </div>
      <div style={{ padding: "0 12px" }}><Report b={b} /></div>
      {!l || !ship ? <div className="c dim">Choose a size, then a ship, in the toolbar. It opens as an Empty Loadout.</div> :
        <div className="c">
          <div>
            <div className="dim" style={{ marginBottom: 6 }}><b style={{ color: "var(--text)" }}>{ship.name}</b> · {ship.size} {ship.klass} · sold by {ship.sellers.join(", ")}{ship.licence && ` · needs ${ship.licence}`}</div>
            <table>
              <thead><tr><th>Slot</th><th>Equipment</th><th className="num">Qty</th><th>Key value</th><th className="num">Price (avg)</th></tr></thead>
              <tbody>
                <tr className="sect"><td colSpan={5}>Slots</td></tr>
                {ship.slots.map(s => { const e = eqRow(l.slots[s.id]); return (
                  <tr key={s.id} className={(s.mandatory && !e ? "need" : "") + (was && was.slots[s.id] !== l.slots[s.id] ? " changed" : "")}>
                    <td>{s.size} {s.kind} <span className="dim">{s.id.replace("con_", "")}</span>{s.mandatory && <span className="warn"> *</span>}</td>
                    <td><select value={e?.id ?? ""} onChange={ev => b.setSlot(s.id, ev.target.value || null)} style={{ width: "100%" }}><option value="">—</option>{s.compatible.map(id => <option key={id} value={id}>{optionLabel(eqRow(id)!, e)}</option>)}</select>
                      <Was changed={!!was && was.slots[s.id] !== l.slots[s.id]} text={eqRow(was?.slots[s.id])?.name ?? "empty"} /></td>
                    <td className="num">{e ? 1 : ""}</td>
                    <td className="dim">{e && (e.dps != null ? `${e.dps} MW` : e.shield != null ? `${e.shield} MJ` : e.thrust != null ? `${e.thrust} N` : `${e.torque} torque`)}</td>
                    <td className="num">{e && cr(e.price.avg)}</td></tr>); })}
                {ship.groups.length > 0 && <tr className="sect"><td colSpan={5}>Slot groups</td></tr>}
                {ship.groups.flatMap(g => g.parts.map(pt => { const v = l.groups[g.id]?.[pt.kind]; const e = eqRow(v?.eq);
                  const wv = was?.groups[g.id]?.[pt.kind]; const gChanged = !!was && (wv?.eq !== v?.eq || (wv?.count ?? 0) !== (v?.count ?? 0)); return (
                  <tr key={g.id + pt.kind} className={gChanged ? "changed" : ""}>
                    <td>{g.name} <span className="dim">{pt.kind}s</span></td>
                    <td><select value={e?.id ?? ""} onChange={ev => b.setGroup(g.id, pt.kind, ev.target.value ? { eq: ev.target.value, count: v?.count || pt.max } : null)} style={{ width: "100%" }}><option value="">—</option>{pt.compatible.map(id => <option key={id} value={id}>{optionLabel(eqRow(id)!, e)}</option>)}</select>
                      <Was changed={gChanged} text={wv ? `${eqRow(wv.eq)?.name} ×${wv.count}` : "empty"} /></td>
                    <td className="num"><input type="number" min={0} max={pt.max} disabled={!e} value={v?.count ?? 0} style={{ width: 52 }} onChange={ev => e && b.setGroup(g.id, pt.kind, { eq: e.id, count: Math.min(pt.max, +ev.target.value) })} /> /{pt.max}</td>
                    <td className="dim">{e && (e.dps != null ? `${e.dps * (v?.count ?? 0)} MW total` : `${(e.shield ?? 0) * (v?.count ?? 0)} MJ total`)}</td>
                    <td className="num">{e && cr(e.price.avg * (v?.count ?? 0))}</td></tr>); }))}
                <tr className="sect"><td colSpan={5}>Consumables</td></tr>
                {CONSUMABLES.filter(c => ship.capacity[c.kind] > 0).map(c => (
                  <tr key={c.id} className={was && (was.consumables[c.id] ?? 0) !== (l.consumables[c.id] ?? 0) ? "changed" : ""}><td className="dim">{c.kind} <span>(cap {ship.capacity[c.kind]})</span></td><td>{c.name}</td>
                    <td className="num"><input type="number" min={0} max={ship.capacity[c.kind]} value={l.consumables[c.id] ?? 0} style={{ width: 52 }} onChange={ev => b.setConsumable(c.id, Math.min(ship.capacity[c.kind], +ev.target.value))} />
                      <Was changed={!!was && (was.consumables[c.id] ?? 0) !== (l.consumables[c.id] ?? 0)} text={String(was?.consumables[c.id] ?? 0)} /></td>
                    <td /><td className="num">{l.consumables[c.id] ? cr(c.price.avg * l.consumables[c.id]) : ""}</td></tr>))}
                <tr className="sect"><td colSpan={5}>Software</td></tr>
                {ship.software.map(s => (
                  <tr key={s.group} className={(s.mandatoryDefault && !l.software[s.group] ? "need" : "") + (was && was.software[s.group] !== l.software[s.group] ? " changed" : "")}><td>{s.group}{s.mandatoryDefault && <span className="warn"> *</span>}</td>
                    <td><select value={l.software[s.group] ?? ""} onChange={ev => b.setSoftware(s.group, ev.target.value || null)} style={{ width: "100%" }}><option value="">—</option>{s.options.map(o => <option key={o} value={o}>{byId(SOFTWARE, o)?.name}</option>)}</select>
                      <Was changed={!!was && was.software[s.group] !== l.software[s.group]} text={byId(SOFTWARE, was?.software[s.group])?.name ?? "none"} /></td>
                    <td /><td /><td className="num">{l.software[s.group] && cr(byId(SOFTWARE, l.software[s.group])!.price.avg)}</td></tr>))}
              </tbody>
            </table>
            <button style={{ marginTop: 8 }} onClick={b.clear}>Clear loadout</button>
          </div>
          <div className="c-stats">
            <h3>Stats</h3>
            <table><tbody>{b.stats.map(r => {
              const base = savedStats?.find(x => x.label === r.label); const d = base ? r.value - base.value : 0;
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
