# How X4 8.00 calculates ship stats from a loadout

Research for issue #4 (child of the wayfinder map, #1). Researched 2026-11-16 against the local
X4 8.00 install with SWI 0.9.1 HF (`starwarsmod_m1`, `starwars_rsp`).

## Short answer

- **The game does not expose its formulas.** The ship configuration menu gets every loadout stat
  from one engine (C++) call, `GetLoadoutStatistics5` / `GetCurrentLoadoutStatistics5` /
  `GetMaxLoadoutStatistics5`. The Lua side only converts units (rad/s to deg/s, m to km).
  So we have to reimplement the maths from community formulas and check them against the game.
- **Most stats are simple sums or ratios of XML attributes.** Hull, shield capacity and recharge,
  missile capacity, price and range come straight from macro attributes. Speeds and turning are
  `thrust / drag`. Accelerations are `thrust / mass` (or `/ inertia` for rotation).
- **Some stats are uncertain:** sustained DPS (heat model), how shield delay combines across
  generators, travel and boost acceleration, and anything shaped by the 7.50 flight model
  (jerk, curves, cargo mass). The community formulas were checked against in-game numbers only
  before 7.50, and only for speed. Nobody has published a check against 8.00 or SWI.
- **SWI uses the vanilla stat attributes.** SWI adds no custom stat system. Differences that
  matter: its own slot tags (e.g. `xwing`, `kx5`, `astromech`), all `libraries/*.xml` are XML
  diff patches over the base game, S/M ships use base-game thrusters, and a few attributes the
  base game never uses (see "What SWI changes").

## Source of truth in the game

`ui/addons/ego_detailmonitor/menu_ship_configuration.lua` (base game, `0?.cat`) declares the FFI
struct the engine fills in:

```
typedef struct {
  float HullValue; float ShieldValue; double ShieldDelay; float ShieldRate;
  float GroupedShieldValue; double GroupedShieldDelay; float GroupedShieldRate;
  float BurstDPS; float SustainedDPS; float TurretBurstDPS; float TurretSustainedDPS;
  float GroupedTurretBurstDPS; float GroupedTurretSustainedDPS;
  float ForwardSpeed; float BoostSpeed; float TravelSpeed;
  float YawSpeed; float PitchSpeed; float RollSpeed;
  float HorizontalStrafeSpeed; float VerticalStrafeSpeed;
  float ForwardAcceleration; float HorizontalStrafeAcceleration; float VerticalStrafeAcceleration;
  float BoostAcceleration; float BoostRechargeRate; float BoostMaxDuration;
  float TravelAcceleration; float TravelChargeTime;
  uint32_t NumDocksShipMedium, NumDocksShipSmall, ShipCapacityMedium, ShipCapacitySmall,
           CrewCapacity, ContainerCapacity, SolidCapacity, LiquidCapacity, CondensateCapacity,
           UnitCapacity, MissileCapacity, CountermeasureCapacity, DeployableCapacity;
  float RadarRange;
} UILoadoutStatistics5;
```

`Helper.convertLoadoutStats` (`ui/addons/ego_detailmonitorhelper/helper.lua`, line ~9057) copies
these fields and only converts Yaw/Pitch/RollSpeed from rad/s to deg/s and RadarRange from m to
km. **This list is effectively the menu of stats the in-game builder shows**, and a good
checklist for our stat set. Per-equipment numbers (`dps`, `sustaineddps`, `thrust_forward`,
`boost_thrustfactor`, `travel_thrustfactor`, `reloadrate`, ...) come from the engine's
`GetLibraryEntry(library, macro)`. The third-party `mycu_equipment_tooltips` mod in the install
uses that call, and it is computed in the engine too.

`libraries/defaults.xml` has a `<statistics><max>` block per ship class (e.g. XL
`engine forward="654.197"`). These are the scales for the UI comparison bars, not real ship
values, so they can't be used to check our formulas.

## Stat by stat

Notation: `ship.*` = ship macro `properties`, `eng.*` = engine macro, `thr.*` = thruster macro,
`N_eng` = number of engine slots filled (every engine slot on a ship takes the same engine in
practice).

### Hull — stored

