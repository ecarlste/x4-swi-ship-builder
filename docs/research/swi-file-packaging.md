# How SWI's game files are packaged and layered over X4

Research for issue #2 (child of the wayfinder map, #1). Researched 2026-11-16.

**Sources.** The main source is the local install at
`/mnt/e/SteamLibrary/steamapps/common/X4 Foundations - 8.00`, read-only, called `<X4>` below.
Facts were read straight from its files (`content.xml`, `.cat` indexes, files extracted from `.dat`s,
`libraries/diff.xsd`). Web sources are the official Egosoft wiki (Modding Support pages) and SWI's own
site and Nexus page. Third-party write-ups (x4cat reference, forum threads) were only used as leads.
Anything marked **(inference)** is my reading, not something a source states.

## Answer in brief

- **Official SWI release = one extension: `extensions/starwarsmod_m1`** (content id `SW Interworlds`,
  version `091` = "Star Wars 0.9.1 HF", dated 2025-12-24). `starwars_rsp` ("Reaper's Ship Pack (SWI)",
  author Reaperxvii) is a **separate add-on** that depends on SWI. It is not part of the SWI release.
- **Archives are trivial to read**: `.cat` is a text index (`path size mtime md5` per line), `.dat` is
  the file bodies concatenated in index order. No compression, encryption or header.
- **Layering**: the game builds each data file from the base game, then each enabled extension in
  dependency order. A file whose root is `<diff>` is an XML patch (RFC 5261-style `add`/`replace`/`remove`
  with an XPath subset). A file with a normal root (`<ships>`, `<loadouts>`, `<index>`, ...) **merges its
  entries** into the collection. `subst_*` catalogs replace files outright.
- **SWI needs** X4 **8.00** (`<dependency version="800"/>`, a minimum) plus five DLCs: Split Vendetta,
  Cradle of Humanity, Tides of Avarice, Kingdom End, Timelines. "8.00.01" is not an Egosoft version name:
  8.00 patches are called "8.00 Hotfix N". SWI's page says "0.91 HF1 for X4 8.0". X4 9.00 is already
  out, so **a pinned 8.00 install matters**.
- **TypeScript/Node can do all of it.** A throwaway Node prototype (`@xmldom/xmldom` + `xpath`) read
  the catalogs straight from the install. It applied all 2,531 diff operations for `libraries/wares.xml`
  across 7 DLCs + SWI + RSP, and every non-`silent` selector matched. That prototype was slow
  (~165 s for wares.xml), so the real pipeline needs a faster selector strategy.

## 1. What is in the install

`<X4>/version.dat` = `800`. `<X4>/extensions/` holds:

| Folder | content.xml id | What it is |
|---|---|---|
| `ego_dlc_split`, `ego_dlc_terran`, `ego_dlc_pirate`, `ego_dlc_boron`, `ego_dlc_timelines` | same as folder | Egosoft DLCs that SWI requires |
| `ego_dlc_mini_01`, `ego_dlc_mini_02` | same as folder | Egosoft mini-DLCs (Hyperion Pack; and, judging by its 2025-09-10 date, the Envoy Pack released with 8.00). SWI does not depend on them, but it ships overrides for some of their files (§4) |
| `starwarsmod_m1` | `SW Interworlds` | **SWI itself** |
| `starwars_rsp` | `Reaper's Ship Pack (SWI)` | Third-party ship add-on for SWI |
| `mycu_equipment_tooltips` | `EquipmentTooltips` | Third-party UI mod (depends on SWI) |
| `apirateslife`, `apirateslife_tests` | | The user's own mod and its test harness |

So the "8.00" install is not quite clean: it also has three non-SWI mods. A pipeline should pick
extensions by id/folder from an allow-list, never "everything in `extensions/`".

### SWI's `content.xml` (`<X4>/extensions/starwarsmod_m1/content.xml`)

```xml
<content id="SW Interworlds" name="SW Interworlds" description="Star Wars 0.9.1 HF"
  author="MikSa Shuulo Elratie Kuertee Lok Land" version="091" date="2025-12-24" save="1" enabled="0">
  <dependency version="800" />
  <dependency id="ego_dlc_split" optional="false" name="Split Vendetta"/>
  <dependency id="ego_dlc_terran" optional="false" name="Cradle of Humanity"/>
  <dependency id="ego_dlc_pirate" optional="false" name="Tides of Avarice"/>
  <dependency id="ego_dlc_boron" optional="false" name="Kingdom End"/>
  <dependency id="ego_dlc_timelines" optional="false" name="Timelines"/>
```

