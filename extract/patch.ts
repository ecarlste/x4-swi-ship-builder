import { ExtractError } from "./errors.ts";
import type { XmlElement } from "./xml.ts";

/**
 * Applies a `<diff>` patch file to the merged file it targets (if any) and
 * returns the patched file. `source` names the patch in errors. Patching
 * arrives in #29; until then every patch is a hard failure.
 */
export function applyPatch(_target: XmlElement | undefined, _diff: XmlElement, source: string): XmlElement {
  throw new ExtractError(`${source}: diff patching not implemented yet`);
}
