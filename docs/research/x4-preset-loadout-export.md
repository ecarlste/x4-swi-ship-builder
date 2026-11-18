# Can a script make X4 generate and export the preset loadouts for every SWI ship?

Research for issue #16 (child of the wayfinder map, #1). Researched 2026-11-18.

**Sources.** All facts below come from the local install
`/mnt/e/SteamLibrary/steamapps/common/X4 Foundations - 8.00` (X4 8.00 + DLCs + SWI 0.9.1), called `<X4>`.
It is read-only. Files were pulled out of the `.cat/.dat` archives by byte range, as described in
`docs/research/swi-file-packaging.md` (branch `research/swi-file-packaging`). The main files:

| File | Archive | What it gives |
|---|---|---|
| `ui/addons/ego_detailmonitor/menu_ship_configuration.lua` | `<X4>/08.cat` | the ship configuration menu (presets, FFI declarations, the mandatory check) |
| `ui/addons/ego_detailmonitor/menu_ship_configuration.xpl` | `<X4>/extensions/starwarsmod_m1/subst_02.cat` | SWI's replacement copy of the same menu (plain Lua source) |
| `ui/addons/ego_detailmonitorhelper/helper.lua` | `<X4>/08.cat` | `Helper.upgradetypes`, `Helper.getLoadoutHelper2` |
| `libraries/common.xsd`, `libraries/md.xsd`, `libraries/scriptproperties.xml` | `<X4>/08.cat` | the MD script actions and properties |
| `md/setup_gamestarts.xml`, `libraries/parameters.xml` | `<X4>/08.cat` | how vanilla calls `generate_loadout`; the default loadout variation |
| `t/0001-l044.xml` | `<X4>/09.cat` | English UI text |
| ship component XMLs `assets/units/size_*/*.xml` | base `0x.cat` and SWI `ext_01.cat` | the `mandatory` connection tag |
| `ui.xml`, `ui/*.lua` | loose files in `<X4>/extensions/starwarsmod_m1/` | how SWI itself loads Lua add-ons |

The user's profile (`Documents/Egosoft/X4/<steamid>/loadouts.xml`, OneDrive-synced) was also looked at, read-only,
to confirm the saved-loadout file format. Line numbers refer to the base `menu_ship_configuration.lua` unless stated.
Anything marked **(inference)** is my reading, not something a source states. The game could not be run.

## Answer in brief

- **Feasible, but one in-game run is needed to confirm.** Everything a script needs exists in the shipped
  code. The **Lua route** calls the exact function the menu uses for its presets:
  `GenerateShipLoadout2(result, containerid = 0, shipid = 0, macro, level)`. With container `0` it runs the way
  the **custom game start editor** does, with no station stock involved. The ship list can come from the
  engine's own `GetAllShipMacros2`. Each result can be written to the debug log (`DebugError`) or saved with
  `SaveLoadout2(..., "local", ...)` into the profile's `loadouts.xml`, which has the same `<loadout>` XML format
  the pipeline already reads. A ~60-line UI-addon mod plus a 10-line MD cue does it in one go (§5).
- **MD-only route** also exists, with no Lua and no ship spawning: `<generate_loadout macro=… level=… variation="0"/>`
  then `<export_loadout macro=… loadout=… id=…/>` ("Export the loadout to the local loadouts.xml file").
  But it is a *different* entry point: the pool is "default items for faction" or an explicit `wares`/`macros`
  list, not the menu's container logic. Nothing proves it matches the menu presets (§3).
- **Stock / container:** the menu has three modes:
  1. **station** (`containerid` = a shipyard): limited to what that container sells (`GetAvailableEquipment(container)`)
     and checked with `CanGenerateValidLoadout(container, macro)`;
  2. **`containerid = 0`** (custom game start): the menu forces `validLoadoutPossible = true` and lists
     `GetAllEquipment(...)`, i.e. no stock at all, everything allowed;
  3. **"known" variant** `GenerateShipKnownLoadout2(macro, level)` (ship comparison mode): uses the player's
     known blueprints.

  So "a container that stocks everything" is not needed: **container 0 is the shipped "no stock" mode**.
  **(inference)** With container 0 the generator draws from all equipment, the same pool the editor lists.
  That it then picks the *same* items as a real SWI shipyard would is not proven.
