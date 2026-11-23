# Where the game names Software Families

Research for #135 (spec #122, feature 5). It answers where each Software Family's name comes from, how a family is tied to its wares, whether every family in the current Game Data has a name, and whether SWI changes any of it.

Sources: X4 8.00 base catalogs (`01.cat`–`09.cat`), the DLC extensions, and SWI 0.9.1 HF (`extensions/starwarsmod_m1`), read straight from the `.cat`/`.dat` archives, plus the merged files in `.cache/extract/files` and the Snapshot `game-data/091_x4-800`. Line numbers are for the X4 8.00 / SWI 0.9.1 HF files.

## Summary

- **The name is the ware's `factoryname` attribute** in `libraries/wares.xml`. It points to a text entry on page 20108 ("Software", section `(*Software Slots*)`).
- **The buy screen uses it as the group heading.** It reads `factoryname` from the first ware in the group. It doesn't use the ware's `group`, its tags or a hard-coded string.
- **A family is a `<software predecessor>` chain.** The game makes one software slot per chain and lists the chain's wares, oldest first. This is the same chain the extraction already reads.
- **All six families in the current Game Data have a name.** On every Ship, every ware in a family has the same `factoryname`.
- **SWI doesn't override or add any of it.** It doesn't change the software wares, page 20108, the "Mandatory" text, or the buy screen's software code.

## 1. The six names

Each family's wares carry `factoryname="{20108,NNN}"` in `libraries/wares.xml` (X4 base, `01.cat`). That id points to a text entry in `t/0001-l044.xml` (English), on `<page id="20108" title="Software" descr="Names and descriptions of ship software">` (line 54324). The entries sit under the comment entry `{20108,100}` "(\*Software Slots\*)".

| Family name (`t/0001-l044.xml`) | Text id | Wares with that `factoryname` (`libraries/wares.xml` line) |
|---|---|---|
| Docking Software | `{20108,161}` | `software_dockmk1` (12750), `software_dockmk2` (12756) |
| Flight Assist Software | `{20108,151}` | `software_flightassistmk1` (12767) |
| Long Range Scanner Software | `{20108,111}` | `software_scannerlongrangemk1` (12781), `software_scannerlongrangemk2` (12788) |
| Object Scanner Software | `{20108,101}` | `software_scannerobjectmk1` (12806), `software_scannerobjectmk2` (12813) |
| Targeting Software | `{20108,141}` | `software_targetmk1` (12829), `software_targetmk2` (12835) |
| Trading Software | `{20108,131}` | `software_trademk1` (12839), `software_trademk2` (12845), `software_trademk3` (12849) |

The same page has names for families that aren't in the Game Data: Mining Scanner Software `{20108,121}`, Economy Software `{20108,171}` and Spacesuit Software `{20108,181}`.

A ware's own name is a different attribute, `name`. For example, `software_dockmk1` has `name="{20108,4011}"` "Docking Computer Mk1". Its `factoryname` is the family's name.

The "Mandatory" label beside a group heading is `ReadText(1001, 8047)`. It's `{1001,8047}` "Mandatory" in `t/0001-l044.xml`, line 1846.

## 2. How the buy screen builds and labels a family

The source is `ui/addons/ego_detailmonitor/menu_ship_configuration.lua` (X4 base, plain Lua).

1. **Slots come from the engine.** `C.GetSoftwareSlots(buf, n, object, macro)` (declared at line 608) returns one `SoftwareSlot { const char* max; const char* current; }` (lines 170–173) per software slot on the Ship. `max` is the latest ware in the chain that the Ship can fit. The engine builds this list, so the Lua doesn't show how. The Ship macro's `<software>` list is the only per-Ship input, which is what the extraction reads (`extract/equipment.ts`, around line 126).
2. **The engine expands the chain.** In "assemble possible software per slot" (lines 4272–4305), `C.GetSoftwarePredecessors(buf, n, software.maxsoftware)` (line 607) lists the predecessors of `max`, and `max` is appended last, forming `possiblesoftware`. The call takes only a ware id, not the Ship, so the chain comes from the wares' `<software predecessor="…"/>` elements. `C.IsSoftwareDefault(object, macro, ware)` marks the mandatory one and sets `defaultsoftware` to its index.
3. **The heading is the first ware's `factoryname`.** `menu.displaySoftwareSlot` (lines 4669–4688):

   ```lua
   local name = GetWareData(slotdata.possiblesoftware[1], "factoryname")
   ...
   if slotdata.defaultsoftware ~= 0 then
       row[1]:setColSpan(7):setBackgroundColSpan(11):createText(name, menu.subHeaderTextProperties)
       ...
       row[8]:setColSpan(4):createText(ReadText(1001, 8047), menu.subHeaderTextProperties)  -- "Mandatory"
   else
       row[1]:setColSpan(11):createText(name, menu.subHeaderTextProperties)
   end
   ```

   The rows under the heading are `GetWareData(software, "name")` for each ware with `i >= slotdata.defaultsoftware` (lines 4690–4716).
