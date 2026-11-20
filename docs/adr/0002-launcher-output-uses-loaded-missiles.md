# A launcher's output uses its loaded missiles

In game, the ship configuration screen gives a missile launcher's Burst / Sustained Weapon Output, and a launcher turret's share of Avg. Turret Output, from one fixed missile: the **last compatible missile by ware id**, whatever is loaded and even with none loaded. #63 checked five weapon launchers ([#63 finding 1](https://github.com/ecarlste/x4-swi-ship-builder/issues/63#issuecomment-7045400951)), and #65's screenshot shows a launcher turret doing the same: a Heraklon Ore Miner with one Light Concussion Missile Launcher in Slot Group `missile` and no missiles shows Avg. Turret Output 270 (ST2 Light Concussion, 1,625 ÷ 6). A launcher's compatible missiles are the missile wares whose tags match its ammunition tags, and for every launcher in the `091_x4-800` Game Data they are exactly its fit list.

That rule makes no sense to a player: the output ignores what's loaded. So the builder deliberately differs from the game (#65):

- A launcher fires the **loaded compatible missile with the highest output**: a missile in its fit list with a count above 0 in the Loadout's `consumables`. On a tie, the first in the fit list.
- With no compatible missile loaded, the launcher gives **0**.
- This applies to launchers in Slots and in Slot Groups, weapons and turrets alike. The stat rows keep the game's names.
- The comparison popover shows a hovered launcher's output with each missile in its fit list, best first, then with "No missile", and marks the row the stats panel would use as "loaded".

The UI doesn't say that these figures differ from the game.

## Considered Options

- **Mirror the game.** Rejected: the figure would ignore the Loadout, so loading a better missile would change nothing.
- **The first loaded missile by fit-list order (ware id)**, the rule before #65. Rejected: it depends on an order the player can't see, so loading a weaker missile alongside a stronger one could lower the output.
- **A missile choice per launcher in the Loadout.** Rejected: it changes the Loadout format, and in game the pilot picks the missile in flight, so the Loadout has nothing to record.
- **A min–max range.** Rejected: ranges break the sums the rows are made of and the better / worse verdicts.

## Consequences

- The rule lives in `src/stats/firepower.ts`: `missilesBestFirst` ranks a launcher's missiles and `launcherMissile` picks the best loaded one. The stats panel and the comparison popover both use them.
- Reference rows for launchers (`src/stats/reference.test.ts`) load the missile the game showed, so both rules agree on the screen's value. Tests of what the builder does differently cite this ADR, not a game screen.
- A launcher with an empty fit list, or with nothing compatible loaded, adds nothing to any output row.
