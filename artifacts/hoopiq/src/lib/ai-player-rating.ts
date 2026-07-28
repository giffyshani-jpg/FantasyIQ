// AI Player Rating Engine.
//
// Computes a 0–100 composite AI Rating for any CricketPlayer using 8 weighted factors:
//   Recent Form · Venue Record · Opposition Strength · Batting Position
//   Bowling Opportunity · Fantasy Consistency · Expected Playing Time · Risk
//
// ALL values are currently MOCK/HEURISTIC — derived from available stats.
// Architecture is designed so each factor can be replaced with a live provider
// without changing the public interfaces consumers depend on.
//
// Usage (single player):
//   const rating = computePlayerAIRating(player, { format: "T20" });
//   console.log(rating.overall); // 0–100
//
// Usage (all players):
//   const ratingsMap = computeAllPlayerRatings(players, ctx);
//   const r = ratingsMap.get(player.id);
//
// To plug in live data:
//   1. Replace mock factor helpers with live API/ML calls
//   2. Set isMock: false once a real provider is wired

import type { CricketPlayer, CricketRole, MatchFormat } from "./cricket-types";
import { calculateCricketFantasyPoints, getScoringProfile } from "./cricket-scoring";

// ── Public types ──────────────────────────────────────────────────────────────

/** Per-factor sub-scores (all 0–100). */
export interface PlayerRatingFactors {
  /** How well the player has performed recently (from stats or credit signal). */
  recentForm: number;
  /** How effective this player tends to be at this venue type (mock placeholder). */
  venueRecord: number;
  /** How strong the opposition is — lower = weaker opposition, easier pickings (mock placeholder). */
  oppositionStrength: number;
  /** Batting opportunity score — top-order gets higher. 0 for pure bowlers. */
  battingPosition: number;
  /** Expected bowling allocation quality. 0 for pure batters and WKs. */
  bowlingOpportunity: number;
  /** How consistently this player returns fantasy points (derived from credits). */
  fantasyConsistency: number;
  /** Likelihood of playing the full match (100 if confirmed XI, 60 otherwise). */
  expectedPlayingTime: number;
  /** Inverse-risk score — higher = safer pick. */
  riskScore: number;
}

export type RatingLabel = "Elite" | "Excellent" | "Good" | "Average" | "Risky" | "Poor";

