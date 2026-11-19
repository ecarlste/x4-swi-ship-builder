# Which factions sell each piece of SWI Equipment, and where?

Research for issue #18 (child of the wayfinder map, #1). Date: 2026-11-19.

**Primary source:** the local X4 8.00 install at
`/mnt/e/SteamLibrary/steamapps/common/X4 Foundations - 8.00`. Layers, in order: base, then
`ego_dlc_split`, `ego_dlc_terran`, `ego_dlc_pirate`, `ego_dlc_boron`, `ego_dlc_timelines`, then
`extensions/starwarsmod_m1` (SWI 0.9.1 HF). `starwars_rsp` and the mini DLCs are left out.
I extracted every file from the `.cat/.dat` archives with an md5 check and applied the XML diff
patches with the stdlib-Python patcher used for issue #15. 2,856 patch operations applied. 5 failed,
all of them SWI `remove`s of `*_gen_m_disabler/gatling/shieldpierce` wares, which only exist in the
excluded mini DLC `ego_dlc_mini_02`.

Files read, beyond the `libraries/*.xml` data files:

- `08.cat → libraries/scriptproperties.xml` and `libraries/common.xsd`. Egosoft's own script API
  docs. They describe how a station's equipment list is built.
- `starwarsmod_m1/subst_02.cat → ui/addons/ego_detailmonitor/menu_ship_configuration.xpl`. SWI's
  replacement shipyard menu, as plain Lua. It shows how the list and the licence check are used.
- Every `md/*.xml` in all layers. I checked them for runtime overrides.

**Status labels** used below:

- **[verified]**: read directly from the layered files or the Lua.
- **[documented]**: stated in Egosoft's own `.xsd`/`scriptproperties.xml` text, but the code runs
  inside the engine.
- **[inferred]**: my reasoning. Not checked in game.

## TL;DR

**Seller of a piece of Equipment** = a faction that

1. lists the ware as `<owner faction>`, or, if the ware has **no** `<owner>` at all, any faction;
2. runs at least one station with a build module whose `<equip classes>` covers a ship class the
   equipment can be fitted to.

The licence is the ware's `<restriction licence>`. The player must hold that licence **from the
station's owner faction**.

