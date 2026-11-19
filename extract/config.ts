export interface ExtractConfig {
  /** SWI's folder under `extensions/`. */
  swiFolder: string;
  /**
   * The content ids SWI's `content.xml` must declare as dependencies. If SWI
   * adds or drops one, extraction fails until this list is updated on purpose.
   */
  expectedDependencies: string[];
}

export const extractConfig: ExtractConfig = {
  swiFolder: "starwarsmod_m1",
  expectedDependencies: ["ego_dlc_split", "ego_dlc_terran", "ego_dlc_pirate", "ego_dlc_boron", "ego_dlc_timelines"],
};
