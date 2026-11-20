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
  - Any other selector is a hard failure, as is an `add` or `replace` whose `sel` matches nothing (unless it has `silent`) or a `sel` that matches more than one node.
  - A `remove` that matches nothing leaves the file as the game has it, and a patch for a file no earlier layer has patches nothing. Both are listed in the report instead.
- An extension's language-neutral `t/0001.xml` is its English text when it has no `t/0001-l044.xml` of its own (SWI ships only the neutral file).

Every duplicate id, whole-file replacement, non-diff library merge, skipped patch and unmatched removal is listed in `.cache/extract/extract-report.md`. `layers.json` records the load order and versions.

Each merged file is pretty-printed JSON at a lowercased path that mirrors the game's (`libraries/wares.json`). Attributes become keys, child elements become arrays grouped by tag, and text becomes `#text`. If an attribute shares its name with a child element, the attribute's key gets an `@` prefix. Only libraries, the macro and component index, ship and equipment assets, station module macros, and the English and language-neutral text files are read.

### Stage 2: the snapshot

Then it builds Game Data from the cache and writes it to `game-data/<swi-version>_x4-<x4-version>/` (e.g. `091_x4-800/`), pointing the `game-data/current` symlink at it. `npm run extract -- --transform-only` re-runs only this stage from the cache.

- **Buildable Ship**: a ware tagged `ship` with a Seller and none of the tags `noplayerbuild`, `missiononly`, `blueprintsaleonly` or `limited` (#15). A Faction is a Seller if it owns the ware and runs a station whose build modules cover the Ship's size: god.xml → stations.xml → stationgroups.xml → constructionplans.xml → `buildmodule` macros' `<builder classes>`, whatever the station's tags (#20).
- **Equipment** is a ware of one of the kinds weapon, turret, shield, engine, thruster, missile, drone, deployable (satellites, mines, laser towers, nav beacons, resource probes), countermeasure or software, by its tags; spacesuit items are not. A Faction is its Seller if it owns the ware, or any Faction if the ware has no owner, and runs a station whose modules' `<equip classes>` cover a class of Ship the item fits; equipment docks count (#18). The Licence is the ware's `<restriction licence>`. Only Equipment with a Seller that fits a buildable Ship is written.
- **Compatibility** is computed here, so the app knows no tag rules. An item fits a Slot of its kind when every tag of its type connection (the component connection tagged with its kind), but for `component`, is on the Slot. A Slot Group kind takes what fits all its connections of that kind. A thruster fits when its connection's tags, but for `component` and `thruster`, are in the ship macro's `<thruster tags>`. Software comes from the ship macro's `<software>` list, `default="1"` being mandatory. Every drone, deployable and countermeasure fits a Ship that can carry some. A launcher (`missilelauncher` or `missileturret` macro) fires the missiles whose `<missile tags>` are in its `<ammunition tags>`, and a missile fits the Ships its launchers fit. Identical lists are shared in `fit-lists.json`.
- Names are resolved in English from `t/0001-l044.xml`, keeping the text id. Where display names collide, the distinguishing Sellers are added (`Venator (Hutt Cartel)`); if Sellers can't tell the Ships apart, extraction fails.
- Licences are named by type (`generaluseship` → "General Use Ship Licence"), since each Faction names its own copy. Its reputation is given only when every Seller asks for the same one.
- The snapshot is validated by the shared schema and integrity pass before anything is written. Zero Ships, or a ware, macro, component, station group, construction plan, Faction or text reference that doesn't resolve, is a hard failure.
- Zero Equipment is a hard failure too. The report adds every Ship and every piece of Equipment left out with its reason, and warnings for SWI data that breaks our rules (a slot with no size tag, a price outside min..max, a group name with stray spaces, a licence with different reputations per Seller, Equipment with a Seller but no compatible Slot, a Slot Group whose connections take different Equipment, a gun with no fire rate). `npm run extract` also prints how many Equipment wares have a Seller before the fits-a-buildable-Ship filter, to check against #18.
- The report also lists every Ship where `rotationspeed@max` would bind: some thruster that fits it turns it faster than the cap (thrust / drag on pitch, yaw or roll above `max`), so the stats engine's `min(thrust/drag, max)` matters.

For SWI 0.9.1 HF on X4 8.00 that is 210 Ships (S 65, M 56, L 66, XL 23).

### Reviewing a new SWI release

Before replacing `game-data/current`, extraction reads the snapshot it pointed at and diffs the new one against it. `.cache/extract/snapshot-diff.md`, beside the report, gives the counts and the ids and names of the Ships and Equipment added, removed and changed, with the fields that changed (`price.average`, `stats.drag.yaw`, `slots`…). Fit-list ids hash their contents, so a change in what fits a Slot shows as a change to the Ship. On a first extraction it says there is no previous snapshot.

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
