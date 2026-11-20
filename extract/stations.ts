import { ExtractError } from "./errors.ts";
import { attr, child, children, list, type GameFiles } from "./gameFiles.ts";

/** The ship classes (`ship_s`, `ship_m`, ...) a Faction's stations build and equip. */
export interface StationClasses {
  /** From the build modules' `<builder classes>`. */
  build: Set<string>;
  /** From the build modules' `<equip classes>`; equipment docks equip but build nothing. */
  equip: Set<string>;
}

/** Which ship classes each Faction can build; see {@link stationClasses}. */
export function shipBuilders(files: GameFiles): Map<string, Set<string>> {
  return new Map([...stationClasses(files)].map(([faction, classes]) => [faction, classes.build]));
}

/**
 * Which ship classes (`ship_s`, `ship_m`, ...) each Faction can build and
 * equip, from the stations it runs: god.xml station → its `<select faction
 * tags>` → every stations.xml definition whose category has that faction and
 * tags → stationgroups.xml → each construction plan → the plan's
 * `buildmodule` macros → their `<builder classes>` and `<equip classes>`. A
 * station's tags don't matter (#18, #20).
 */
export function stationClasses(files: GameFiles): Map<string, StationClasses> {
  const definitions = children(files.requireFile("libraries/stations.xml"), "station");
  const groups = new Map(
    children(files.requireFile("libraries/stationgroups.xml"), "group").map((g) => [attr(g, "name"), g]),
  );
  const plans = new Map(
    children(files.requireFile("libraries/constructionplans.xml"), "plan").map((p) => [attr(p, "id"), p]),
  );
  const planClasses = new Map<string, StationClasses>();
  const classesOfPlan = (planId: string, referencedBy: string): StationClasses => {
    const cached = planClasses.get(planId);
    if (cached) return cached;
    const plan = plans.get(planId);
    if (!plan) throw new ExtractError(`${referencedBy} refers to construction plan "${planId}", which doesn't exist`);
    const classes: StationClasses = { build: new Set(), equip: new Set() };
    for (const entry of children(plan, "entry")) {
      const macroName = attr(entry, "macro");
      if (macroName === undefined) continue;
      const macro = files.macro(macroName, `construction plan ${planId}`).element;
      if (attr(macro, "class") !== "buildmodule") continue;
      const properties = child(macro, "properties");
      for (const builder of children(properties, "builder")) {
        for (const cls of list(attr(builder, "classes"))) classes.build.add(cls);
      }
      for (const equip of children(properties, "equip")) {
        for (const cls of list(attr(equip, "classes"))) classes.equip.add(cls);
      }
    }
    planClasses.set(planId, classes);
    return classes;
  };

  const builders = new Map<string, StationClasses>();
  const god = child(files.requireFile("libraries/god.xml"), "stations");
  for (const godStation of children(god, "station")) {
    for (const spec of children(godStation, "station")) {
      for (const select of children(spec, "select")) {
        const faction = attr(select, "faction")?.replace(/^faction\./, "");
        if (faction === undefined) continue;
        const tags = list(attr(select, "tags"));
        for (const definition of definitions) {
          const matches = children(definition, "category").some((category) => {
            const categoryTags = list(attr(category, "tags"));
            return list(attr(category, "faction")).includes(faction) && tags.every((t) => categoryTags.includes(t));
          });
          const groupName = attr(definition, "group");
          if (!matches || groupName === undefined) continue;
          const where = `stations.xml station ${attr(definition, "id")}`;
          const group = groups.get(groupName);
          if (!group) throw new ExtractError(`${where} refers to station group "${groupName}", which doesn't exist`);
          for (const planSelect of children(group, "select")) {
            const planId = attr(planSelect, "constructionplan");
            if (planId === undefined) continue;
            const classes = builders.get(faction) ?? { build: new Set<string>(), equip: new Set<string>() };
            const ofPlan = classesOfPlan(planId, `station group ${groupName}`);
            for (const cls of ofPlan.build) classes.build.add(cls);
            for (const cls of ofPlan.equip) classes.equip.add(cls);
            builders.set(faction, classes);
          }
        }
      }
    }
  }
  return builders;
}
