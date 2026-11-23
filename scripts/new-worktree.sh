#!/usr/bin/env bash
# `npm run worktree -- <issue> <slug> [base]`: makes a ready worktree for a
# ticket, next to the main checkout, at ../<main checkout>-<issue>, on a new
# branch <issue>-<slug> from a freshly fetched origin/<base> (default main; an
# integration-branch ticket passes the integration branch). See
# docs/agents/worktrees.md.
#
# The worktree gets its own node_modules (npm ci) and its own copy of game-data/,
# so a ticket that changes the schema re-extracts only its own snapshot. The
# merged game files in .cache/extract/files are only ever read, so they're
# linked; the rest of .cache/extract (report, diff) is the worktree's own.
# The main checkout's .env, if any, is copied, so extraction finds X4_INSTALL_DIR.
set -euo pipefail

usage() {
  echo "usage: npm run worktree -- <issue number> <slug> [base branch, default main]" >&2
  echo "       (e.g. 76 ticket-worktrees, or 121 shadcn-review-fixes shadcn-ui-migration)" >&2
  exit 1
}

[ $# -eq 2 ] || [ $# -eq 3 ] || usage
issue=$1
slug=$2
base=${3:-main}
[[ $issue =~ ^[0-9]+$ ]] || usage
[ -n "$slug" ] || usage

# The main checkout owns the common git dir, wherever this is run from.
common_git_dir=$(git rev-parse --path-format=absolute --git-common-dir)
main=$(dirname "$common_git_dir")
worktree="$(dirname "$main")/$(basename "$main")-$issue"
branch="$issue-$slug"

# --prune, so a branch deleted on origin doesn't pass as a base.
git -C "$main" fetch --quiet --prune origin
# The exact remote-tracking ref: a revision like main~1 isn't a branch tip.
base_ref="refs/remotes/origin/$base"
if ! git -C "$main" show-ref --verify --quiet "$base_ref"; then
  echo "origin has no branch $base to make the worktree from. Push it first, or check the name." >&2
  exit 1
fi
git -C "$main" worktree add --no-track -b "$branch" "$worktree" "$base_ref"

if [ -d "$main/game-data" ]; then
  cp -a "$main/game-data" "$worktree/game-data"
else
  echo "No game-data/ in $main to copy. Run the extraction in the worktree if the ticket needs a snapshot."
fi

if [ -d "$main/.cache/extract/files" ]; then
  mkdir -p "$worktree/.cache/extract"
  ln -s "$main/.cache/extract/files" "$worktree/.cache/extract/files"
  # Stage 2 (`npm run extract -- --transform-only`) reads these beside the files.
  for file in layers.json merge-log.json; do
    if [ -f "$main/.cache/extract/$file" ]; then cp "$main/.cache/extract/$file" "$worktree/.cache/extract/"; fi
  done
fi

# A copy, not a link: editing one checkout's .env doesn't change the other's.
if [ -f "$main/.env" ]; then cp "$main/.env" "$worktree/.env"; fi

(cd "$worktree" && npm ci)

echo
echo "Worktree ready on branch $branch. Open the session in:"
echo "  $worktree"
