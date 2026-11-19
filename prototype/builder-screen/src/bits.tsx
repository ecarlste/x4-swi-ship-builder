// PROTOTYPE — small widgets shared by variants (not layout).
import { useRef } from "react";
import { Builder } from "./model";
import { GAME_DATA_VERSION } from "./data";

export function Report({ b }: { b: Builder }) {
  if (!b.report) return null;
  return (
    <div className="notice">
      <b>{b.report.title}</b> <button onClick={b.dismissReport} style={{ float: "right" }}>Dismiss</button>
      <ul>{b.report.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}

export function ShareButton({ b, label = "Share link" }: { b: Builder; label?: string }) {
  return <button disabled={!b.loadout} onClick={async () => { const url = b.shareLink(); try { await navigator.clipboard.writeText(url); alert("Share Link copied:\n\n" + url); } catch { prompt("Copy this Share Link", url); } }}>{label}</button>;
}

export function ImportButton({ b }: { b: Builder }) {
  const r = useRef<HTMLInputElement>(null);
  return (
    <>
      <button onClick={() => r.current?.click()}>Import file…</button>
      <input ref={r} type="file" accept=".json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) b.importFile(f); e.target.value = ""; }} />
    </>
  );
}

export function askName(def: string) { return prompt("Name this loadout", def)?.trim() || null; }

export function Credits() {
  return (
    <div className="footer-notices">
      PROTOTYPE · stub data · Game Data SWI {GAME_DATA_VERSION.swi} on X4 {GAME_DATA_VERSION.x4}. Uses content from X4: Foundations (Egosoft; Steam/GOG link) and Star Wars Interworlds (credit SWI team).
      Unofficial fan project, not approved or endorsed by Egosoft (Section 7 disclaimer). Not affiliated with Disney or Lucasfilm.
    </div>
  );
}
