#!/usr/bin/env bash
# `npm run worktree -- <issue> <slug>`: makes a ready worktree for a ticket, next
# to the main checkout, at ../<main checkout>-<issue>, on a new branch
# <issue>-<slug> from a freshly fetched origin/main. See docs/agents/worktrees.md.
#
# The worktree gets its own node_modules (npm ci) and its own copy of game-data/,
# so a ticket that changes the schema re-extracts only its own snapshot. The
# merged game files in .cache/extract/files are only ever read, so they're
# linked; the rest of .cache/extract (report, diff) is the worktree's own.
set -euo pipefail

usage() {
  echo "usage: npm run worktree -- <issue number> <slug>   (e.g. 76 ticket-worktrees)" >&2
  exit 1
}

[ $# -eq 2 ] || usage
issue=$1
slug=$2
[[ $issue =~ ^[0-9]+$ ]] || usage
[ -n "$slug" ] || usage

# The main checkout owns the common git dir, wherever this is run from.
common_git_dir=$(git rev-parse --path-format=absolute --git-common-dir)
main=$(dirname "$common_git_dir")
worktree="$(dirname "$main")/$(basename "$main")-$issue"
branch="$issue-$slug"

git -C "$main" fetch --quiet origin
git -C "$main" worktree add --no-track -b "$branch" "$worktree" origin/main

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

(cd "$worktree" && npm ci)

echo
echo "Worktree ready on branch $branch. Open the session in:"
echo "  $worktree"