- The id has a space and differs from the folder name. Other extensions depend on `"SW Interworlds"`.
- `enabled="0"` as shipped: the player turns it on in game. A pipeline should ignore `enabled`
  (the wiki says the game writes that attribute and it should not be hand-edited).
- `<dependency version="800"/>` with no id means "minimum game version 8.00" (Egosoft wiki, *Anatomy
  of an extension*). It does not cap the version, so it does not prove SWI 0.91 is unsafe on 9.00.
  SWI's own release notes target 8.0 (§6).

### SWI's files on disk

```
starwarsmod_m1/
  content.xml            loose (always loose, per wiki)
  ui.xml, ui/*.lua       loose UI Lua add-ons (not game data)
  ext_01.cat/.dat        26,630 files, 18.2 GB: assets (ship/equipment macros & components,
                         models, textures, sounds), index/macros.xml, index/components.xml,
                         93 overrides of DLC files under extensions/ego_dlc_*/
  ext_02.cat/.dat        345 files, 20.8 MB: libraries/*.xml, md/, aiscripts/, t/ (text)
  subst_01.cat/.dat      513 files: replacement voice files and loading-screen textures
  subst_02.cat/.dat      20 files: replacement compiled UI menus (ui/addons/ego_*/*.xpl)
  subst_03.cat/.dat      20 files: replacement loading screens incl. extensions/ego_dlc_timelines/...
```

ext_01 and ext_02 have no paths in common. **All game data the ship builder needs comes from `ext_01`
(macros, components, index) and `ext_02` (libraries, text).** The `subst_*` catalogs hold no data XML.

SWI also packs junk that the game never reads by name, such as `libraries/backup/*.xml`,
`libraries/backup/ships civs.xml`, `md/temp/*.xml`, `t/tmp/*.xml` and `* - Copy` assets. The game
loads library files by fixed names like `libraries/wares.xml` **(inference)**, so the pipeline must
read only the canonical paths and never glob `libraries/**`.

### `starwars_rsp`

```xml
<content id="Reaper's Ship Pack (SWI)" author="Reaperxvii" version="208" date="2026-7-18" save="0" enabled="1">
  <dependency id="SW Interworlds" name="SW Interworlds" optional="false" version="091"/>
```

One `ext_01` catalog (366 files): 31 ships' macros/components, weapons, `index/macros.xml`,
`index/components.xml` (diffs adding `extensions\starwars_rsp\...` entries), and `libraries/` diffs
(`wares`, `ships`, `loadouts`, `shipgroups`, `jobs`, `icons`, `sound_library`), plus `md/` and `t/0001.xml`.
Its wares diffs patch wares that **SWI** adds (e.g. `//wares/ware[@id='engine_venator_xl']`), so it must
apply after SWI. SWI's site names only the `starwarsmod_m1` folder ("A starwarsmod_m1 folder should
appear in the extensions folder"). Search results credit an SWI ship pack on Nexus (mod 1321) to
Reaperxvii, and a DABC SWI expansion lists "Reaper's Ship Pack" as a separate install. So RSP is a
community add-on, not core SWI. **Whether v1 includes it is a scope decision for the map** (see Open
questions).

## 2. The cat/dat archive format

Confirmed from the files and from the Egosoft wiki pages *X Catalog Tool* and *Anatomy of an extension →
Catalogs*:

- `.cat`: UTF-8 text, one line per file: `<path> <size> <unix mtime> <md5 hex>`. Paths can contain
  spaces (SWI has `assets/interiors/rooms/room_imp_m_buildmodule_01 - BKUP.xml`), so **parse the last
  three space-separated fields and treat the rest as the path**. Entries are sorted by lowercased path,
  but the original case is kept. A zero-byte file has an all-zero hash. A deletion marker has size 0 and mtime 0.
- `.dat`: the bodies concatenated in index order, "with no header, padding, compression, or per-entry
  markers". Each entry's offset is the sum of the earlier sizes. I checked this on every SWI and RSP
  catalog: the sizes add up to exactly the `.dat` length, and every extracted file's MD5 matched.
- `.dat` files can be large (SWI `ext_01.dat` is 18.2 GB). Use positioned reads (`fs.read` with a position;
  safe up to 2^53), never whole-file loads.
