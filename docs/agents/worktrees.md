# Worktrees: one per ticket

Each ticket session works in its own git worktree, on its own branch. The main checkout stays on a clean `main`, so sessions don't commit on `main` or see each other's edits.

## Make one

From any checkout of the repo:

```bash
npm run worktree -- <issue> <slug>
```

For example, `npm run worktree -- 76 ticket-worktrees`. It:

1. fetches `origin`,
2. adds `../x4-swi-ship-builder-<issue>`, next to the main checkout, on a new branch `<issue>-<slug>` from `origin/main` (not the main checkout's HEAD),
3. copies the main checkout's `game-data/` into it, so a ticket that changes the Game Data schema re-extracts only its own snapshot,
4. links `.cache/extract/files` to the main checkout's (the merged game files are only ever read); `layers.json` and `merge-log.json` are copied beside it so `npm run extract -- --transform-only` works, and the report and diff it writes are the worktree's own,
5. copies the main checkout's `.env`, if it has one, so `npm run extract` finds `X4_INSTALL_DIR` without `--x4` (a copy, not a link: editing one checkout's `.env` doesn't change the other's),
6. runs `npm ci` there (never symlink `node_modules`: an install on one branch would change the other's),
7. prints the path. Open the session there.

If the main checkout has no extraction, the worktree has no snapshot: the Game Data check then skips with a warning, and `npm run dev` needs `GAME_DATA_DIR`.

## Rules

- **Don't work in the main checkout.** If a session starts there on a ticket, make the worktree and continue in it.
- **No commits on `main`.** The tracked `.githooks/pre-commit` refuses them; `npm ci` wires it up through the `prepare` script (`core.hooksPath`), and it covers every worktree. For a deliberate commit on `main`, run it with `ALLOW_MAIN_COMMIT=1`.
- **No AI attribution.** `.claude/settings.json` turns off Claude's commit and PR attribution, the `commit-msg` hook strips AI `Co-authored-by` trailers, and the `attribution` CI job (`.github/workflows/attribution.yml`, which re-runs when the PR description is edited) fails a PR whose commits or description still credit an AI tool. The pattern is in `scripts/aiAttribution.ts`.
- **Clean up** a merged ticket's worktree with `git worktree remove ../x4-swi-ship-builder-<issue>`.

Worktrees Claude Code makes itself (Agent isolation, under `.claude/worktrees/`, which is gitignored) aren't prepared by this script.
