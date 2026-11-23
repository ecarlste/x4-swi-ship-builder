/**
 * Number formatting for the builder's tables and popovers: English digits
 * with thousands separators, as the game prints them in English.
 */
const LOCALE = "en-US";

/**
 * A number with thousands separators: "1,234.5". With `decimals`, exactly
 * that many places; without, as many as it has, up to three.
 */
export function formatNumber(n: number, decimals?: number): string {
  return decimals === undefined
    ? n.toLocaleString(LOCALE)
    : n.toLocaleString(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** A difference as "+1,000" or "−1,000" (a true minus sign); callers decide how to show 0. */
export function formatSigned(n: number, decimals?: number): string {
  return `${n < 0 ? "−" : "+"}${formatNumber(Math.abs(n), decimals)}`;
}

/** A price in whole credits: "1,234 Cr". */
export const formatCredits = (n: number) => `${formatNumber(n, 0)} Cr`;

/**
 * An X4 version as the game writes it: the manifest's integer form "800" is
 * "8.00". The footer and the Repairs notice both show versions through this.
 */
export const formatX4Version = (version: string) =>
  /^\d{3,}$/.test(version) ? `${version.slice(0, -2)}.${version.slice(-2)}` : version;