- `_sig.cat/_sig.dat`: Egosoft signatures. Ignore them.
- Paths are case-insensitive in practice: an extension may write `assets/props/Engines/...` for a base
  file (base catalogs and SWI mostly agree on case). Use lowercased keys.

**Which catalogs are loaded, and override order:**

- Base game: `<X4>/01.cat` upwards, stopping at the first missing number. **A later number overrides an
  earlier one** for the same path. This install has `01`–`09`. `libraries/wares.xml`, `ships.xml`,
  `loadouts.xml`, `index/macros.xml` and `diff.xsd` all live in `08.cat`.
- Extension `ext_NN.cat`: paths are relative to the extension folder. The catalog is "the extension folder
  in packed form and nothing more", so its entries behave like loose files and are merged or patched.
  `ext_v###.cat` applies only to one game version. **New in 9.00:** `ext_NN_diff_v###.cat` layers over
  `ext_NN` from that version up (not used by SWI 0.91).
- Extension `subst_NN.cat` / `subst_v###.cat`: paths are relative to the **game root**. "Nothing is merged
  and nothing is patched, so a substitute has to be a complete, valid file of its kind." A subst entry can
  also target another extension as `extensions/<folder>/<path>` (SWI's `subst_03` does this for Timelines
  loading screens).
- Loose file vs packed: "When a catalog and a loose file hold the same path, the packed copy wins."

## 3. How an extension file joins the game

From the Egosoft wiki (*Anatomy of an extension → How a file joins the game*), checked against the game's
own `libraries/diff.xsd` (in `08.cat`) and against what the DLCs and SWI actually ship:

1. **`<diff>` root = patch.** The file is "a list of changes to apply to whatever is already there,
   expressed as XPath selections". `diff.xsd` defines exactly three operations:
   - `<add sel=... [pos="before|after|prepend"] [type="@attr"] [if=...] [silent="true"]>`. No `pos`
     means append as the last child. `type="@name"` adds an attribute whose value is the element text.
   - `<replace sel=... [if] [silent]>`: replaces an element with its single child element, or sets an
     attribute or text node to its text.
   - `<remove sel=... [if] [silent]>`.
   - `sel` is a restricted XPath: steps with `[@a='v']`, `[child='v']`, `[n]` predicates, `//`, `*`,
     `text()`, `@attr`, and the functions `not()`, `boolean()`, `position()`, `last()`, `name()`, `root()`.
     SWI uses `pos` (354×), `type="@..."` (106×), `silent` (15×) and `not()` (2×). It never uses `if`.
     The same semantics are standardised as RFC 5261 (XML Patch), and `diff.xsd` follows its shape.
2. **Ordinary root (`<ships>`, `<loadouts>`, `<index>`, `<groups>`, `<macros>`, ...) = collection merge.**
   It "contributes its contents to a collection gathered from every source" and does not erase anything.
   **The DLCs rely on this heavily**: every DLC's `libraries/ships.xml`, `loadouts.xml`, `shipgroups.xml`,
   `index/macros.xml` and `index/components.xml` is a plain collection file, not a diff, while their
   `libraries/wares.xml` is a diff. SWI uses `<diff>` for almost every library and index file (269 of 271
   in `ext_02`). Its exceptions are `libraries/macro.xml` and `stances.xml`.
3. **Whole-file replacement**: Lua, textures, models, and files placed in `subst_*`.
4. **Asset XML (ship and equipment macros/components)**: a new file at a new path is reached through
   `index/macros.xml` / `index/components.xml`. An entry maps a macro name to a path without `.xml`,
   with backslashes, e.g. `<entry name="servator_macro" value="extensions\starwars_rsp\assets\units\size_xl\macros\servator_macro"/>`.
   An extension can also ship a file at the **same path as a base file**. SWI's `ext_01` has 366 paths
   that also exist in the base catalogs. Of 40 sampled unit/prop macros, 34 have `<diff>` roots
   (patching base equipment, e.g. `assets/props/SurfaceElements/macros/shield_xen_m_standard_01_mk1_macro.xml`)
   and 6 have full `<macros>` roots. The wiki says mirroring a path "works when the target file holds its
   own data, such as a whole macro file". So a full macro at a base path **replaces** that file
   **(inference from the wiki wording; not tested in game)**.

