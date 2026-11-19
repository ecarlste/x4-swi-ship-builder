# Preset export (throwaway)

A test mod plus scripts for [Run the preset-export test mod in game](https://github.com/ecarlste/x4-swi-ship-builder/issues/17).
It asks X4 for the ship configuration menu's Minimum/Low/Medium/High presets for every ship and logs them.
This branch is a primary source for that ticket. It is never merged.

**Result** ([resolution](https://github.com/ecarlste/x4-swi-ship-builder/issues/17#issuecomment-7017329850)): the export works for every buildable ship, but Low/Medium/High are random, in the game's own menu too.
Whether v1 uses presets anyway is [Should v1 offer loadout presets when the game's presets are random?](https://github.com/ecarlste/x4-swi-ship-builder/issues/21).
The mod's design and the API it calls come from [the research](https://github.com/ecarlste/x4-swi-ship-builder/blob/research/x4-preset-loadout-export/docs/research/x4-preset-loadout-export.md).

## What's here

| File | What it does |
|---|---|
| `mod/` | The extension: `content.xml`, `ui.xml`, an MD cue that fires 5 s after a game starts or loads, and the Lua as a template |
| `install.mjs` | Copies the mod into `<X4>/extensions/swi_preset_export`, filling in the Lua's FFI declarations from your SWI install. `--uninstall` removes it |
| `analyse.mjs` | Reads the log: ship coverage and how pass 1 and pass 2 differ (exact, slot order only, same price, different price) |
| `catalog.mjs` | Minimal `.cat`/`.dat` reader shared by both scripts |

**SWI's code isn't in this repo.** The Lua needs SWI's `UILoadout2` FFI types and five engine function declarations
(`GenerateShipLoadout2`, `GenerateShipLoadoutCounts2`, `GetNumAllShipMacros2`, `GetAllShipMacros2`, `SaveLoadout2`).
`install.mjs` copies them, by name, from your own `ui/addons/ego_detailmonitor/menu_ship_configuration.xpl`
in `extensions/starwarsmod_m1/subst_*.cat`.

## Running it

Needs Node 22+ and an X4 8.00 install with SWI 0.9.1 HF. The paths below are the dev machine's (WSL).

```bash
node tools/preset-export/install.mjs "/mnt/e/SteamLibrary/steamapps/common/X4 Foundations - 8.00"
```

1. In X4's Extensions menu, turn off everything that isn't core SWI or its DLCs (Reaper's Ship Pack, third-party add-ons). Check that "SWI preset export" is on.
2. Start X4 with a log file (launch options `-debug all -logfile debuglog.txt`), then start or load any SWI game.
3. Wait for `SWIPRESET;END` in the log (about 2 minutes for 226 ships), then quit. The log is in `Documents/Egosoft/X4/`.

```bash
node tools/preset-export/analyse.mjs "/mnt/c/Users/<you>/OneDrive/Documents/Egosoft/X4/debuglog.txt" "/mnt/e/SteamLibrary/steamapps/common/X4 Foundations - 8.00" --list
```

```bash
node tools/preset-export/install.mjs "/mnt/e/SteamLibrary/steamapps/common/X4 Foundations - 8.00" --uninstall
```

Each ship × level is generated twice (`P1`, `P2`) to show the randomness. Only `P1` is saved to the profile's `loadouts.xml`,
as `swipreset_<level>_<macro>`. The log and that file are Game Data: don't commit them here.

## What the mod logs

One line per ship, level and pass:

```
SWIPRESET;P1;<ship macro>;<minimum|low|medium|high>;engines[<slot>=<macro>,…];thruster[<macro>];shields[…];weapons[…];turrets[…];shieldgroups[<group>x<count>=<macro>,…];turretgroups[…];ammo[<macro>x<amount>,…];units[…];software[<ware>,…]
```

plus `SWIPRESET;BEGIN;<ship count>`, `SWIPRESET;END`, and `SWIPRESET;ERROR;…` for any ship and level that failed.