/** Full AI rating output for one player. */
export interface PlayerAIRating {
  /** Composite weighted score 0–100. */
  overall: number;
  /** Per-factor breakdown for transparency and debugging. */
  factors: PlayerRatingFactors;
  /** Player role used for factor weighting. */
  role: CricketRole;
  /** Human-readable label derived from overall score. */
  label: RatingLabel;
  /** Always true until real AI provider is wired. */
  isMock: true;
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface PlayerRatingContext {
  format: MatchFormat;
  competitionName?: string;
  isBattingFriendly?: boolean;
}

// ── Role weight profiles ──────────────────────────────────────────────────────
// Weights must sum to 1.0 per role.
// Architecture: swap these for ML-calibrated weights from a live model.

interface WeightProfile {
  recentForm: number;
  venueRecord: number;
  oppositionStrength: number;
  battingPosition: number;
  bowlingOpportunity: number;
  fantasyConsistency: number;
  expectedPlayingTime: number;
  riskScore: number;
}

const ROLE_WEIGHTS: Record<CricketRole, WeightProfile> = {
  bat: {
    recentForm: 0.28,
    venueRecord: 0.10,
    oppositionStrength: 0.10,
    battingPosition: 0.15,
    bowlingOpportunity: 0.00,
    fantasyConsistency: 0.18,
    expectedPlayingTime: 0.12,
    riskScore: 0.07,
  },
  bowl: {
    recentForm: 0.28,
    venueRecord: 0.10,
    oppositionStrength: 0.12,
    battingPosition: 0.00,
    bowlingOpportunity: 0.18,
    fantasyConsistency: 0.17,
    expectedPlayingTime: 0.10,
    riskScore: 0.05,
  },
  all: {
    recentForm: 0.25,
    venueRecord: 0.10,
    oppositionStrength: 0.10,
    battingPosition: 0.10,
    bowlingOpportunity: 0.10,
    fantasyConsistency: 0.20,
    expectedPlayingTime: 0.10,
    riskScore: 0.05,
  },
  wk: {
    recentForm: 0.26,
    venueRecord: 0.08,
    oppositionStrength: 0.08,
    battingPosition: 0.18,
    bowlingOpportunity: 0.00,
    fantasyConsistency: 0.20,
    expectedPlayingTime: 0.12,
    riskScore: 0.08,
  },
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Derive a recent-form score from available stats.
 * Uses fantasy points if scorecard data exists; falls back to credits as proxy.
 * Architecture: replace with last-N-games rolling stats from a live provider.
 */
function computeRecentForm(
  player: CricketPlayer,
  format: MatchFormat,
  competitionName: string,
): number {
  const profile = getScoringProfile(format, competitionName);
  const hasStats =
    player.stats?.batting !== undefined || player.stats?.bowling !== undefined;

  if (hasStats) {
    const pts = calculateCricketFantasyPoints(player.stats, profile);
    // Map fantasy pts → 0–100: 0 pts → 30 baseline, 100+ pts → ~95
    const base = 30 + Math.min(65, pts.total * 0.65);
    return clamp(base);
  }

  // Pre-match: use credit value as form proxy (credits 8–12+ = in-form)
  if (player.credits !== null) {
    const base = 35 + (player.credits - 7) * 8;
    return clamp(base);
  }

  return 50; // neutral fallback
}

/**
 * Batting-position score — high-order batters get more scoring opportunity.
 * Architecture: replace with actual batting-order position from lineup API.
 */
function computeBattingPosition(player: CricketPlayer, format: MatchFormat): number {
  if (player.role === "bowl") return 0;

  const hasBatting = player.stats?.batting !== undefined;
  if (!hasBatting) {
    // Pre-match heuristic by role
    if (player.role === "wk")  return 80;
    if (player.role === "bat") return 72;
    if (player.role === "all") return 55;
    return 40;
  }

  const bat = player.stats.batting!;
  const balls = bat.balls ?? 0;
  const runs  = bat.runs  ?? 0;

  if (balls >= 40) return clamp(82 + (runs >= 50 ? 10 : 0));
  if (balls >= 20) return clamp(65 + Math.min(15, runs * 0.2));
  if (balls >= 8)  return 52;
  if (balls > 0)   return 38;
  // Didn't bat
  return format === "T20" ? 35 : 28;
}

/**
 * Bowling-opportunity score — based on overs bowled or expected allocation.
 * Architecture: replace with pre-match bowling-order data from lineup API.
 */
function computeBowlingOpportunity(player: CricketPlayer, format: MatchFormat): number {
  if (player.role === "bat" || player.role === "wk") return 0;

  const hasBowling = player.stats?.bowling !== undefined;
  if (!hasBowling) {
    if (player.role === "bowl") return 75;
    if (player.role === "all")  return 55;
    return 30;
  }

  const bowl = player.stats.bowling!;
  const maxOvers =
    format === "T20" ? 4 :
    format === "ODI" ? 10 :
    format === "T10" ? 2 :
    4;
  const totalOvers = bowl.overs + bowl.extraBalls / 6;
  const allocationPct = Math.min(1, totalOvers / maxOvers);
  const wicketBonus = Math.min(30, bowl.wickets * 8);
  return clamp(40 + allocationPct * 40 + wicketBonus);
}

/**
 * Fantasy-consistency score — derived from platform credit value.
 * Architecture: replace with historical ownership/points-per-game from a provider.
 */
function computeFantasyConsistency(player: CricketPlayer): number {
  if (player.credits !== null) {
    const base = 30 + (player.credits - 6) * 10;
    return clamp(base);
  }
  return 55;
}

/** Expected playing time — 100 if confirmed XI, 60 otherwise. */
function computeExpectedPlayingTime(player: CricketPlayer): number {
  return player.isPlaying ? 100 : 60;
}

/**
 * Venue record — mock placeholder.
 * Architecture: replace with player-venue lookup from historical stats API.
 */
function computeVenueRecord(player: CricketPlayer): number {
  const seed = player.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return clamp(50 + ((seed % 40) - 20));
}

/**
 * Opposition strength — mock placeholder.
 * Architecture: replace with opposition batting/bowling ranking from live data.
 */
function computeOppositionStrength(player: CricketPlayer): number {
  const seed = player.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 17);
  return clamp(55 + ((seed % 30) - 15));
}

/**
 * Risk score — inverse of risk (high = safer pick).
 * Derived from: confirmed XI, credits, role, format.
 */
function computeRiskScore(player: CricketPlayer, format: MatchFormat): number {
  let risk = 50;
  if (!player.isPlaying) risk -= 25;
  if (player.credits !== null && player.credits >= 9) risk += 20;
  if (player.role === "all" || player.role === "wk")  risk += 8;
  if (format === "Test") risk += 10;
  return clamp(risk);
}

// ── Rating label ──────────────────────────────────────────────────────────────

function toRatingLabel(overall: number): RatingLabel {
  if (overall >= 85) return "Elite";
  if (overall >= 72) return "Excellent";
  if (overall >= 58) return "Good";
  if (overall >= 44) return "Average";
  if (overall >= 30) return "Risky";
  return "Poor";
}

// ── Public entry points ───────────────────────────────────────────────────────

/**
 * Compute the AI Rating for a single CricketPlayer.
 *
 * @param player  CricketPlayer from the game object.
 * @param ctx     Match context (format, competition, surface info).
 */
export function computePlayerAIRating(
  player: CricketPlayer,
  ctx: PlayerRatingContext,
): PlayerAIRating {
  const { format, competitionName = "", isBattingFriendly: _isBattingFriendly = true } = ctx;

  const factors: PlayerRatingFactors = {
    recentForm:          computeRecentForm(player, format, competitionName),
    venueRecord:         computeVenueRecord(player),
    oppositionStrength:  computeOppositionStrength(player),
    battingPosition:     computeBattingPosition(player, format),
    bowlingOpportunity:  computeBowlingOpportunity(player, format),
    fantasyConsistency:  computeFantasyConsistency(player),
    expectedPlayingTime: computeExpectedPlayingTime(player),
    riskScore:           computeRiskScore(player, format),
  };

  const w = ROLE_WEIGHTS[player.role];
  const overall = clamp(
    factors.recentForm          * w.recentForm          +
    factors.venueRecord         * w.venueRecord         +
    factors.oppositionStrength  * w.oppositionStrength  +
    factors.battingPosition     * w.battingPosition     +
    factors.bowlingOpportunity  * w.bowlingOpportunity  +
    factors.fantasyConsistency  * w.fantasyConsistency  +
    factors.expectedPlayingTime * w.expectedPlayingTime +
    factors.riskScore           * w.riskScore,
  );

  return {
    overall,
    factors,
    role: player.role,
    label: toRatingLabel(overall),
    isMock: true,
  };
}

/**
 * Batch-rate all players in an array.
 * Returns a Map keyed by player.id for O(1) lookup in rendering components.
 */
export function computeAllPlayerRatings(
  players: CricketPlayer[],
  ctx: PlayerRatingContext,
): Map<string, PlayerAIRating> {
  const map = new Map<string, PlayerAIRating>();
  for (const p of players) {
    map.set(p.id, computePlayerAIRating(p, ctx));
  }
  return map;
}
