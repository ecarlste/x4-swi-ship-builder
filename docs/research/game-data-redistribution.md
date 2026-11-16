# Can extracted SWI Game Data be published on a public website?

Research for issue #5 (child of the wayfinder map, #1). Researched 2026-11-16.

**This is not legal advice.** It reports what the primary sources say, where they are silent, and who to ask. It does not decide whether anything is lawful.

## Short answer

- **Egosoft (base game):** Egosoft's Fan Content Policy (last updated 2026-08-07) explicitly permits using "information, and data from our games" on **non-commercial** fan websites, with conditions: attribute the game, link to its Steam or GOG page, and show a required "unofficial fan project" disclaimer. It forbids distributing complete original data containers (`.dat` files). It doesn't mention public GitHub repos of derived data. Egosoft says permission can be revoked and that tolerating other projects sets no precedent.
- **SWI team (the mod):** The extension folders have no licence or readme. The main SWI Nexus page (mod 349), as quoted in search excerpts, requires the author's permission before "use any of the assets in this file". It doesn't say whether stats, names and loadouts extracted from the mod's XML count as "assets". **That is the main open question. Asking the SWI team is the safe path.**
- **Reaper's Ship Pack (`starwars_rsp`):** a separate author (Reaperxvii) with separate terms, which this research couldn't read.
- **Star Wars IP (Lucasfilm/Disney):** ship and faction names are Star Wars IP. Lucasfilm's only published fan-site guidance asks fan sites to say they are not affiliated with Disney or Lucasfilm.
- **Precedent:** public, extracted-data X4 sites exist and are long-running. The clearest is x4-game.com, which keeps its extracted base-game data as TypeScript in a public MIT GitHub repo. No public SWI data site or database was found.

## 1. Egosoft

### What exists