| Category | Wares after layering | Defined by SWI | **With a Seller** | No Seller | Licences of the sold ones |
|---|---:|---:|---:|---:|---|
| Weapons | 69 | 58 | **57** | 12 (Xenon/Kha'ak) | 36 general use, 21 military |
| Turrets | 174 | 165 | **163** | 11 (Xenon/Kha'ak) | 128 general use, 15 military, 20 capital |
| Shields | 96 | 75 | **73** (+2 `missiononly`) | 21 (Xenon/Kha'ak/base) | 31 general use, 25 military, 17 capital |
| Engines | 134 | 118 | **112** (+5 `missiononly`) | 17 (Xenon/Kha'ak/base) | 83 general use, 16 military, 13 capital |
| Thrusters | 18 | 0 | **18** (ownerless) | 0 | none |
| Missiles | 39 | 18 | **18** (13 ownerless) | 21 (base/Split, handed to Kha'ak or Split) | 18 general use |
| Drones | 12 | 0 | **5** (ownerless) | 7 (base police drones) | none |
| Deployables | 10 | 0 | **7** (ownerless) | 3 (laser towers, Yaki mine) | none |
| Countermeasures | 1 | 0 | **1** (ownerless) | 0 | none |
| Software | 13 | 0 | **13** (ownerless) | 0 | none |
| **Total** | **566** | **434** | **467** | **92** | |

*"With a Seller"* leaves out the 7 `missiononly` wares (engines and shields of the Executor, Home One,
MC85, Praetor and Bellator, all of which issue #15 already excludes as Ships). Every
SWI-defined weapon, turret, shield, engine and missile has at least one Seller. Every base or DLC ware in
those five categories has **none**, because SWI hands it to Xenon/Kha'ak (or it keeps Split owners).

**Where:** 73 stations in `god.xml`, run by 25 factions, can equip ships:

- 31 wharves;
- 20 shipyards, plus 1 small shipyard and 4 XXL shipyards;
- 10 equipment docks;
- 3 Black Sun asteroid bases, 1 Black Sun refit facility and 3 Pirate Syndicates outposts.

These are exactly the factions that are ship Sellers in #15. No other faction can sell equipment.

**Can it all be derived from files?** Yes, mechanically, with one rule that is **[inferred]**: an
ownerless ware counts as sold by every faction. Strong evidence for that rule is in the next section. All the inputs are in the files: owners, station chains, `<equip classes>`, licences and
licence thresholds. Nothing needs a hand-kept list. SWI has no MD script that overrides a station's
equipment list.

## 1. How the game decides what a station offers

### 1.1 The list comes from the owner faction **[documented + verified]**

The shipyard menu fills its equipment list with one engine call **[verified, Lua]**:

```lua
-- menu_ship_configuration.xpl (SWI's copy), menu.getDataAndDisplay
n = C.GetNumAvailableEquipment(menu.container, "")
n = C.GetAvailableEquipment(buf, n, menu.container, "")
```

`menu.container` is the station. The function runs inside the engine. Egosoft's script docs say what it
returns **[documented]**:

- `scriptproperties.xml`, `container.buildequipment.wares`: "All equipment wares this object can
  build (= default items + included items - excluded items)".
- `common.xsd`, `<set_equipment_wares_absolute>`: "…ignoring any defaults **for the object
  owners' faction** (only applies to objects with build modules such as shipyards or equipment
  docks)". The `_included` and `_excluded` variants say the same.

So the defaults are per **owner faction**. The only per-faction equipment link in the data is the ware's
`<owner faction>` list. That is the same mechanism #15 confirmed for ships, which have a matching
`set_ship_wares_*` family. **[inferred, high confidence]**

**No MD overrides in SWI [verified].** I searched every `md/` and `aiscripts/` file in all 7 layers
for `set_equipment_wares` and `buildequipment`. There are 2 base-game uses:

- `ego_dlc_pirate/md/setup_dlc_pirate.xml` sets an absolute list on the Alliance of the Word wharf.
  That wharf is created in `Cluster_502_Sector001_macro`, a vanilla sector that SWI's galaxies
  (`swi_galaxy_macro`, `sws_galaxy_macro`) do not use **[inferred]**.
- `base/md/x4ep1_mentor_subscription.xml` only *queries* `canbuildequipment`.

SWI's own MD never calls these actions.

### 1.2 Ownerless wares are sold by everyone **[inferred, strong evidence]**

All of the following have **no `<owner>`** after layering:

- base thrusters (18);
- software (13);
- flares (1);
- the generic drones (cargo, repair, building, 2 mining);
- satellites, resource probe, nav beacon and the 3 generic mines;
- SWI's own 13 general missiles (proton, concussion, ion, rocket, Proton Bomb, Boron cruise).

If "owner" were a strict filter, no station in base X4 or in SWI could sell a thruster or software. The data
also shows SWI relying on this rule:

- Base `missile_dumbfire_light_mk1` (and the other 16 base missiles) has no owner in base
  `wares.xml`. SWI's `wares.xml` then *adds* `<owner faction="khaak"/>` to each of them
  (`<add sel="//wares/ware[@id='missile_dumbfire_light_mk1']"><owner faction="khaak"/>…`). Adding
  an owner only makes sense if it *narrows* availability from "everyone" to "the owner".
- SWI fully `replace`s `countermeasure_flares_01` and still gives it no owner.

**Still not confirmed in game:** that an SWI station actually lists, for example,
`thruster_gen_s_allround_01_mk1`.

### 1.3 The station must have an equip-capable build module **[verified + documented]**

Build-module macros carry three class lists. `<builder classes>` builds ships. **`<equip classes>`
changes loadouts.** `<supply classes>` resupplies. For example
`base → assets/structures/buildmodule/macros/buildmodule_gen_equip_m_dockarea_01_macro.xml`:

```xml
<builder optimalprocessorunits="10" usemasstraffic="0" />   <!-- no classes: builds no ships -->
<equip classes="ship_m ship_s" />
<supply classes="ship_m ship_s" />
```

- The script docs define `container.canequipclass.{$class}` as "has a build module capable of
  equipping objects of this class". They define `isequipmentdock` as "can change loadouts … but
  cannot build ships" **[documented]**.
- The menu removes any ship from the selection unless `C.CanContainerEquipShip(station, ship)` or
  `CanContainerSupplyShip(station, ship)` is true **[verified, Lua]**.
- **Equipment-dock modules** (`buildmodule_{gen,imp,bor,ter}_equip_{m_dockarea,l,xl}`,
  `buildmodule_sw2025_gen_equip_m_dockarea`) have equip and supply classes but **no** builder classes.
  Ship build modules equip the same classes they build.
- `pier_golan3_pier_macro` is a `buildmodule` with `<equip classes="ship_xl"/>`. It is attached to
  several shipyards and equipment docks.

I used the same chain as #15: god.xml station → stations.xml (`category tags` + `faction`) →
stationgroups.xml → constructionplans.xml → module macro, layered through `index/macros.xml`.
Then I took the union of `<equip classes>`.

**Equip classes by station type** **[verified]**:

| Station type (`god.xml` select tags) | Count | Equips |
|---|---:|---|
| `[wharf]` | 31 | S, M. Exception: the Rebel Alliance wharf `rbl_warf` also has `buildmodule_gen_equip_l/xl`, so it equips L and XL. |
| `[shipyard]` | 20 | L, XL. Exceptions: the Hapes yard and the 3 Sith foundries also have M/S modules, so they equip all classes. |
| `[shipyardsmall]` | 1 | L, XL |
| `[shipyard_xxl]` | 4 | XL |
| `[equipmentdock]` | 10 | S, M, L, XL. They build no ships. Owners: Galactic Empire ×2, New Republic ×2, Corporate Sector ×2, Ascendancy, Commerce Guild, Death Watch, Anoat. |
| `[pirateasteroidbase]` (Black Sun) | 3 | S, M, L |
| `[refitfacility]` (Black Sun) | 1 | XL |
| `[pirateoutpost]` (Pirate Syndicates) | 3 | S, M, L |

There are none in game starts. `md/setup_sw_xxl_stations.xml` rebuilds the 4 XXL yards
(Galactic Empire, Ascendancy, CSA, Commerce Guild) after they are destroyed, using the same plans. That
adds no new Sellers. `md/swi_piratesrebuild.xml` rebuilds Pirate Syndicates stations at runtime,
which also adds no new Sellers.

**Equip classes per faction** (union over its stations):

- **All of S, M, L and XL (19 factions):** Anoat, Ascendancy, Black Sun, Commerce Guild, Corporate
  Sector, Galactic Empire, Hapes, Hoersch-Kessel, Hutt Cartel, Kamino, Kuat, Death Watch, Mon
  Calamari, New Republic, Rebel Alliance, Rendili, Sienar, Sith, TransGalMeg.
- **S, M and L only (1):** Pirate Syndicates (`valarian`).
- **S and M only (5):** Bounty Hunters, Corellia, Incom, Mining Guild, Naboo.

### 1.4 Size and class: a filter, not a rule in the list **[inferred]**

`GetAvailableEquipment(container, "")` is called with an empty class. The menu then shows only what
fits the slots of the ship being configured, and the ship has to be of a class the station can equip.
So an S/M-only wharf never lets you fit an L shield, even if its faction owns that shield.

I applied this as a filter. To find which ship classes use each slot size, I collected every `<connection>` tagged
`weapon`/`turret`/`shield`/`engine`, and the ship macro's `<thruster tags>`, across the components and macros
of every ship ware. The equipment's size is the size tag on its own connection. For an
equipment item with no size tag, I applied no filter. The filter drops only a few faction–ware pairs,
for example:

- `engine_rendili_isd` (XL) is not sold by Naboo, Corellia or Incom;
- L/XL thrusters are not sold by the 5 S/M-only factions or by the Pirate Syndicates.

The exact slot-tag match is out of scope here. A naive "equipment tags ⊆ slot tags" check finds no slot
on any Ship for:

- 40 sold turrets: Executor, Bellator and Subjugator turret variants, and station turrets;
- 2 shields;
- 1 engine;
- 2 launchers (`weapon_mg1launcher`, `weapon_mg9launcher`).

These have Sellers but probably can't be fitted to any buildable Ship. A loadout-compatibility
ticket should confirm the matching rule, which for SWI includes components whose type connection
is not tagged `component`.

### 1.5 What does *not* decide it [verified]

- **Station tags and names.** As for ships, only modules count. The Rebel Alliance wharf, Hapes
  shipyard and Sith foundries break the "wharf = S/M, shipyard = L/XL" rule.
- **`libraries/stock.xml`.** It only stocks NPC traders' *inventory* items (spacesuit gear,
  seminars). It is not ship equipment.
- **Blueprint tags.**
  - `noblueprint` and `noplayerblueprint` matter only for player-owned stations. The menu passes
    `playerblueprint` only in custom-game-start mode.
  - `blueprintsaleonly` and `limited` are on no equipment ware. `isblueprintsaleonly` would lock a ware
    at NPC stations.
- **Research.** No equipment ware has a `<research>` precursor. The menu skips the licence check in
  favour of research when one exists.

## 2. Licences

**Mechanism [verified, Lua]**:

```lua
-- menu.checkLicence
local tradelicence, isblueprintsaleonly, researchprecursors, islimited = GetWareData(ware, "tradelicence", …)
...
haslicence = HasLicence("player", tradelicence, menu.containerowner)
```

- The ware's `<restriction licence="…"/>` gives `tradelicence`. The licence must come from the
  **station owner**.
- Without it, the slot button is drawn inactive (`useable = hasstock and haslicence`). For the ship
  itself, the purchase is blocked (`menu.validLicence`).

**Licence per category** (sold wares only; from `wares.xml`) **[verified]**:

- Weapons, turrets, shields and engines carry one of `generaluseequipment`, `militaryequipment` or
  `capitalequipment`. Counts are in the TL;DR table.
- `capitalequipment` appears on L/XL items, 3 medium turrets and 16 shields that have no size tag.
- SWI missiles all need `generaluseequipment`.
- Thrusters, drones, deployables, flares and software need **no licence**.
- One ware lists `generaluseequipment` twice. That is harmless.

**How a faction grants each licence** (`factions.xml`, `<licences><licence type minrelation precursor price>`)
**[verified]**:

| Faction group | general use | military | capital |
|---|---|---|---|
| Galactic Empire, Ascendancy, New Republic, Rebel Alliance, Sith, CSA, Commerce Guild, Hutt Cartel, Death Watch, Anoat, Hapes | rel ≥ −0.01 | rel ≥ 0.01, needs `ceremonyfriend` | rel ≥ 0.1, needs `ceremonyally` |
| Naboo | ≥ −0.01 | ≥ 0.01 | ≥ −0.01, free |
| Corellia, Hoersch-Kessel, Rendili, Incom, Mon Cal, Sienar, TransGalMeg, Kamino, Kuat, Mining Guild | ≥ −0.01, free | ≥ −0.01, **for credits** (100 k–2 M) | ≥ −0.01, **for credits** (0.5 M–10 M; Mining Guild free) |
| Black Sun | ≥ −0.01, 50 k | ≥ −0.01, 500 k | ≥ 0.1, needs `ceremonyally` |
| Pirate Syndicates | ≥ −0.01, 50 k | ≥ −0.01, 500 k | ≥ −0.01, 500 k |
| Bounty Hunters | ≥ −0.01, 100 k | ≥ −0.01, 1 M | ≥ −0.01, 500 k |

Two more points:

- **Player starting grants [verified].** SWI adds a `generaluseequipment` (and `generaluseship`)
  entry to the `player` faction with `factions="galempire ascendancy newrepublic … valarian"`. That is all
  equipment-selling factions **except Sith and Black Sun**. `factions.xsd` defines the attribute as
  "Factions that have granted a license of the specified type".
- **Inter-faction sharing [verified].** Several NPC factions share licences, for example New Republic ←
  Mon Cal, Rebel Alliance and Incom. These are *NPC* grants, which affect what NPC factions may buy. The player check
  uses `HasLicence("player", …, stationowner)`.
- The UI shows reputation, not raw relation. Raw −0.01, 0.01 and 0.1 correspond to UI −10, +10
  and +20. That uses X4's usual log mapping and is **[inferred]**.

## 3. Sellers per faction

Number of Equipment wares each faction sells (sold wares only, size filter applied):

| Faction | Weapons | Turrets | Shields | Engines | Thrusters | Missiles | Drones | Deployables | Counterm. | Software |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Kuat Drive Yards (`kuat`) | 25 | 59 | 35 | 39 | 18 | 13 | 5 | 7 | 1 | 13 |
| Galactic Empire (`galempire`) | 22 | 56 | 33 | 34 | 18 | 13 | 5 | 7 | 1 | 13 |
| Imperial Ascendancy (`ascendancy`) | 21 | 56 | 32 | 36 | 18 | 13 | 5 | 7 | 1 | 13 |
| New Republic (`newrepublic`) | 24 | 52 | 35 | 30 | 18 | 13 | 5 | 7 | 1 | 13 |
| Rebel Alliance (`rebelalliance`) | 24 | 51 | 34 | 29 | 18 | 13 | 5 | 7 | 1 | 13 |
| Sith Empire (`sith`) | 21 | 57 | 28 | 30 | 18 | 13 | 5 | 7 | 1 | 13 |
| Corporate Sector Authority (`corporate`) | 25 | 45 | 31 | 27 | 18 | 15 | 5 | 7 | 1 | 13 |
| Sienar Fleet Systems (`sienar`) | 22 | 52 | 26 | 29 | 18 | 13 | 5 | 7 | 1 | 13 |
| Independent Commerce Guild (`commerceguild`) | 24 | 45 | 29 | 29 | 18 | 14 | 5 | 7 | 1 | 13 |
| Mandalorian Death Watch (`mandodw`) | 25 | 44 | 27 | 24 | 18 | 15 | 5 | 7 | 1 | 13 |
| Anoat Federation (`anoat`) | 26 | 45 | 23 | 26 | 18 | 13 | 5 | 7 | 1 | 13 |
| Kamino (`kamino`) | 25 | 41 | 24 | 25 | 18 | 14 | 5 | 7 | 1 | 13 |
| Hoersch-Kessel Drive (`hoersh`) | 23 | 38 | 22 | 32 | 18 | 14 | 5 | 7 | 1 | 13 |
| Mon Calamari Shipyards (`moncal`) | 24 | 34 | 27 | 27 | 18 | 13 | 5 | 7 | 1 | 13 |
| Hutt Cartel (`huttcartel`) | 21 | 43 | 20 | 20 | 18 | 14 | 5 | 7 | 1 | 13 |
| Hapes Consortium (`hapes`) | 22 | 41 | 20 | 19 | 18 | 13 | 5 | 7 | 1 | 13 |
| Pirate Syndicates (`valarian`) | 23 | 37 | 16 | 26 | 15 | 14 | 5 | 7 | 1 | 13 |
| Rendili Drive Yards (`rendili`) | 20 | 31 | 21 | 23 | 18 | 13 | 5 | 7 | 1 | 13 |
| TransGalMeg Industries (`transgalmeg`) | 20 | 28 | 20 | 23 | 18 | 13 | 5 | 7 | 1 | 13 |
| Black Sun (`blacksun`) | 19 | 27 | 20 | 21 | 18 | 13 | 5 | 7 | 1 | 13 |
| Incom Corporation (`incom`) | 24 | 26 | 20 | 19 | 12 | 13 | 5 | 7 | 1 | 13 |
| Corellian Engineering Corp. (`corellia`) | 21 | 25 | 21 | 21 | 12 | 13 | 5 | 7 | 1 | 13 |
| Naboo Royal Authority (`naboo`) | 18 | 19 | 21 | 13 | 12 | 13 | 5 | 7 | 1 | 13 |
| Bounty Hunters Guild (`bountyhunters`) | 15 | 18 | 19 | 13 | 12 | 14 | 5 | 7 | 1 | 13 |
| Mining Guild (`miningguild`) | 4 | 16 | 20 | 9 | 12 | 13 | 5 | 7 | 1 | 13 |

Spread of Sellers per ware:

- Weapons and turrets: median 5 Sellers per ware, range 1–25.
- Shields and engines: median 3, range 1–25.
- Ownerless wares: all 25 factions. L/XL thrusters: 19–20.

## 4. Examples per category [verified unless marked]

| Category | Ware | Size | Licence | Sellers |
|---|---|---|---|---|
| Weapon | `weapon_kx5_s_laser`, TB KX5 Laser Cannon | S | general use | 15: New Republic, Rebel Alliance, Death Watch, Anoat, Hapes, Kamino, Corellia, Hoersch-Kessel, Rendili, Incom, TransGalMeg, Black Sun, Mon Cal, Bounty Hunters, Kuat |
| Weapon | `weapon_kx7_s_laser`, TB KX7 Laser Cannon | S | **military** | 6: New Republic, Rebel Alliance, Anoat, Incom, Hapes, Kuat |
| Weapon (launcher) | `weapon_protonlauncher`, Krupx Medium Warhead Launcher | M | general use | 23 factions |
| Turret | `turret_vcx100_short`, V-1 Laser Turret | S | general use | 11: Corellia, Hoersch-Kessel, Rendili, Incom, TransGalMeg, Black Sun, Mon Cal, Anoat, Death Watch, Hutt Cartel, Pirate Syndicates |
| Turret | `turret_cis_dual_xl`, HKD Super Heavy Turbolaser | XL | **capital** | 2: Commerce Guild, Hoersch-Kessel |
| Shield | `shield_fulgor`, Fulgor L Shield | (tag-locked to 1 hull) | military | 1: Ascendancy |
| Engine | `engine_arc170`, 3L3 Fusial Thrust Engine | S | general use | 6: CSA, Kamino, Pirate Syndicates, Mon Cal, Kuat, Incom |
| Engine | `engine_rendili_isd`, Rendili Heavy SLx Engine | XL | general use | 20. The S/M-only Naboo, Corellia and Incom are filtered out. |
| Thruster | `thruster_gen_l_allround_01_mk1`, L All-round Thrusters Mk1 | L | none | 20 **[inferred: ownerless]** |
| Missile | `missile_proton_light`, MG7-A Light Proton Torpedo | n/a | general use | all 25 **[inferred: ownerless]** |
| Missile | `missile_carbonite`, Carbonite Missile | n/a | general use | 2: Death Watch, Pirate Syndicates. Third owner `mandoraiders` runs no station. |
| Missile | `seismic_charge`, Void-7 Seismic Charge | n/a | general use | 1: Bounty Hunters |
| Drone | `ship_gen_xs_repairdrone_01_a`, Repair Drone | n/a | none | all 25 **[inferred: ownerless]** |
| Deployable | `satellite_mk2`, `weapon_gen_mine_01` | n/a | none | all 25 **[inferred: ownerless]** |
| Countermeasure | `countermeasure_flares_01`, Flares | n/a | none | all 25 **[inferred: ownerless]** |
| Software | `software_targetmk2`, Targeting Computer Extension Mk2 | n/a | none | all 25 **[inferred: ownerless]**. Which software a ship can take comes from its macro's `<software>` list (see the #3 research). |

**Without a Seller** **[verified]**:

- Weapons, turrets, shields and engines owned only by `xenon` or `khaak`, for example
  `weapon_xen_s_laser_01_mk1` and `turret_kha_l_beam_01_mk1`.
- The 17 base missiles, which SWI moves to `khaak`, and the 4 Split DLC missiles, which keep owners
  `court`/`freesplit`/`split`. Those factions run no station in SWI.
- 7 police drones (base faction owners).
- 2 laser towers (`khaak`) and the Yaki `weapon_clustermine_01`.
- `subjugator_ion_weapon`, whose owner is literally `ownerless`.

## 5. Is it all derivable from the files?

| Input | Derivable? |
|---|---|
| Equipment wares and their category (ware `tags`: `weapon`, `turret`, `shield`, `engine`, `thruster`, `missile`, `drone`, `countermeasure`, `software`/`transport="software"`, deployables = `satellite`/`mine`/`lasertower`/`navbeacon`/`resourceprobe`, matching the menu's own grouping) | Yes **[verified]**. Skip `transport="inventory"` / `personalupgrade` (spacesuit items). |
| Owners, licence | Yes, from `wares.xml` **[verified]** |
| Stations that can equip, and their classes | Yes: god → stations → stationgroups → constructionplans → module `<equip classes>` **[verified]** |
| Licence thresholds and prices per faction, player starting grants | Yes, from `factions.xml` **[verified]** |
| Equipment size → ship classes | Yes, from component connection tags and ship slots **[verified data, inferred rule]** |
| "Owner faction ⇒ in the station's list" | Engine code; documented by Egosoft **[documented]** |
| "No owner ⇒ every faction" | Engine code; strong evidence in the data **[inferred]** |
| Runtime changes (stations destroyed or rebuilt, `set_equipment_wares_*`) | No SWI MD changes equipment lists **[verified]**. Destroyed or conquered stations are runtime state, out of scope. |

**Proposed rule for Game Data** (mirrors #15). For each Equipment ware:

- `sellers` = { faction F : (ware has no `<owner>` **or** F ∈ owners) **and** F runs a god.xml station
  whose modules' `<equip classes>` include a ship class that has a slot of the ware's size };
- `licence` = the ware's `<restriction licence>` (or none).

Leave out `missiononly` wares. Report every ware without a Seller with its reason (owner runs no
station / no fitting class / no slot fits), so changes show up in the snapshot diff.

## 6. Still to check

- In game: an SWI wharf lists ownerless base thrusters and software. That would confirm §1.2.
- In game: Pirate Syndicates outposts and the Black Sun refit facility actually sell (carried over
  from #15).
- The exact slot-matching rule for SWI components whose type connection is not tagged `component`.
  This affects the 40 turrets, 2 shields, 1 engine and 2 launchers that match no slot naively. It belongs to
  the loadout-compatibility work, not to Sellers.
- Whether the build module also needs a production `method` the faction can use. Base equipment
  wares have `method="default"` plus race methods, and SWI wares use `default`. I assumed it does not
  restrict anything **[inferred]**.