**Patching a DLC or another extension.** Put the file under `extensions/<their folder>/<path>` in your own
extension. SWI does this 93 times in `ext_01`, all for DLC assets and `md/` scripts (split 26, terran 42,
pirate 11, timelines 6, boron 3, mini_02 3, mini_01 2). When the target is itself a patch, the wiki says
to patch the base path instead and declare a dependency so the target loads first. "The selection must
match the document as it exists after the other extension's patch."

**Text.** `t/0001-lNNN.xml` is language NNN (44 = English). `t/0001.xml` "has no language suffix and is
used for every language", and per-language files take precedence. SWI ships `t/0001.xml` as
`<diff><add sel="/language">...` (its English, and the default for every language), plus `-L007`, `-L033`,
`-L049` and `-L086` files. The base game has no `t/0001.xml`, so the pipeline must apply SWI's
`t/0001.xml` on top of the chosen base `t/0001-l044.xml`. Text is referenced as `{page,id}`.

## 4. Load order

- "The game loads dependencies before the extension that declares them." Dependencies name the target's
  **content.xml id**, not its folder. `optional="true"` only sets order.
- The DLC content.xml files form a chain through optional dependencies:
  split → terran → pirate → boron → timelines → mini_01 → mini_02.
- SWI hard-depends on split, terran, pirate, boron and timelines, so it loads after those five. It has
  **no** dependency on `ego_dlc_mini_01` / `mini_02`, and they have none on SWI. The wiki does not say how
  ties are broken, so **their order relative to SWI is unspecified** (see Open questions). It matters:
  SWI's `ships.xml` does `<replace sel="//ships">` (wiping every job/ship-group entry gathered so far), and
  its `wares.xml` has 1,015 `<remove>`s of base and DLC wares. Whatever loads after SWI survives those.
- RSP depends on `SW Interworlds`, so it loads after SWI.

Pipeline order to use (deterministic: topological sort by id, ties by folder name):
`base 01..09` → `ego_dlc_split` → `ego_dlc_terran` → `ego_dlc_pirate` → `ego_dlc_boron` →
`ego_dlc_timelines` → `ego_dlc_mini_01` → `ego_dlc_mini_02` → `starwarsmod_m1` → (`starwars_rsp`).
Within one extension, `ext_01`, `ext_02`, ... in number order.

## 5. Can a TypeScript/Node tool do this? Yes. Prototype results

I built a ~120-line throwaway Node 26 ESM script in a scratch directory (not committed). It used
`@xmldom/xmldom@0.8.10` and `xpath@0.0.34`. It:

1. parses `.cat` files as above and reads entries from the `.dat` by offset (no extraction to disk),
2. takes the last base catalog that holds a path, then walks extensions in dependency order,
3. applies `<diff>` files (add with pos/type, replace, remove, silent, if) and appends the children of
   collection-root files.

Results on this install:

| File | Base + 7 DLCs | + SWI + RSP | Notes |
|---|---|---|---|
| `libraries/wares.xml` | 729 diff ops, 0 failed | 2,531 ops; 5 unmatched, **all `silent="true"`** | 291 `transport="ship"` wares after layering; removed base wares (e.g. `module_tel_prod_teladianium_01`) are gone |
| `libraries/ships.xml` | 376 `<ship>` entries (DLCs merge as collections) | 503 | SWI's `replace //ships` wipes base + DLC entries, then RSP adds |
| `libraries/loadouts.xml` | 246 | 261 | SWI and RSP each `add` to `//loadouts` |

What this shows:
- Catalog reading and both merge modes work in plain Node with no native modules.
- SWI's selectors fit the XPath 1.0 subset that the `xpath` npm package supports.
- **Performance needs care**: `wares.xml` took ~165 s, because each of ~1,800 SWI ops runs a full XPath
  scan over a ~5 MB DOM. Fixes for the pipeline design: fast-path the common `/wares/ware[@id='x']` shape
  with an id index, or use a faster engine (e.g. a libxml2 binding). Either way it is a one-off build step,
  so this is not a blocker.
- Not checked in the prototype: patching asset macro files (`<diff>` on `assets/...`), `extensions/<dlc>/`
  path overrides, `subst_*`, and text files. These use the same mechanisms.

Prior art to consult when designing the pipeline (not checked in depth): Egosoft's **X Catalog Tool**
(official, Windows; can also unpack everything for a cross-check), **X4 Customizer** (Python, implements
diff patching), **x4cat** (Python CLI) and **X4CatSuite**.

## 6. Which X4 version SWI targets

