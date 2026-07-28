// Cricket AI Match Intelligence engine.
//
// Computes intelligence signals for any CricketGame:
//   matchDifficulty · surface · weather · toss · battingFriendly
//   captainPicks · viceCaptainPicks · differentialPicks · riskLevel
//   captainEngine  (Task 2) — Best Captain / VC / Safe Pick / Grand League Diff / Risk Pick
//   matchConditions (Task 3) — Pitch Report · Weather · Dew Factor · Toss Bias
//                              Pace vs Spin · Batting % · Bowling %
//
// ALL values are currently MOCK/HEURISTIC — format-aware approximations.
// Architecture is designed so every field can be replaced with a real
// provider value without changing the interface consumers depend on.
//
// To plug in real data:
//   1. Replace FORMAT_HEURISTICS values with live pitch/weather API responses
//   2. Replace rankPlayersForPicks() scoring with ML model outputs
//   3. Set isMock: false once a real provider is wired

import type { CricketGame, CricketPlayer, MatchFormat } from "./cricket-types";
import { calculateCricketFantasyPoints, getScoringProfile } from "./cricket-scoring";

// ── Public types ──────────────────────────────────────────────────────────────

export type DifficultyLevel = "EASY" | "MEDIUM" | "HARD";
export type RiskLevel       = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
export type SurfaceType     =
  | "BATTING"
  | "BALANCED"
  | "BOWLING"
  | "SPIN_FRIENDLY"
  | "SEAM_FRIENDLY";

export type PaceSpinBias =
  | "PACE_DOMINANT"
  | "SLIGHT_PACE"
  | "BALANCED"
  | "SLIGHT_SPIN"
  | "SPIN_DOMINANT";

export type DewImpact = "NONE" | "LOW" | "MODERATE" | "HIGH";

/** One of the five typed captain/VC recommendation labels. */
export type CaptainLabel =
  | "BEST_CAPTAIN"
  | "BEST_VC"
  | "SAFE_PICK"
  | "GRAND_LEAGUE"
  | "RISK_PICK";

// ── Legacy pick type (kept for backward compatibility) ────────────────────────

/** A player selected by the AI as a captain, VC, or differential pick. */
export interface AIPlayerPick {
  player: CricketPlayer;
  teamAbbreviation: string;
  rationale: string;
  /** 0–100 confidence in this pick. */
  confidence: number;
  /** 0–100 AI rating used by the player rating model. */
  aiRating: number;
}

// ── Task 2: Captain/VC engine types ──────────────────────────────────────────

/** A strongly-typed captain recommendation with scoring breakdown. */
export interface CaptainVCPick {
  player: CricketPlayer;
  teamAbbreviation: string;
  label: CaptainLabel;
  /** 0–100 composite captain suitability score. */
  captainScore: number;
  /** 0–100 risk percentage (high = risky/volatile pick). */
  riskPct: number;
  /** 0–100 confidence in this recommendation. */
  confidencePct: number;
  rationale: string;
  /** 0–100 AI rating from the player rating model. */
  aiRating: number;
}

/** Full captain/VC engine output. */
export interface CaptainVCEngine {
  /** ⭐ Best Captain — highest projected fantasy ceiling. */
  bestCaptain: CaptainVCPick;
  /** ⭐ Best Vice Captain — strong alternative. */
  bestVC: CaptainVCPick;
  /** 🛡 Safe Pick — consistent, low-risk floor option. */
  safePick: CaptainVCPick;
  /** 🔥 Grand League Differential — low-ownership upside. */
  grandLeagueDiff: CaptainVCPick;
  /** ⚠ Risk Pick — high-ceiling volatile pick, boom-or-bust. */
  riskPick: CaptainVCPick;
  /** 0–100 overall team-confidence % derived from pick quality + format risk. */
  teamConfidencePct: number;
  /** Always true until real provider is wired. */
  isMock: true;
}

// ── Task 3: Match Conditions types ───────────────────────────────────────────

/** Rich pitch report with batting/bowling % breakdown. */
export interface PitchReport {
  surface: SurfaceType;
  label: string;
  /** 0–100: how batting-friendly the pitch is. */
  battingFriendlyPct: number;
  /** 0–100: how bowling-friendly the pitch is. */
  bowlingFriendlyPct: number;
  /** Pace vs spin advantage direction. */
  paceSpinBias: PaceSpinBias;
  paceSpinRationale: string;
  rationale: string;
  /** True until real pitch API is wired. */
  isPlaceholder: boolean;
}

