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

So far it only writes each layer's raw files to the gitignored `.cache/extract/`. `layers.json` records the load order and versions. `layers/<NN>_<layer>/files/` holds the files from base and `ext_*` catalogs, and `subst/` holds the files from `subst_*` catalogs. Each file is pretty-printed JSON at a lowercased path that mirrors the game's (`libraries/wares.json`). Attributes become keys, child elements become arrays grouped by tag, and text becomes `#text`. If an attribute shares its name with a child element, the attribute's key gets an `@` prefix. Only libraries, the macro and component index, ship and equipment assets, and the English and language-neutral text files are converted.

## Tests

```bash
npm test
```

This runs Vitest (`npm run test:unit`) and then Playwright Test (`npm run test:ui`). Playwright serves the app with the fixture snapshot. The first time, install a browser with `npx playwright install --with-deps chromium`.