- SWI content.xml: `version="091"`, `description="Star Wars 0.9.1 HF"`, `date="2025-12-24"`,
  `<dependency version="800"/>`.
- SWI's Nexus page (mod 349; seen via search snippet, since the page returns 403 to automated fetches):
  "X4 SW Interworlds 0.91 HF1 for X4 8.0", uploaded 24 Dec 2025, 7.1 GB. Requires Split Vendetta,
  Cradle of Humanity, Tides of Avarice, Kingdom End and Timelines. Works only with saves from 0.90/0.91.
  There is also an optional "Imperial Control Center Lag Hotfix" (3 Jan 2026), a separate download.
  **That optional hotfix is not in this install (inference: no extra extension folder).** Whether it
  changes any ship or equipment data is unknown.
- SWI site: "YOU NEED ALL DLCs for the mod to work". Install by extracting into `X4 Foundations/extensions`.
- Egosoft releases 8.00 patches as "8.00 Hotfix 1..4" (HF4 Feb 2026). **"8.00.01" is not a real
  version label**, and `version.dat` reads `800` for the whole 8.00 line **(inference)**, so the install
  cannot show which hotfix it has. 9.00 has shipped (GOG changelog "8.00 Hotfix 4 ⇒ 9.00",
  dated 11 June 2026). The user's other install has `version.dat` = `900`, and its Steam manifest uses
  beta branch `9.00`.
- Conclusion: **the latest SWI (0.91 HF1) targets X4 8.00, with no specific hotfix pinned**. The initial
  concept's "8.00.01" should read "8.00 (latest hotfix)".

## Open questions for the map

1. **Is `starwars_rsp` (Reaper's Ship Pack) in v1 scope?** It is a third-party add-on, not core SWI. The
   map says core SWI only, but the 8.00 install was described as "SWI (`starwarsmod_m1`, `starwars_rsp`)".
2. **Mini-DLC order and inclusion.** `ego_dlc_mini_01`/`mini_02` have no dependency link to SWI, so their
   order relative to SWI is unspecified. They decide whether Hyperion / mini-pack ships and wares survive
   SWI's wipe. Does a real SWI game include them? This could be checked in game, or by asking the SWI team.
3. **Collection-merge details.** What happens when a collection file adds an entry whose id already exists,
   and does merging happen before later extensions' diffs (the prototype assumes yes)? The wiki is silent.
   It affects `ships.xml`, `loadouts.xml` and `index/*.xml`.
4. **Full-file macro at a base path = replace?** This follows from the wiki wording but is not tested. It
   decides how ~6+ SWI equipment macros resolve.
5. **"Buildable" may depend on more than files.** SWI removes/re-adds wares and rewrites ships.xml, jobs
   and god.xml. Which ships are buildable is a Game Data modelling question for the extraction ticket(s),
   not a packaging one, but it builds on this layering.
6. **Redistribution.** Extracted data comes from SWI's own catalogs, so licensing matters (a separate map
   item already covers it).

## Sources

- Local, read-only: `<X4>/version.dat`, `<X4>/extensions/*/content.xml`, `<X4>/0[1-9].cat`,
  `<X4>/extensions/starwarsmod_m1/{ext_01,ext_02,subst_01..03}.cat`, `<X4>/extensions/starwars_rsp/ext_01.cat`;
  extracted `libraries/diff.xsd` (base `08.cat`), SWI/RSP/DLC `libraries/*.xml`, `index/*.xml`, `t/*.xml`.
- Egosoft wiki, *X Catalog Tool*: https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/X%20Catalog%20Tool
- Egosoft wiki, *Anatomy of an extension*: https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/Anatomy%20of%20an%20extension/
- Egosoft wiki, *Anatomy of an extension → Catalogs*: https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/Anatomy%20of%20an%20extension/Catalogs/
- SWI site, install page: https://sites.google.com/view/swinterworlds/Home
- SWI site, changelog (latest entry 0.86, out of date): https://sites.google.com/view/swinterworlds/roadmap-and-changelog
- SWI on Nexus (403 to automated fetch; facts from search snippet): https://www.nexusmods.com/x4foundations/mods/349?tab=files
- Seen via search results only: Egosoft forum, 8.00 release: https://forum.egosoft.com/viewtopic.php?p=5290423 ; GOG changelog (8.00 HF4 ⇒ 9.00): https://www.gogdb.org/product/1588366064
- RFC 5261, XML Patch Operations: https://www.rfc-editor.org/rfc/rfc5261