/** Extended weather condition including dew factor. */
export interface WeatherCondition {
  condition: "CLEAR" | "OVERCAST" | "RAIN_RISK" | "HUMID" | "WINDY" | "UNKNOWN";
  label: string;
  impact: string;
  /** Expected dew formation — affects second-innings bowling. */
  dewFactor: DewImpact;
  dewRationale: string;
  /** True until weather API is wired. */
  isPlaceholder: boolean;
}

/** Full match-conditions bundle replacing/extending the legacy surface+weather+toss fields. */
export interface MatchConditions {
  pitchReport: PitchReport;
  weather: WeatherCondition;
  /** 0–100: overall batting-friendly score for the match (combines pitch + weather). */
  battingFriendlyPct: number;
  /** 0–100: overall bowling-friendly score. */
  bowlingFriendlyPct: number;
  tossBias: {
    importanceScore: number;
    preferredDecision: "BAT" | "BOWL";
    label: string;
    rationale: string;
  };
  /** Always true until real providers are wired. */
  isMock: true;
}

// ── Legacy surface / weather / toss (kept for backward compatibility) ─────────

export interface SurfaceProfile {
  type: SurfaceType;
  label: string;
  battingScore: number;
  bowlingScore: number;
  rationale: string;
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
  isPlaceholder: true;
}

export interface TossProfile {
  importanceScore: number;
  label: string;
  preferredDecision: "BAT" | "BOWL";
  rationale: string;
}

// ── Full MatchIntelligence output ─────────────────────────────────────────────

