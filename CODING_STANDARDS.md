# Coding standards

The rules a reviewer checks a diff against. Each rule says what the code does, why, and what to flag. Tooling (`npm run typecheck`, the tests) and the docs it names (`README.md`, `GLOSSARY.md`, `docs/adr/`) are covered elsewhere; these rules are the conventions no config records.

## 1. Docs change with the behaviour they describe

When a diff changes a behaviour the README describes, the README section that describes it changes in the same diff. The README restates behaviour in detail, so check it line by line, not by heading:

| The diff changes…                                                                                | Read against it                                        |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| what extraction reads, merges, writes, warns about or fails on (`extract/`)                      | `## Extraction` and `### Stage 2: the snapshot`        |
| the snapshot diff (`extract/diff.ts`) or the review workflow                                     | `### Reviewing a new SWI release`                      |
| the Game Data schema or integrity rules (`shared/game-data/`)                                    | `## Game Data`, and the integrity bullets in Stage 2   |
| how the app is run, built or tested                                                              | `## Game Data`, `## Tests`                             |
| what the app shows or does for the user (`src/`)                                                 | any README passage that describes it                   |

**Why:** the README spells out merge rules, warnings, failures, report contents and diff fields, so a code change makes it wrong without breaking anything. #52 changed how Slot Groups are named and how the diff names changed fields, and left both passages stale.

**Flag:** a behaviour change whose README passage still describes the old behaviour, or a new failure, warning, rule or output field the README lists its siblings of but not it. Quote the stale README line next to the hunk that made it stale.

## 2. Each side of extraction keeps its own words

Code in `extract/` that reads game files names things in the game's XML terms as written: `connection`, `macro`, `component`, `ware`, `group`, `tags`. Types in `extract/` that hold game data on its way to the snapshot (such as a Ship's connections and their groups) use those words too. Glossary terms (Ship, Slot, Slot Group, Equipment, Seller, …) name the domain: the snapshot schema and everything in `shared/game-data/` and `src/`, and the snapshot types extraction writes.

**Why:** extraction maps game XML onto the domain, and the mapping is clearest when each side keeps its own vocabulary. The glossary's _Avoid_ lists govern domain language; `connection` and `group` are the game's file format, and the right words for it.

**Flag:** a glossary term used for an XML concept in `extract/` (a `<connection>` called a Slot before it is one), or an XML term naming a domain concept in `shared/` or `src/`, or in the snapshot types. An XML term on an `extract/` type is the rule followed; leave it.

## 3. The integrity pass stays independent of extraction

`shared/game-data/integrity.ts` re-checks extraction's rules (such as Slot Group ids not colliding once trimmed) with its own code, and imports nothing from `extract/`. The same small rule written twice, once in `extract/` and once in `shared/game-data/integrity.ts`, is the design.

**Why:** the integrity pass is the backstop for extraction. A helper shared by both would carry one bug into both, and extraction would approve its own broken output.

**Flag:** an import from `extract/` in `shared/game-data/`, or a helper the two share. Logic repeated between `extract/` and the integrity pass is this rule followed; keep it out of Duplicated Code findings.

## 4. A stat formula is confirmed in game, says it isn't, or says why it differs

A diff that adds or changes how a stat row is computed (`src/stats/`), or how extraction derives an input the stats use, does one of these:

- adds or updates a row in `src/stats/reference.test.ts`, with values from an in-game screen and the issue that recorded them, **or**
- marks the formula `unconfirmed (#N)` in a comment, where `#N` is an open ticket to check it in game, **or**
- differs from the game on purpose, with a comment citing the ADR in `docs/adr/` that records the game's rule, the builder's and why (such as ADR 0002, a launcher's loaded missiles). Its tests cite the ADR, not a game screen.

Fixture inputs in `src/stats/testing/` that were chosen to produce an expected number, rather than copied from Game Data, are marked the same way.

**Why:** a stat test can't tell a formula that's right from one written to match its own fixture. Only the game decides. #39 checked formulas that had shipped untested in game and found three wrong (launcher storage, a missile's `barrelamount`, the engine class's boost default). #53 fixed them.

**Flag:** a new or changed stat formula with no reference row, no `unconfirmed (#N)` marker and no ADR saying why it differs from the game, or a marker whose ticket is closed. Judging what counts as a stat input is up to the reviewer. No check can decide it, which is why this rule is here and not in a lint rule.
