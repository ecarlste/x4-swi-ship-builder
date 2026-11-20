# X4: SWI Ship Builder

A web app for configuring the equipment on ships from the Star Wars Interworlds (SWI) mod for X4: Foundations. See `GLOSSARY.md` for the domain terms.

## Game Data

The app bundles one Game Data snapshot at build time. By default it reads `game-data/current`, which the extraction writes and which is gitignored: SWI content is never committed. To use another snapshot, set `GAME_DATA_DIR` when you run Vite. For example, this uses the tiny hand-made fixture:

```bash
GAME_DATA_DIR=fixtures/game-data/tiny npm run dev
```

`npm run dev` and `npm run build` fail with a clear message if there's no snapshot.

`src/gameData.ts` is the app's only entry point to Game Data. It checks the snapshot against the shared zod schema and reference-integrity pass in `shared/game-data/`.

## Extraction

`npm run extract` reads Game Data from a local X4 8.00 + SWI install. Give it the install folder with `--x4`, or set `X4_INSTALL_DIR` in a gitignored `.env`:

```bash
npm run extract -- --x4 "/path/to/X4 Foundations"
```

It reads SWI's `extensions/starwarsmod_m1/content.xml` and checks its dependencies against `expectedDependencies` in `extract/config.ts`. If SWI adds or drops a dependency, extraction stops until the config is updated on purpose. It then reads base X4, the DLCs SWI depends on and SWI itself, in load order. Mini-DLCs, Reaper's Ship Pack and any other extensions are never read.

It merges the layers in load order into one file per game path, in the gitignored `.cache/extract/files/`. The merge rules are the assumptions from #6:

- A `subst_*.cat` file replaces the file at its path whole, and the catalog that loads last wins.
- A library, index or text file without a `<diff>` root is merged into the earlier file. For a duplicate id (or `name`, for index entries), the later definition wins, in the earlier one's place.
- Any other file (a macro or component) at a base-game path replaces the base file whole. A new one stays in its extension's folder (`extensions/<folder>/assets/…`), where the index points to it.
- A file with a `<diff>` root patches the merged file at its path, in load order. The patcher (`extract/patch.ts`) supports `add` (with `pos` or `type="@attr"`), `replace` and `remove` on elements and attributes, `if` conditions and `silent`, and only the XPath `sel` forms found in the files we read: absolute paths with `/` and `//`, a final `@attr`, and the predicates `[@a='v']`, `[n]`, `… or …`, `[not(child)]` and `[not(child/@a='v')]`.
  - Any other selector is a hard failure, as is a `sel` that matches nothing (unless it has `silent`), a `sel` that matches more than one node, and a `<diff>` file for a path no earlier layer has.
  - The known exceptions are listed, each with its reason, in `patchAllowlist` in `extract/config.ts`: a `remove` (by extension, patch file and `sel`) whose node the game doesn't have, and a `<diff>` file (by extension and patch file) with nothing to patch. An allowlisted one is skipped and listed in the report. For SWI 0.9.1 HF on X4 8.00 these are five `remove`s in SWI's `libraries/wares.xml` of wares 8.00 doesn't have (`weapon_gen_m_disabler_01_mk1` and the like), SWI's `assets/fx/weaponFx/backup/bullet_xen_s_laser_01_mk1.xml`, which no earlier layer has, and its `assets/structures/dock/macros/dockarea_arg_m_01_tradestation_01_macro.xml`, which X4 8.00 deletes. When a new SWI release adds another, extraction stops until it is checked and added on purpose.
- An extension's language-neutral `t/0001.xml` is its English text when it has no `t/0001-l044.xml` of its own (SWI ships only the neutral file).

Every duplicate id, whole-file replacement, non-diff library merge, allowlisted skipped patch and allowlisted unmatched removal is listed in `.cache/extract/extract-report.md`. `layers.json` records the load order and versions.

Each merged file is pretty-printed JSON at a lowercased path that mirrors the game's (`libraries/wares.json`). Attributes become keys, child elements become arrays grouped by tag, and text becomes `#text`. If an attribute shares its name with a child element, the attribute's key gets an `@` prefix. Only libraries, the macro and component index, ship and equipment assets, station module macros, and the English and language-neutral text files are read.

### Stage 2: the snapshot

Then it builds Game Data from the cache and writes it to `game-data/<swi-version>_x4-<x4-version>/` (e.g. `091_x4-800/`), pointing the `game-data/current` symlink at it. `npm run extract -- --transform-only` re-runs only this stage from the cache.

