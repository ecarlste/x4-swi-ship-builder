/**
 * Whether a game file is one the later stages need: library files, the macro
 * and component index, the macros and components of ships and equipment
 * (including bullets and deployables), station module macros, and the English and language-neutral
 * text files. `path` is lowercased with forward slashes. A path under
 * `extensions/<folder>/` is one extension overriding another's file: it's
 * needed only if that folder is in `loadedFolders` (lowercased), and is then
 * judged by the part after it.
 */
export function isNeededFile(path: string, loadedFolders: ReadonlySet<string>): boolean {
  const override = /^extensions\/([^/]+)\/(.*)$/.exec(path);
  if (override && !loadedFolders.has(override[1]!)) return false;
  const gamePath = override ? override[2]! : path;
  return NEEDED.some((pattern) => pattern.test(gamePath));
}

const NEEDED: RegExp[] = [
  // Only files directly in libraries/: SWI ships junk in libraries/backup/ that the game never reads.
  /^libraries\/[^/]+\.xml$/,
  /^index\/(macros|components)\.xml$/,
  /^assets\/units\/.+\.xml$/,
  /^assets\/props\/.+\.xml$/,
  /^assets\/fx\/weaponfx\/.+\.xml$/,
  /^assets\/wares\/.+\.xml$/,
  // Station module macros: build modules say which ship classes a station builds.
  /^assets\/structures\/.+\/macros\/[^/]+\.xml$/,
  /^t\/0001(-l044)?\.xml$/,
];