`HullValue = ship.hull@max`. Engines, shields and weapons have `hull integrated="1"` or their
own `hull@max`. That is the component's own hit points, not added to the ship's hull.
Equipment mods are out of scope (#1). Confidence: high (direct attribute; UI field name).

### Shields — stored per generator, summed by the engine

Shield generator macro: `<recharge max="827" rate="82" delay="12.1"/>` (e.g.
`shield_arg_s_standard_01_mk1_macro`).

- `ShieldValue ≈ Σ recharge@max`, `ShieldRate ≈ Σ recharge@rate` over the shields mounted on the
  ship's own (non-group) shield slots.
- L/XL ships also have **grouped** shields, which sit in turret/shield groups (component
  connection `group` tags; SWI L loadouts use `<groups><shields group=… macro=… exact=…/>`).
  The engine reports these separately as `GroupedShield*`. A ship-wide "total shield" in the
  UI is `ShieldValue + GroupedShieldValue`. The engine does not combine them.
- **Delay:** each generator has its own `recharge@delay`. How the engine reduces them to one
  `ShieldDelay` (max? the value of the main generator?) is **unverified**. If all slots take the
  same shield, they are equal, so any rule gives the same answer for a uniform loadout.

Sources: game XML; Egosoft wiki shield tables list capacity/rate per generator
(<https://wiki.egosoft.com:1337/X4%20Foundations%20Wiki/Manual%20and%20Guides/Objects%20in%20the%20Game%20Universe/Equipment/Shield%20Generators>).
Confidence: high for capacity/rate sums, low for delay.

### Forward, boost and travel speed — calculated

Inputs: `eng.thrust@forward`, `eng.boost@thrust`, `eng.travel@thrust` (both are multipliers of
base thrust), `ship.physics/drag@forward`, `N_eng`.

```
ForwardSpeed = N_eng × eng.thrust@forward / ship.drag@forward
BoostSpeed   = ForwardSpeed × eng.boost@thrust
TravelSpeed  = ForwardSpeed × eng.travel@thrust
ReverseSpeed = N_eng × eng.thrust@reverse / ship.drag@reverse   (not in the UI struct)
```

- `max speed = thrust / drag` is on the official Egosoft wiki's movement formulae
  (<https://egosoft.com:8444/confluence/x/BgWjB>) and in an early forum data thread
  (<https://forum.egosoft.com/viewtopic.php?p=4824306>, 2019, multiplies by engine count).
- Egosoft's flight-parameter guide (written for 7.50, edited 2025-02-21) defines boost and
  travel thrust as "a multiplier of base thrust that sets maximum boost/TD speed"
  (<https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/Assets%20Modding/Guides/JPMFlight/>).
- **In-game check (pre-7.50):** a forum user fitted `Max Boost Speed = Max Boost Thrust / Drag`
  against the ship statistics screen. Top speed and boost gave the same drag (2.382) once the
  display's rounding to whole m/s was accounted for
  (<https://forum.egosoft.com/viewtopic.php?p=5243945>, Aug 2024). That is the only numeric
  comparison found, and it is from before 7.50.

Confidence: high for top/boost/travel *maximum* speed. The 7.50 update changed how ships get to
top speed (jerk, curves), not the `thrust/drag` limit.

### Forward and strafe acceleration — calculated

```
ForwardAcceleration          = N_eng × eng.thrust@forward / ship.physics@mass × ship.accfactors@forward
HorizontalStrafeAcceleration = thr.thrust@strafe / mass × accfactors@horizontal
VerticalStrafeAcceleration   = thr.thrust@strafe / mass × accfactors@vertical
HorizontalStrafeSpeed        = thr.thrust@strafe / ship.drag@horizontal
VerticalStrafeSpeed          = thr.thrust@strafe / ship.drag@vertical
BoostAcceleration            = ForwardAcceleration × eng.boost@acceleration   (assumed)
```

- `acceleration = thrust / mass` is on the Egosoft wiki formulae page and in roguey.co.uk's
  explainer with a worked example (<https://roguey.co.uk/x4/help/technical/engines_and_thrusters>).
- `accfactors` (forward/reverse/horizontal/vertical, default 1) are multipliers on acceleration.
  The JPMFlight guide: horizontal/vertical `0.85` "reduc[es] strafe acceleration by 15%", and
  says to change mass instead when all factors should move together.
- `boost@acceleration` is "a multiplier of base acceleration while boosting" (JPMFlight).
- Thrusters are virtual equipment (`<component virtual="1"/>`, `type="thrustertypes"`) picked by
  `ship.thruster@tags`. A ship has **one** thruster choice, not one per slot.
- **Cargo mass (7.50+):** the 7.50 FAQ says loaded freighters "experience more drift due to their
  increased mass" (<https://forum.egosoft.com/viewtopic.php?p=5269237>), and
  `libraries/parameters.xml` has `<physics><additionalmass max="0.25"/>`, which probably means cargo
  adds up to +25 % mass. The loadout UI most likely uses the empty ship. Unverified.
- **Travel acceleration and charge:** `TravelChargeTime = eng.travel@charge` (stored).
  `TravelAcceleration` is probably derived from `eng.travel@attack` (seconds to reach TD speed,
  per JPMFlight). Exact form unverified, and SWI sets `attack="0"` on many engines.

Confidence: medium. The basic `thrust/mass` is well sourced, but where `accfactors` sit and the
boost/travel acceleration formulas are inferred from attribute descriptions, not checked in game.

### Turning — calculated

Inputs: thruster `thrust@yaw/pitch/roll`, ship `physics/drag@yaw/pitch/roll`,
`physics/inertia@yaw/pitch/roll`. Some engines also have `thrust@yaw/pitch/roll` or
`<angular>`. The base-game attribute list includes `engine/thrust@yaw|pitch|roll` and
`engine/angular@pitch|roll`.

```
YawSpeed   = thr.thrust@yaw   / ship.drag@yaw        (pitch, roll alike)
YawAccel   = thr.thrust@yaw   / ship.inertia@yaw
```

- From roguey's worked example (184 / 2.585 ≈ 71). The engine returns rad/s and the Lua turns
  it into deg/s. So either thrust is in degree-based units or the engine converts internally.
  This needs a check against one in-game number before we trust the units.
- `ship.rotationspeed@max` / `rotationacceleration@max` (base S ships: 1000) look like caps.
  Many SWI ships leave them out.
- `steeringcurve` scales turning by current speed (≈7.5–10 % at full travel speed). It shapes
  turning in flight, not the static stat (JPMFlight).

Confidence: medium-low (single community source; units unclear).

### Boost duration and recharge — stored

`BoostMaxDuration = eng.boost@duration` (seconds). `BoostRechargeRate` comes from
`eng.boost@recharge` (e.g. 92 base, 80 SWI X-wing). The unit is unclear: maybe %/s, maybe the
seconds for a full recharge. Global `boost threshold/rechargedelay/minduration` are in
`defaults.xml`. Confidence: medium for duration, low for recharge semantics.

### Weapon and turret DPS — calculated

Weapon/turret macro: `bullet@class` (points to a bullet macro), optional `reload@rate|time`,
`heat@overheat|cooldelay|coolrate|reenable`. Bullet macro (`assets/fx/weaponFx/macros`):
`damage@value|shield|hull|repair`, `bullet@amount|barrelamount|speed|lifetime|range|maxhits`,
`reload@rate|time`, `ammunition@value|reload` (burst weapons), `heat@value`.

Rate of fire (from X4_Customizer, bvbohnen, public source, last commit 2024-06-30 —
`Plugins/Classes/Weapons.py: Get_Rate_Of_Fire`):

```
rate = reload@rate, or 1 / reload@time
if no ammunition@reload:            rof = rate
else (burst weapon):                rof = ammo_rounds / (ammunition@reload + (ammo_rounds - 1) / rate)
BurstDPS (per weapon) = rof × damage × bullet@amount     (skip repair weapons)
```

X4_Customizer notes that **the game's own encyclopedia got burst-weapon RoF wrong** in 1.5 and
3.0. So our "correct" number may not match the game's, and the target should be matching the
game.

Sustained DPS: the Egosoft manual says sustained output is what's left after overheating and
shutdowns
(<https://wiki.egosoft.com/X4%20Foundations%20Wiki/Manual%20and%20Guides/X4%3A%20Foundations%20Manual/Combat%20And%20Weapons/>).
No published formula. A plausible model, to check in game:

```
H = heat@value × rof                    (heat per second)
if H <= coolrate: Sustained = Burst
else: t_fire = overheat / (H - coolrate); t_cool = cooldelay + (overheat - reenable) / coolrate
      Sustained = Burst × t_fire / (t_fire + t_cool)
```

Base turrets have no heat, so sustained = burst. **SWI** turrets (`starwars_rsp`) *do* add
`heat@overheat|cooldelay|coolrate|reenable` to turrets.

Loadout totals: `BurstDPS/SustainedDPS` = sum over forward weapons. `TurretBurst/Sustained` =
sum over ungrouped turrets. `GroupedTurret*` = turrets in L/XL groups. Range per weapon =
`bullet@range` if set (beams), else `bullet@speed × bullet@lifetime`. Example: base S laser Mk1 =
4147 × 0.75 ≈ 3.1 km, burst 7 × 32 = 224 DPS, heat 371/s < coolrate 2000, so sustained = burst.

Confidence: high for single-shot weapon burst DPS and range. Medium for burst weapons (the game
itself has had bugs). Low for sustained DPS.

### Missile capacity — stored and summed

`MissileCapacity ≈ ship.storage@missile + Σ launcher.storage@capacity` (base missile launchers
carry `storage capacity="1"`/`"2"`). Missile turrets are similar. Countermeasure/deployable/unit
capacities also come from `ship.storage@…`. Many SWI fighters have `storage missile="0"` or `"6"`.
Confidence: medium (summing launcher capacity is inferred from the attributes).

### Price — stored in wares

Each ship and piece of equipment is a ware in `libraries/wares.xml` with
`<price min average max>` and `<component ref="…_macro"/>`. A loadout's price is about
`ship ware price + Σ equipment ware prices + consumables`. The in-game price also depends on the
shipyard's faction, relations and supply, so show `average` (or a min–max range). SWI's
`wares.xml` is a diff patch that adds wares (e.g. `t65xj3_xwing` 246 085 / 308 100 / 400 115).
Confidence: high for the data, medium for whether to show it.

## Worked example (SWI T-65B X-wing, file values only, not checked in game)

`t65b_xwing_01_macro`: mass 6, drag forward 6.65 / horizontal 8 / yaw 4, accfactors forward 0.5 /
horizontal 1.4, 4 engine slots tagged `engine small xwing`. `engine_xwing_macro`: thrust forward
550, boost thrust 2.5, travel thrust 21.6, charge 4. Thruster: base `thruster_gen_s_allround_01_mk1`
(strafe 400, yaw 160).

| Stat | Formula | Value |
|---|---|---|
| Forward speed | 4 × 550 / 6.65 | 330.8 m/s |
| Boost speed | × 2.5 | 827 m/s |
| Travel speed | × 21.6 | 7 145 m/s |
| Forward accel | 2200 / 6 × 0.5 | 183 m/s² |
| Strafe speed | 400 / 8 | 50 m/s |
| Yaw | 160 / 4 | 40 °/s (units unverified) |

**Next step:** compare this row with the X-wing's in-game ship configuration screen. One
screenshot settles accfactors, the turning units and whether 7.50+ changed anything.

## What SWI changes

Found by comparing every `macro/properties` attribute path in SWI against base + all five DLCs:

- **No new stat system.** SWI ships, engines, shields and weapons use the vanilla attributes.
- **Extra attributes the base game never uses:** `engine/travel@acceleration|coast|recharge`
  (only `bellator_engines_macro`, probably ignored by the engine),
  `bullet/areadamage@hull|noshield|repair`, `missile/explosiondamage@hull|shield`,
  `ship/threatscore@value`, `ship_xl/boarding@resistance`; `starwars_rsp` adds heat to turrets.
  Treat area/explosion hull/shield splits as real damage types when computing DPS.
- **Own slot tags:** e.g. X-wing weapon slots tagged `kx5 kx7 kx10 tie7 tie1`, engines `xwing`,
  a shield slot `astromech` (R2 units are shield generators, `shield_s_r2astro_macro`). Slot
  compatibility follows component connection tags, which matters for the Game Data ticket.
- **Diff patches:** all SWI `libraries/*.xml` (wares, loadouts, defaults…) are XML diff patches
  (`<diff><add sel=…>/<replace sel=…>`) over the base game. The pipeline has to apply them.
  `subst_*.cat` files replace base assets outright.
- **Thrusters:** SWI only ships L/XL thrusters. S/M ships use the base-game `thruster_gen_s/m_*`.
- **Travel drives:** many SWI engines set `travel attack="0" release="0"`.

## Open questions

1. Check the formulas against in-game 8.00 + SWI numbers (one screenshot per stat family) before
   building the stat engine. Also check the engine-count multiplier and `accfactors`.
2. Shield delay with mixed generators; which shield slots count as "grouped".
3. Sustained DPS heat model; whether to copy the game's burst-weapon RoF quirks.
4. Turning units and the role of `rotationspeed@max`.
5. `boost@recharge` meaning; travel acceleration with `attack="0"`.
6. Does the loadout screen include cargo mass (`additionalmass`)? Probably not.
7. Which stats v1 shows. The `UILoadoutStatistics5` field list is a ready-made candidate set.

## Method

Extracted base `0?.cat`, the five DLC `ext_0?.cat`, and SWI `ext_*/subst_*.cat` into a scratch
directory with a small cat/dat reader (each `.cat` line is `path size mtime md5`; files sit back
to back in the `.dat`). Read UI Lua and macro XML. Diffed attribute paths with a Python script.
Web sources were Egosoft wiki/forum, roguey.co.uk, X4_Customizer source
(<https://github.com/bvbohnen/X4_Customizer>).
