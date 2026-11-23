import { describe, expect, it } from "vitest";
import { commentBody } from "./prScreenshots.ts";

const RAW = "https://raw.githubusercontent.com/ecarlste/x4-swi-ship-builder/pr-screenshots/pr-150/def5678def5678def5678def5678def5678def56";

describe("the screenshot comment", () => {
  const pr = {
    repo: "ecarlste/x4-swi-ship-builder",
    pr: 150,
    baseSha: "abc1234abc1234abc1234abc1234abc1234abc12",
    headSha: "def5678def5678def5678def5678def5678def56",
  };

  it("starts with the hidden marker it is found by", () => {
    expect(commentBody({ ...pr, files: [] }).startsWith("<!-- pr-screenshots -->\n")).toBe(true);
  });

  it("shows each state's before and after images from the pr-screenshots branch, inline", () => {
    const body = commentBody({ ...pr, files: ["before-empty.png", "after-empty.png", "after-save-dialog.png", "before-save-dialog.png"] });
    expect(body).toContain("| State | Before | After |");
    expect(body).toContain(`| Empty page | ![Empty page, before](${RAW}/before-empty.png) | ![Empty page, after](${RAW}/after-empty.png) |`);
    expect(body).toContain(`| Save dialog open | ![Save dialog open, before](${RAW}/before-save-dialog.png) | ![Save dialog open, after](${RAW}/after-save-dialog.png) |`);
  });

  it("lists every state in a fixed order, saying where a screenshot wasn't taken", () => {
    const body = commentBody({ ...pr, files: ["after-saved-loadouts.png"] });
    const rows = body.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| State") && !line.startsWith("| ---"));
    expect(rows).toEqual([
      "| Empty page | _None_ | _None_ |",
      "| Fitted Loadout, comparison popover open | _None_ | _None_ |",
      `| Saved Loadouts open | _None_ | ![Saved Loadouts open, after](${RAW}/after-saved-loadouts.png) |`,
      "| Save dialog open | _None_ | _None_ |",
    ]);
  });

  it("names the base and head commits it compares", () => {
    const body = commentBody({ ...pr, files: [] });
    expect(body).toContain("`abc1234`");
    expect(body).toContain("`def5678`");
  });
});
