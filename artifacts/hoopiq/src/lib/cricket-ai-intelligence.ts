// Cricket AI Match Intelligence engine.
//
// Computes 9 intelligence signals for any CricketGame:
//   matchDifficulty · surface · weather · toss · battingFriendly
//   captainPicks · viceCaptainPicks · differentialPicks · riskLevel
//
// ALL values are currently MOCK/HEURISTIC — format-aware approximations.
// Architecture is designed so every field can be replaced with a real
// provider value without changing the interface consumers depend on.
//
// To plug in real data:
//   1. Replace FORMAT_PROFILES values with live pitch/weather API responses
//   2. Replace rankPlayersForPicks() scoring with ML model outputs
//   3. Set isMock: false once a real provider is wired

import type { CricketGame, CricketPlayer, MatchFormat } from "./cricket-types";
import { calculateCricketFantasyPoints, getScoringProfile } from "./cricket-scoring";

// ── Public types ──────────────────────────────────────────────────────────────

export type DifficultyLevel = "EASY" | "MEDIUM" | "HARD";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
export type SurfaceType =
  | "BATTING"
  | "BALANCED"
  | "BOWLING"
  | "SPIN_FRIENDLY"
  | "SEAM_FRIENDLY";

export interface MatchDifficulty {
  /** 0 (easy to predict) → 100 (extremely unpredictable). */
  score: number;
  level: DifficultyLevel;
  rationale: string;
}

export interface SurfaceProfile {
  type: SurfaceType;
  /** Human label, e.g. "Batting Paradise", "Seam Friendly". */
  label: string;
  /** 0–100. Higher = better for batsmen. */
  battingScore: number;
  /** 0–100. Higher = better for bowlers. */
  bowlingScore: number;
  rationale: string;
  /** True until a real pitch-report API is wired. */
  isPlaceholder: boolean;
}

export interface WeatherProfile {
  condition:
    | "CLEAR"
    | "OVERCAST"
    | "RAIN_RISK"
    | "HUMID"
    | "WINDY"
    | "UNKNOWN";
  label: string;
  impact: string;
  /** Always true until weather API is wired. */
  isPlaceholder: true;
}

export interface TossProfile {
  /** 0–100. Higher = winning the toss matters more. */
  importanceScore: number;
  label: string;
  preferredDecision: "BAT" | "BOWL";
  rationale: string;
}

/** A player selected by the AI as a captain, VC, or differential pick. */
export interface AIPlayerPick {
  player: CricketPlayer;
  teamAbbreviation: string;
  rationale: string;
  /** 0–100 confidence in this pick. */
  confidence: number;
  /** 0–100 AI rating used by Task 2 player rating model. */
  aiRating: number;
}

export interface MatchIntelligence {
  matchDifficulty: MatchDifficulty;
  surface: SurfaceProfile;
  weather: WeatherProfile;
  toss: TossProfile;
  isBattingFriendly: boolean;
  captainPicks: AIPlayerPick[];
  viceCaptainPicks: AIPlayerPick[];
  differentialPicks: AIPlayerPick[];
  riskLevel: RiskLevel;
  riskRationale: string;
  /** Always true until real AI provider is wired. Consumers should show a mock badge. */
  isMock: true;
}

// ── Internal format heuristics ────────────────────────────────────────────────

interface FormatHeuristic {
  battingScore: number;
  bowlingScore: number;
  tossImportance: number;
  surfaceType: SurfaceType;
  riskLevel: RiskLevel;
  difficultyBase: number;
  preferBatFirst: boolean;
  surfaceRationale: string;
  tossRationale: string;
  riskRationale: string;
}

