import { createHash } from "node:crypto";

/**
 * The port Playwright serves the app on. Each checkout gets its own default,
 * hashed from its absolute path, so UI runs in two worktrees at once don't share
 * a server (barring a rare hash collision). `PW_PORT` overrides it.
 *
 * The range sits clear of Vite's default 5173 and below the OS ephemeral
 * ranges (32768+ on Linux, 49152+ on Windows and macOS).
 */

const FIRST_PORT = 20000;
const PORT_COUNT = 10000;

export function playwrightPort(
  checkoutPath: string,
  env: Record<string, string | undefined>,
): number {
  if (env.PW_PORT) {
    const port = Number(env.PW_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`PW_PORT must be a port number (1–65535), not "${env.PW_PORT}".`);
    }
    return port;
  }
  const hash = createHash("sha256").update(checkoutPath).digest().readUInt32BE(0);
  return FIRST_PORT + (hash % PORT_COUNT);
}
