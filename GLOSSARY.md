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

**Slot**:
One place on a Ship where one piece of Equipment is fitted.
_Avoid_: hardpoint, connection, mount

**Slot Group**:
A named set of Slots on a large Ship, filled together instead of one Slot at a time: for each kind of Equipment it takes (such as turrets or shields), the user picks one type and a count. Engines are the exception: they are never picked per Slot Group.
_Avoid_: battery, cluster, group slot

**Loadout**:
A specific choice of equipment for one ship. A loadout fits one engine type to all of the ship's engine Slots, including those in Slot Groups, or no engines at all. Equipment mods, paint and crew are not part of a loadout.
_Avoid_: build, fit, config

**Empty Loadout**:
The loadout every ship starts with in the builder: no equipment at all, not even software.
_Avoid_: default loadout, base loadout, template

**Saved Loadout**:
A loadout the user has kept so they can open it again later.
_Avoid_: favourite, bookmark

**Share Link**:
A URL that carries one Loadout so another person can open it.
_Avoid_: permalink, share code

**Loadout File**:
A file of one or more Saved Loadouts, written by export and read by import.
_Avoid_: backup, save file
