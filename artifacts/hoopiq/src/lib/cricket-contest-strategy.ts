import type { CricketPlayer, MatchFormat } from "./cricket-types";
import type { PlayerAIRating } from "./ai-player-rating";

export type ContestSize = "small" | "large";

export type CricketContestStrategy = {
  contest: ContestSize;
  label: string;
  risk: string;
  captainPlan: string;
  lineupPlan: string;
  notes: string[];
  confidence: number;
};

function roleLabel(player: CricketPlayer | undefined): string {
  return player?.name ?? "the highest-rated player";
}

/**
 * Converts the existing stats-based AI ratings into contest guidance.
 * This deliberately does not alter cricket fantasy points or auto-pick.
 */
export function getCricketContestStrategies(
  players: CricketPlayer[],
  ratings: Map<string, PlayerAIRating>,
  format: MatchFormat,
): CricketContestStrategy[] {
  const ranked = players
    .map((player) => ({ player, rating: ratings.get(player.id)?.overall ?? 0 }))
    .sort((a, b) => b.rating - a.rating || a.player.name.localeCompare(b.player.name));
  const safest = [...ranked].sort(
    (a, b) => (b.rating + (b.player.role === "all" || b.player.role === "wk" ? 8 : 0))
      - (a.rating + (a.player.role === "all" || a.player.role === "wk" ? 8 : 0)),
  )[0]?.player;
  const differential = ranked.find(({ player }) => player !== safest && (player.role === "all" || player.role === "bowl"))
    ?.player ?? ranked[2]?.player;
  const captain = ranked[0]?.player;
  const viceCaptain = ranked[1]?.player;
  const highVariance = ranked.find(({ player }) => player !== captain && player !== viceCaptain && player.role === "bat")
    ?.player ?? differential;
  const dataConfidence = ranked.length > 0
    ? Math.round(ranked.slice(0, 5).reduce((sum, item) => sum + item.rating, 0) / Math.min(5, ranked.length))
    : 0;

  return [
    {
      contest: "small",
      label: "Small contest",
      risk: "Low variance",
      captainPlan: `Captain ${roleLabel(safest)} for floor; keep ${roleLabel(captain)} as VC if roles and XI are confirmed.`,
      lineupPlan: `Build around the top AI-rated core. Prefer confirmed all-rounders/WKs and avoid unconfirmed players.`,
      notes: [
        `${format} matches reward repeatable involvement more than a one-event punt.`,
        "Use fewer differentials and keep the captain/VC pair close to the safest projections.",
      ],
      confidence: Math.min(95, Math.max(25, dataConfidence + 5)),
    },
    {
      contest: "large",
      label: "Large contest",
      risk: "Higher variance",
      captainPlan: `Keep ${roleLabel(captain)} in the core, then consider ${roleLabel(highVariance)} as a differentiated C/VC in some entries.`,
      lineupPlan: `Keep a strong floor but rotate one or two lower-ownership upside players rather than duplicating one lineup.`,
      notes: [
        `Consider ${roleLabel(differential)} as the main differential when the player is in the confirmed XI.`,
        "Do not use a differential solely because the feed lacks stats; missing data is not upside.",
      ],
      confidence: Math.min(90, Math.max(20, dataConfidence - 8)),
    },
  ];
}