# Mandatory software is always fitted

The game's buy screen marks some Software Families "Mandatory" but leaves them unticked, so a fit can be empty there until the player picks one. v1 copied that: an Empty Loadout had no software, and the builder marked each mandatory family "missing". This makes the user tick boxes that aren't a choice, so the builder no longer copies it. Every Loadout fits exactly one ware of each of its Ship's mandatory families. An Empty Loadout starts with the Ship's default ware, the earliest it can fit; wares earlier in the chain aren't offered, as the game's buy screen lists only the default and the wares after it. So the Y-wing Longprobe, whose default is the Long Range Scanner Mk2, starts on the Mk2 and isn't offered the Mk1 on its fit list. Matching the game is worth extra work only when it gives the user a real choice.

## Consequences

- A mandatory family of one ware (Flight Assist) is shown fitted and can't be changed. A mandatory family of several wares offers one choice among them and has no "None".
- An optional family of one ware is a toggle, and an optional family of several wares starts at "None".
- An Empty Loadout's Price now includes its mandatory software.
- A Saved Loadout, Share Link or Loadout File without a mandatory family's software gets the Ship's default ware of that family when it's opened, and one earlier in the chain than the default is dropped. It's reported like any other Repair, so Repair now covers additions as well as drops and clamps. The Loadout format doesn't change.
- The "mandatory missing" mark no longer applies to software. It still applies to the engines, the thruster and mandatory Slots, which are real choices.
