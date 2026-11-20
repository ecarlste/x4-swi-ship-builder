import { ExtractError } from "./errors.ts";
import { attr, child, children, list, type GameFiles } from "./gameFiles.ts";

/**
 * Which ship classes (`ship_s`, `ship_m`, ...) each Faction can build, from
 * the stations it runs: god.xml station → its `<select faction tags>` →
 * every stations.xml definition whose category has that faction and tags →
 * stationgroups.xml → each construction plan → the plan's `buildmodule`
 * macros → their `<builder classes>`. A station's tags don't matter (#20).
 */
export function shipBuilders(files: GameFiles): Map<string, Set<string>> {
  const definitions = children(files.requireFile("libraries/stations.xml"), "station");
  const groups = new Map(
    children(files.requireFile("libraries/stationgroups.xml"), "group").map((g) => [attr(g, "name"), g]),
  );
  const plans = new Map(
    children(files.requireFile("libraries/constructionplans.xml"), "plan").map((p) => [attr(p, "id"), p]),
  );
  const planClasses = new Map<string, Set<string>>();
  const classesOfPlan = (planId: string, referencedBy: string): Set<string> => {
    const cached = planClasses.get(planId);
    if (cached) return cached;
    const plan = plans.get(planId);
    if (!plan) throw new ExtractError(`${referencedBy} refers to construction plan "${planId}", which doesn't exist`);
    const classes = new Set<string>();
    for (const entry of children(plan, "entry")) {
      const macroName = attr(entry, "macro");
      if (macroName === undefined) continue;
      const macro = files.macro(macroName, `construction plan ${planId}`).element;
      if (attr(macro, "class") !== "buildmodule") continue;
      for (const builder of children(child(macro, "properties"), "builder")) {
        for (const cls of list(attr(builder, "classes"))) classes.add(cls);
      }
    }
    planClasses.set(planId, classes);
    return classes;
  };

  const builders = new Map<string, Set<string>>();
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
            const classes = builders.get(faction) ?? new Set<string>();
            for (const cls of classesOfPlan(planId, `station group ${groupName}`)) classes.add(cls);
            builders.set(faction, classes);
          }
        }
      }
    }
  }
  return builders;
}
