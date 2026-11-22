# Mandatory software is always fitted

The game's buy screen marks some Software Families "Mandatory" but leaves them unticked, so a fit can be empty there until the player picks one. v1 copied that: an Empty Loadout had no software, and the builder marked each mandatory family "missing". This makes the user tick boxes that aren't a choice, so the builder no longer copies it. Every Loadout fits exactly one ware of each of its Ship's mandatory families. An Empty Loadout starts with the cheapest one the Ship can fit, which is the earliest in the family's upgrade chain that is on the Ship's fit list (so the Mk2 on the 19 Ships, such as the M12-L Kimogila, whose fit list has no Mk1). Matching the game is worth extra work only when it gives the user a real choice.

## Consequences

- A mandatory family of one ware (Flight Assist) is shown fitted and can't be changed. A mandatory family of several wares offers one choice among them and has no "None".
- An optional family of one ware is a toggle, and an optional family of several wares starts at "None".
- An Empty Loadout's Price now includes its mandatory software.
- A Saved Loadout, Share Link or Loadout File without a mandatory family's software gets that family's cheapest ware when it's opened. It's reported like any other Repair, so Repair now covers additions as well as drops and clamps. The Loadout format doesn't change.
- The "mandatory missing" mark no longer applies to software. It still applies to the engines, the thruster and mandatory Slots, which are real choices.
