/**
 * Share Links (spec #25, decided in #9): the Loadout JSON, with its name, is
 * compressed with deflate-raw, base64url-encoded and put in the URL fragment
 * as `#l=…`, so it never reaches a server. There's no size cap; a warning is
 * logged when a link is longer than 2,000 characters.
 */
import { parseSharedLoadout, type ParseResult, type SharedLoadout } from "./loadout.ts";

const FRAGMENT_KEY = "l";

/** Links longer than this may be cut off by chat apps and some browsers. */
export const LONG_SHARE_LINK = 2000;

export const BAD_SHARE_LINK_ERROR = "This Share Link is damaged or incomplete, so its Loadout couldn't be opened.";

async function pipe(bytes: Uint8Array<ArrayBuffer>, transform: CompressionStream | DecompressionStream) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64url(text: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("not base64url");
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The Share Link for a Loadout: `base` with the Loadout in its fragment. */
export async function shareLinkUrl(base: string, loadout: SharedLoadout): Promise<string> {
  const compressed = await pipe(new TextEncoder().encode(JSON.stringify(loadout)), new CompressionStream("deflate-raw"));
  const url = new URL(base);
  url.hash = `${FRAGMENT_KEY}=${toBase64url(compressed)}`;
  const link = url.toString();
  if (link.length > LONG_SHARE_LINK) {
    console.warn(
      `This Share Link is ${link.length} characters long, over ${LONG_SHARE_LINK}; some apps may cut it off.`,
    );
  }
  return link;
}

/**
 * Reads the Loadout from a URL fragment (`location.hash`). Null when the
 * fragment doesn't carry a Share Link; otherwise the validated Loadout, or an
 * error for a bad or tampered link or a newer `format`.
 */
export async function readShareLink(hash: string): Promise<ParseResult<SharedLoadout> | null> {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get(FRAGMENT_KEY);
  if (encoded === null) return null;

  let value: unknown;
  try {
    const json = await pipe(fromBase64url(encoded), new DecompressionStream("deflate-raw"));
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(json));
  } catch {
    return { ok: false, error: BAD_SHARE_LINK_ERROR };
  }
  return parseSharedLoadout(value);
}
