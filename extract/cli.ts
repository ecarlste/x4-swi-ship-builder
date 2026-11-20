/**
 * `npm run extract`: reads an X4 + SWI install into the extraction cache.
 *
 *   npm run extract --x4 <path>        (or X4_INSTALL_DIR in .env)
 *   --cache <dir>                      cache folder, default .cache/extract
 */
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { ExtractError } from "./errors.ts";
import { extract } from "./extract.ts";

const repoRoot = resolve(import.meta.dirname, "..");

function main(): void {
  const { values, positionals } = parseArgs({
    options: { x4: { type: "string" }, cache: { type: "string" } },
    allowPositionals: true,
  });
  // `npm run extract --x4 <path>` (without `--`) keeps `--x4` as an npm config
  // flag (npm_config_x4=true) and passes the path on as a positional argument.
  const npmFlag = process.env.npm_config_x4 === "true";
  if (positionals.length > (npmFlag ? 1 : 0)) {
    throw new ExtractError(`Unexpected argument: ${positionals.join(" ")}`);
  }
  const x4Dir = values.x4 ?? (npmFlag ? positionals[0] : undefined) ?? process.env.X4_INSTALL_DIR;
  if (!x4Dir) {
    throw new ExtractError("No X4 install folder given. Pass --x4 <path>, or set X4_INSTALL_DIR in .env.");
  }
  const cacheDir = resolve(values.cache ?? resolve(repoRoot, ".cache/extract"));

  console.log(`Reading ${x4Dir}`);
  const result = extract({ x4Dir: resolve(x4Dir), cacheDir });
  for (const layer of result.layers) {
    console.log(`  ${layer.id}: ${layer.files} files, ${layer.substFiles} subst files`);
  }
  console.log(`Merged ${result.layers.length} layers into ${result.files} files in ${cacheDir}`);
  console.log(`Report: ${result.reportPath}`);
}

try {
  main();
} catch (error) {
  // ExtractErrors and bad command-line flags (parseArgs TypeErrors with a code) are the user's to fix.
  if (!(error instanceof ExtractError) && !(error instanceof TypeError && "code" in error)) throw error;
  console.error(`Extraction failed: ${error.message}`);
  process.exitCode = 1;
}
