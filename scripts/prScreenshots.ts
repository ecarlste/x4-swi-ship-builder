/**
 * Before and after screenshots on every PR (#150). The screenshots workflow
 * (`.github/workflows/screenshots.yml`) takes them with
 * `screenshots/shots.spec.ts`, then this script commits them to the orphan
 * `pr-screenshots` branch and writes the PR comment that shows them.
 *
 * Runs under plain `node` (type stripping), so it imports only Node built-ins.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The states the shots spec takes, in the order the comment shows them. */
export const STATES = [
  { key: "empty", label: "Empty page" },
  { key: "loadout-popover", label: "Fitted Loadout, comparison popover open" },
  { key: "saved-loadouts", label: "Saved Loadouts open" },
  { key: "save-dialog", label: "Save dialog open" },
] as const;

export type StateKey = (typeof STATES)[number]["key"];
export type Phase = "before" | "after";

/** The screenshot's file name, in the shots folder and on the branch. */
export const shotFile = (phase: Phase, state: StateKey) => `${phase}-${state}.png`;

/** The branch the screenshots live on, and the hidden marker the comment is found by. */
export const BRANCH = "pr-screenshots";
export const MARKER = "<!-- pr-screenshots -->";

export type CommentInput = {
  /** `owner/name`. */
  repo: string;
  pr: number;
  baseSha: string;
  headSha: string;
  /** The screenshots taken, by file name: a state missing from it shows _None_. */
  files: string[];
};

/** The PR comment: a before and after table of every state, its images linked from the branch. */
export function commentBody({ repo, pr, baseSha, headSha, files }: CommentInput): string {
  const folder = `https://raw.githubusercontent.com/${repo}/${BRANCH}/pr-${pr}/${headSha}`;
  const taken = new Set(files);
  const cell = (phase: Phase, state: (typeof STATES)[number]) => {
    const file = shotFile(phase, state.key);
    return taken.has(file) ? `![${state.label}, ${phase}](${folder}/${file})` : "_None_";
  };
  return [
    MARKER,
    "### Screenshots",
    "",
    `Before is the base (\`${baseSha.slice(0, 7)}\`), after is this PR's head (\`${headSha.slice(0, 7)}\`), ` +
      "both built against the fixture snapshot and shown 1280px wide. This comment updates on every push. " +
      "_None_ means that screenshot wasn't taken: the state failed, or the build did.",
    "",
    "| State | Before | After |",
    "| --- | --- | --- |",
    ...STATES.map((state) => `| ${state.label} | ${cell("before", state)} | ${cell("after", state)} |`),
    "",
  ].join("\n");
}

/** The Actions bot, which every commit on the branch is made as. */
const BOT = {
  GIT_AUTHOR_NAME: "github-actions[bot]",
  GIT_AUTHOR_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
  GIT_COMMITTER_NAME: "github-actions[bot]",
  GIT_COMMITTER_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
};

function git(args: string[], env: Record<string, string> = {}): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: "pipe", env: { ...process.env, ...env } }).trim();
}

/** The branch's tip on origin, fetched; null when origin has no such branch yet. */
function fetchBranch(): string | null {
  const listed = spawnSync("git", ["ls-remote", "--exit-code", "origin", `refs/heads/${BRANCH}`], { encoding: "utf8" });
  if (listed.status === 2) return null;
  if (listed.status !== 0) throw new Error(`git ls-remote failed: ${listed.stderr}`);
  git(["fetch", "-q", "--depth=1", "origin", `refs/heads/${BRANCH}`]);
  return git(["rev-parse", "FETCH_HEAD"]);
}

/**
 * Replaces the PR's folder on the branch with these files (none removes it) and
 * pushes, without checking the branch out: the commit is built in a throwaway
 * index. The push isn't forced, so when another PR's job pushed first it is
 * rejected; then the change is rebuilt on the new tip and pushed again.
 */
function replaceFolder(pr: number, files: { path: string; from: string }[], message: string): void {
  const scratch = mkdtempSync(join(tmpdir(), "pr-screenshots-"));
  const env = { ...BOT, GIT_INDEX_FILE: join(scratch, "index") };
  try {
    for (let attempt = 1; ; attempt++) {
      const parent = fetchBranch();
      if (parent === null && files.length === 0) return;
      git(parent === null ? ["read-tree", "--empty"] : ["read-tree", parent], env);
      git(["rm", "-r", "-q", "--cached", "--ignore-unmatch", `pr-${pr}`], env);
      for (const { path, from } of files) {
        const blob = git(["hash-object", "-w", from]);
        git(["update-index", "--add", "--cacheinfo", `100644,${blob},${path}`], env);
      }
      const tree = git(["write-tree"], env);
      if (parent !== null && tree === git(["rev-parse", `${parent}^{tree}`])) return;
      const commit = git(["commit-tree", tree, ...(parent === null ? [] : ["-p", parent]), "-m", message], env);
      const pushed = spawnSync("git", ["push", "-q", "origin", `${commit}:refs/heads/${BRANCH}`], { encoding: "utf8" });
      if (pushed.status === 0) return;
      if (attempt === 5) throw new Error(`Couldn't push ${BRANCH}: ${pushed.stderr}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** The PNGs in the shots folder; none when it doesn't exist (every screenshot failed). */
function shotsIn(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith(".png")).sort() : [];
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set.`);
  return value;
}

const USAGE = [
  "usage: PR_NUMBER=... HEAD_SHA=... node scripts/prScreenshots.ts publish <shots-dir>",
  "       PR_NUMBER=... BASE_SHA=... HEAD_SHA=... GITHUB_REPOSITORY=... node scripts/prScreenshots.ts comment <shots-dir>",
  "       PR_NUMBER=... node scripts/prScreenshots.ts clean",
].join("\n");

function main([command, ...args]: string[]): number {
  if (command === "publish" && args.length === 1) {
    const [dir] = args;
    const pr = Number(requiredEnv("PR_NUMBER"));
    const headSha = requiredEnv("HEAD_SHA");
    const files = shotsIn(dir).map((file) => ({ path: `pr-${pr}/${headSha}/${file}`, from: join(dir, file) }));
    replaceFolder(pr, files, `PR #${pr} screenshots at ${headSha.slice(0, 7)}`);
    return 0;
  }
  if (command === "comment" && args.length === 1) {
    const [dir] = args;
    process.stdout.write(
      commentBody({
        repo: requiredEnv("GITHUB_REPOSITORY"),
        pr: Number(requiredEnv("PR_NUMBER")),
        baseSha: requiredEnv("BASE_SHA"),
        headSha: requiredEnv("HEAD_SHA"),
        files: shotsIn(dir),
      }),
    );
    return 0;
  }
  if (command === "clean" && args.length === 0) {
    const pr = Number(requiredEnv("PR_NUMBER"));
    replaceFolder(pr, [], `PR #${pr} closed: remove its screenshots`);
    return 0;
  }
  console.error(USAGE);
  return 2;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