const FORMAT_HEURISTICS: Record<MatchFormat, FormatHeuristic> = {
  T20: {
    battingScore: 72,
    bowlingScore: 40,
    tossImportance: 78,
    surfaceType: "BATTING",
    riskLevel: "HIGH",
    difficultyBase: 68,
    preferBatFirst: false,
    surfaceRationale:
      "T20 surfaces favour power-hitting. Powerplay and death-overs boundaries dominate fantasy returns.",
    tossRationale:
      "Chasing teams win ~54% of T20s. Toss winner typically elects to bowl, setting up run chases.",
    riskRationale:
      "Short format = high variance. One bad over or duck can wipe out a player's entire fantasy game.",
  },
  ODI: {
    battingScore: 62,
    bowlingScore: 52,
    tossImportance: 60,
    surfaceType: "BALANCED",
    riskLevel: "MEDIUM",
    difficultyBase: 55,
    preferBatFirst: true,
    surfaceRationale:
      "ODI pitches offer balance across 50 overs. Pacers dominate early, spinners take over mid-innings.",
    tossRationale:
      "Batting first lets a team set a target. Pitch conditions favour the powerplay batting team.",
    riskRationale:
      "50 overs allows recovery from slow starts. Consistent performers are safer fantasy investments.",
  },
  Test: {
    battingScore: 48,
    bowlingScore: 64,
    tossImportance: 50,
    surfaceType: "SEAM_FRIENDLY",
    riskLevel: "LOW",
    difficultyBase: 40,
    preferBatFirst: true,
    surfaceRationale:
      "Test pitches deteriorate across 5 days. Seam movement on Day 1, spin on Days 4–5.",
    tossRationale:
      "Test pitches seam on Day 1 — batting first on a flat deck gives a significant advantage.",
    riskRationale:
      "Longer format reduces per-session variance. Consistent performers offer safer fantasy returns.",
  },
  T10: {
    battingScore: 82,
    bowlingScore: 28,
    tossImportance: 85,
    surfaceType: "BATTING",
    riskLevel: "EXTREME",
    difficultyBase: 82,
    preferBatFirst: false,
    surfaceRationale:
      "Ultra-fast T10 format — batsmen dominate 100-ball matches. Any bowler can leak runs.",
    tossRationale:
      "Powerplay spans almost the entire game. Chasing a low target is significantly easier.",
    riskRationale:
      "Extreme variance — 100 balls. A single big over changes fantasy scores completely.",
  },
  "The Hundred": {
    battingScore: 70,
    bowlingScore: 42,
    tossImportance: 76,
    surfaceType: "BATTING",
    riskLevel: "HIGH",
    difficultyBase: 65,
    preferBatFirst: false,
    surfaceRationale:
      "100-ball format rewards big hitters. Powerplay blocks heavily influence total fantasy output.",
    tossRationale:
      "Chasing has a strong historical win record. Powerplay restrictions favour fielding first.",
    riskRationale:
      "High variance format — fewer balls means star players have less time to build innings.",
  },
  Other: {
    battingScore: 60,
    bowlingScore: 50,
    tossImportance: 55,
    surfaceType: "BALANCED",
    riskLevel: "MEDIUM",
    difficultyBase: 50,
    preferBatFirst: true,
    surfaceRationale: "Standard balanced conditions expected for this match.",
    tossRationale: "Toss provides a moderate strategic advantage in this format.",
    riskRationale:
      "Moderate fantasy variance — standard selection strategy applies.",
  },
};

// ── Player helpers ────────────────────────────────────────────────────────────

type ScoredEntry = {
  player: CricketPlayer;
  teamAbbreviation: string;
  fantasyPts: number;
};

function collectAllPlayers(
  game: CricketGame,
): { player: CricketPlayer; teamAbbreviation: string }[] {
  const seen = new Set<string>();
  const out: { player: CricketPlayer; teamAbbreviation: string }[] = [];

  const push = (p: CricketPlayer, abbr: string) => {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push({ player: p, teamAbbreviation: abbr });
    }
  };

  for (const inn of game.innings) {
    for (const p of inn.battingTeam.players) push(p, inn.battingTeam.abbreviation);
    for (const p of inn.bowlingTeam.players) push(p, inn.bowlingTeam.abbreviation);
  }

  // Fallback when no innings yet (scheduled match)
  if (out.length === 0) {
    for (const p of game.homeTeam.players) push(p, game.homeTeam.abbreviation);
    for (const p of game.awayTeam.players) push(p, game.awayTeam.abbreviation);
  }

  return out;
}

function scoreAndRankPlayers(game: CricketGame): ScoredEntry[] {
  const profile = getScoringProfile(game.format, game.competitionName);
  const all = collectAllPlayers(game);

  return all
    .map(({ player, teamAbbreviation }) => ({
      player,
      teamAbbreviation,
      fantasyPts: calculateCricketFantasyPoints(player.stats, profile).total,
    }))
    .sort((a, b) => b.fantasyPts - a.fantasyPts);
}

function buildAIRating(fantasyPts: number): number {
  // Maps fantasy points → 0–100 AI rating.
  // 0 pts → 40, 30 pts → 75, 60+ pts → 95
  if (fantasyPts <= 0) return Math.max(20, 40 + fantasyPts);
  return Math.min(100, Math.round(40 + fantasyPts * 0.9));
}

function buildPickRationale(entry: ScoredEntry, hasData: boolean): string {
  const { player } = entry;
  const bat = player.stats?.batting;
  const bowl = player.stats?.bowling;

  if (hasData) {
    if (bat && bat.runs >= 50)
      return `${player.name.split(" ").pop()} scored ${bat.runs}${bat.dismissed ? "" : "*"} — leading fantasy performer`;
    if (bat && bat.runs >= 25)
      return `${bat.runs}${bat.dismissed ? "" : "*"} runs at a strong strike rate — consistent scorer`;
    if (bowl && bowl.wickets >= 3)
      return `${bowl.wickets}/${bowl.runsConceded} — match-changing bowling spell`;
    if (bowl && bowl.wickets >= 2)
      return `${bowl.wickets} wickets with economy of ${bowl.economy?.toFixed(1) ?? "–"}`;
    if (player.role === "all")
      return "All-round contribution across batting and bowling";
    if (player.role === "wk")
      return "Wicket-keeper; dismissal bonuses add to fantasy floor";
  }

  // Pre-match / no data
  if (player.credits && player.credits >= 9)
    return `${player.credits} credits — top-rated ${player.role === "bat" ? "batter" : player.role === "bowl" ? "bowler" : player.role === "wk" ? "keeper" : "all-rounder"} in this squad`;
  if (player.role === "all")
    return "All-rounders accumulate points in multiple categories — high ceiling pick";
  return `Form-based projection — strong ${player.role === "bat" ? "batting" : player.role === "bowl" ? "bowling" : "role"} record`;
}