- **Mandatory upgrades** are decided in Lua, in `menu_ship_configuration.lua` (the error/warning builder at
  ~L7540-7600, and the left-bar red icons at ~L3355-3515). The rule:
  - **engines and thrusters are always mandatory**: `allowempty = false` in `Helper.upgradetypes`
    (`helper.lua` ~L8488-8500). That covers `engine`, `enginegroup`, `thruster`;
  - **any other slot is mandatory if the engine says so**: `C.IsSlotMandatory(object, 0, macro, false, type, slot)`.
    In the data this follows the **`mandatory` tag on a ship component's connection**
    (e.g. `tags="turret medium mandatory …"`). **(inference: the C function is engine-side, but the tag is the only
    data-side marker)**. In SWI only **one** slot has it: a turret on `assets/units/size_s/quad_jumper.xml`.
    Vanilla uses it on a few ships (e.g. tug turrets, Khaak destroyer and battleship weapons);
  - **default software**: a software slot whose ship macro lists a `default="1"` ware
    (`<software ware="software_flightassistmk1" default="1"/>`, checked with `C.IsSoftwareDefault`) must not be empty;
  - in **purchase** mode, a missing **captain** also raises the same message.

  The message itself is text `{1001,8020}` "Currently edited ship is missing mandatory upgrades (marked in red)."
  Shields, weapons, turrets, consumables and crew are otherwise optional (`allowempty = true`).

## 1. How the menu builds the presets

`menu.getPresetLoadouts()` (L3678) adds four fixed entries (L3839-3842):

```lua
{ id = "empty",  name = ReadText(1001, 7941), preset = 0,   ... }   -- Minimum
{ id = "low",    name = ReadText(1001, 7910), preset = 0.1, ... }
{ id = "medium", name = ReadText(1001, 7911), preset = 0.5, ... }
{ id = "high",   name = ReadText(1001, 7912), preset = 1.0, ... }
```

Picking one calls (`menu.dropdownLoadout`, L2088-2095):

```lua
if menu.mode == "customgamestart" then
    loadout = Helper.getLoadoutHelper2(C.GenerateShipLoadout2, C.GenerateShipLoadoutCounts2, "UILoadout2", 0, menu.object, menu.macro, preset)
elseif menu.mode == "comparison" then
    loadout = Helper.getLoadoutHelper2(C.GenerateShipKnownLoadout2, C.GenerateShipKnownLoadoutCounts2, "UILoadout2", menu.macro, preset)
else
    loadout = Helper.getLoadoutHelper2(C.GenerateShipLoadout2, C.GenerateShipLoadoutCounts2, "UILoadout2", menu.container, menu.object, menu.macro, preset)
end
```

`Helper.getLoadoutHelper2` (`helper.lua` L8584) first calls the `…Counts2` function to size the arrays, allocates
a `UILoadout2`, then calls the generator. The FFI declarations (L469-472):

```c
void GenerateShipKnownLoadout2(UILoadout2* result, const char* macroname, float level);
void GenerateShipKnownLoadoutCounts2(UILoadoutCounts2* result, const char* macroname, float level);
void GenerateShipLoadout2(UILoadout2* result, UniverseID containerid, UniverseID shipid, const char* macroname, float level);
void GenerateShipLoadoutCounts2(UILoadoutCounts2* result, UniverseID containerid, UniverseID shipid, const char* macroname, float level);
```

`UILoadout2` (L285-309) holds `weapons`, `turrets`, `shields`, `engines` (each `{macro, upgradetypename, slot,
optional, weaponsetting}`), `turretgroups`/`shieldgroups` (`{macro, path, group, count, …}`), `ammo` and `units`
(`{macro, amount}`), `software` (`{ware}`), a single `thruster` (`{macro}`), and `crew` (`{roleid, count}`).
So **one call gives everything the screen shows**: slot-level equipment, groups, consumables, software and crew.

The algorithm itself is in the engine (`X4.exe`), not in any data or Lua file. Note there is **no variation
parameter** on the FFI call, unlike MD where variation defaults to `0.3` (`parameters.xml`:
`<loadout level="0.5" variation="0.3" ammo="0.9" software="0.9">`). **(inference)** The UI presets are therefore
deterministic for a given container. This is worth checking in the test (§5) by generating twice.

### SWI's copy of the menu changes nothing here

SWI replaces the compiled menu with `subst_02.cat: ui/addons/ego_detailmonitor/menu_ship_configuration.xpl`.
That file is **plain Lua source** (starts `-- section == cArch_configureships`), and it is kuertee's
"UI Extensions" variant. A diff against the base `.lua` shows 272 changed lines, all `menu.uix_callbacks[...]`
hooks. The preset list, the `GenerateShipLoadout2` calls and the mandatory checks are the same (they move
by ~30-40 lines: e.g. the calls are at L2120/L2124).

