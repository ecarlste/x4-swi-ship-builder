# One engine per Loadout

In game, a Ship's engine Slots can't take different engines. The ship configuration screen offers one "N×" choice for all of them (Settie, TIE Fighter, N-1 Starfighter; [#39 finding 4](https://github.com/ecarlste/x4-swi-ship-builder/issues/39#issuecomment-7029359824)). So the Loadout holds a single top-level `engine` Equipment id, like `thruster`, and doesn't hold engines per Slot in `slots` or per Slot Group in `groups`. An engine is fitted all or nothing: it fills every engine Slot and every engine Slot Group to its full size, so a Loadout can't contain mixed or part-filled engines at all (#50).

## Considered Options

- **Keep engines per Slot and have the builder keep them matching.** Rejected: the codec would still accept mixed engines, so loading code and the stats engine would have to handle a case the game can't produce.

## Consequences

- Engine Equipment never appears in `slots` or `groups`. Code that walks those for fitted Equipment (such as missile launchers) doesn't see engines.
- The engine count comes from the Ship's Game Data (its engine Slots plus the sizes of its engine Slot Groups), not from the Loadout. A Game Data release that changes the count changes the stats, not the Loadout.
- Format 1 was changed in place, with no migration, because no format-1 Loadouts had been released.
