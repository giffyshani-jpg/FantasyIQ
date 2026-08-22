/**
 * Shared application constants — single source of truth for version and build metadata.
 *
 * To bump the release version, change APP_VERSION here only.
 * BUILD_DATE is injected automatically by vite.config.ts at compile time.
 */

// Injected at compile time by vite.config.ts define block.
declare const __BUILD_DATE__: string;

/** Current release version. Change this string for every release. */
export const APP_VERSION = "0.1.0";

/** Release stage label shown in the UI (e.g. "Beta", "RC", or "" for stable). */
export const APP_STAGE = "Beta";

/** ISO 8601 timestamp captured when the bundle was last built. */
export const BUILD_DATE: string =
  typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : new Date().toISOString();

/**
 * Returns a short human-readable build date string, e.g. "Aug 4, 2026".
 * Falls back to the raw ISO string if the date cannot be parsed.
 */
export function formatBuildDate(): string {
  try {
    return new Date(BUILD_DATE).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return BUILD_DATE;
  }
}

/**
 * Full version label suitable for display, e.g. "FantasyIQ v0.1.0 Beta".
 */
export function appVersionLabel(): string {
  return APP_STAGE
    ? `FantasyIQ v${APP_VERSION} ${APP_STAGE}`
    : `FantasyIQ v${APP_VERSION}`;
}