## 2. The containerid question

How the menu decides which equipment is on offer (L3887-3898):

```lua
if menu.mode == "customgamestart" then
    n = C.GetNumAllEquipment(not menu.allownonplayerblueprints)
    ...
    n = C.GetAllEquipment(buf, n, not menu.allownonplayerblueprints)
elseif (not menu.isReadOnly) and ((menu.mode ~= "modify") or (not menu.modeparam[1])) then
    n = C.GetNumAvailableEquipment(menu.container, "")
    ...
    n = C.GetAvailableEquipment(buf, n, menu.container, "")
end
```

and whether presets are allowed at all (L1954-1960):

```lua
if menu.mode == "customgamestart" then
    menu.validLoadoutPossible = true
elseif menu.mode == "comparison" then
    menu.validLoadoutPossible = C.CanGenerateValidKnownLoadout(menu.macro)
else
    menu.validLoadoutPossible = (not menu.isReadOnly) and menu.container and C.CanGenerateValidLoadout(menu.container, menu.macro)
end
```

Answers:

- **Without a station:** pass `containerid = 0` and `shipid = 0`. That is exactly what the custom game start
  editor does, so it is a supported call path, not a hack.
- **A container that stocks everything:** not needed. Container `0` is the "everything" mode
  **(inference: the generator's pool in that mode is not visible; the editor's equipment list is
  `GetAllEquipment`, so the generator presumably uses the same)**. `GetAllEquipment(playerblueprint)` takes a flag
  that limits it to player blueprints. The editor passes `not allownonplayerblueprints`. The generator call has no
  such flag.
- **None at all / a real shipyard:** pass a station's `UniverseID`. The result is limited to its wares.
  `CanGenerateValidLoadout(container, macro)` returns false if the station can't fit the mandatory slots, and
  the presets go grey. That is the "station stock" behaviour the issue asks about.
- **Open:** whether container-0 output depends on the ship's maker race/faction, or on something random.
  The test in §5 logs the same ship twice and logs a few ship races to settle this.

## 3. MD alternatives

`libraries/common.xsd` (MD and AI scripts share it) has three relevant actions:

- `<generate_loadout macro="…" level="…" variation="…" faction="…" wares="…" macros="…" result="$list"/>`
  "Generate a loadout for a given object". `level` is 0..1. Without `variation` it uses the
  `parameters.xml` value (0.3), so **pass `variation="0"`**. With no `wares`/`macros` it uses "default items
  for faction". `wares`/`macros` restrict the pool, e.g. "a container that stocks everything" is just a list of
  every equipment ware. `requireblueprints` limits it to the player's blueprints. Returns a list, take `.{1}`
  (vanilla `md/setup_gamestarts.xml` L426-441 does this).
- `<export_loadout macro="…" loadout="…" id="…" name="…"/>`: "Export the loadout to the local loadouts.xml file".
- `<create_ship …><loadout><level exact="…"/><variation exact="0"/></loadout></create_ship>` builds a real ship
  with a generated loadout. `level`'s attributes are the usual `random` group (`exact`/`min`/`max`), plus `faction`.

**Reading equipment back in MD** (`libraries/scriptproperties.xml`): the `loadout` datatype only has
`.wares` (a warelist, no slots). A spawned ship gives `engines.all.list`, `shields.all.list`,
`weapons.all.list`, `turrets.all.list` (each item has `.macro`), `software.installed`, `units.table`, and
`.loadoutlevel`. So MD *can* log a spawned ship's equipment with `debug_to_file`. But `export_loadout`
is simpler, and it gives slot paths.

**Caveat (inference):** `generate_loadout` and `GenerateShipLoadout2` are probably the same engine generator,
but they get **different inputs**: a faction default-item pool vs. container/all-equipment. They should not be
assumed to give the menu's exact presets. Use the Lua route if "same as the ship configuration screen" matters.

## 4. Getting the results out

