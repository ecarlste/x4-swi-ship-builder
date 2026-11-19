# Can the player raise reputation with SWI's pirate factions?

Research for issue #19 (child of the wayfinder map, #1). Researched 2026-11-19.

**Sources.** Only the local install at `/mnt/e/SteamLibrary/steamapps/common/X4 Foundations - 8.00`
(called `<X4>`), layered as base → `ego_dlc_split/terran/pirate/boron/timelines` →
`extensions/starwarsmod_m1` (SWI 0.9.1 HF). `starwars_rsp` and the other mods were left out. Files were
pulled from the `.cat/.dat` archives (format: `docs/research/swi-file-packaging.md` on branch
`research/swi-file-packaging`). File paths below are archive paths. "base" means the base game's
`NN.cat`, and "SWI" means `starwarsmod_m1/ext_*.cat` or `subst_02.cat`. Line numbers refer to the
extracted files.

- **Verified**: read directly in game data or script code.
- **Inference**: my reading of how the engine behaves. The engine's C++ is not visible, so anything
  about `GetLibrary("factions")` or how a lock is enforced falls here.

## Answer in brief

| | Black Sun (`blacksun`, BLS) | Pirate Syndicates (`valarian`, PIR) |
|---|---|---|
| Start relation, normal game | **-0.0032 = UI -5** (verified) | **-0.01 = UI -10** (verified) |
| Relations locked? | **No** (verified) | **Yes, `<relations locked="1">`** (verified). Nothing in SWI unlocks it (verified) |
| Can the player raise it? | **Yes**: missions, kills near its stations, trading | **No, in practice** (inference from the lock, strongly backed by base usage) |
| Ship/equipment licences | General-use and military at `minrelation -0.01` (money only). **Capital ship/equipment need the "ally" ceremony = UI +20** (verified) | **All, including capital, at `minrelation -0.01`** (money only) (verified). Ceremonies (+10/+20) are out of reach |
| On the reputation list? | Yes | **Yes, should be** (verified data; the engine filter is inferred). It shows at -10, and "Declare war" is greyed out because the relation is locked |

**Why killing criminals gave nothing (inference, best fit):** the kill-reward path is wired correctly for
Black Sun. But a custom start "allied" with Black Sun puts the relation at or above UI +20. Above +5
the reward is added **linearly to a logarithmic scale**, so one kill moves the UI number by about
0.01–0.04 (and by 0 at the +30 cap). Other conditions that could also block it are listed in §3.

## 1. Faction definitions (SWI `libraries/factions.xml`, a `<diff>` that adds new factions)

Verified, from the `<add sel="/factions">` block:

- `blacksun` (l. 845): `known="1"`,
  `tags="barterships claimspace barterwares economic protective watchdoguser privateloadout privateship plunder pirate"`,
  **`<relations>` with no lock**. `relation faction="criminal" relation="-0.5"`, player -0.0032.
- `valarian` (l. 772): `known="1"`, `tags="barterships barterwares economic protective watchdoguser privateloadout privateship plunder pirate"`
  (no `claimspace`), **`<relations locked="1">`**. Criminal -0.5, player -0.01.
- `mandoraiders` (l. 705), for comparison: `known="1"`, `plunder pirate`, **locked**, and every one of
  its own licences is tagged `hidden`.
- Other locked SWI factions: `huttpirates`, `twinsuns`, `baobab`, `tradefederation`, `tagge`,
  `bankingclan`, `indibhg`, `dummypirate`, plus the replaced `khaak`/`xenon`.
- The player side (l. 1801) adds `valarian -0.01`, `mandoraiders/huttpirates/blacksun -0.0032`.
- No standard SWI gamestart (`libraries/gamestarts.xml`) changes these values. The only start that sets
  them (to +1) is the commented-out `swi_galaxy_main_0` test map. The custom start `custom_creative`
  lets the player edit `universefactionrelations`.
- UI scale, from the file's own header comment: `0.0032 = 5`, `0.01 = 10`, `0.1 = 20`, `0.32 = 25`,
  `1.0 = 30`, log interpolation above ±5, linear between ±5 (`0.00064` per UI step).
- Licences (verified):
  - `blacksun`: `generaluse*`, `military*` and `station_illegal` at `minrelation="-0.01"` (prices 50k–1M).
    `capitalship`/`capitalequipment` at `minrelation="0.1" precursor="ceremonyally"`. Ceremonies:
    friend `0.01` (+10, "Black Sun Cooperator") and ally `0.1` (+20, "Black Sun Member").
  - `valarian`: every ship/equipment licence, capital included ("Refurbished Advanced Ships Access",
    2M), is at `minrelation="-0.01"`. The ceremonies need +10/+20, which a locked relation at -10
    never reaches. The player faction also gets `generaluseship`/`generaluseequipment` for
    `valarian` at the start (l. 1849ff).
  - **Inference:** whether "-0.01 ≥ -0.01" counts as meeting the requirement, and whether -0.01 counts
    as "enemy", is decided by the engine. The SWI header says
    `enemy: -1.0 to -0.01`, `neutral: -0.01 to 0.01` and "-0.01 to -0.099999 – factions do not trade",
    so PIR sits exactly on the boundary.

