import { describe, expect, it } from "vitest";
import { applyPatch } from "./patch.ts";
import { parseXml } from "./xml.ts";

const SOURCE = "fx_dlc_a ext_01.cat: libraries/wares.xml";

/** Applies `diff` to `target` (both XML text) and returns the patched file. */
function patch(target: string, diff: string) {
  return applyPatch(parseXml(target, "target"), parseXml(diff, SOURCE), SOURCE).file;
}

const xml = (text: string) => parseXml(text, "expected");

describe("applyPatch: replace", () => {
  it("replaces an attribute of the element with that id", () => {
    const result = patch(
      `<wares><ware id="a" name="A"/><ware id="b" name="B"/></wares>`,
      `<diff><replace sel="/wares/ware[@id='b']/@name">Bee</replace></diff>`,
    );

    expect(result).toEqual(xml(`<wares><ware id="a" name="A"/><ware id="b" name="Bee"/></wares>`));
  });

  it("replaces an element with the one given, in its place", () => {
    const result = patch(
      `<wares><ware id="a"/><ware id="b"><price min="1"/></ware><ware id="c"/></wares>`,
      `<diff><replace sel="/wares/ware[@id='b']"><ware id="b" v="2"><price min="9"/></ware></replace></diff>`,
    );

    expect(result).toEqual(xml(`<wares><ware id="a"/><ware id="b" v="2"><price min="9"/></ware><ware id="c"/></wares>`));
  });

  it("replaces the root element", () => {
    const result = patch(`<macros><macro name="a"/></macros>`, `<diff><replace sel="/macros"><macros/></replace></diff>`);

    expect(result).toEqual(xml(`<macros/>`));
  });

  it("sets an attribute to an empty value", () => {
    const result = patch(`<wares><ware id="a" tags="x"/></wares>`, `<diff><replace sel="/wares/ware[@id='a']/@tags"/></diff>`);

    expect(result).toEqual(xml(`<wares><ware id="a" tags=""/></wares>`));
  });
});

describe("applyPatch: remove", () => {
  it("removes an element", () => {
    const result = patch(
      `<wares><ware id="a"/><ware id="b"/><ware id="c"/></wares>`,
      `<diff><remove sel="/wares/ware[@id='b']"/></diff>`,
    );

    expect(result).toEqual(xml(`<wares><ware id="a"/><ware id="c"/></wares>`));
  });

  it("removes an attribute", () => {
    const result = patch(`<wares><ware id="a" tags="x"/></wares>`, `<diff><remove sel="/wares/ware[@id='a']/@tags"/></diff>`);

    expect(result).toEqual(xml(`<wares><ware id="a"/></wares>`));
  });
});

describe("applyPatch: add", () => {
  const target = `<wares><ware id="a"/><ware id="b"><price/></ware></wares>`;

  it("appends the given elements as the last children by default", () => {
    const result = patch(target, `<diff><add sel="/wares"><ware id="c"/><ware id="d"/></add></diff>`);

    expect(result).toEqual(xml(`<wares><ware id="a"/><ware id="b"><price/></ware><ware id="c"/><ware id="d"/></wares>`));
  });

  it('appends with pos="append"', () => {
    const result = patch(target, `<diff><add sel="/wares/ware[@id='b']" pos="append"><owner/></add></diff>`);

    expect(result).toEqual(xml(`<wares><ware id="a"/><ware id="b"><price/><owner/></ware></wares>`));
  });

  it('adds as the first children with pos="prepend"', () => {
    const result = patch(target, `<diff><add sel="/wares" pos="prepend"><ware id="c"/><ware id="d"/></add></diff>`);

    expect(result).toEqual(xml(`<wares><ware id="c"/><ware id="d"/><ware id="a"/><ware id="b"><price/></ware></wares>`));
  });

  it('adds as the previous siblings with pos="before"', () => {
    const result = patch(target, `<diff><add sel="/wares/ware[@id='b']" pos="before"><ware id="c"/><ware id="d"/></add></diff>`);

    expect(result).toEqual(xml(`<wares><ware id="a"/><ware id="c"/><ware id="d"/><ware id="b"><price/></ware></wares>`));
  });

  it('adds as the next siblings with pos="after"', () => {
    const result = patch(target, `<diff><add sel="/wares/ware[@id='a']" pos="after"><ware id="c"/><ware id="d"/></add></diff>`);

    expect(result).toEqual(xml(`<wares><ware id="a"/><ware id="c"/><ware id="d"/><ware id="b"><price/></ware></wares>`));
  });

  it('adds an attribute with type="@name"', () => {
    const result = patch(target, `<diff><add sel="/wares/ware[@id='a']" type="@active">false</add></diff>`);

    expect(result).toEqual(xml(`<wares><ware id="a" active="false"/><ware id="b"><price/></ware></wares>`));
  });
});