- **Buildable Ship**: a ware tagged `ship` with a Seller and none of the tags `noplayerbuild`, `missiononly`, `blueprintsaleonly` or `limited` (#15). A Faction is a Seller if it owns the ware and runs a station whose build modules cover the Ship's size: god.xml → stations.xml → stationgroups.xml → constructionplans.xml → `buildmodule` macros' `<builder classes>`, whatever the station's tags (#20).
- **Equipment** is a ware of one of the kinds weapon, turret, shield, engine, thruster, missile, drone, deployable (satellites, mines, laser towers, nav beacons, resource probes), countermeasure or software, by its tags; spacesuit items are not. A Faction is its Seller if it owns the ware, or any Faction if the ware has no owner, and runs a station whose modules' `<equip classes>` cover a class of Ship the item fits; equipment docks count (#18). The Licence is the ware's `<restriction licence>`. Only Equipment with a Seller that fits a buildable Ship is written.
- **Compatibility** is computed here, so the app knows no tag rules. An item fits a Slot of its kind when every tag of its type connection (the component connection tagged with its kind), but for `component`, is on the Slot. A Slot Group kind takes what fits all its connections of that kind. A thruster fits when its connection's tags, but for `component` and `thruster`, are in the ship macro's `<thruster tags>`. Software comes from the ship macro's `<software>` list, `default="1"` being mandatory. Every drone, deployable and countermeasure fits a Ship that can carry some. A launcher (`missilelauncher` or `missileturret` macro) fires the missiles whose `<missile tags>` are in its `<ammunition tags>`, and a missile fits the Ships its launchers fit. Identical lists are shared in `fit-lists.json`.
- Names are resolved in English from `t/0001-l044.xml`, keeping the text id. Where display names collide, the distinguishing Sellers are added (`Venator (Hutt Cartel)`); if Sellers can't tell the Ships apart, extraction fails.
- Licences are named by type (`generaluseship` → "General Use Ship Licence"), since each Faction names its own copy. Its reputation is given only when every Seller asks for the same one.
- Slot Groups whose names are equal once trimmed are one Slot Group, as in game (#52): extraction merges them, summing their counts, and the trimmed name is the id. If the merged groups take one kind on different fit lists, the merge would be a guess, so extraction fails.
- A connection name listed more than once in a Ship's component counts once, as in game (#68: the Heraklon Ore Miner's `left-mine` group). If the listings differ in tags or group, which one counts would be a guess, so extraction fails.
- The snapshot is validated by the shared schema and integrity pass before anything is written. Zero Ships, or a ware, macro, component, station group, construction plan, Faction or text reference that doesn't resolve, is a hard failure. The integrity pass also rejects duplicate ids, a Ship's Slot Group ids that collide once trimmed, a Ship whose engines are on more than one fit list, mandatory software missing from its Ship's software fit list, and a fit list holding Equipment of the wrong kind.
- Zero Equipment is a hard failure too. The report adds every Ship and every piece of Equipment left out with its reason, and warnings for SWI data that breaks our rules (a slot with no size tag, a price outside min..max, a Slot Group name with spaces around it (merged, as above), a connection listed more than once in a component (counted once, as above), a licence with different reputations per Seller, Equipment with a Seller but no compatible Slot, a Slot Group whose connections take different Equipment). `npm run extract` also prints how many Equipment wares have a Seller before the fits-a-buildable-Ship filter, to check against #18.
- The report also lists every Ship where `rotationspeed@max` would bind: some thruster that fits it turns it faster than the cap (thrust / drag on pitch, yaw or roll above `max`), so the stats engine's `min(thrust/drag, max)` matters.

For SWI 0.9.1 HF on X4 8.00 that is 210 Ships (S 65, M 56, L 66, XL 23).

### Reviewing a new SWI release

Before replacing `game-data/current`, extraction reads the snapshot it pointed at and diffs the new one against it. `.cache/extract/snapshot-diff.md`, beside the report, gives the counts and the ids and names of the Ships and Equipment added, removed and changed, with the fields that changed (`price.average`, `stats.drag.yaw`…). Lists whose items all have ids (Slots, Slot Groups) are compared item by item, so a changed field names the item, and an added or removed item is named on its own: `slotGroups[enginegroup].kinds.engine.count`, `slotGroups["enginegroup  "]`. Other lists are compared whole. Fit-list ids hash their contents, so a change in what fits a Slot shows as a change to the Ship. On a first extraction it says there is no previous snapshot.

To re-run only Stage 2 from the cache (after changing the transform, say), without reading the install or merging again:

```bash
npm run extract -- --transform-only
```

This writes the snapshot, the report and the diff again; the diff is then against the snapshot of the previous run.

The **Game Data check** (`shared/game-data/currentSnapshot.test.ts`, part of `npm run test:unit`) re-validates `game-data/current` against the shared zod schema and integrity pass. It is skipped when there is no snapshot, as in CI, which has no game files.

## Tests

```bash
npm test
```

This runs Vitest (`npm run test:unit`) and then Playwright Test (`npm run test:ui`). Playwright serves the app with the fixture snapshot. The first time, install a browser with `npx playwright install --with-deps chromium`.

Each checkout serves the app on its own port, hashed from the checkout's path into 20000–29999, so UI runs in two worktrees at once don't share a dev server (two paths can hash to the same port, but rarely). Rerunning in the same checkout reuses its server if it's still up. Set `PW_PORT` to pick the port yourself, e.g. `PW_PORT=5301 npm run test:ui`.
