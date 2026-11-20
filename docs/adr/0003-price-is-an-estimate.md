# Price is an estimate without crew

In game, a shipyard charges each ware at its own price, and its total for a new Ship includes crew. #63 checked this at a real shipyard: a Gozanti-class Miner at Rendili Drive Yards, reputation 0 ([#63's Price comment](https://github.com/ecarlste/x4-swi-ship-builder/issues/63#issuecomment-7046160635)).

- **The total is the sum of the lines.** Each engine, consumable and piece of software is charged separately, as the builder does.
- **Hardware costs the station's price**, at 0.85–0.98 of Game Data's average.
- **Every piece of software, and the flares, cost exactly 0.90 of average**, even at reputation 0. We don't know why. Across Game Data this falls below min only for wares whose min is itself 0.90 of average (`countermeasure_flares_01`, `software_scannerlongrangemk1`, `software_scannerlongrangemk2`), and by less than 1 Cr, so it's rounding in Game Data's min. Missiles weren't observed at 0.90.
- **The total includes crew**: 16× Crewman at 5,624 (89,984). The base game's `crew` ware is 5,000 / 7,500 / 10,000, and a Ship's crew capacity is already in Game Data.

The station's price depends on the station, so no reference Loadout can assert an exact price. The builder deliberately differs from the game (#70):

- Price is the Ship plus each piece of Equipment (the engine once per engine) at Game Data's **average**, the headline, with **min–max** as the range. The UI labels it as an estimate.
- Price **leaves out crew** and says so. Crew and marines aren't part of a Loadout, and if the builder ever includes them, it includes their price too (#80).
- The 0.90 on software and consumables isn't modelled.

## Considered Options

- **Model the station's price**, including the 0.90. Rejected: it depends on the station and on rules we don't know, and Game Data has no per-station prices.
- **Range as the headline.** Rejected: a range breaks the single figure the change column and the comparison verdicts compare.
- **Add crew at capacity − 1 × the `crew` ware.** Rejected for now: the count is a choice made at the shipyard, it's based on one Ship, and the builder has no crew. It's #80.

## Consequences

- `price` in `src/stats/stats.ts` cites this ADR instead of `unconfirmed (#70)`. Its tests cite this ADR, not a game screen.
- The Loadout table's "Price (avg)" column and the comparison popover's Price row keep using the average.
- For the #63 fit, the game charged 2,029,768 without crew, inside the builder's 1,807,158–2,745,202 range and 11% under its 2,276,186 average.
