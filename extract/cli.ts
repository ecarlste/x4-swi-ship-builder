/**
 * `npm run extract`: reads an X4 + SWI install into the extraction cache
 * (Stage 1, merge), then writes a Game Data snapshot from it (Stage 2).
 *
 *   npm run extract --x4 <path>        (or X4_INSTALL_DIR in .env)
 *   --cache <dir>                      cache folder, default .cache/extract
 *   --game-data <dir>                  snapshot folder, default game-data
 *   --transform-only                   skip the merge and re-run Stage 2 from the cache
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { ExtractError } from "./errors.ts";
import { extract } from "./extract.ts";
import { transform } from "./transform.ts";

const repoRoot = resolve(import.meta.dirname, "..");

function main(): void {
  const { values, positionals } = parseArgs({
    options: {
      x4: { type: "string" },
      cache: { type: "string" },
      "game-data": { type: "string" },
      "transform-only": { type: "boolean" },
    },
    allowPositionals: true,
  });
  // `npm run extract --x4 <path>` (without `--`) keeps `--x4` as an npm config
  // flag (npm_config_x4=true) and passes the path on as a positional argument.
  const npmFlag = process.env.npm_config_x4 === "true";
  if (positionals.length > (npmFlag ? 1 : 0)) {
    throw new ExtractError(`Unexpected argument: ${positionals.join(" ")}`);
  }
  const cacheDir = resolve(values.cache ?? resolve(repoRoot, ".cache/extract"));
  const gameDataDir = resolve(values["game-data"] ?? resolve(repoRoot, "game-data"));

  if (!values["transform-only"]) {
    const x4Dir = values.x4 ?? (npmFlag ? positionals[0] : undefined) ?? process.env.X4_INSTALL_DIR;
    if (!x4Dir) {
      throw new ExtractError("No X4 install folder given. Pass --x4 <path>, or set X4_INSTALL_DIR in .env.");
    }
    console.log(`Reading ${x4Dir}`);
    const merged = extract({ x4Dir: resolve(x4Dir), cacheDir });
    for (const layer of merged.layers) {
      console.log(`  ${layer.id}: ${layer.files} files, ${layer.substFiles} subst files`);
    }
    console.log(`Merged ${merged.layers.length} layers into ${merged.files} files in ${cacheDir}`);
  }

  const result = transform({ cacheDir, gameDataDir, pipelineCommit: pipelineCommit() });
  const { s, m, l, xl } = result.ships;
  console.log(`Ships: ${s + m + l + xl} (S ${s}, M ${m}, L ${l}, XL ${xl})`);
  console.log(
    `Equipment: ${result.equipment.included} (${result.equipment.withSeller} wares have a Seller before the fits-a-buildable-Ship filter)`,
  );
  console.log(`Snapshot: ${result.snapshotDir}`);
  console.log(`Report: ${result.reportPath}`);
}

/** The repo's current commit, marked `-dirty` when the working tree has changes. */
function pipelineCommit(): string {
  try {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
    const commit = git("rev-parse", "HEAD");
    return git("status", "--porcelain") === "" ? commit : `${commit}-dirty`;
  } catch {
    return "unknown";
  }
}

try {
  main();
} catch (error) {
  // ExtractErrors and bad command-line flags (parseArgs TypeErrors with a code) are the user's to fix.
  if (!(error instanceof ExtractError) && !(error instanceof TypeError && "code" in error)) throw error;
  console.error(`Extraction failed: ${error.message}`);
  process.exitCode = 1;
}