4. **One group per slot.** The software tab calls `displaySoftwareSlot` once for each slot that has at least one ware, with a blank row between groups (lines 6045–6057).

`possiblesoftware[1]` is the chain's oldest ware. Two things show this: the predecessors are added before `max`, and the screen hides the wares before the default (`i >= defaultsoftware`). This is inferred from the Lua; the engine's ordering isn't visible.

In read-only mode, `possiblesoftware` keeps only the fitted ware (lines 4282, 4294), and the heading then comes from that ware. In the current data that gives the same name, because every ware in a chain has the same `factoryname` (section 3).

**For extraction:** a family is a chain of `predecessor` links, which the extraction already keeps for each software ware (`extract/equipment.ts`, `predecessorOf`, line 106). Its name is the `factoryname` of the chain's oldest ware, resolved through the merged text. `group="software"` and the tags are the same for every family, so they can't tell families apart. The Snapshot doesn't keep `factoryname` today: `game-data/091_x4-800/equipment.json` software entries have only `name`/`nameId` and `predecessor`.

## 3. Every family in the current Game Data has a name

Checked against `game-data/091_x4-800` (210 Ships, nine software wares) and the merged `.cache/extract/files/libraries/wares.json`.

| Family (chain's oldest ware) | `factoryname` | Ships whose fit list has it | Mandatory on |
|---|---|---|---|
| `software_dockmk1` | `{20108,161}` Docking Software | 210 | 2 |
| `software_flightassistmk1` | `{20108,151}` Flight Assist Software | 210 | 210 |
| `software_scannerlongrangemk1` | `{20108,111}` Long Range Scanner Software | 210 | 209 |
| `software_scannerobjectmk1` | `{20108,101}` Object Scanner Software | 210 | 206 |
| `software_targetmk1` | `{20108,141}` Targeting Software | 209 (not the TIE Phantom, `tie_phantom`) | 49 |
| `software_trademk1` | `{20108,131}` Trading Software | 210 | 86 |

- **No family lacks a name.** On every Ship's software fit list, every ware has the same `factoryname` as its chain's oldest ware.
- **Many fit lists leave out a chain's oldest ware.** This happens on 164 Ships: 158 have `software_dockmk2` without `dockmk1`, 18 have `scannerlongrangemk2` without `mk1`, and 5 have `scannerobjectmk2` without `mk1`. The family and its name are still found from the chain in the Game Data, because each ware's predecessor is in `equipment.json`. The extraction ticket shouldn't take the name from the first ware on the Ship's fit list and assume it's the chain's oldest. Use the `factoryname` of any ware in the family, which is the same for all of them, and check that they agree.
- **One ware breaks the rule, but it isn't in the Game Data.** `software_scannerobjectmk3` (line 12821) continues the Object Scanner chain (`predecessor="software_scannerobjectmk2"`) but has `factoryname="{20108,181}"` Spacesuit Software. It's a spacesuit upgrade (`transport="inventory"`, tag `personalupgrade`) and isn't on any Ship's fit list, so it isn't in the Game Data.
- **A family without a name isn't handled by the game.** `displaySoftwareSlot` uses whatever `GetWareData(…, "factoryname")` returns and has no fallback. What the engine returns for a ware without `factoryname` isn't visible in the files. Nothing in the current data hits this, so spec #122's rule (fail extraction and name the family) has nothing to fail on today.

## 4. SWI doesn't override or add names

- **Wares:** SWI's `libraries/wares.xml` (`starwarsmod_m1/ext_02.cat`) is a `<diff>` with no selector or added ware mentioning `software`. Its only selectors that aren't by id are `add sel="/wares/production"` and `add sel="/wares"`, and none of the wares they add is a software ware. The merged wares have exactly the base X4 software wares. The only DLC change is `ego_dlc_pirate/libraries/wares.xml` (lines 1575–1604), which adds a `<production method="closedloop">` to ten software wares and leaves `factoryname` alone.
- **Text:** none of SWI's `t/*.xml` files has a `<page id="20108">`. Their `<page id="1001">` (such as `t/0001.xml` line 6294) has no `<t id="8047">`, so the base names and "Mandatory" stand.
- **Buy screen:** SWI replaces `ui/addons/ego_detailmonitor/menu_ship_configuration.xpl` with plain Lua (Kuertee's UI Extensions). Its `menu.displaySoftwareSlot` (line 4714) is the same as the base function line for line, including the `factoryname` lookup (line 4716). Its predecessor expansion (line 4316) is also unchanged. Its other differences are UIX callback hooks, none of them in the software code.

## Reproducing

The base Lua and text aren't in `.cache/extract/files`, which holds only what the extraction needs. To read them, pull `ui/addons/ego_detailmonitor/menu_ship_configuration.lua`, `libraries/wares.xml` and `t/0001-l044.xml` from `$X4_INSTALL_DIR/0?.cat`. Each `.cat` line is `path size mtime md5`, and the files sit back to back in the matching `.dat` in that order. For SWI's copies, pull from `$X4_INSTALL_DIR/extensions/starwarsmod_m1/ext_0?.cat`.