describe("applyPatch: selector forms", () => {
  it("finds an element anywhere with a leading //", () => {
    const result = patch(
      `<macros><macro name="m"><properties><thrust forward="1"/></properties></macro></macros>`,
      `<diff><replace sel="//thrust"><thrust forward="2"/></replace></diff>`,
    );

    expect(result).toEqual(xml(`<macros><macro name="m"><properties><thrust forward="2"/></properties></macro></macros>`));
  });

  it("finds the root element with a leading //", () => {
    const result = patch(`<macros><macro name="a"/></macros>`, `<diff><replace sel="//macros"><macros/></replace></diff>`);

    expect(result).toEqual(xml(`<macros/>`));
  });

  it("finds descendants with // after a step", () => {
    const result = patch(
      `<god><gamestart ref="g"><stations><station id="s"/></stations></gamestart></god>`,
      `<diff><remove sel="/god//station[@id='s']"/></diff>`,
    );

    expect(result).toEqual(xml(`<god><gamestart ref="g"><stations/></gamestart></god>`));
  });

  it("matches on attributes other than id", () => {
    const result = patch(
      `<wares><ware id="a"><production method="default"/><production method="terran" time="1"/></ware></wares>`,
      `<diff><replace sel="/wares/ware[@id='a']/production[@method='terran']/@time">5</replace></diff>`,
    );

    expect(result).toEqual(
      xml(`<wares><ware id="a"><production method="default"/><production method="terran" time="5"/></ware></wares>`),
    );
  });

  it("chains predicates in one step", () => {
    const result = patch(
      `<sounds><sound id="a" n="1"/><sound id="a" n="2"/></sounds>`,
      `<diff><remove sel="/sounds/sound[@id='a'][2]"/></diff>`,
    );

    expect(result).toEqual(xml(`<sounds><sound id="a" n="1"/></sounds>`));
  });

  it("picks the nth matching child with [n], counted under each parent", () => {
    const result = patch(
      `<docking><dock tags="s"><offset x="1"/><offset x="2"/></dock><dock tags="m"><offset x="3"/></dock></docking>`,
      `<diff><replace sel="//dock[@tags='s']/offset[2]/@x">9</replace></diff>`,
    );

    expect(result).toEqual(
      xml(`<docking><dock tags="s"><offset x="1"/><offset x="9"/></dock><dock tags="m"><offset x="3"/></dock></docking>`),
    );
  });

  it("matches either of an or predicate", () => {
    const result = patch(
      `<stations><station id="a"/><station id="c"/></stations>`,
      `<diff><replace sel="/stations/station[@id='b' or @id='c']"><station id="d"/></replace></diff>`,
    );

    expect(result).toEqual(xml(`<stations><station id="a"/><station id="d"/></stations>`));
  });

  it("matches an element without a child with [not(child)]", () => {
    const result = patch(
      `<jobs><job id="j"><location><factions/></location><location class="x"/></job></jobs>`,
      `<diff><add sel="/jobs/job[@id='j']/location[not(factions)]" type="@macro">m</add></diff>`,
    );

    expect(result).toEqual(xml(`<jobs><job id="j"><location><factions/></location><location class="x" macro="m"/></job></jobs>`));
  });

  it("matches an element without a child having an attribute value with [not(child/@a='v')]", () => {
    const result = patch(
      `<icons><upgrade><slot tags="turret small"/></upgrade><upgrade><slot tags="turret large"/></upgrade></icons>`,
      `<diff><add sel="/icons/upgrade[not(slot/@tags='turret small')]"><slot tags="extra"/></add></diff>`,
    );

    expect(result).toEqual(
      xml(
        `<icons><upgrade><slot tags="turret small"/></upgrade><upgrade><slot tags="turret large"/><slot tags="extra"/></upgrade></icons>`,
      ),
    );
  });

  it("finds an element added by an earlier operation in the same patch", () => {
    const result = patch(
      `<wares><ware id="a"/></wares>`,
      `<diff>
        <replace sel="/wares/ware[@id='a']/@id">b</replace>
        <add sel="/wares"><ware id="a" new="1"/></add>
        <add sel="/wares/ware[@id='a']" type="@seen">1</add>
        <add sel="/wares/ware[@id='b']" type="@seen">2</add>
      </diff>`,
    );

    expect(result).toEqual(xml(`<wares><ware id="b" seen="2"/><ware id="a" new="1" seen="1"/></wares>`));
  });
});