function buildDiffPick(entry: ScoredEntry, hasData: boolean): AIPlayerPick {
  return {
    player: entry.player,
    teamAbbreviation: entry.teamAbbreviation,
    rationale:
      "Lower-ownership pick with ceiling upside — ideal for differential strategies",
    confidence: 48,
    aiRating: buildAIRating(entry.fantasyPts),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute AI Match Intelligence for a CricketGame.
 *
 * Returns mock/heuristic values when no real provider is available.
 * The `isMock: true` flag is always set until a real AI provider is wired.
 *
 * @param game — any CricketGame object (scheduled, live, or final)
 */
export function computeMatchIntelligence(game: CricketGame): MatchIntelligence {
  const h = FORMAT_HEURISTICS[game.format] ?? FORMAT_HEURISTICS.Other;
  const hasScorecardData = game.innings.length > 0;
  const ranked = scoreAndRankPlayers(game);

  // ── Captain picks ─────────────────────────────────────────────────────────
  const captainPicks: AIPlayerPick[] = ranked.slice(0, 2).map((e, i) => ({
    player: e.player,
    teamAbbreviation: e.teamAbbreviation,
    rationale: buildPickRationale(e, hasScorecardData),
    confidence: i === 0 ? 85 : 72,
    aiRating: buildAIRating(e.fantasyPts),
  }));

  // ── VC picks ──────────────────────────────────────────────────────────────
  const viceCaptainPicks: AIPlayerPick[] = ranked.slice(2, 4).map((e, i) => ({
    player: e.player,
    teamAbbreviation: e.teamAbbreviation,
    rationale: buildPickRationale(e, hasScorecardData),
    confidence: 65 - i * 8,
    aiRating: buildAIRating(e.fantasyPts),
  }));

  // ── Differential picks — prefer all-rounders and WKs not already in C/VC ─
  const captainIds = new Set([
    ...captainPicks.map((p) => p.player.id),
    ...viceCaptainPicks.map((p) => p.player.id),
  ]);
  const diffPool = ranked.filter((e) => !captainIds.has(e.player.id));
  const premiumDiffs = diffPool.filter(
    (e) => e.player.role === "all" || e.player.role === "wk",
  );
  const diffSource = premiumDiffs.length > 0 ? premiumDiffs : diffPool;
  const differentialPicks: AIPlayerPick[] = diffSource
    .slice(0, 2)
    .map((e) => buildDiffPick(e, hasScorecardData));

  // ── Difficulty ────────────────────────────────────────────────────────────
  let diffScore = h.difficultyBase;
  if (game.status === "in_progress") diffScore = Math.min(100, diffScore + 8);
  if (game.status === "final") diffScore = Math.max(20, diffScore - 12);

  const diffLevel: DifficultyLevel =
    diffScore >= 68 ? "HARD" : diffScore >= 42 ? "MEDIUM" : "EASY";

  // ── Toss ─────────────────────────────────────────────────────────────────
  const tossLabel =
    h.tossImportance >= 75
      ? "Very High"
      : h.tossImportance >= 60
        ? "High"
        : h.tossImportance >= 45
          ? "Moderate"
          : "Low";

  return {
    matchDifficulty: {
      score: diffScore,
      level: diffLevel,
      rationale: `${game.format} match — difficulty rated ${diffLevel.toLowerCase()}. ${
        hasScorecardData
          ? "Projections use live scorecard data."
          : "Pre-match projections based on format heuristics."
      }`,
    },
    surface: {
      type: h.surfaceType,
      label:
        h.surfaceType === "BATTING"
          ? "Batting Paradise"
          : h.surfaceType === "BOWLING"
            ? "Bowler's Heaven"
            : h.surfaceType === "SPIN_FRIENDLY"
              ? "Spin Friendly"
              : h.surfaceType === "SEAM_FRIENDLY"
                ? "Seam Friendly"
                : "Balanced",
      battingScore: h.battingScore,
      bowlingScore: h.bowlingScore,
      rationale: h.surfaceRationale,
      isPlaceholder: true,
    },
    weather: {
      condition: "UNKNOWN",
      label: "Weather data unavailable",
      impact:
        "Connect a weather API to enable. Overcast conditions favour swing bowlers; heat impacts fielder stamina.",
      isPlaceholder: true,
    },
    toss: {
      importanceScore: h.tossImportance,
      label: tossLabel,
      preferredDecision: h.preferBatFirst ? "BAT" : "BOWL",
      rationale: h.tossRationale,
    },
    isBattingFriendly: h.battingScore > h.bowlingScore,
    captainPicks,
    viceCaptainPicks,
    differentialPicks,
    riskLevel: h.riskLevel,
    riskRationale: h.riskRationale,
    isMock: true,
  };
}
