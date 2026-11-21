# Crew is part of the Loadout

ADR 0003 left crew out of the Loadout and out of Price, because "the count is a choice made at the shipyard". That's a reason to put it in the Loadout, not to leave it out: the user makes the same choice in the builder. So the Loadout now holds Crew (service crew and marines) and Price includes it (#80). This reverses ADR 0003's crew bullet and its rejected "Add crew at capacity − 1" option. The rest of ADR 0003 stands.

What the game does, checked at RDY Wharf on X4 8.00 + SWI 0.9.1 HF (#80), and in SWI's `libraries/loadouts.xml`:

- **The Captain is free and mandatory.** A new Ship always gets one, at no charge, in a seat on top of `people@capacity`. That seat is the +1 in the Crew stat (`people@capacity + 1`, confirmed in #77). The Captain isn't part of a Loadout or of Price. The buy screen lists it as a checkbox marked Mandatory, named "Pilot" on S and M Ships and "Captain" on L and XL. A purchase is refused without it, whether bought remotely or in person at the dealer, and once ticked it can't be unticked (#96). So it's never a choice, and the builder treats it as always ticked.
- **Service crew and marines are optional, start at 0, and share `people@capacity`.** The Z-95 Headhunter (`people@capacity` 1) takes 1 service crew *or* 1 marine.
- **Both are bought as the base game's `crew` ware, at the same price per head** (6,520 at RDY Wharf, inside its 5,000–10,000 range). Price uses its average and min–max, like any other ware.
- **The game's own loadouts store them as two counts**, `<crew role="service" exact="N"/>` and `<crew role="marine" exact="N"/>`, and never store a captain.

## Considered Options

- **Crew only in Price, at a count derived from the Ship's capacity.** Rejected: the shipyard's default is 0 service crew and 0 marines, so there's nothing to derive, and a fixed count can't show marines.
- **Leave crew out (ADR 0003 as it was).** Rejected: the game's total includes the crew the player picks, so Price would be wrong for any Ship bought with crew.

## Consequences

- The Loadout gets an optional `crew: { service?, marines? }`, two counts as the game stores them, sparse like the rest: left out when both are 0. Price can't tell them apart, but a Share Link of a boarding fit should say it carries marines.
- Format 1 changes in place, with no bump or migration: the field is optional, so every existing Loadout is still valid and has no Crew, and no builder that would drop the key has been released (as in ADR 0001).
- When resolving against Game Data that lowers a Ship's crew capacity, service crew is cut first and marines are kept, since marines are the deliberate choice. Each cut is reported as a clamp.
- Crew changes only Price. Its effects in game (repair, morale, boarding) have no stat in the builder, and the Crew stat stays `people@capacity + 1`.
- Price is labelled "Estimate", no longer "Estimate · excludes crew".
- An Empty Loadout has no Crew, matching the shipyard's buy screen.
- The 16 Crewmen in #63's Gozanti-class Miner total must have been added on the buy screen, since the default is 0.
