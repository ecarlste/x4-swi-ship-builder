# Where X4 8.00 computes the stats its ship screens show

Research for issue #12 (child of the wayfinder map, #1). Researched 2026-11-17 against the local
X4 8.00 install with SWI 0.9.1 HF (`starwarsmod_m1`). Follows on from
[x4-stat-formulas](https://github.com/ecarlste/x4-swi-ship-builder/blob/research/x4-stat-formulas/docs/research/x4-stat-formulas.md)
and the in-game measurements in the issue #12 comments.

## Short answer

- **Lua does no stat maths on either screen.** Every number in the shipyard's **Ship Statistics**
  panel is a field of one engine struct, `UILoadoutStatistics5`, which the engine fills in
  (`GetLoadoutStatistics5` / `GetCurrentLoadoutStatistics5` / `GetMaxLoadoutStatistics5`). Lua
  only converts units: rad/s to °/s, and m to km. The **info panel** reads speeds, per-direction
  DPS and weapon range from three more engine calls: `GetDefensibleSpeeds`, `GetDefensibleDPS`
  and `GetDefensibleWeaponFireRange`. **All of the turret maths, including which directions a
  turret covers, is inside the closed `X4.exe`.** No Lua or XML decides it.
- **Rounding differs between the screens, and that's in Lua.** Ship configuration uses
  `Helper.floor(x, accuracy)`, so it **truncates**. The info panel uses `Helper.round(x)`, so it
  **rounds to nearest**. This explains boost 438 vs 439.
- **Turret DPS, best fit to the in-game data (unconfirmed):** the engine's turret rate of fire is
  the 3.0-era "encyclopedia" magazine formula, `mag / (ammo_reload + mag / bullet_rate)`. The
  turret macro's own `<reload rate="1" time="1">` plays no part. With that rate:

  ```
  S_turret = (damage@value + damage@noshield) × bullet@barrelamount × mag / (ammo_reload + mag / reload@rate)
  Avg. Turret Output (non-capship) = Σ_turrets S_turret / 6
  ```

  This gives exactly the three Avg. Turret Output values we have: YT-1300 with 2× RM-76 = 138.1
  (138 shown), with 1× RM-76 = 69.05 (69), and Gozanti with 2× RH2 = 148.0 (148). It does **not**
  explain the info panel's per-direction burst of 422 per RH2 turret. See
  [Turret output](#turret-output-the-priority) for the competing fit and the in-game checks that
  would settle it.
- **The encyclopedia shows per-turret DPS.** Turret entries show "Weapon Output" and "Rate of
  Fire" from `GetLibraryEntry` (an engine global). That is a per-turret number with no direction
  coverage, and the cheapest way to confirm the formula: read the RH2 and RM-76 entries in game.

## Which files are in effect

- The base UI is in `08.cat`: `ui/addons/ego_detailmonitor/menu_ship_configuration.lua`,
  `menu_map.lua`, `menu_encyclopedia.lua`, `ego_detailmonitorhelper/helper.lua`,
  `ego_interactmenu/menu_interactmenu.lua`. Later base catalogs don't replace them.
- **SWI replaces all of these** through `extensions/starwarsmod_m1/subst_02.cat`, as `.xpl` files
  with the same paths (e.g. `menu_ship_configuration.xpl`, `menu_map.xpl`, `helper.xpl`). They
  are plain-text Lua, the base file plus kuertee/UIX callback hooks. I diffed the parts traced
  here (the `stats` table, the stats-panel renderer, `Helper.convertLoadoutStats`, and the
  info-panel defence block) against the base `.lua`. **They are identical**, so SWI changes no
  stat or rounding logic. Line numbers below are from the SWI `.xpl` after stripping CR, with the
  base `.lua` line in brackets.
- No other extension and no DLC in the install ships `ui/` files in a catalog.
  (`mycu_equipment_tooltips` has a loose `ui/` folder but was off for the measurements.)
- Text comes from `t/0001-l044.xml` (`09.cat`).

## (a) Ship configuration: "Ship Statistics" panel

### Data flow

1. `menu_ship_configuration.xpl` ~8786–8808 [base ~8680]:
   - planned macro: `C.GetLoadoutStatistics5(0, menu.macro, loadout)`
   - upgrading an existing ship: `C.GetLoadoutStatistics5(menu.object, "", loadout)`, compared
     with `C.GetCurrentLoadoutStatistics5(menu.object)`
   - bar maximum: `C.GetMaxLoadoutStatistics5(menu.object, menu.macro)`
2. Each result goes through `Helper.convertLoadoutStats` (`helper.xpl` 9193 [base 9057]). That
   function copies fields one-to-one, except for:
   ```lua
   result.YawSpeed   = stats.YawSpeed   * 180 / math.pi   -- rad -> deg conversion
   result.PitchSpeed = stats.PitchSpeed * 180 / math.pi
   result.RollSpeed  = stats.RollSpeed  * 180 / math.pi
   result.RadarRange = stats.RadarRange / 1000            -- m -> km
   ```
3. The row list is `config.stats` (`menu_ship_configuration.xpl` 741–791 [base same]). For
   L/XL ships, rows with `capshipid` swap their field: `id = iscapship and entry.capshipid or id`
   (8844). `iscapship` = `ship_l` or `ship_xl` class.
4. Formatting (8855–8866):
   ```lua
   if entry.type == "UINT" then
     value = ConvertIntegerString(Helper.round(loadoutstats[id], 0), true, 0, true, false)
   elseif (entry.type == "float") or (entry.type == "double") then
     local int, frac = math.modf(Helper.floor(loadoutstats[id], entry.accuracy))
     value = ConvertIntegerString(int, true, 0, true, false)
     if entry.accuracy > 0 then
       frac = Helper.round(math.abs(frac or 0) * (10 ^ entry.accuracy))
       value = value .. ReadText(1001, 105) .. string.format("%0".. (entry.accuracy) .."d", frac)
     end
   end
   ```
   `Helper.floor(x, d) = math.floor(x * 10^d) / 10^d` and
   `Helper.round(x, d) = math.floor(x * 10^d + 0.5) / 10^d` (`helper.xpl` 821–845).
   `ConvertIntegerString` is a native engine global (its name and error strings are in `X4.exe`).
   Here it only adds thousands separators to a number that is already an integer.

So **floats and doubles are truncated to `accuracy` decimals, and UINTs are rounded to nearest**
(they're integers anyway). The "decimal" step re-rounds the already-floored fraction, which only
removes float noise.

### Stat table

FFI struct `UILoadoutStatistics5` (declared at `menu_ship_configuration.xpl` 320–364). "Engine"
means the value is computed in `X4.exe`. The formula column links to what issue #12 confirmed
against the files.

| Row (text id) | Field | Lua maths | Display |
|---|---|---|---|
| Hull (1001/8048) | `HullValue` | none | floor, 0 dp |
| Shield (8049) | `ShieldValue` (`GroupedShieldValue` row 8533 for groups) | none | floor, 0 dp |
| Shield recharge rate (8553) | `ShieldRate` / `GroupedShieldRate` | none | floor, 0 dp |
| Shield recharge delay (8554) | `ShieldDelay` / `GroupedShieldDelay` (double) | none | floor, 2 dp (`inverted` only flips the colour) |
| Radar range (8068) | `RadarRange` | `/ 1000` (m→km) | floor, 0 dp |
| Burst Weapon Output (8073 → 9092) | `BurstDPS` | none | floor, 0 dp |
| Sustained Weapon Output (8074 → 9093) | `SustainedDPS` | none | floor, 0 dp |
| Avg. Turret Output (8532, tooltip 1026/8017) | `TurretSustainedDPS`; L/XL: `GroupedTurretSustainedDPS` | none | floor, 0 dp |
| Container / Solid / Liquid / Condensate | `ContainerCapacity` … `CondensateCapacity` (UINT) | none | round, 0 dp |
| M/S dock count, M/S ship storage | `NumDocksShip*`, `ShipCapacity*` (UINT) | none | round |
| Speed (8051) | `ForwardSpeed` | none | floor, 0 dp |
| Acceleration (8069) | `ForwardAcceleration` | none | floor, 0 dp |
| Boost speed (8052) | `BoostSpeed` | none | floor, 0 dp |
| Boost acceleration (8590) | `BoostAcceleration` | none | floor, 0 dp |
| Boost capacity (8592) | `BoostMaxDuration` | none | floor, 1 dp |
| Boost recharge rate (8591) | `BoostRechargeRate` | none | floor, 1 dp |
| Travel speed (8053) | `TravelSpeed` | none | floor, 0 dp |
| Travel acceleration (8593) | `TravelAcceleration` | none | floor, 0 dp |
| Travel charge time (8594) | `TravelChargeTime` | none | floor, 1 dp |
| Strafe speed (8559) | `HorizontalStrafeSpeed` | none | floor, 1 dp |
| Strafe acceleration (8560) | `HorizontalStrafeAcceleration` | none | floor, 1 dp |
| Yaw / Pitch / Roll (8054–8056) | `YawSpeed` / `PitchSpeed` / `RollSpeed` (rad/s) | `× 180 / π` | floor, 1 dp |
| Crew (8057) | `CrewCapacity` (UINT) | none | round |
| Units / Missiles / Deployables / Countermeasures | `UnitCapacity`, `MissileCapacity`, `DeployableCapacity`, `CountermeasureCapacity` (UINT) | none | round |

Notes:
- The struct also has `TurretBurstDPS`, `GroupedTurretBurstDPS`, `VerticalStrafeSpeed` and
  `VerticalStrafeAcceleration`. No row shows them.
- The yaw of 39.9 instead of 40 fits a float32 rad/s value of slightly under 40·π/180, converted
  to degrees in Lua, then floored to 1 dp.
- The "limited" view (`config.limitedStats`) shows a subset with the same ids, accuracy and
  rounding.

## (b) Ship info panel (map → Information tab)

`menu_map.xpl` ~13673–13805 [base ~13180–13270]. Inputs: `GetComponentData(object64, "hullmax",
"shieldmax", "maxradarrange", …)` (engine) and the FFI calls below.

| Row | Source | Display |
|---|---|---|
| Hull / Shield | `GetComponentData` `hull`/`hullmax`, `shield`/`shieldmax` | `ConvertIntegerString(Helper.round(x), true, 4, true, true, true)` (round to nearest) |
| Speed / Boost speed / Travel speed (8051/8052/8053) | `C.GetDefensibleSpeeds(object64)` → `SpeedInfo{ speed, boostspeed, travelspeed }` | `ConvertIntegerString(Helper.round(v), true, 0, true)`: **round to nearest** |
| Burst Weapon Output, ship without turrets (9092) | `C.GetDefensibleDPS(dpstable, obj, primary=true, secondary=true, lasers=true, missiles=true, turrets=false, includeheat=false, includeinactive=true)`, then `dpstable[0].dps` | `Helper.round`, 0 dp |
| Burst Weapon Output (Fore/Aft/…), ship with turrets | same call with `turrets=true`. It returns `numtotalquadrants` entries `DPSData{ float dps; uint32_t quadranttextid; }`, and the label is `ReadText(20220, quadranttextid)` | `Helper.round`, 0 dp, one row per quadrant |
| Sustained Weapon Output (9093) | `C.GetDefensibleDPS(…, turrets=false, includeheat=true, includeinactive=true)[0]`. Only shown if > 0 | `Helper.round`, 0 dp |
| Weapon and Turret Range (11649) | `C.GetDefensibleWeaponFireRange(obj, primary, secondary, lasers, missiles, turrets=true, includeinactive=false)` | `Helper.round`, metres |
| Radar range | `GetComponentData "maxradarrange"` | `Helper.round(m) / 1000`, km |

The code:
```lua
local dpstable = ffi.new("DPSData[?]", 6)
local hasturrets = (defenceinfo_low and #loadout.component.turret > 0)
local numtotalquadrants = C.GetDefensibleDPS(dpstable, inputobject, true, true, true, true, hasturrets, false, true)
...
ReadText(1001, 9092) .. " (" .. ReadText(20220, dpstable[i].quadranttextid) .. ")"
```
Page 20220: 101 Fore, 201 Aft, 301 Port, 401 Starboard, 501 Aloft, 601 Below.

What this tells us:
- **The per-direction rows mix main weapons and turrets.** Primary and secondary guns and
  missile launchers count towards whichever quadrant(s) the engine assigns them, normally Fore.
  The Gozanti has no main guns, so Fore = 0 there means no turret covers Fore.
- **These rows are burst (`includeheat=false`).** The info panel's "Sustained" row leaves out
  turrets.
- `menu_interactmenu.xpl` ~5199 uses the same call only to test `dps > 0` for "has guns".
- `GetDefensibleDPS` is the only engine export with "DPS" in its name. A `strings` scan of
  `X4.exe` finds no per-weapon DPS or per-turret direction export. Related exports are
  `GetNumTurrets`, `GetTurret`, `GetNumTurretSlots`, `GetTurretGroupMode(2)` and
  `IsTurretGroupArmed`, which return slot and mode data, not damage.
- The script API has the same quadrant concept (`libraries/scriptproperties.xml` 468–482):
  `dps.turrets.{$quadrant}`: "Combined damage/second of turrets in given quadrant. **Ignores
  ammo usage.**" The quadrant keyword is front/back/left/right/up/down
  (`libraries/common.xsd` `quadrantlookup`). Quadrant membership is an engine concept, and the
  engine's quadrant DPS ignores ammo, i.e. the magazine reload.

## Encyclopedia

`menu_encyclopedia.xpl` ~958: `menu.object = GetLibraryEntry(menu.library, menu.id)` (engine
global). The table keys are engine strings (`dps`, `sustaineddps`, `hullshielddps`,
`hullonlydps`, `hullnoshielddps`, `*dpshot`, `reloadrate`, `maxheatrate`, `coolingrate`,
`bulletspeed`, `rotation`, … all present in `X4.exe`).

- **Lasers** (`weapons_lasers`, 3278–3368): Burst Weapon Output = `dps`, Sustained = `sustaineddps`,
  per-shot hull/shield damage, Rate of Fire = `Helper.round(reloadrate, 2)`, heat buildup,
  cooling rate. All shown with `ConvertIntegerString(x, true, 0, true)`.
- **Turrets** (`weapons_turrets`, 3404–3510): **"Weapon Output" (1001/9077) = `dps`**, per-shot
  damage rows, Rate of Fire = `Helper.round(reloadrate, 2)`, projectile speed, range, rotation
  speed. **There's no sustained row for turrets and no direction factor.**

So the encyclopedia's turret page shows the engine's per-turret DPS and rate of fire directly.
The game computes them at run time from the macros (Egosoft's CBJ:
[forum t=409379](https://forum.egosoft.com/viewtopic.php?t=409379)).

## Turret output (the priority)

### What is certain

- **Per-direction coverage is decided in the engine.** No Lua, library or macro attribute names a
  quadrant for a turret slot. The inputs the engine *could* use are all geometry:
  - the slot's position and quaternion in the ship component. The Gozanti's
    `con_turret_L01` sits at `y=+9.9, z=-35.6` (top, rear) facing up, and `con_turret_R01` at
    `y=-7.6, z=-35.6` rotated 180° about z (bottom). The YT-1300's two `ag1g` slots are at
    `z=+1.2` on the centre line, top and bottom, with the same up/down orientation.
  - the turret component's joint limits: RH2 and RM-76 both have unlimited `rotation_y` and
    `rotation_x` from −10° to +90°.
  - possibly occlusion by the hull. The Gozanti's rear-mounted turrets get no Fore even though
    their yaw is unlimited, which fits a line-of-fire check against the hull. **This is a guess.**
- **The DPS maths is in the engine.** `TurretSustainedDPS`, `GroupedTurretSustainedDPS`,
  `GetDefensibleDPS` and the library `dps` are all computed in C++.
- **The turret macro's `reload` doesn't matter, as far as anyone has shown.** A forum reply says
  it is "a leftover from XR". X4_Customizer ignores it too.

### Rate-of-fire formula the engine uses for magazine weapons (community, primary-ish)

X4_Customizer's author (SirNukes), testing against the encyclopedia
([`Plugins/Analyses/Live_Editor_Builders/Weapons.py`](https://github.com/bvbohnen/X4_Customizer/blob/master/Plugins/Analyses/Live_Editor_Builders/Weapons.py),
`Display_Update_RoF`):

> Update: in 3.0 game computes ammo_rounds/reload_rate instead of subtracting one round …
> Test: 2 round burst, 1 reload_rate, 2 reload_time => 2 round/3 sec, enc says 0.5

So the **game's** rate (encyclopedia, 3.0+) is `mag / (ammo_reload + mag / rate)`. The "physically
correct" one is `mag / (ammo_reload + (mag − 1) / rate)`. An older form from 1.x is in
[forum t=409379](https://forum.egosoft.com/viewtopic.php?t=409379) and
[p=4821890](https://forum.egosoft.com/viewtopic.php?p=4821890). Nobody has checked this against
8.00 except through the numbers below.

### Fitting the in-game numbers

Inputs (SWI `ext_01.cat` macros):

| | hull dmg (`value+noshield`) | `barrelamount` | `ammunition value` / `reload` | bullet `reload rate` | turret `reload` |
|---|---|---|---|---|---|
| RH2 (`bullet_turret_m_duallaser_green_macro`) | 255 + 189 = 444 | 2 | 2 / 3 | 2 | rate 1, time 1 |
| RM-76 (`bullet_turret_m_ag1g_macro`) | 110 + 35 = 145 | 1 | 20 / 3 | 5 | rate 1, time 1 |
| KX5 laser (control) | 193 + 135 = 328 | 1 | none | 2.4 | n/a |

Engine rate `r = mag / (reload + mag / rate)`: RH2 = 2 / (3 + 1) = 0.5/s, RM-76 = 20 / (3 + 4) = 2.857/s.

**Hypothesis A: flat sum / 6 (fits all three ship-config numbers exactly)**

`S = dmg × barrelamount × r`; `Avg. Turret Output = Σ S / 6`

| Case | S per turret | Σ / 6 | floored | in game |
|---|---|---|---|---|
| YT-1300, 2× RM-76 | 145 × 1 × 2.857 = 414.29 | 138.10 | 138 | 138 ✅ |
| YT-1300, 1× RM-76 | 414.29 | 69.05 | 69 | 69 ✅ |
| Gozanti, 2× RH2 | 444 × 2 × 0.5 = 444 | 148.0 | 148 | 148 ✅ |

The barrelamount multiplier is consistent with the forward weapons: the KX5 has `barrelamount=1`,
so it doesn't affect the confirmed X-wing numbers. Problem: under A, an RH2's *sustained* (444)
would be above the info panel's *burst* for that turret (422 per direction), which can't happen
if both are the same quantity per turret. A would need the two screens to measure different
things. That's possible: one is a planned loadout, the other a live ship whose per-direction
values come from another call.

**Hypothesis B: coverage-weighted (the reading in the issue comments)**

`Avg = Σ_turrets S × (directions covered) / 6`. The Gozanti covers 8 turret-directions, so
S(RH2) = 111 = 444 × 0.25 = `dmg × r × barrelamount / 2`, or `dmg / (reload + 1)`. The YT-1300
then needs `S × c / 6 = 69` per turret with an integer c. The only magazine-style S that fits is
c = 1, S = 414.29, which means each YT-1300 turret covers **one** direction. That's implausible
for top and bottom turrets on the centre line with unlimited yaw. B also needs RH2 and RM-76 to
use different formulas (÷ barrelamount for one and not the other, unless barrelamount
divides in both and the RM-76's 1 hides it).

**Info-panel burst 422 per RH2 turret (unexplained under both)**

- Allowed range from the round-to-nearest display: 421.5 ≤ B < 422.5, i.e. B / 444 ∈ [0.9493, 0.9516).
  **20/21 = 0.9524 is just outside** (444 × 20/21 = 422.9 → 423), so the "×20/21" factor in the
  issue comment doesn't fit exactly. 0.95 fits (421.8).
- Total over all quadrants: 3376 = 2 turrets × 1688, and 1688 = 0.950 × 1776 = 0.95 × (444 × 2
  barrels × bullet rate 2), i.e. full no-magazine burst. Whether the 0.95 is a coverage
  weighting split across 4 quadrants, a magazine term, or something else can't be told from one
  turret type.
- Simple candidates that **fail**: `dmg × rate` = 888; `dmg × barrels × rate` = 1776;
  correct-magazine `dmg × barrels × mag/(reload+(mag−1)/rate)` = 507; game-magazine (A's S) = 444.

**Best current answer.** For Avg. Turret Output (ship configuration, M ships), Hypothesis A
reproduces every data point we have, exactly:

```
S_turret = (value + noshield) × barrelamount × ammo_value / (ammo_reload + ammo_value / bullet_reload_rate)
Avg. Turret Output = floor( Σ S_turret / 6 )
```

Heat is untested for turrets: neither bullet has `<heat>`. If one does, apply the
fire-to-overheat cycle confirmed for the KX5 in #12 on top. Treat A as provisional until one of
the checks below confirms it. The info panel's per-direction burst has no formula yet.

### In-game checks that would settle it (cheapest first)

1. **Encyclopedia → Equipment → Turrets → RH2 Dual Laser Cannon Turret and RM-76**: read
   "Weapon Output" and "Rate of Fire". A predicts rate 0.50 / 2.86 and output 444 / 414 (or
   222 / 414 if barrelamount isn't in `dps`). That gives the per-turret engine number with no
   direction effect.
2. **YT-1300 info panel**: the per-direction burst rows show how many directions each RM-76
   covers (A doesn't care. B predicts 1 each).
3. **Gozanti with 1× RH2** in ship configuration: A predicts 74. B also predicts 74 (4 × 111 / 6),
   so this doesn't separate them. Prefer checks 1–2.
4. Any vanilla M ship with one turret type and a known slot layout, as a control without SWI.

## Unknowns

- How the engine assigns turrets (and forward weapons) to quadrants: geometry, joint limits,
  occlusion. Closed source, and nobody has published it.
- The 0.95 factor in the info panel's burst per turret.
- Whether `barrelamount` multiplies damage (A) or not.
- `GroupedTurretSustainedDPS` (L/XL): presumably averaged per turret group like
  `GroupedShieldValue` ("average shield of the engine and turret groups", 1026/8018). No L/XL
  data yet.
- What exactly `ConvertIntegerString`'s 3rd–6th arguments do (native). It doesn't matter for
  our values, which reach it already rounded.

## Sources

- Game install, base `08.cat` / `09.cat`, SWI `subst_02.cat` (`.xpl` UI overrides), SWI `ext_01.cat`
  (macros and components). Extracted to the session scratchpad, not to the repo.
- `X4.exe` exported names and strings (`strings`), used only to confirm which functions exist.
- X4_Customizer, `Plugins/Analyses/Live_Editor_Builders/Weapons.py`:
  <https://github.com/bvbohnen/X4_Customizer/blob/master/Plugins/Analyses/Live_Editor_Builders/Weapons.py>
- Egosoft forum, "[BUG 1.32] Encyclopedia miscalculates Rate of Fire": <https://forum.egosoft.com/viewtopic.php?t=409379>
- Egosoft forum, "How do they calculate RoF?": <https://forum.egosoft.com/viewtopic.php?p=4821890>
- roguey.co.uk equipment pages returned 404 when fetched, so they weren't used.