## 2. What a relation lock means (verified in schema and base usage)

- base `libraries/factions.xsd` l. 277: `locked` = "Are relations locked? (don't change permanently)".
  `lockreason` = "shown to player, defaults to empty string and player is just told it's not currently
  possible".
- base `libraries/common.xsd` l. 34586, `set_faction_relation_locked`: "Whether the faction's relations
  towards others should be able to change".
- Base scripts always unlock before scripting a change and re-lock afterwards. That is strong evidence that
  `add/set_faction_relation` does nothing on a locked faction, **including** calls written as
  `faction="faction.player" otherfaction="<locked>"`:
  - `ego_dlc_pirate md/story_thefan.xml` l. 15294–15318 (Riptide Rakers / `loanshark`).
  - base `md/terraforming.xml` l. 2318–2341 (Scale Plate Pact).
  - SWI `md/setup_gamestarts_sw.xml` l. 1683: the Hutt-yacht start unlocks `huttpirates` before
    setting the relation.
- Base reward code also skips locked factions explicitly. Examples: `md/notifications.xml` l. 1901 and
  2182 (`not ...owner.isrelationlocked`) and `md/signal_leaks.xml` l. 906ff.
- **Nothing in SWI or the DLCs unlocks `valarian`, `blacksun` or `mandoraiders`.** A search of all
  extracted `md/` and `aiscripts/` found `set_faction_relation_locked` only for huttpirates, loanshark,
  scaleplate and Timelines scenario factions (verified).

Vanilla precedent: Duke's Buccaneers and Scale Plate Pact (base, `plunder pirate`) are locked until a story
unlocks them. Riptide Rakers (`loanshark`) and Fallen Families (`fallensplit`) are not locked, so they
behave like Black Sun.

## 3. How the player gains reputation, and why the criminal kills did nothing

### Kills near a station ("station defended" reward). Verified in base `md/notifications.xml`; SWI does not patch this branch

The chain runs `PlayerKills` (l. 1715) → `AttackResponse` (l. 1848) → the "No responder" branch (l. 2158–2199) →
`AccumulateRewards` (l. 2265) → `IllegalActivityReward` (l. 2396ff). All of these must hold:

1. The kill counts at all. The target is a defensible, **not a visitor**, not `isrelationchangedisabled`,
   and not player/ownerless. SWI adds (SWI `md/notifications.xml` l. 450) that the kill must **not**
   be on kuertee's "sanctioned kill" list. Those are kills the professions/guild missions sanctioned.
2. If the victim is a small or medium ship (not L/XL), there must be **no "protector"** within 30 km.
   A protector is a station that is not hostile to the victim's owner. If one exists, that station
   responds and the reward branch is skipped.
3. In the **same sector**, within 30 km of the player and inside the station's radar range, there is a
   non-player station whose owner:
   - is **hostile to the victim's owner**. Black Sun → criminal is -0.5, so this holds.
   - `isprotective`. Both pirate factions have the `protective` tag.
   - is **not relation-locked**. This excludes `valarian`.
   - has a `tradenpc` with a voice page. Not checked for the asteroid base.
4. The reward is paid after a delay of at least 45 s, once the player is out of conversations and full-screen
   menus. It comes through a comm from the station's manager.
5. Amount: `relationchange.killfaction.bonus` from base `libraries/defaults.xml`. XS 0.00064, S 0.001,
   M 0.002, L 0.005, XL 0.01. SWI does not change these.
   - Below UI -5 the relation is multiplied, so each 0.0064 of bonus is worth +10 UI.
   - Above that, the bonus is **added**.
   - Black Sun has no police tag or `policefaction`, so its space pays no police bounty either.
     That is an inference: a zone's police faction comes from its owner.

Criminal ships in SWI are mass traffic owned by `faction.criminal`, spawned around stations of argon-,
imperial-, sith- and teladi-race factions. Sources: SWI `libraries/jobs.xml` l. 22009ff
(`masstraffic_*_criminal`) and SWI `md/gm_killmasstraffic.xml`, which maps Black Sun/PIR stations to
`masstraffic_newrepublic_criminal`. Black Sun's `primaryrace` is argon.

**Why the owner saw no gain (inference):** conditions 2–3 are all met for Black Sun by data. The
likeliest cause is the custom start's "allied" relation. The UI value is `10·log10(r·1000)`. At +20
(r = 0.1), an S-ship kill (+0.001) gives +0.04 UI, so you need about 26 S kills (about 41 XS) to tick the
integer to +21. At +25 you need about 82 S kills per point, and at +30 nothing can change. Other
possible causes:
- A neutral-to-criminal station in range claimed the victim (condition 2).
- The kill was a kuertee-sanctioned mission kill.
- The base has no voiced trade manager.
- Leaving the sector or opening a menu does not cancel the reward but delays it.

