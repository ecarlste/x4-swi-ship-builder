# X4: SWI Ship Builder

A web app for configuring the equipment on ships from the Star Wars Interworlds mod for X4: Foundations.

## Language

**SWI**:
Star Wars Interworlds, the total-conversion mod for X4: Foundations, limited to its official extensions. Third-party SWI add-ons are not SWI.
_Avoid_: the mod, Star Wars mod

**Game Data**:
The ships, equipment and default loadouts the app knows about, always extracted by script from an SWI release and never entered by hand.
_Avoid_: database, content

**Ship**:
A ship that can be built in SWI.
_Avoid_: hull, vessel, model

**Equipment**:
Anything that can be fitted to a ship as part of a loadout: weapons, turrets, shields, engines, thrusters, consumables (missiles, drones, deployables) and software.
_Avoid_: parts, components, wares

**Loadout**:
A specific choice of equipment for one ship. Equipment mods, paint and crew are not part of a loadout.
_Avoid_: build, fit, config

**Default Loadout**:
A loadout defined in the SWI game files for a ship, used as the starting point for configuring that ship.
_Avoid_: preset, template, base loadout

**Saved Loadout**:
A loadout the user has kept so they can open it again later.
_Avoid_: favourite, bookmark
