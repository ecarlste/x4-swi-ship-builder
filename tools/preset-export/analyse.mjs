#!/usr/bin/env node
// Summarises a preset-export run.
//
//   node analyse.mjs <debuglog.txt> "<X4 dir>" [--list]
//
// Reads the SWIPRESET lines the mod logged and, from the X4 + SWI files, a rough layered view of
// the ship and equipment wares (base + the DLCs SWI depends on + starwarsmod_m1; only ware add,
// replace and remove-by-id patches are applied, so treat ware counts as approximate).
// Prints: coverage of ship wares, and how Low/Medium/High differ between pass 1 and pass 2
// (exact, ignoring slot order, and by total equipment price). --list prints each differing preset.
// Nothing is written: the output is Game Data, so keep it out of this public repo.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readPacked, requireX4 } from "./catalog.mjs";

const [logPath, x4Arg, flag] = process.argv.slice(2);
const x4 = requireX4(x4Arg);

// --- the log ---------------------------------------------------------------------------------
const FIELDS = ["engines", "thruster", "shields", "weapons", "turrets", "shieldgroups", "turretgroups", "ammo", "units", "software"];
const passes = { 1: new Map(), 2: new Map() };
let begin = null, end = false, errors = 0;
for (const line of readFileSync(logPath, "utf8").split(/\r?\n/)) {
  const i = line.indexOf("SWIPRESET;");
  if (i < 0) continue;
  const parts = line.slice(i).split(";");
  if (parts[1] === "BEGIN") begin = Number(parts[2]);
  else if (parts[1] === "END") end = true;
  else if (parts[1] === "ERROR") errors++;
  else if (/^P[12]$/.test(parts[1])) passes[parts[1][1]].set(`${parts[2]};${parts[3]}`, parts.slice(4));
}
if (begin === null) throw new Error("No SWIPRESET;BEGIN line: the mod didn't run, or this is the wrong log");

/** Equipment in a preset as macro -> count, ignoring which slot or group it sits in. */
function bag(fields) {
  const out = new Map();
  const add = (m, n) => out.set(m, (out.get(m) ?? 0) + n);
  fields.forEach((field, idx) => {
    const name = FIELDS[idx];
    const body = field.slice(field.indexOf("[") + 1, -1);
    for (const item of body ? body.split(",") : []) {
      if (item.includes("=")) {
        const [where, macro] = item.split("=");
        add(macro, name.endsWith("groups") ? Number(where.split("x").pop()) : 1);
      } else if (name === "ammo" || name === "units") {
        const k = item.lastIndexOf("x");
        add(item.slice(0, k), Number(item.slice(k + 1)));
      } else add(item, 1);
    }
  });
  return out;
}
const sameBag = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
const sorted = (fields) => fields.map((f) => f.replace(/\[(.*)\]$/, (_, b) => `[${b.split(",").sort().join(",")}]`)).join(";");

// --- the wares -------------------------------------------------------------------------------
const swiDir = join(x4, "extensions", "starwarsmod_m1");
const deps = [...readFileSync(join(swiDir, "content.xml"), "utf8").matchAll(/<dependency id="([^"]+)"/g)].map((m) => m[1]);
const sources = [
  ["base", readPacked(x4, "libraries/wares.xml")],
  ...deps.map((d) => [d, readPacked(join(x4, "extensions", d), "libraries/wares.xml", { prefix: "ext_" })]),
  ["starwarsmod_m1", readPacked(swiDir, "libraries/wares.xml", { prefix: "ext_" })],
];
const attr = (tag, a) => tag.match(new RegExp(`\\b${a}="([^"]*)"`))?.[1];
const wares = new Map(); // id -> { transport, macro, price, owners, tags }
for (const [, xml] of sources) {
  if (!xml) continue;
  for (const m of xml.matchAll(/<remove\s+sel="[^"]*\/ware\[@id='([^']+)'\]"\s*\/>/g)) wares.delete(m[1]);
  for (const m of xml.matchAll(/<ware\b([^>]*)>([\s\S]*?)<\/ware>/g)) {
    const [head, body] = [m[1], m[2]];
    wares.set(attr(head, "id"), {
      transport: attr(head, "transport"),
      tags: (attr(head, "tags") ?? "").split(/\s+/).filter(Boolean),
      macro: body.match(/<component ref="([^"]+)"/)?.[1],
      price: Number(body.match(/<price\b[^>]*\baverage="(\d+)"/)?.[1] ?? 0),
      owners: [...body.matchAll(/<owner faction="([^"]+)"/g)].map((o) => o[1]),
    });
  }
}
const priceOf = new Map([...wares.values()].filter((w) => w.macro).map((w) => [w.macro, w.price]));
const ships = [...wares.entries()].filter(([, w]) => w.transport === "ship" && w.macro);
const exported = new Set([...passes[1].keys()].map((k) => k.split(";")[0]));

// --- report ----------------------------------------------------------------------------------
console.log(`Run: BEGIN ${begin} macros, END ${end ? "seen" : "MISSING"}, ${errors} errors, ` +
  `${passes[1].size} pass-1 and ${passes[2].size} pass-2 presets`);
const missing = ships.filter(([, w]) => !exported.has(w.macro));
console.log(`Ship wares (approx.): ${ships.length}; exported: ${ships.length - missing.length}; not exported: ${missing.length}`);
for (const [id, w] of missing) console.log(`  not exported: ${id} (${w.macro}) owners=${w.owners.join(",") || "-"} tags=${w.tags.join(" ")}`);

const byLevel = {};
let exact = 0, order = 0, tie = 0, price = 0;
const listed = [];
for (const [key, a] of passes[1]) {
  const b = passes[2].get(key);
  if (!b || a.join(";") === b.join(";")) continue;
  exact++;
  const level = key.split(";")[1];
  byLevel[level] = (byLevel[level] ?? 0) + 1;
  if (sorted(a) === sorted(b)) { order++; continue; }
  const [ba, bb] = [bag(a), bag(b)];
  if (sameBag(ba, bb)) { order++; continue; }
  const cost = (m) => [...m].reduce((s, [k, v]) => s + (priceOf.get(k) ?? 0) * v, 0);
  const [ca, cb] = [cost(ba), cost(bb)];
  if (ca === cb) tie++; else price++;
  const only = (x, y) => [...x].filter(([k, v]) => v > (y.get(k) ?? 0)).map(([k, v]) => `${k}x${v - (y.get(k) ?? 0)}`);
  listed.push(`${key} ${ca === cb ? "tie" : `${((100 * (cb - ca)) / ca).toFixed(1)}%`} P1-only=${only(ba, bb)} P2-only=${only(bb, ba)}`);
}
console.log(`Pass 1 vs pass 2: ${exact} presets differ ${JSON.stringify(byLevel)}`);
console.log(`  order only: ${order}; different items, same total price: ${tie}; different total price: ${price}`);
if (flag === "--list") listed.forEach((l) => console.log(`  ${l}`));
