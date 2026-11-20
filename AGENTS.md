# AGENTS.md

## Agent skills

### Issue tracker

Issues live in GitHub Issues (ecarlste/x4-swi-ship-builder), via the gh CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one GLOSSARY.md + docs/adr/ at the repo root. See `docs/agents/domain.md`.

### Worktrees

Ticket work happens in its own worktree (`npm run worktree -- <issue> <slug>`); the main checkout stays on a clean `main`. See `docs/agents/worktrees.md`.
