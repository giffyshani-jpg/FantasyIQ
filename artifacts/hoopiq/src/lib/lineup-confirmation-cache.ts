// Tracks the first time a player's lineup status was confirmed for a game
// (i.e. ESPN published the actual starting lineup).
//
// Uses sessionStorage — data is scoped to the current browser tab and cleared
// automatically when the tab closes. We never need this beyond the current
// session, and we never store PII or fabricated data: only timestamps keyed
// by provider-supplied game + player IDs.
//
// "Confirmed" means ESPN's own box-score starter flag has been published for
// tonight's game (LineupStatus === "Confirmed Starter" | "Confirmed Bench").
// "Expected" (heuristic from prior game) is intentionally NOT recorded here.

const PREFIX = "fantasyiq:lineup-confirmed:";

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

function storageKey(gameId: string, playerId: string): string {
  return `${PREFIX}${gameId}:${playerId}`;
}

/**
 * Record the first time a player's lineup was confirmed for a game.
 * Safe to call on every render — silently no-ops if already recorded.
 */
export function recordLineupConfirmation(gameId: string, playerId: string): void {
  if (!hasStorage() || !gameId || !playerId) return;
  const k = storageKey(gameId, playerId);
  if (window.sessionStorage.getItem(k) !== null) return; // already recorded
  window.sessionStorage.setItem(k, String(Date.now()));
}

/**
 * Returns the epoch-ms timestamp when this player was first confirmed for
 * the given game, or null if never recorded in this session.
 */
export function getLineupConfirmedAt(gameId: string, playerId: string): number | null {
  if (!hasStorage() || !gameId || !playerId) return null;
  const raw = window.sessionStorage.getItem(storageKey(gameId, playerId));
  if (raw === null) return null;
  const ts = parseInt(raw, 10);
  return Number.isFinite(ts) ? ts : null;
}

/**
 * Human-readable relative-time string for how long ago a lineup was confirmed.
 * Examples: "just now", "1 min ago", "18 min ago".
 */
export function formatConfirmedAgo(confirmedAt: number): string {
  const elapsed = Math.max(0, Date.now() - confirmedAt);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes === 0) return "just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}
