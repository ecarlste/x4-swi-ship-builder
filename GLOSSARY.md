# X4: SWI Ship Builder

A web app for configuring the equipment on ships from the Star Wars Interworlds mod for X4: Foundations.

## Language

**SWI**:
Star Wars Interworlds, the total-conversion mod for X4: Foundations, limited to its official extensions. Third-party SWI add-ons are not SWI.
_Avoid_: the mod, Star Wars mod

**Game Data**:
The ships and equipment the app knows about, always extracted by script from an SWI release and never entered by hand.
_Avoid_: database, content

**Ship**:
A ship that can appear in SWI, whether or not the player can buy it.
_Avoid_: hull, vessel, model

**Chassis**:
A Ship's own share of the Price, without any Equipment or Crew.
_Avoid_: hull price, base price

**Ship Type**:
The game's role for a Ship, such as fighter, bomber, corvette, frigate or carrier, within its size.
_Avoid_: class, role, category

**Seller**:
A faction the player can buy a ship or a piece of equipment from.
_Avoid_: owner, vendor, manufacturer

**Faction**:
A power in SWI, such as the Galactic Empire or Black Sun, that can be a Seller.
_Avoid_: race, empire, side

**Licence**:
A permission the player holds with a Faction, which that Faction requires before it sells certain Ships or Equipment.
_Avoid_: permit, clearance

**Equipment**:
Anything that can be fitted to a ship as part of a loadout: weapons, turrets, shields, engines, thrusters, consumables (missiles, drones, deployables) and software.
_Avoid_: parts, components, wares

**Software Family**:
Software where each one replaces the one before, such as Long Range Scanner Mk1 and Mk2. A Ship fits at most one of each family, and when a family is mandatory any of them will do.
_Avoid_: software slot, software group

**Slot**:
One place on a Ship where one piece of Equipment is fitted.
_Avoid_: hardpoint, connection, mount

**Slot Group**:
A named set of Slots on a large Ship, filled together instead of one Slot at a time: for each kind of Equipment it takes (such as turrets or shields), the user picks one type and a count. Engines are the exception: they are never picked per Slot Group.
_Avoid_: battery, cluster, group slot

**Place**:
Where a Loadout fits something: the engines, one Slot, one kind of Equipment in a Slot Group, the thruster, one piece of software, one consumable, or one Crew role. Every Place has its share of the Price.
_Avoid_: row, key, hardpoint, position

**Loadout**:
A specific choice of equipment and Crew for one ship. A loadout fits one engine type to all of the ship's engine Slots, including those in Slot Groups, or no engines at all. Equipment mods, paint and the Captain are not part of a loadout.
_Avoid_: build, fit, config

**Crew**:
The service crew and marines a Loadout carries, as two counts that share the Ship's crew capacity. Both are bought as the same ware at the same price per head. The Captain is not Crew.
_Avoid_: personnel, people, workforce

**Captain**:
The one person who flies a Ship, which every Ship gets free and must have when it's bought. The Captain's seat is on top of the Ship's crew capacity. The game calls it "Pilot" on S and M Ships and "Captain" on L and XL, and the buy screen keeps it ticked.
_Avoid_: pilot, commander

**Price**:
An estimate of what a Loadout costs: the Chassis, each piece of Equipment (the engine once per engine) and each member of its Crew, at Game Data's average, with Game Data's min–max as the range. A shipyard charges its own price inside that range (ADR 0003). The Captain is free (ADR 0004).
_Avoid_: cost, value, purchase price

**Empty Loadout**:
The loadout every ship starts with in the builder: no equipment at all, not even software, and no Crew. Like a shipyard, it starts with only the Captain.
_Avoid_: default loadout, base loadout, template

**Loaded Loadout**:
The Loadout as it was last opened or saved, which the builder compares the current Loadout against to show what changed. A freshly picked Ship has none.
_Avoid_: original, baseline, snapshot

**Repair**:
A drop or clamp that makes a Loadout fit its Ship and the Game Data, such as missiles dropped when no launcher carries them, or Crew cut to the Ship's crew capacity.
_Avoid_: change, fix, correction

**Changes since loading**:
How the Loadout being built differs from the one it was opened or last saved as.
_Avoid_: diff, edits, unsaved changes

**Saved Loadout**:
A loadout the user has kept so they can open it again later.
_Avoid_: favourite, bookmark

**Share Link**:
A URL that carries one Loadout so another person can open it.
_Avoid_: permalink, share code

**Loadout File**:
A file of one or more Saved Loadouts, written by export and read by import.
_Avoid_: backup, save file
