# X4: SWI Ship Builder

A web app for configuring the equipment on ships from the Star Wars Interworlds (SWI) mod for X4: Foundations. See `GLOSSARY.md` for the domain terms.

## Game Data

The app bundles one Game Data snapshot at build time. By default it reads `game-data/current`, which the extraction writes and which is gitignored: SWI content is never committed. To use another snapshot, set `GAME_DATA_DIR` when you run Vite. For example, this uses the tiny hand-made fixture:

```bash
GAME_DATA_DIR=fixtures/game-data/tiny npm run dev
```

`npm run dev` and `npm run build` fail with a clear message if there's no snapshot.

`src/gameData.ts` is the app's only entry point to Game Data. It checks the snapshot against the shared zod schema and reference-integrity pass in `shared/game-data/`.

## Tests

```bash
npm test
```

This runs Vitest (`npm run test:unit`) and then Playwright Test (`npm run test:ui`). Playwright serves the app with the fixture snapshot. The first time, install a browser with `npx playwright install --with-deps chromium`.
