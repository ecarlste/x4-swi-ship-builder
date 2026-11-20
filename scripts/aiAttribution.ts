/**
 * Keeps AI tools out of commit attribution on main (#91). The one place the
 * AI pattern lives: the commit-msg hook strips matching Co-authored-by
 * trailers, and CI fails a PR whose commits or description still carry one.
 *
 * Runs under plain `node` (type stripping), so it imports only Node built-ins.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * A name or email that belongs to an AI tool. Matches anywhere in the text,
 * ignoring case, so bot accounts like `claude_code@…` or `copilot-swe-agent`
 * are caught too. A human whose name contains one (a co-author named Devin)
 * is caught as well: the accepted cost of not letting a bot through.
 */
const AI_TOOL = /anthropic|claude|openai|chatgpt|copilot|cursor|codex|gemini|devin/i;

const CO_AUTHOR = /^\s*co-authored-by:(.*?)\s*$/i;

function isAiCoAuthor(line: string): boolean {
  const match = CO_AUTHOR.exec(line);
  return match !== null && AI_TOOL.test(match[1]);
}

/**
 * The message without its AI Co-authored-by trailers. Every other line stays
 * as written; only when the trailers were the message's last paragraph is the
 * blank line that set them off dropped too.
 */
export function stripAiCoAuthors(message: string): string {
  const lines = message.split("\n");
  const kept = lines.filter((line) => !isAiCoAuthor(line));
  if (kept.length === lines.length) return message;

  const stripped = kept.join("\n");
  const body = stripped.replace(/(\n[ \t]*)+$/, "");
  return message.endsWith("\n") ? `${body}\n` : body;
}

/** A commit in the PR, as CI reads it. */
export type Commit = { sha: string; authorEmail: string; committerEmail: string; message: string };

/** Where AI attribution was found ("commit abc1234", "the PR description") and the offending line. */
export type Finding = { where: string; line: string };

/** Splits on CRLF too: a PR description from the GitHub UI has CRLF line ends. (`stripAiCoAuthors` keeps `\r` as written.) */
function aiCoAuthorLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter(isAiCoAuthor)
    .map((line) => line.trim());
}

/** Every AI co-author trailer, author or committer in the PR's commits and description. */
export function findAiAttribution(commits: Commit[], prDescription: string): Finding[] {
  const findings: Finding[] = [];
  for (const commit of commits) {
    const where = `commit ${commit.sha}`;
    if (AI_TOOL.test(commit.authorEmail)) findings.push({ where, line: `author: ${commit.authorEmail}` });
    if (AI_TOOL.test(commit.committerEmail)) findings.push({ where, line: `committer: ${commit.committerEmail}` });
    for (const line of aiCoAuthorLines(commit.message)) findings.push({ where, line });
  }
  for (const line of aiCoAuthorLines(prDescription)) findings.push({ where: "the PR description", line });
  return findings;
}

/** The commits in `base..head`, read from git in the current directory. */
function readCommits(base: string, head: string): Commit[] {
  const log = execFileSync("git", ["log", "--format=%H%x1f%ae%x1f%ce%x1f%B%x1e", `${base}..${head}`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return log
    .split("\x1e")
    .filter((record) => record.trim() !== "")
    .map((record) => {
      const [sha, authorEmail, committerEmail, message] = record.replace(/^\n/, "").split("\x1f");
      return { sha: sha.slice(0, 12), authorEmail, committerEmail, message };
    });
}

const USAGE = [
  "usage: node scripts/aiAttribution.ts strip <message-file>",
  "       PR_DESCRIPTION=... node scripts/aiAttribution.ts check <base> <head>",
].join("\n");

function main([command, ...args]: string[]): number {
  if (command === "strip" && args.length === 1) {
    const [file] = args;
    writeFileSync(file, stripAiCoAuthors(readFileSync(file, "utf8")));
    return 0;
  }
  if (command === "check" && args.length === 2) {
    const [base, head] = args;
    const findings = findAiAttribution(readCommits(base, head), process.env.PR_DESCRIPTION ?? "");
    if (findings.length === 0) return 0;
    console.error("AI attribution found. Remove it (amend or rebase the commit, or edit the PR description):");
    for (const { where, line } of findings) console.error(`  ${where}: ${line}`);
    return 1;
  }
  console.error(USAGE);
  return 2;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
