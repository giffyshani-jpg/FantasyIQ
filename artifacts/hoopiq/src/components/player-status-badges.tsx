import { InjuryBadge } from "./injury-badge";
import { inactiveStatusLabel, starterBadgeLabel } from "../lib/player-status";
import { Game, Player } from "../lib/types";

/**
 * Consistent status-badge rendering shared by Box Score, Fantasy Optimizer,
 * and Player Comparison.
 *
 * Availability badge (OUT / GTD / Questionable / Probable / DNP):
 *   Sourced from the provider injury report or the ESPN didNotPlay flag.
 *
 * Lineup-role badge:
 *   - "Confirmed Starter" / "Confirmed Bench" — ESPN's starter flag is a
 *     boolean (lineup has been officially published).
 *   - "Unknown" — game is scheduled but ESPN has not published the lineup yet.
 *     Shown so the user sees "Unknown" rather than a blank, making it clear
 *     that no data is available (not that the player is confirmed active).
 *   - Nothing — live / final game where starter is undefined (DNP / OUT badge
 *     already carries the full story).
 *
 * Never fabricates a status — every label comes directly from the provider.
 */
export function PlayerStatusBadges({
  player,
  gameStatus,
  className = "",
}: {
  player: Player;
  gameStatus: Game["status"];
  className?: string;
}) {
  const status = inactiveStatusLabel(player, gameStatus);
  const starter = starterBadgeLabel(player, gameStatus);

  if (!status && !starter) return null;

  return (
    <span className={`inline-flex items-center gap-1 shrink-0 ${className}`}>
      <InjuryBadge status={status ?? undefined} />
      <InjuryBadge status={starter ?? undefined} />
    </span>
  );
}
