// PROTOTYPE — throwaway. Three structurally different builder screens on one page,
// switchable via ?variant=A|B|C and the floating bar (← / → keys too).
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { useBuilder } from "./model";
import VariantA from "./VariantA";
import VariantB from "./VariantB";
import VariantC from "./VariantC";

const VARIANTS = [
  { key: "A", name: "Config screen (3 panes + picker)", C: VariantA },
  { key: "B", name: "Guided steps", C: VariantB },
  { key: "C", name: "One sheet", C: VariantC },
];

function App() {
  const [variant, setVariant] = useState(() => new URLSearchParams(location.search).get("variant") ?? "A");
  const b = useBuilder(); // shared, so switching variants keeps the current loadout
  const idx = Math.max(0, VARIANTS.findIndex(v => v.key === variant));
  const go = (d: number) => {
    const v = VARIANTS[(idx + d + VARIANTS.length) % VARIANTS.length].key;
    const u = new URL(location.href); u.searchParams.set("variant", v); history.replaceState(null, "", u); setVariant(v);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    addEventListener("keydown", h); return () => removeEventListener("keydown", h);
  });
  const V = VARIANTS[idx];
  return (
    <>
      <V.C b={b} />
      <div className="proto-bar">
        <button onClick={() => go(-1)}>←</button>
        <span>{V.key} ({V.name})</span>
        <button onClick={() => go(1)}>→</button>
        <span className="proto-sep" />
        <button title="Open a Share Link made against older Game Data" onClick={() => { location.href = b.staleLink(); location.reload(); }}>Try a stale link</button>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
