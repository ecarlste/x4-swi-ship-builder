# X4: Star Wars Interworlds Ship Builder — Initial Concept

## Summary

A web app for configuring any ship that can be built in **X4: Star Wars Interworlds (SWI)**, the total-conversion mod for X4: Foundations.

## Core Features

- **Configure any buildable ship.** Pick any ship available in SWI and configure its loadout (weapons, turrets, shields, engines, thrusters, and other equipment).
- **Start from a default loadout.** Begin from one of the ship's existing base loadouts as defined in the game, instead of starting from an empty ship.
- **Save and load custom loadouts.** Save a configured loadout and load it again later to review or keep editing.
- **Scripted data resync.** All game data the app uses (ships, equipment, default loadouts) comes from a script or set of scripts that extract it from the SWI game files. When a new SWI version comes out, rerunning the scripts updates the app's data. No data is ever entered by hand.

## Scope

- **SWI only.** This app targets the Star Wars Interworlds mod, not the base game of X4. Base-game ships and equipment are out of scope.
- **Game version.** Built against the latest SWI release, which is believed to run on X4 version 8.00.01 (still to be confirmed).