The same kills **would** show at a normal start: from UI -5, each S kill is about +1.5 UI and each XS kill
+1. Near Pirate Syndicates stations they would give nothing, because of the lock.

### Missions (verified)

- Generic missions put the reward on the client faction:
  `add_faction_relation faction="faction.player" otherfaction="$ClientOwner" ... reason="missioncompleted"`.
  Examples: base `md/gm_destroy_objects.xml` l. 1010 and `md/gm_reputation.xml` l. 589.
- SWI deliberately wires the pirate factions into missions:
  - `md/setup_swmod.xml` l. 66–69 adds blacksun, valarian, huttpirates and mandoraiders to
    `md.$DLCPirateFactions`.
  - Both have the `pirate` tag, so they land in `md.$PirateFactions` (base `md/setup.xml` l. 1091).
  - SWI `md/gm_destroy_objects.xml` makes pirate stations offer "destroy the other pirates" missions.
    Black Sun stations target PIR, and PIR stations target Black Sun.
  - SWI `md/gm_barterwares.xml` offers barter missions at valarian/blacksun stations to players who are
    not their enemy.
  - kuertee emergent missions (SWI `md/kuertee_emergent_missions*.xml`) include every
    `plunder`-tagged faction and also use `add_faction_relation`.
- **Black Sun:** missions raise reputation. This is the main route to +10/+20.
- **Pirate Syndicates (inference):** missions can be *offered*, because nothing filters out locked
  factions. But the reputation part of the reward is swallowed by the lock. Only the money is paid.

### Trading (verified)

base `aiscripts/order.trade.perform.xml` l. 593–596: when a **player-owned ship** completes a trade with an
NPC station, `0.00016 + 0.00064 × price/4 M Cr` is added to the relation between the buyer and seller
factions. SWI's diff of this file keeps that code. This works for Black Sun. For PIR it is blocked by
the lock (inference). Buying ships at a shipyard does not go through this script.

### Bribes, diplomacy, other

- **No "pay for reputation" or bribe action exists for these factions.** No script found adds relation
  in return for money.
- SWI's diplomacy table (`md/setup_swmod.xml` l. 150–155) sets `DiplomatAvailable = 'no'` and
  `EventCapable = 'no'` for both. For PIR it also sets `InateAgentExperience = 'no_agents'`. So they
  have no embassy diplomat and no diplomacy events (verified data; inferred effect).
- Signal-leak rewards (base `md/signal_leaks.xml`) skip locked factions.
- The `lib_reward_balancing` `set_faction_relation 0.3` is a debug helper, not gameplay.

## 4. Does Pirate Syndicates appear on the reputation list?

**Yes, it should** (verified data, inferred engine filter).

- The reputation list in `menu_playerinfo` is built from `GetLibrary("factions")`, and only `player` is
  removed in Lua. That is true of the base `ui/addons/ego_detailmonitor/menu_playerinfo.lua` and of
  SWI's replacement in `subst_02.cat`, `menu_playerinfo.xpl` (plain Lua source, l. 2408–2445). SWI's
  kuertee add-on (`ui/kuertee_reputations_and_professions_playerinfo.lua`) only re-sorts that same list.
- Any further filtering happens inside the engine's `GetLibrary("factions")`. **Inference:** it drops
  factions that are inactive, unknown or tagged `hidden`. That is how SWI hides vanilla factions: it
  adds `@active=0` and sets their tags to `hidden police` in its `factions.xml`, l. 37–105.
- `valarian` passes all three:
  - it has `known="1"`;
  - it has no `hidden` tag;
  - it is never set inactive. The only `set_faction_active` in SWI is `md/sw_factions_defeat.xml`,
    which covers sector-owning empires, not valarian.
- Expected display: **"[PIR] Pirate Syndicates" at -10**. Its "Declare war" button is disabled with the
  default lock text "It is currently not possible to declare war on this faction." (base
  `t/0001-l044.xml`, page 20229 id 100), because `valarian` has no `lockreason`.

The owner said -10 is the default start for both. The data says **Black Sun starts at -5 and only PIR
at -10**. Worth a glance in game.

## 5. Implications for the builder

- **Black Sun ships:** reachable in a normal game. General and military licences only need money. Capital
  ships and equipment need the +20 "Black Sun Member" ceremony, earned through missions, kills and trade.
- **Pirate Syndicates ships:** reachable for money alone at the fixed -10, if the engine treats
  `-0.01 ≥ -0.01` as met (the -0.01 boundary is unverified, see §1). Reputation with them never changes.
- **Mandalorian Raiders:** locked as well, and all their own licences are `hidden`. They are not a
  practical seller.

## Open points (need an in-game check)

1. Does PIR at exactly -10 trade with the player and sell licences? This is the `-0.01` boundary.
2. What relation value does the custom editor's "allied" set? This would confirm the log-scale explanation.
3. Does the BLS Pirate Asteroid Base have a voiced trade manager? This is reward condition 3.