| Channel | How | Where it lands |
|---|---|---|
| Lua `DebugError(text)` | any UI Lua | the debug log, when the game runs with `-debug all -logfile <name>.log` (in the profile folder) |
| Lua `C.SaveLoadout2(macro, uiloadout, "local", id, overwrite, name, desc)` | the same call the menu's "save loadout" button makes (L1284) | `Documents/Egosoft/X4/<steamid>/loadouts.xml` |
| MD `<export_loadout>` | see §3 | "the local loadouts.xml file" (**inference:** the same profile file) |
| MD `<debug_to_file name="…" text="…"/>` | needs `-scriptlogfiles` | `Documents/Egosoft/X4/logs/` (the user's folder already has mod logs there) |

The profile `loadouts.xml` already holds SWI ships saved from the menu, in a format the pipeline can parse:

```xml
<loadout id="player_1745703918" name="Heroic" description="" macro="tie_defender_macro" player="1">
  <patches><patch extension="SW Interworlds" version="85" name="SW Interworlds"/></patches>
  <macros>
    <engine macro="heroes_engine_vader_macro" path="../con_engine_03"/>
    <weapon macro="weapon_nk3_s_laser_macro" path="../con_weapon_01"/>
    <shield macro="shield_s_novaldex60_macro" path="../con_shield_04"/>
    ...
  </macros>
  <ammunition><ammunition macro="countermeasure_flares_01_macro" exact="8"/> ...
```

That is the same schema as the game's own `libraries/loadouts.xml`, so **`SaveLoadout2` is the best export
channel**: no log parsing needed.

## 5. The in-game test (minimal mod)

Make a folder `<X4>/extensions/swi_preset_export/` (or the profile's `extensions/`) with four files.
**(inference)** The pattern is copied from SWI's own `ui.xml` and `ui/resourcelookup.lua`. Those also run
`ffi.cdef` with repeated typedefs (`UniverseID` twice), so re-declaring the menu's types is allowed.

`content.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<content id="swi_preset_export" name="SWI preset export" version="100" save="0">
  <dependency version="800"/>
  <dependency id="SW Interworlds" optional="false"/>
</content>
```

`ui.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<addon name="swi_preset_export" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="../../ui/core/addon.xsd">
  <environment type="menus">
    <file name="ui/preset_export.lua"/>
    <dependency name="ego_detailmonitorhelper"/>
    <dependency name="ego_detailmonitor"/>
  </environment>
</addon>
```

`md/preset_export.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<mdscript name="SwiPresetExport" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="md.xsd">
  <cues>
    <cue name="Run" instantiate="true">
      <conditions>
        <check_any>
          <event_game_started/>
          <event_game_loaded/>
        </check_any>
      </conditions>
      <delay exact="5s"/>
      <actions>
        <raise_lua_event name="'swiPresetExport'"/>
      </actions>
    </cue>
  </cues>
</mdscript>
```

`ui/preset_export.lua`. **Copy the `typedef struct` blocks for `UILoadoutWeaponSetting`, `UILoadoutAmmoData`,
`UILoadoutCrewData`, `UILoadoutGroupData2`, `UILoadoutMacroData2`, `UILoadoutSoftwareData`,
`UILoadoutVirtualMacroData`, `UILoadoutCounts2` and `UILoadout2` from SWI's `menu_ship_configuration.xpl` verbatim**
(base file L20-309; only these types are needed):

```lua
local ffi = require("ffi")
local C = ffi.C
ffi.cdef[[
  typedef uint64_t UniverseID;
  /* ... the typedefs listed above, verbatim ... */
  void GenerateShipLoadout2(UILoadout2* result, UniverseID containerid, UniverseID shipid, const char* macroname, float level);
  void GenerateShipLoadoutCounts2(UILoadoutCounts2* result, UniverseID containerid, UniverseID shipid, const char* macroname, float level);
  uint32_t GetNumAllShipMacros2(bool playerblueprint, bool customgamestart);
  uint32_t GetAllShipMacros2(const char** result, uint32_t resultlen, bool playerblueprint, bool customgamestart);
  bool IsSlotMandatory(UniverseID defensibleid, UniverseID moduleid, const char* macroname, bool ismodule, const char* upgradetypename, size_t slot);
  void SaveLoadout2(const char* macroname, UILoadout2 uiloadout, const char* source, const char* id, bool overwrite, const char* name, const char* desc);
]]

local levels = { { "minimum", 0 }, { "low", 0.1 }, { "medium", 0.5 }, { "high", 1.0 } }

local function slots(lo, cat)
  local out = {}
  for i = 0, lo["num" .. cat] - 1 do
    local e = lo[cat][i]
    out[#out + 1] = cat .. "#" .. tostring(e.slot) .. "=" .. ffi.string(e.macro)
  end
  return table.concat(out, ",")
end

local function run()
  local n = C.GetNumAllShipMacros2(false, false)
  local buf = ffi.new("const char*[?]", n)
  n = C.GetAllShipMacros2(buf, n, false, false)
  DebugError("SWIPRESET;BEGIN;" .. n)
  for i = 0, n - 1 do
    local macro = ffi.string(buf[i])
    for _, lv in ipairs(levels) do
      local lo = Helper.getLoadoutHelper2(C.GenerateShipLoadout2, C.GenerateShipLoadoutCounts2, "UILoadout2", 0, 0, macro, lv[2])
      C.SaveLoadout2(macro, lo, "local", "swipreset_" .. lv[1] .. "_" .. macro, true, "swipreset " .. lv[1], "")
      DebugError("SWIPRESET;" .. macro .. ";" .. lv[1] .. ";" .. slots(lo, "engines") .. ";" .. slots(lo, "shields")
        .. ";" .. slots(lo, "weapons") .. ";" .. slots(lo, "turrets") .. ";thruster=" .. ffi.string(lo.thruster.macro))
    end
  end
  DebugError("SWIPRESET;END")
end

RegisterEvent("swiPresetExport", run)
```

Run X4 with `-debug all -logfile swipreset.log`, start or load any SWI game, wait a few seconds, quit.
Then check:

1. `swipreset.log` has `SWIPRESET;BEGIN;<n>`, one line per ship and level, and `END`. Does `n` cover the SWI ships?
   (`GetAllShipMacros2(false, false)` = not limited to player blueprints, not limited to custom-gamestart ships.
   **(inference)** That means all buildable ship macros. If SWI ships are missing, replace the loop with a
   hard-coded macro list from our extractor.)
2. The profile `loadouts.xml` has `swipreset_*` entries.
3. **Spot check** one ship (e.g. `tie_defender_macro`): open it in the custom game start editor and pick
   Medium. It should match the `medium` line. Then compare with the same preset at a real SWI shipyard to see how
   much station stock changes it.
4. **Determinism:** run twice (or loop the same macro twice). Identical lines → no randomness.

If `SaveLoadout2` complains about the id or the overwrite (not documented), drop that line and use the log only.
The same file could also export which slots are mandatory, per ship, by calling `C.IsSlotMandatory(0, 0, macro,
false, "turret", slot)` for each slot index (**(inference)** that `defensibleid = 0` + macro works, as it does
for the generator).

## 6. Mandatory upgrades: the full rule with sources

From `helper.lua` (`Helper.upgradetypes`, ~L8487-8531):

| type | allowempty |
|---|---|
| `engine`, `enginegroup`, `thruster` | **false** (always mandatory) |
| `shield`, `weapon`, `turret`, `turretgroup`, `shieldgroup` | true |
| `missile`, `drone`, `deployable`, `countermeasure`, `software`, `crew` | true |

From `menu_ship_configuration.lua` (`menu.errors` builder, ~L7540-7600):

```lua
if data.macro == "" then
    allowempty = upgradetype.allowempty and (not C.IsSlotMandatory(menu.object, 0, menu.macro, false, upgradetype.type, slot))
...
if allowempty == false then
    if (menu.mode == "customgamestart") or (menu.mode == "comparison") then
        menu.criticalerrors[2] = ReadText(1001, 8020)
    else
        menu.errors[1] = menu.objectgroup and ReadText(1001, 8568) or ReadText(1001, 8020)
    end
```

plus the software check (`slotdata.defaultsoftware ~= 0` and slot empty → same text) and the captain check
(`menu.mode == "purchase" and not menu.captainSelected` → same text). The text: `{1001,8020}` = "Currently edited
ship is missing mandatory upgrades \(marked in red\)."; `{1001,8568}` is the plural form for ship groups.

Where `IsSlotMandatory` gets its answer: an engine function. The only data-side marker found is the
**`mandatory` word in a connection's `tags`** in ship component XMLs:

- vanilla: `ship_gen_m_tugboat_01.xml` (`con_turret_01..` `tags="turret medium mandatory …"`),
  `ship_kha_l_destroyer_01.xml`, `ship_kha_xl_battleship_01.xml` (`weapon … mandatory`);
- SWI (`ext_01.cat`, 232 unit component files checked): only `assets/units/size_s/quad_jumper.xml`
  (one turret connection).

Default software comes from the ship **macro**: `<software><software ware="…" default="1"/>…</software>`
(e.g. `ship_arg_s_fighter_01_a_macro.xml`: flight assist, long-range scanner, object scanner, targeting).
`IsSoftwareDefault(object, macro, ware)` reads it.

**For the ship builder:** a build is "missing mandatory upgrades" if any engine slot (or engine group) or the thruster
is empty, or a `mandatory`-tagged slot is empty, or a default-software slot is empty. All of that can be
derived from data files we already extract. No game run is needed for this part.
