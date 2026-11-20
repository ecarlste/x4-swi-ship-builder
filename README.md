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
- A file with a `<diff>` root goes to the patch step, which isn't written yet (#29), so for now extraction stops there.

Every duplicate id, whole-file replacement and non-diff library merge is listed in `.cache/extract/extract-report.md`. `layers.json` records the load order and versions.

Each merged file is pretty-printed JSON at a lowercased path that mirrors the game's (`libraries/wares.json`). Attributes become keys, child elements become arrays grouped by tag, and text becomes `#text`. If an attribute shares its name with a child element, the attribute's key gets an `@` prefix. Only libraries, the macro and component index, ship and equipment assets, and the English and language-neutral text files are read.

## Tests

```bash
npm test
```

This runs Vitest (`npm run test:unit`) and then Playwright Test (`npm run test:ui`). Playwright serves the app with the fixture snapshot. The first time, install a browser with `npx playwright install --with-deps chromium`.