- **No game-specific EULA was found.** The X4: Foundations Steam store page lists no third-party EULA, only Valve's Steam Subscriber Agreement and legal links ([Steam store page](https://store.steampowered.com/app/392160/)). The install folder has `licences.txt`, which only lists third-party libraries (FFmpeg, LuaJIT, and so on). It is not an end-user licence.
- **Egosoft Fan Content Policy** ([egosoft.com/community/fanpolicy_en.php](https://www.egosoft.com/community/fanpolicy_en.php), last updated 2026-08-07). This is the governing first-party document.

### What the Fan Content Policy says (quoted)

- **Section 2, Fan Websites:** "Using screenshots, artwork, information, and data from our games on non-commercial fan websites is permitted, provided you clearly attribute the respective game and include a direct link to the game's official product page on Steam or GOG."
- **Section 3, Mods, container files:** "Distributing complete original game data containers (e.g., full .dat files) is strictly forbidden."
- **Section 4, Standalone projects:** "You may not extract or use original game files (models, textures, animations, code, music, sound effects, UI elements) in standalone projects." This is aimed at standalone games and software. A data viewer that depends on the game arguably isn't one, but the policy doesn't define the line.
- **Section 6, Commercial use:** "any direct or indirect generation of revenue or economic benefit, including sales, paywalled access, subscriptions, advertising (outside platform partner programs), sponsorships, crowdfunding, paid commissions, and licensing." Donations aren't named directly. Crowdfunding is.
- **Section 7, Required disclaimer.** Fan sites and tools must visibly show it. Required text: "This is an unofficial fan project. It is not affiliated with, endorsed, or supported by Egosoft. Egosoft assumes no technical support or liability (e.g., for corrupted save games). Use at your own risk. All names, trademarks, and content related to [Game Name, e.g. X4: Foundations] are the property of Egosoft or their respective owners."
- **Sections 8–9, Revocation and precedent:** Egosoft may change or revoke the policy. "Prior tolerance or approval of other fan projects does not constitute a binding precedent."
- **Section 9, Contact:** "For permissions, licensing enquiries, or questions regarding projects not covered by this Policy, please contact Egosoft (info@egosoft.com) prior to starting development or publication."

### Gaps

- The policy doesn't explicitly cover **wikis, databases, or public source repositories** that hold derived data files (JSON or TS generated from game XML). Section 2 ("data … on non-commercial fan websites") is the closest fit.
- It doesn't say how Egosoft's terms apply to **mod content** built on Egosoft's game. SWI's data files reuse Egosoft file formats and, in places, base-game macros. SWI's own content is the mod authors' work (see §2).

## 2. SWI team

### Local files (read-only check)

- `extensions/starwarsmod_m1/content.xml` gives `name="SW Interworlds"`, `version="091"` ("Star Wars 0.9.1 HF", 2025-12-24) and `author="MikSa Shuulo Elratie Kuertee Lok Land"`.
- `extensions/starwars_rsp/content.xml` gives `name="Reaper's Ship Pack (SWI)"`, `author="Reaperxvii"`, version 208 (2026-7-18), depending on SW Interworlds 091.
- Neither folder has a readme, licence, credits or terms file, loose or inside the `.cat` catalogues (file lists were searched for readme, licence, credits and copying).
- `starwarsmod_m1/ui/` includes `kuertee_*.lua` scripts. Kuertee is a separate modder credited in the author list. Those are UI scripts, not Game Data, but they show that SWI bundles other authors' work.

### Public pages

The automated fetcher couldn't read Nexus Mods and ModDB (bot protection returned 403). The points below come from **search-engine excerpts** of those pages and still **need checking by a human in a browser**.

- **Main SWI page:** [X4 Star Wars Interworlds (SWI), Nexus mod 349](https://www.nexusmods.com/x4foundations/mods/349). Creator: "SW Interworlds Team". Uploader: MikSka. Excerpted permissions: "You must get permission from me before you are allowed to use any of the assets in this file" and "You are not allowed to convert this file to work on other games under any circumstances." Another excerpt adds bans on re-uploading elsewhere and on using assets in paid mods. The page links a Discord invite and a Patreon (patreon.com/mikska).
- **SWI Patch Collection** ([Nexus 924](https://www.nexusmods.com/x4foundations/mods/924)) asks people to contact the SWI Team about permissions first.
- **SWI add-on pages** ([Nexus 524](https://www.nexusmods.com/x4foundations/mods/524), [525](https://www.nexusmods.com/x4foundations/mods/525)) say their add-ons have "the permission of the creator Mikhail Skatchkov". They show the SWI lead granting permission case by case.
- **ModDB** ([star-wars-mod-x4](https://www.moddb.com/mods/star-wars-mod-x4)) is the older listing. Search excerpts say it is marked outdated, points to Nexus, and says community and help are on Discord. MikSka said the mod was renamed to "SW Interworlds" ([ModDB, MikSka comments](https://www.moddb.com/members/mikska/comments)).
- **Reaper's Ship Pack:** [Nexus 1321](https://nexusmods.com/x4foundations/mods/1321) by Reaperxvii. Its permissions weren't read.

### Gaps

- No source says whether **"assets"** in the Nexus permission covers data (names, stats, loadouts) or only models, textures and sounds. On Nexus, "assets" usually means anything in the file, so the cautious reading is that it covers data too.
- No public SWI statement on fan sites, wikis or tools was found. Discord announcements couldn't be checked.
- Reaper's Ship Pack terms are unread.

### Who to contact

- **SWI: MikSka (Mikhail Skatchkov),** the Nexus uploader, team lead and Patreon owner. The canonical-data add-on credits him as "the creator", and others report getting permission from him directly. Channels: the SWI Discord linked from Nexus mod 349 (the invite code differs between pages, so use the one on the main page), or a Nexus private message to MikSka.
- **Reaper's Ship Pack: Reaperxvii,** through Nexus mod 1321 or the SWI Discord.
- **Egosoft:** info@egosoft.com, only if the project falls outside the Fan Content Policy (for example, if it takes revenue).

## 3. Star Wars IP (Lucasfilm/Disney)

- Ship, faction and equipment names in SWI are Star Wars names. Lucasfilm's FAQ ([lucasfilm.com/who-we-are/faq](https://www.lucasfilm.com/who-we-are/faq/)) asks that fan sites be "clearly represented as a fansite and state that is not affiliated with Disney or Lucasfilm."
- No Lucasfilm fan-content licence for games, mods or tools was found. The SWI mod itself runs on the same unlicensed footing.

## 4. Precedent

| Project | What it publishes | Data in public repo? | Notices |
| --- | --- | --- | --- |
| [x4-game.com](http://www.x4-game.com), [crissian/x4](https://github.com/crissian/x4) | Base-game database (ships, equipment, wares, modules, sectors) in all game languages, station calculator, share links. Static, in-browser, with JSON exports. | **Yes.** `src/app/shared/services/data/*.ts` (e.g. `equipment-data.ts`, ~477 KB) and `src/assets/i18n/<lang>` game texts, MIT-licensed code. | README: "X4: Foundations is a trademark of Egosoft. This project is not affiliated with or endorsed by Egosoft." Funded by Buy Me a Coffee and Patreon. |
| [Roguey's X4 site](https://roguey.co.uk/x4/) | Ship, shield, weapon and engine tables, plus a loadout import feature ([import_loadout](https://roguey.co.uk/x4/ships/import_loadout.php)). | No public repo. | Footer: "All names, logos, images and trademarks are the property of their respective owners." Runs AdSense and takes donations. No mod data. |
| [X4FProjector](https://github.com/bno1/X4FProjector) | CLI that exports ship and equipment stats to CSV/JSON/YAML. | **No.** Reads the user's own install. Apache-2.0. | None about Egosoft. |
| [X4 Customizer](https://github.com/bvbohnen/X4_Customizer/) | Modding tool that unpacks catalogues locally. | Not established. MIT. | None seen. |
| [Egosoft wiki ship list](https://wiki.egosoft.com/X4%20Foundations%20Wiki/Manual%20and%20Guides/Objects%20in%20the%20Game%20Universe/Ships/) | Sortable ship list. | n/a (first-party wiki). | n/a |

**What this shows:** publishing extracted **base-game** data on public sites and in public repos is established and visible, including on ad-supported sites. Egosoft warns that its tolerance is not precedent. **No equivalent for SWI or another major total-conversion mod was found**, so there's no precedent for mod data.

## 5. What this means for the project (facts only)

- To fit inside Egosoft's written policy as quoted, the site would need to be non-commercial (no ads outside partner programs, no paywall, no crowdfunding), carry the Section 7 disclaimer, and attribute X4 with a link to its Steam or GOG page. It must never publish raw `.cat`/`.dat` files.
- A Lucasfilm non-affiliation line costs nothing and matches what that FAQ asks for.
- SWI and Reaper's Ship Pack data isn't covered by any public grant found. The main SWI page's wording asks for permission before using its assets.
- Keeping generated Game Data **out** of the public repo and building it in CI from a local install wouldn't fully help. The static site still publishes the data, and a CI runner has no game install. Either way, the permission question is about publishing, not about where the files are stored.

## Open questions

1. **SWI permission.** Ask MikSka (SWI Discord or Nexus PM) for permission to publish extracted names, stats and default loadouts on a free, non-commercial site and in its public GitHub repo, with credit and a link. Ask Reaperxvii the same for `starwars_rsp`. Ask what credit or wording they want.
2. **Human check of the Nexus permissions tabs** for mods 349 and 1321. The fetcher was blocked, and this document relies on search excerpts there.
3. **Fallback if SWI says no.** For example, keep Game Data out of the repo and make the site load data the user extracts locally. That would change the pipeline and hosting design.
4. **Funding.** Any donation or Patreon link would need checking against Egosoft's "commercial use" definition (crowdfunding is listed) and SWI's ban on paid use.
5. **Required notices in the UI.** The Egosoft Section 7 disclaimer, the Steam/GOG link, Lucasfilm non-affiliation, and SWI credit should become a UI and spec requirement.
