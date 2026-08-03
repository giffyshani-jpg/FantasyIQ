// Shared "is this player actually available" logic.
//
// ESPN's box score athlete entries carry explicit `starter` and `didNotPlay`
// flags alongside an injury-report status ("OUT" / "GTD" / "Questionable" /
// "Probable") — see providers/espn.js. Both are undefined pregame, before a
// box score has been published.
//
// We derive "inactive" (covering OUT, DNP, Inactive, and Not-in-lineup, per
// the product ask) as: explicitly ruled OUT on the injury report, OR ESPN's
// own `didNotPlay` flag is true, OR — as a fallback for feed shapes that
// omit that flag — the game has started/finished and the player recorded
// zero minutes. Pregame ("scheduled"), nobody has "not played" yet, so
// nobody is inactive on that basis alone.

import { Game, Player } from "./types";

export function minutesValue(stats: Player["stats"]): number {
  const parsed = stats.minutes ? parseFloat(stats.minutes) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** True if the player should be treated as OUT / DNP / Inactive / Not-in-lineup. */
export function isPlayerInactive(player: Player, gameStatus: Game["status"]): boolean {
  if (player.injuryStatus === "OUT") return true;
  if (gameStatus === "scheduled") return false;
  if (player.didNotPlay === true) return true;
  if (player.didNotPlay === false) return false;
  return minutesValue(player.stats) === 0;
}

/**
 * Status label to surface as a badge. Explicit injury-report statuses take
 * priority (they're more specific); otherwise falls back to "DNP" once the
 * game is underway and the player is confirmed (or inferred) to not have
 * played.
 */
export function inactiveStatusLabel(
  player: Player,
  gameStatus: Game["status"],
): "OUT" | "GTD" | "Questionable" | "Probable" | "DNP" | null {
  if (player.injuryStatus) return player.injuryStatus;
  if (gameStatus === "scheduled") return null;
  if (player.didNotPlay === true) return "DNP";
  if (player.didNotPlay === false) return null;
  if (minutesValue(player.stats) === 0) return "DNP";
  return null;
}

/**
 * Lineup-role label sourced directly from ESPN's per-athlete `starter` flag.
 *
 * When ESPN has published the lineup (starter is a boolean), returns the
 * confirmed label so the badge reads "Confirmed Starter" / "Confirmed Bench".
 * These match the richer Pre-Game Intelligence labels used in pregame-intel.ts
 * so the visual language is consistent across all views.
 *
 * When the game is scheduled and ESPN has not yet published the lineup
 * (starter is undefined), returns "Unknown" rather than nothing — this
 * signals to the user that no lineup data is available yet, rather than
 * implying the player is active but unlabeled.
 *
 * For live/final games where starter is undefined (e.g. a DNP after lock),
 * returns null so the existing DNP/OUT badge from inactiveStatusLabel carries
 * the full story without duplication.
 */
export function starterBadgeLabel(
  player: Player,
  gameStatus?: Game["status"],
): "Confirmed Starter" | "Confirmed Bench" | "Unknown" | null {
  if (typeof player.starter === "boolean") {
    return player.starter ? "Confirmed Starter" : "Confirmed Bench";
  }
  // Lineup not yet announced — show Unknown only for scheduled games.
  // For live/final, the DNP badge already conveys the absent-starter state.
  if (gameStatus === "scheduled") return "Unknown";
  return null;
}

/**
 * Tier used to sort a player list: selected players always first, then
 * remaining active players, then inactive players always last — regardless
 * of whatever sort key/direction is otherwise applied.
 */
export function playerSortTier(
  player: Player,
  gameStatus: Game["status"],
  isSelected: boolean,
): number {
  if (isSelected) return 0;
  if (isPlayerInactive(player, gameStatus)) return 2;
  return 1;
}
