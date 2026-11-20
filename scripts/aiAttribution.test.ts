import { describe, expect, it } from "vitest";
import { findAiAttribution, stripAiCoAuthors } from "./aiAttribution.ts";

describe("stripAiCoAuthors", () => {
  it("removes a Claude co-author trailer and keeps a human one", () => {
    const message = [
      "Stats: add a row",
      "",
      "Body text.",
      "",
      "Co-authored-by: Ada Lovelace <ada@example.com>",
      "Co-authored-by: Claude <noreply@anthropic.com>",
      "",
    ].join("\n");
    expect(stripAiCoAuthors(message)).toBe(
      ["Stats: add a row", "", "Body text.", "", "Co-authored-by: Ada Lovelace <ada@example.com>", ""].join("\n"),
    );
  });

  it("drops the blank line left behind when every trailer was an AI one", () => {
    const message = "Fix it\n\nBody.\n\nco-authored-by: Bot <bot@OpenAI.com>\nCO-AUTHORED-BY: GitHub Copilot <x@example.com>\n";
    expect(stripAiCoAuthors(message)).toBe("Fix it\n\nBody.\n");
  });

  it("catches tool names inside a longer identity, such as a bot account", () => {
    const message = "Fix it\n\nCo-authored-by: ClaudeBot <claude_code@example.com>\nCo-authored-by: copilot-swe-agent[bot] <198982749+Copilot@users.noreply.github.com>\n";
    expect(stripAiCoAuthors(message)).toBe("Fix it\n");
  });

  it("leaves a message with no AI trailer exactly as written", () => {
    const message = "Fix it\n\n  indented body\n\n\nCo-authored-by: Grace Hopper <grace@example.com>\nSigned-off-by: Ada <ada@example.com>";
    expect(stripAiCoAuthors(message)).toBe(message);
  });
});

describe("findAiAttribution", () => {
  const human = { sha: "aaa1111", authorEmail: "ada@example.com", committerEmail: "noreply@github.com" };

  it("finds nothing in clean commits and a clean description", () => {
    const commits = [{ ...human, message: "Fix it\n\nCo-authored-by: Ada <ada@example.com>\n" }];
    expect(findAiAttribution(commits, "Closes #91.")).toEqual([]);
  });

  it("names the commit and line of an AI co-author trailer", () => {
    const commits = [{ ...human, message: "Fix it\n\nCo-authored-by: Claude <noreply@anthropic.com>\n" }];
    expect(findAiAttribution(commits, "")).toEqual([
      { where: "commit aaa1111", line: "Co-authored-by: Claude <noreply@anthropic.com>" },
    ]);
  });

  it("flags an AI author or committer email", () => {
    const commits = [
      { sha: "bbb2222", authorEmail: "noreply@anthropic.com", committerEmail: "Copilot@users.noreply.github.com", message: "Fix it" },
    ];
    expect(findAiAttribution(commits, "")).toEqual([
      { where: "commit bbb2222", line: "author: noreply@anthropic.com" },
      { where: "commit bbb2222", line: "committer: Copilot@users.noreply.github.com" },
    ]);
  });

  it("names the PR description when it carries an AI co-author trailer", () => {
    const description = "Summary.\r\n\r\nco-authored-by: ChatGPT <bot@openai.com>\r\n";
    expect(findAiAttribution([], description)).toEqual([
      { where: "the PR description", line: "co-authored-by: ChatGPT <bot@openai.com>" },
    ]);
  });
});
