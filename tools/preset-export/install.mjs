#!/usr/bin/env node
// Installs (or removes) the throwaway preset-export mod into an X4 + SWI install.
//
//   node install.mjs "<X4 dir>"              install into <X4 dir>/extensions/swi_preset_export
//   node install.mjs "<X4 dir>" --uninstall  remove it again
//
// The mod's Lua needs SWI's UILoadout2 FFI types and five engine function declarations. They are
// SWI's code, so this repo doesn't carry them: they're copied, by name, from the user's own
// ui/addons/ego_detailmonitor/menu_ship_configuration.xpl at install time.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPacked, requireX4 } from "./catalog.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [x4Arg, flag] = process.argv.slice(2);
const x4 = requireX4(x4Arg);
const target = join(x4, "extensions", "swi_preset_export");

if (flag === "--uninstall") {
  if (existsSync(target)) rmSync(target, { recursive: true });
  console.log(`Removed ${target}`);
  process.exit(0);
}

const MENU = "ui/addons/ego_detailmonitor/menu_ship_configuration.xpl";
const menu = readPacked(join(x4, "extensions", "starwarsmod_m1"), MENU, { prefix: "subst_" });
if (!menu) throw new Error(`SWI's ${MENU} not found in starwarsmod_m1/subst_*.cat`);

const TYPES = [
  "UILoadoutWeaponSetting", "UILoadoutAmmoData", "UILoadoutCrewData", "UILoadoutGroupData2",
  "UILoadoutMacroData2", "UILoadoutSoftwareData", "UILoadoutVirtualMacroData", "UILoadoutCounts2",
  "UILoadout2",
];
const FUNCTIONS = [
  "GenerateShipLoadout2", "GenerateShipLoadoutCounts2", "GetNumAllShipMacros2",
  "GetAllShipMacros2", "SaveLoadout2",
];

function typedef(name) {
  const re = new RegExp(`typedef struct \\{[^{}]*\\}\\s*${name};`);
  const m = menu.match(re);
  if (!m) throw new Error(`typedef ${name} not found in SWI's menu`);
  return m[0].replace(/\r/g, "");
}
function declaration(name) {
  const m = menu.match(new RegExp(`^\\s*([\\w\\s\\*]+\\b${name}\\([^)]*\\);)`, "m"));
  if (!m) throw new Error(`function ${name} not found in SWI's menu`);
  return m[1].trim();
}

const decls = [
  ...TYPES.map((t) => `  [[\n${typedef(t).replace(/^/gm, "    ")}\n  ]],`),
  ...FUNCTIONS.map((f) => `  ${JSON.stringify(declaration(f))},`),
].join("\n");

const template = readFileSync(join(here, "mod", "ui", "preset_export.template.lua"), "utf8");
const marker = /^ *--@@SWI_DECLS@@.*$/m;
if (!marker.test(template)) throw new Error("template marker missing");

mkdirSync(target, { recursive: true });
cpSync(join(here, "mod", "content.xml"), join(target, "content.xml"));
cpSync(join(here, "mod", "ui.xml"), join(target, "ui.xml"));
cpSync(join(here, "mod", "md"), join(target, "md"), { recursive: true });
mkdirSync(join(target, "ui"), { recursive: true });
writeFileSync(join(target, "ui", "preset_export.lua"), template.replace(marker, decls));
console.log(`Installed ${target} (${TYPES.length} types, ${FUNCTIONS.length} functions from SWI's menu)`);