describe("applyPatch: if", () => {
  const target = `<factions><faction id="argon"/></factions>`;

  it("applies an operation whose if path matches something", () => {
    const result = patch(target, `<diff><add sel="/factions" if="//faction[@id='argon']"><faction id="x"/></add></diff>`);

    expect(result).toEqual(xml(`<factions><faction id="argon"/><faction id="x"/></factions>`));
  });

  it("skips an operation whose if path matches nothing", () => {
    const result = patch(target, `<diff><add sel="/factions" if="/factions/faction[@id='terran']"><faction id="x"/></add></diff>`);

    expect(result).toEqual(xml(target));
  });

  it("applies an operation whose if is not(path) and the path matches nothing", () => {
    const result = patch(target, `<diff><add sel="/factions" if="not(//faction[@id='terran'])"><faction id="x"/></add></diff>`);

    expect(result).toEqual(xml(`<factions><faction id="argon"/><faction id="x"/></factions>`));
  });

  it("skips an operation whose if is not(path) and the path matches", () => {
    const result = patch(target, `<diff><add sel="/factions" if="not(//faction[@id='argon'])"><faction id="x"/></add></diff>`);

    expect(result).toEqual(xml(target));
  });

  it("doesn't fail on a sel that matches nothing when the if skips it", () => {
    const result = patch(target, `<diff><remove sel="/factions/faction[@id='zz']" if="//faction[@id='zz']"/></diff>`);

    expect(result).toEqual(xml(target));
  });
});

describe("applyPatch: failures", () => {
  const target = `<wares><ware id="a" name="A"/></wares>`;

  it.each([
    ["replace", `<replace sel="/wares/ware[@id='zz']"><ware id="zz"/></replace>`],
    ["add", `<add sel="/wares/ware[@id='zz']"><price/></add>`],
  ])("fails, naming the file and selector, when an %s sel matches nothing", (_op, operation) => {
    expect(() => patch(target, `<diff>${operation}</diff>`)).toThrow(
      `${SOURCE}: sel "/wares/ware[@id='zz']" matches nothing`,
    );
  });

  it("doesn't fail on a remove whose sel matches nothing, since the node is already gone, but returns it", () => {
    const result = applyPatch(
      parseXml(target, "target"),
      parseXml(`<diff><remove sel="/wares/ware[@id='zz']"/><remove sel="/wares/ware[@id='a']/@name"/></diff>`, SOURCE),
      SOURCE,
    );

    expect(result.file).toEqual(xml(`<wares><ware id="a"/></wares>`));
    expect(result.unmatchedRemovals).toEqual(["/wares/ware[@id='zz']"]);
  });

  it("fails when a sel names an attribute the element doesn't have", () => {
    expect(() => patch(target, `<diff><replace sel="/wares/ware[@id='a']/@tags">x</replace></diff>`)).toThrow(
      `${SOURCE}: sel "/wares/ware[@id='a']/@tags" matches nothing`,
    );
  });

  it.each(["true", "1"])('skips a sel that matches nothing when the patch has silent="%s"', (silent) => {
    const result = patch(
      target,
      `<diff><replace sel="/wares/ware[@id='zz']/@name" silent="${silent}">x</replace><replace sel="/wares/ware[@id='a']/@name">B</replace></diff>`,
    );

    expect(result).toEqual(xml(`<wares><ware id="a" name="B"/></wares>`));
  });

  it.each([
    "/wares/ware[last()]",
    "/wares/ware[@id=\"a\"]",
    "/wares/ware[contains(@id, 'a')]",
    "/wares/ware/text()",
    "/wares/*",
    "/wares/ware | /wares",
    "wares/ware",
    "/wares/ware[@id='a' and @name='A']",
  ])("fails, naming the file and selector, on the unsupported selector %s", (sel) => {
    expect(() => patch(target, `<diff><remove sel="${sel.replaceAll('"', "&quot;")}"/></diff>`)).toThrow(
      `${SOURCE}: unsupported selector "${sel}"`,
    );
  });

  it("fails when a sel matches more than one node", () => {
    expect(() => patch(`<wares><ware id="a"/><ware id="b"/></wares>`, `<diff><remove sel="/wares/ware"/></diff>`)).toThrow(
      `${SOURCE}: sel "/wares/ware" matches 2 nodes, not 1`,
    );
  });

  it("fails, naming the file and selector, on an unsupported if", () => {
    expect(() => patch(target, `<diff><remove sel="/wares" if="count(/wares)"/></diff>`)).toThrow(
      `${SOURCE}: unsupported selector "count(/wares)"`,
    );
  });

  it("fails on an operation other than add, replace and remove", () => {
    expect(() => patch(target, `<diff><rename sel="/wares"/></diff>`)).toThrow(`${SOURCE}: unsupported operation <rename>`);
  });
});