export interface MatchIntelligence {
  matchDifficulty: { score: number; level: DifficultyLevel; rationale: string };
  /** Legacy surface field — use matchConditions.pitchReport for richer data. */
  surface: SurfaceProfile;
  /** Legacy weather field — use matchConditions.weather for dew factor etc. */
  weather: WeatherProfile;
  /** Legacy toss field — use matchConditions.tossBias for full data. */
  toss: TossProfile;
  isBattingFriendly: boolean;
  captainPicks: AIPlayerPick[];
  viceCaptainPicks: AIPlayerPick[];
  differentialPicks: AIPlayerPick[];
  riskLevel: RiskLevel;
  riskRationale: string;
  /** Task 2: typed captain/VC recommendations with scores. */
  captainEngine: CaptainVCEngine;
  /** Task 3: rich match-conditions bundle. */
  matchConditions: MatchConditions;
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
  paceSpinBias: PaceSpinBias;
  dewFactor: DewImpact;
  surfaceRationale: string;
  tossRationale: string;
  riskRationale: string;
  paceSpinRationale: string;
  dewRationale: string;
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
    paceSpinBias: "SLIGHT_PACE",
    dewFactor: "MODERATE",
    surfaceRationale:
      "T20 surfaces favour power-hitting. Powerplay and death-overs boundaries dominate fantasy returns.",
    tossRationale:
      "Chasing teams win ~54% of T20s. Toss winner typically elects to bowl, setting up run chases.",
    riskRationale:
      "Short format = high variance. One bad over or duck can wipe out a player's entire fantasy game.",
    paceSpinRationale:
      "Fast bowlers dominate Powerplay (overs 1–6). Spinners tighten the middle. Death overs return to pace.",
    dewRationale:
      "Evening dew is common in T20 venues. Heavy dew makes the ball slippery, favouring batting second.",
  },
  ODI: {
    battingScore: 62,
    bowlingScore: 52,
    tossImportance: 60,
    surfaceType: "BALANCED",
    riskLevel: "MEDIUM",
    difficultyBase: 55,
    preferBatFirst: true,
    paceSpinBias: "BALANCED",
    dewFactor: "LOW",
    surfaceRationale:
      "ODI pitches offer balance across 50 overs. Pacers dominate early, spinners take over mid-innings.",
    tossRationale:
      "Batting first lets a team set a target. Pitch conditions favour the powerplay batting team.",
    riskRationale:
      "50 overs allows recovery from slow starts. Consistent performers are safer fantasy investments.",
    paceSpinRationale:
      "Seam bowlers are effective in the Powerplay (1–10). Spinners dominate overs 15–40. Pacers return for death.",
    dewRationale:
      "Dew is typically moderate in ODIs. It can affect the second innings but less dramatically than T20s.",
  },
  Test: {
    battingScore: 48,
    bowlingScore: 64,
    tossImportance: 50,
    surfaceType: "SEAM_FRIENDLY",
    riskLevel: "LOW",
    difficultyBase: 40,
    preferBatFirst: true,
    paceSpinBias: "SLIGHT_PACE",
    dewFactor: "NONE",
    surfaceRationale:
      "Test pitches deteriorate across 5 days. Seam movement on Day 1, spin on Days 4–5.",
    tossRationale:
      "Test pitches seam on Day 1 — batting first on a flat deck gives a significant advantage.",
    riskRationale:
      "Longer format reduces per-session variance. Consistent performers offer safer fantasy returns.",
    paceSpinRationale:
      "Seamers dominate early (Day 1–2). Spinners become crucial on turning tracks (Day 4–5).",
    dewRationale:
      "Dew is not a factor in Test cricket. Day/night Tests may have some evening moisture.",
  },
  T10: {
    battingScore: 82,
    bowlingScore: 28,
    tossImportance: 85,
    surfaceType: "BATTING",
    riskLevel: "EXTREME",
    difficultyBase: 82,
    preferBatFirst: false,
    paceSpinBias: "PACE_DOMINANT",
    dewFactor: "HIGH",
    surfaceRationale:
      "Ultra-fast T10 format — batsmen dominate 100-ball matches. Any bowler can leak runs.",
    tossRationale:
      "Powerplay spans almost the entire game. Chasing a low target is significantly easier.",
    riskRationale:
      "Extreme variance — 100 balls. A single big over changes fantasy scores completely.",
    paceSpinRationale:
      "100 balls means almost all deliveries are within Powerplay restrictions. Pure pace is key.",
    dewRationale:
      "Evening T10 matches are heavily impacted by dew. Bowling second becomes extremely difficult.",
  },
  "The Hundred": {
    battingScore: 70,
    bowlingScore: 42,
    tossImportance: 76,
    surfaceType: "BATTING",
    riskLevel: "HIGH",
    difficultyBase: 65,
    preferBatFirst: false,
    paceSpinBias: "BALANCED",
    dewFactor: "MODERATE",
    surfaceRationale:
      "100-ball format rewards big hitters. Powerplay blocks heavily influence total fantasy output.",
    tossRationale:
      "Chasing has a strong historical win record. Powerplay restrictions favour fielding first.",
    riskRationale:
      "High variance format — fewer balls means star players have less time to build innings.",
    paceSpinRationale:
      "Pace and spin share equal importance in The Hundred. Batters face both types within blocks.",
    dewRationale:
      "Dew forms in evening matches at UK venues. Second-innings batting benefits from softer grip conditions.",
  },
  Other: {
    battingScore: 60,
    bowlingScore: 50,
    tossImportance: 55,
    surfaceType: "BALANCED",
    riskLevel: "MEDIUM",
    difficultyBase: 50,
    preferBatFirst: true,
    paceSpinBias: "BALANCED",
    dewFactor: "LOW",
    surfaceRationale: "Standard balanced conditions expected for this match.",
    tossRationale: "Toss provides a moderate strategic advantage in this format.",
    riskRationale: "Moderate fantasy variance — standard selection strategy applies.",
    paceSpinRationale: "Equal pace and spin opportunity expected in this match.",
    dewRationale: "Minimal dew impact expected. Standard conditions should prevail.",
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

  if (out.length === 0) {
    for (const p of game.homeTeam.players) push(p, game.homeTeam.abbreviation);
    for (const p of game.awayTeam.players)  push(p, game.awayTeam.abbreviation);
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
  if (fantasyPts <= 0) return Math.max(20, 40 + fantasyPts);
  return Math.min(100, Math.round(40 + fantasyPts * 0.9));
}

function buildPickRationale(entry: ScoredEntry, hasData: boolean): string {
  const { player } = entry;
  const bat  = player.stats?.batting;
  const bowl = player.stats?.bowling;

  if (hasData) {
    if (bat  && bat.runs >= 50)    return `${player.name.split(" ").pop()} scored ${bat.runs}${bat.dismissed ? "" : "*"} — leading fantasy performer`;
    if (bat  && bat.runs >= 25)    return `${bat.runs}${bat.dismissed ? "" : "*"} runs at a strong strike rate — consistent scorer`;
    if (bowl && bowl.wickets >= 3) return `${bowl.wickets}/${bowl.runsConceded} — match-changing bowling spell`;
    if (bowl && bowl.wickets >= 2) return `${bowl.wickets} wickets with economy of ${bowl.economy?.toFixed(1) ?? "–"}`;
    if (player.role === "all")     return "All-round contribution across batting and bowling";
    if (player.role === "wk")      return "Wicket-keeper; dismissal bonuses add to fantasy floor";
  }

  if (player.credits && player.credits >= 9)
    return `${player.credits} credits — top-rated ${player.role === "bat" ? "batter" : player.role === "bowl" ? "bowler" : player.role === "wk" ? "keeper" : "all-rounder"} in this squad`;
  if (player.role === "all")
    return "All-rounders accumulate points in multiple categories — high ceiling pick";
  return `Form-based projection — strong ${player.role === "bat" ? "batting" : player.role === "bowl" ? "bowling" : "role"} record`;
}

// ── Task 2: Captain/VC engine builder ─────────────────────────────────────────

function buildCaptainEngine(
  ranked: ScoredEntry[],
  hasScorecardData: boolean,
  riskLevel: RiskLevel,
): CaptainVCEngine {
  const dummyPlayer: CricketPlayer = {
    id: "", name: "TBD", role: "bat", credits: null, isPlaying: false, teamAbbreviation: "", stats: {},
  };

  if (ranked.length === 0) {
    const dummy: CaptainVCPick = {
      player: dummyPlayer,
      teamAbbreviation: "",
      label: "BEST_CAPTAIN",
      captainScore: 50,
      riskPct: 50,
      confidencePct: 50,
      rationale: "No player data available",
      aiRating: 50,
    };
    return {
      bestCaptain: dummy,
      bestVC: { ...dummy, label: "BEST_VC" },
      safePick: { ...dummy, label: "SAFE_PICK" },
      grandLeagueDiff: { ...dummy, label: "GRAND_LEAGUE" },
      riskPick: { ...dummy, label: "RISK_PICK" },
      teamConfidencePct: 50,
      isMock: true,
    };
  }

  // Risk base percentage from format
  const riskBase: Record<RiskLevel, number> = { LOW: 18, MEDIUM: 35, HIGH: 55, EXTREME: 72 };
  const baseRisk = riskBase[riskLevel];

  // Best Captain — highest fantasy ceiling (rank 0)
  const cap = ranked[0];
  const capAI = buildAIRating(cap.fantasyPts);
  const bestCaptain: CaptainVCPick = {
    player: cap.player,
    teamAbbreviation: cap.teamAbbreviation,
    label: "BEST_CAPTAIN",
    captainScore: Math.min(100, Math.round(capAI * 1.05)),
    riskPct: Math.min(100, baseRisk + (cap.player.role === "bat" ? -5 : cap.player.role === "bowl" ? 10 : 0)),
    confidencePct: hasScorecardData ? 88 : 72,
    rationale: buildPickRationale(cap, hasScorecardData),
    aiRating: capAI,
  };

  // Best VC — rank 1 (or rank 0 if only 1 player)
  const vcEntry = ranked.length > 1 ? ranked[1] : ranked[0];
  const vcAI = buildAIRating(vcEntry.fantasyPts);
  const bestVC: CaptainVCPick = {
    player: vcEntry.player,
    teamAbbreviation: vcEntry.teamAbbreviation,
    label: "BEST_VC",
    captainScore: Math.min(100, Math.round(vcAI * 1.0)),
    riskPct: Math.min(100, baseRisk + (vcEntry.player.role === "all" ? -8 : 5)),
    confidencePct: hasScorecardData ? 78 : 65,
    rationale: buildPickRationale(vcEntry, hasScorecardData),
    aiRating: vcAI,
  };

  // Safe Pick — prefer WK or all-rounder with high credits (consistent floor)
  const safePool = ranked.filter(
    (e) => (e.player.role === "wk" || e.player.role === "all") &&
           (e.player.credits ?? 0) >= 8,
  );
  const safeEntry = safePool.length > 0 ? safePool[0] : (ranked[2] ?? ranked[0]);
  const safeAI = buildAIRating(safeEntry.fantasyPts);
  const safePick: CaptainVCPick = {
    player: safeEntry.player,
    teamAbbreviation: safeEntry.teamAbbreviation,
    label: "SAFE_PICK",
    captainScore: Math.min(100, Math.round(safeAI * 0.92)),
    riskPct: Math.max(5, baseRisk - 20),
    confidencePct: hasScorecardData ? 80 : 70,
    rationale: safeEntry.player.role === "wk"
      ? "Wicket-keeper provides a safe batting floor plus stumping/catch bonuses"
      : "All-rounder scoring from multiple disciplines reduces single-factor variance",
    aiRating: safeAI,
  };

  // Grand League Differential — low-ownership upside (prefer outside top-4, prefer AR/WK)
  const capVcSafeIds = new Set([cap.player.id, vcEntry.player.id, safeEntry.player.id]);
  const diffPool = ranked.filter((e) => !capVcSafeIds.has(e.player.id));
  const premDiffs = diffPool.filter((e) => e.player.role === "all" || e.player.role === "wk");
  const diffEntry = (premDiffs.length > 0 ? premDiffs : diffPool)[0] ?? ranked[Math.min(4, ranked.length - 1)];
  const diffAI = buildAIRating(diffEntry.fantasyPts);
  const grandLeagueDiff: CaptainVCPick = {
    player: diffEntry.player,
    teamAbbreviation: diffEntry.teamAbbreviation,
    label: "GRAND_LEAGUE",
    captainScore: Math.min(100, Math.round(diffAI * 0.85)),
    riskPct: Math.min(100, baseRisk + 20),
    confidencePct: hasScorecardData ? 55 : 42,
    rationale: "Low-ownership differential — if this player fires, it's a massive points advantage",
    aiRating: diffAI,
  };

  // Risk Pick — high-variance boom-or-bust selection
  // Find a player with real upside (aiRating >= 40) outside the 4 main picks,
  // preferring batters in explosive positions or bowlers with wicket-taking form.
  const usedIds = new Set([cap.player.id, vcEntry.player.id, safeEntry.player.id, diffEntry.player.id]);
  const riskPool = ranked.filter((e) => !usedIds.has(e.player.id));
  // Prefer batters (higher variance) then bowlers, then all-rounders
  const riskBatters = riskPool.filter((e) => e.player.role === "bat");
  const riskBowlers = riskPool.filter((e) => e.player.role === "bowl");
  const riskEntry =
    (riskBatters.length > 0 ? riskBatters : riskBowlers.length > 0 ? riskBowlers : riskPool)[0] ??
    ranked[Math.min(5, ranked.length - 1)];
  const riskAI = buildAIRating(riskEntry.fantasyPts);
  const riskPick: CaptainVCPick = {
    player: riskEntry.player,
    teamAbbreviation: riskEntry.teamAbbreviation,
    label: "RISK_PICK",
    captainScore: Math.min(100, Math.round(riskAI * 0.78)),
    riskPct: Math.min(100, baseRisk + 28),
    confidencePct: hasScorecardData ? 45 : 34,
    rationale: "High-variance pick — can be a match-winner or score zero. Best for small-league gambles.",
    aiRating: riskAI,
  };

  // Team Confidence % — derived from top-2 pick confidence + format risk adjustment
  const riskAdj: Record<RiskLevel, number> = { LOW: 8, MEDIUM: 0, HIGH: -8, EXTREME: -18 };
  const rawConf = (bestCaptain.confidencePct + bestVC.confidencePct) / 2;
  const teamConfidencePct = Math.min(95, Math.max(25, Math.round(rawConf + riskAdj[riskLevel])));

  return { bestCaptain, bestVC, safePick, grandLeagueDiff, riskPick, teamConfidencePct, isMock: true };
}

// ── Task 3: Match Conditions builder ─────────────────────────────────────────

function buildMatchConditions(h: FormatHeuristic): MatchConditions {
  const surfaceLabel =
    h.surfaceType === "BATTING"      ? "Batting Paradise" :
    h.surfaceType === "BOWLING"      ? "Bowler's Heaven"  :
    h.surfaceType === "SPIN_FRIENDLY"? "Spin Friendly"    :
    h.surfaceType === "SEAM_FRIENDLY"? "Seam Friendly"    :
    "Balanced";

  const tossLabel =
    h.tossImportance >= 75 ? "Very High" :
    h.tossImportance >= 60 ? "High"       :
    h.tossImportance >= 45 ? "Moderate"   :
    "Low";

  return {
    pitchReport: {
      surface: h.surfaceType,
      label: surfaceLabel,
      battingFriendlyPct: h.battingScore,
      bowlingFriendlyPct: h.bowlingScore,
      paceSpinBias: h.paceSpinBias,
      paceSpinRationale: h.paceSpinRationale,
      rationale: h.surfaceRationale,
      isPlaceholder: true,
    },
    weather: {
      condition: "UNKNOWN",
      label: "Weather data unavailable",
      impact:
        "Connect a weather API to enable real-time conditions. Overcast skies swing bowling; heat impacts stamina.",
      dewFactor: h.dewFactor,
      dewRationale: h.dewRationale,
      isPlaceholder: true,
    },
    battingFriendlyPct: h.battingScore,
    bowlingFriendlyPct: h.bowlingScore,
    tossBias: {
      importanceScore: h.tossImportance,
      preferredDecision: h.preferBatFirst ? "BAT" : "BOWL",
      label: tossLabel,
      rationale: h.tossRationale,
    },
    isMock: true,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute AI Match Intelligence for a CricketGame.
 *
 * Returns mock/heuristic values when no real provider is available.
 * The `isMock: true` flag is always set until a real AI provider is wired.
 */
export function computeMatchIntelligence(game: CricketGame): MatchIntelligence {
  const h = FORMAT_HEURISTICS[game.format] ?? FORMAT_HEURISTICS.Other;
  const hasScorecardData = game.innings.length > 0;
  const ranked = scoreAndRankPlayers(game);

  // ── Legacy captain/VC/differential picks ─────────────────────────────────
  const captainPicks: AIPlayerPick[] = ranked.slice(0, 2).map((e, i) => ({
    player: e.player,
    teamAbbreviation: e.teamAbbreviation,
    rationale: buildPickRationale(e, hasScorecardData),
    confidence: i === 0 ? 85 : 72,
    aiRating: buildAIRating(e.fantasyPts),
  }));

  const viceCaptainPicks: AIPlayerPick[] = ranked.slice(2, 4).map((e, i) => ({
    player: e.player,
    teamAbbreviation: e.teamAbbreviation,
    rationale: buildPickRationale(e, hasScorecardData),
    confidence: 65 - i * 8,
    aiRating: buildAIRating(e.fantasyPts),
  }));

  const captainIds = new Set([
    ...captainPicks.map((p) => p.player.id),
    ...viceCaptainPicks.map((p) => p.player.id),
  ]);
  const diffPool     = ranked.filter((e) => !captainIds.has(e.player.id));
  const premiumDiffs = diffPool.filter((e) => e.player.role === "all" || e.player.role === "wk");
  const diffSource   = premiumDiffs.length > 0 ? premiumDiffs : diffPool;
  const differentialPicks: AIPlayerPick[] = diffSource.slice(0, 2).map((e) => ({
    player: e.player,
    teamAbbreviation: e.teamAbbreviation,
    rationale: "Lower-ownership pick with ceiling upside — ideal for differential strategies",
    confidence: 48,
    aiRating: buildAIRating(e.fantasyPts),
  }));

  // ── Difficulty ────────────────────────────────────────────────────────────
  let diffScore = h.difficultyBase;
  if (game.status === "in_progress") diffScore = Math.min(100, diffScore + 8);
  if (game.status === "final")       diffScore = Math.max(20, diffScore - 12);

  const diffLevel: DifficultyLevel =
    diffScore >= 68 ? "HARD" : diffScore >= 42 ? "MEDIUM" : "EASY";

  // ── Toss label ────────────────────────────────────────────────────────────
  const tossLabel =
    h.tossImportance >= 75 ? "Very High" :
    h.tossImportance >= 60 ? "High"       :
    h.tossImportance >= 45 ? "Moderate"   :
    "Low";

  // ── Surface label ─────────────────────────────────────────────────────────
  const surfaceLabel =
    h.surfaceType === "BATTING"       ? "Batting Paradise" :
    h.surfaceType === "BOWLING"       ? "Bowler's Heaven"  :
    h.surfaceType === "SPIN_FRIENDLY" ? "Spin Friendly"    :
    h.surfaceType === "SEAM_FRIENDLY" ? "Seam Friendly"    :
    "Balanced";

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
      label: surfaceLabel,
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
    captainEngine: buildCaptainEngine(ranked, hasScorecardData, h.riskLevel),
    matchConditions: buildMatchConditions(h),
    isMock: true,
  };
}
