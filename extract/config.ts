export interface ExtractConfig {
  /** SWI's folder under `extensions/`. */
  swiFolder: string;
  /**
   * The content ids SWI's `content.xml` must declare as dependencies. If SWI
   * adds or drops one, extraction fails until this list is updated on purpose.
   */
  expectedDependencies: string[];
  /** Known `<diff>` patches that miss on purpose; see {@link PatchAllowlist}. */
  patchAllowlist: PatchAllowlist;
}

/**
 * The known exceptions to the patch hard failures. A `remove` whose `sel`
 * matches nothing (without `silent`), or a `<diff>` file for a path no earlier
 * layer has, fails extraction unless it is listed here. A listed one is skipped
 * and shown in the report instead. Each entry names the extension's folder
 * under `extensions/` and the patch file's path inside its catalogs (both
 * matched without regard to case), and says why it is safe to skip.
 */
export interface PatchAllowlist {
  /** A `remove` whose `sel` matches nothing: the node it removes is already gone. */
  unmatchedRemovals: { extension: string; patch: string; sel: string; reason: string }[];
  /** A `<diff>` file for a path no earlier layer has, so it has nothing to patch. */
  orphanPatches: { extension: string; patch: string; reason: string }[];
}

const NOT_IN_X4_800 = "SWI removes a base-game ware that X4 8.00 doesn't have";

export const extractConfig: ExtractConfig = {
  swiFolder: "starwarsmod_m1",
  expectedDependencies: ["ego_dlc_split", "ego_dlc_terran", "ego_dlc_pirate", "ego_dlc_boron", "ego_dlc_timelines"],
  patchAllowlist: {
    unmatchedRemovals: [
      "weapon_gen_m_disabler_01_mk1",
      "weapon_gen_m_shieldpierce_01_mk1",
      "turret_gen_m_disabler_01_mk1",
      "turret_gen_m_gatling_01_mk1",
      "turret_gen_m_shieldpierce_01_mk1",
    ].map((ware) => ({
      extension: "starwarsmod_m1",
      patch: "libraries/wares.xml",
      sel: `/wares/ware[@id='${ware}']`,
      reason: NOT_IN_X4_800,
    })),
    orphanPatches: [
      {
        extension: "starwarsmod_m1",
        patch: "assets/fx/weaponFx/backup/bullet_xen_s_laser_01_mk1.xml",
        reason: "a backup copy of a weapon effect that no earlier layer has; effects aren't extracted",
      },
      {
        extension: "starwarsmod_m1",
        patch: "assets/structures/dock/macros/dockarea_arg_m_01_tradestation_01_macro.xml",
        reason: "X4 8.00 deletes this dock area macro (05.cat), so SWI's patch for it has nothing to patch",
      },
    ],
  },
};
