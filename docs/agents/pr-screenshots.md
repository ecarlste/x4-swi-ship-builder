# PR screenshots

Before and after screenshots appear on every PR by themselves. Don't take them by hand or attach them to the PR description: link to the comment instead.

## What appears

When a PR from this repo is opened or pushed to, the `Screenshots` workflow (`.github/workflows/screenshots.yml`) posts one comment from `github-actions[bot]` headed **Screenshots**: a table with a row per state and a Before (the PR's base) and After (its head) image in each. Each push updates that same comment with the new head's images. The comment starts with the hidden marker `<!-- pr-screenshots -->`, which is how the workflow finds it again.

The states, full page at 1280px wide, against the fixture snapshot (`fixtures/game-data/tiny`):

- the empty page;
- a fitted Loadout with the comparison popover open;
- Saved Loadouts open;
- the Save dialog open.

A cell reading _None_ means that screenshot wasn't taken: the state failed (the base's UI may not have it yet) or the build did. The workflow's log says which. The screenshots aren't a test, and nothing here fails `check`.

In a PR description, point reviewers at it, e.g. "Screenshots: see the bot comment below." Name the state to look at when the change is in one.

## Adding or changing a state

The states are `STATES` in `scripts/prScreenshots.ts` (key, label, order in the comment), and `screenshots/shots.spec.ts` drives the page to each one through roles and the e2e helpers. Add a state to both; the spec's `drive` map won't typecheck until every state has a driver. The head's spec drives both builds, so a new state gets a Before image too whenever the base's UI can reach it.

## Where the images live

The orphan branch `pr-screenshots`, under `pr-<number>/<head sha>/{before,after}-<state>.png`, linked from the comment through `raw.githubusercontent.com` (the repo is public). Each push replaces the PR's folder; closing the PR removes it. Commits there are made as the Actions bot by `node scripts/prScreenshots.ts publish|clean`. The "Protect main" ruleset covers only `main`. Never base work on that branch or merge it.

## Limits

- **Fork PRs are skipped.** Their token is read-only, so the workflow can't push or comment.
- Retire this once Vercel preview environments exist for PRs, or keep it next to them.
