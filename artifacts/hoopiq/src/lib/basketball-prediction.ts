import { Game } from "./types";
import { LINEUP_SIZE } from "./lineup-storage";
import { PregamePlayerIntel } from "./pregame-intel";

export type PredictionRisk = "Low" | "Medium" | "High";

export type BasketballPredictionPlayer = {
  playerId: string;
  name: string;
  teamId: string;
  teamAbbreviation: string;
  projectedMinutes: number | null;
  projectedFantasyPoints: number | null;
  confidencePercent: number | null;
  risk: PredictionRisk | null;
  status: PregamePlayerIntel["status"];
  injuryStatus?: PregamePlayerIntel["injuryStatus"];
  avgFptsLast5: number | null;
  avgFptsLast10: number | null;
  avgFptsLast20: number | null;
  seasonAvgFpts: number | null;
  usageProjection: number | null;
  reason: string;
  tags: Array<"lock" | "value" | "differential">;
};

export type BasketballPrediction = {
  gameId: string;
  league: Game["league"];
  generatedAt: string;
  available: boolean;
  unavailableReason: string | null;
  players: BasketballPredictionPlayer[];
  predictedFantasyXi: BasketballPredictionPlayer[];
  captain: BasketballPredictionPlayer | null;
  viceCaptain: BasketballPredictionPlayer | null;
  projectedFantasyScore: number | null;
  confidencePercent: number | null;
  risk: PredictionRisk | null;
  valuePicks: BasketballPredictionPlayer[];
  differentialPicks: BasketballPredictionPlayer[];
  lockPicks: BasketballPredictionPlayer[];
  injuryImpact: {
    outPlayers: string[];
    concernPlayers: string[];
    knownAvgFptsLost: number | null;
  };
  modelInputs: {
    last5: boolean;
    last10: boolean;
    last20: boolean;
    seasonAverage: boolean;
    homeAway: "available" | "unavailable";
    opponentDefense: "available" | "unavailable";
    pace: "available" | "unavailable";
    usage: "available" | "unavailable";
    minutes: "available" | "unavailable";
    injuries: "available" | "unavailable";
    backToBack: "available" | "unavailable";
    restDays: "available" | "unavailable";
    starterBench: "available" | "unavailable";
    matchupHistory: "available" | "unavailable";
  };
};

type PredictionInput = {
  game: Game;
  away: PregamePlayerIntel[];
  home: PregamePlayerIntel[];
  generatedAt?: string;
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number | null {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function riskForPlayer(player: PregamePlayerIntel): PredictionRisk {
  if (
    player.status === "Out" ||
    player.status === "Questionable" ||
    player.status === "Game Time Decision" ||
    player.formTrend === "Cold"
  ) {
    return "High";
  }
  if (
    player.status === "Bench" ||
    player.status === "Confirmed Bench" ||
    player.minutesTrend === "down" ||
    player.consistency === "Volatile" ||
    player.backToBack
  ) {
    return "Medium";
  }
  return "Low";
}

function confidenceForPlayer(player: PregamePlayerIntel): number {
  if (player.status === "Out") return 0;

  let confidence = 55;
  if (player.status === "Confirmed Starter") confidence += 18;
  else if (player.status === "Expected Starter") confidence += 10;
  else if (player.status === "Questionable" || player.status === "Game Time Decision") confidence -= 22;
  else if (player.status === "Bench" || player.status === "Confirmed Bench") confidence -= 8;

  if (player.consistency === "Consistent") confidence += 12;
  else if (player.consistency === "Somewhat Consistent") confidence += 5;
  else if (player.consistency === "Volatile") confidence -= 10;
  if (player.formTrend === "Hot") confidence += 5;
  if (player.formTrend === "Cold") confidence -= 6;
  if (player.backToBack) confidence -= 5;

  return Math.round(clamp(confidence, 10, 95));
}

function projectionForPlayer(player: PregamePlayerIntel): number | null {
  if (player.status === "Out") return null;
  const windows = [
    { value: player.avgFptsLast5, weight: 0.35 },
    { value: player.avgFptsLast10, weight: 0.3 },
    { value: player.avgFptsLast20, weight: 0.2 },
    { value: player.seasonAvgFpts, weight: 0.15 },
  ].filter((entry): entry is { value: number; weight: number } => entry.value !== null);
  if (windows.length === 0) return null;
  const totalWeight = windows.reduce((sum, entry) => sum + entry.weight, 0);
  let weightedForm = windows.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight;

  const split = player.isHome ? player.homeAvgFpts : player.awayAvgFpts;
  if (split !== null) weightedForm = weightedForm * 0.8 + split * 0.2;
  const minutesBaseline = player.avgMinutesLast10 ?? player.avgMinutesLast5;
  const minutes = player.projectedMinutes ?? minutesBaseline;
  if (minutes === null || minutes <= 0 || minutesBaseline === null || minutesBaseline <= 0) {
    return round(weightedForm);
  }

  // A transparent minutes adjustment preserves real historical production
  // while accounting for a provider-backed projected role change.
  const minutesFactor = clamp(minutes / minutesBaseline, 0.7, 1.25);
  return round(weightedForm * minutesFactor);
}

function reasonForPlayer(player: PregamePlayerIntel, projection: number | null): string {
  const reasons: string[] = [];
  if (player.status === "Confirmed Starter" || player.status === "Expected Starter") {
    reasons.push("starter role");
  }
  if (player.formTrend === "Hot") reasons.push("recent form");
  if (player.minutesTrend === "up") reasons.push("minutes trending up");
  if (player.backToBack) reasons.push("back-to-back adjustment");
  if (player.injuryStatus) reasons.push(`${player.injuryStatus.toLowerCase()} report`);
  if (projection !== null) reasons.push(`${projection.toFixed(1)} projected FPTS`);
  return reasons.length > 0 ? reasons.join(", ") : "historical sample available";
}

function toPredictionPlayer(player: PregamePlayerIntel): BasketballPredictionPlayer {
  const projectedFantasyPoints = projectionForPlayer(player);
  const confidencePercent = confidenceForPlayer(player);
  const risk = riskForPlayer(player);
  const tags: BasketballPredictionPlayer["tags"] = [];

  if (risk === "Low" && confidencePercent >= 78 && projectedFantasyPoints !== null) {
    tags.push("lock");
  }
  if (
    projectedFantasyPoints !== null &&
    player.projectedMinutes !== null &&
    player.projectedMinutes >= 18 &&
    projectedFantasyPoints / player.projectedMinutes >= 0.8
  ) {
    tags.push("value");
  }

  return {
    playerId: player.playerId,
    name: player.name,
    teamId: player.teamId,
    teamAbbreviation: player.teamAbbreviation,
    projectedMinutes: player.projectedMinutes !== null ? round(player.projectedMinutes) : null,
    projectedFantasyPoints,
    confidencePercent,
    risk,
    status: player.status,
    injuryStatus: player.injuryStatus,
    avgFptsLast5: player.avgFptsLast5 !== null ? round(player.avgFptsLast5) : null,
    avgFptsLast10: player.avgFptsLast10 !== null ? round(player.avgFptsLast10) : null,
    avgFptsLast20: player.avgFptsLast20 !== null ? round(player.avgFptsLast20) : null,
    seasonAvgFpts: player.seasonAvgFpts !== null ? round(player.seasonAvgFpts) : null,
    usageProjection: null,
    reason: reasonForPlayer(player, projectedFantasyPoints),
    tags,
  };
}

function unavailablePrediction(
  game: Game,
  reason: string,
  generatedAt: string,
): BasketballPrediction {
  return {
    gameId: game.id,
    league: game.league,
    generatedAt,
    available: false,
    unavailableReason: reason,
    players: [],
    predictedFantasyXi: [],
    captain: null,
    viceCaptain: null,
    projectedFantasyScore: null,
    confidencePercent: null,
    risk: null,
    valuePicks: [],
    differentialPicks: [],
    lockPicks: [],
    injuryImpact: { outPlayers: [], concernPlayers: [], knownAvgFptsLost: null },
    modelInputs: {
      last5: false,
      last10: false,
      last20: false,
      seasonAverage: false,
      homeAway: "unavailable",
      opponentDefense: "unavailable",
      pace: "unavailable",
      usage: "unavailable",
      minutes: "unavailable",
      injuries: "available",
      backToBack: "available",
      restDays: "unavailable",
      starterBench: "available",
      matchupHistory: "unavailable",
    },
  };
}

export function buildBasketballPrediction({
  game,
  away,
  home,
  generatedAt = new Date().toISOString(),
}: PredictionInput): BasketballPrediction {
  const allIntel = [...away, ...home];
  const eligibleIntel = allIntel.filter(
    (player) =>
      player.status !== "Out" &&
      (player.avgFptsLast5 !== null || player.avgFptsLast10 !== null || player.avgFptsLast20 !== null || player.seasonAvgFpts !== null) &&
      player.projectedMinutes !== null &&
      player.projectedMinutes > 0,
  );

  if (eligibleIntel.length < LINEUP_SIZE) {
    return unavailablePrediction(
      game,
      `Unavailable: only ${eligibleIntel.length} players have both real historical fantasy data and a projected role; ${LINEUP_SIZE} are required.`,
      generatedAt,
    );
  }

  const players = eligibleIntel
    .map(toPredictionPlayer)
    .sort((a, b) => (b.projectedFantasyPoints ?? -Infinity) - (a.projectedFantasyPoints ?? -Infinity));
  const predictedFantasyXi = players.slice(0, LINEUP_SIZE);
  const captain = predictedFantasyXi[0] ?? null;
  const viceCaptain = predictedFantasyXi[1] ?? null;
  const projectedFantasyScore =
    captain?.projectedFantasyPoints !== null && captain?.projectedFantasyPoints !== undefined &&
    viceCaptain?.projectedFantasyPoints !== null && viceCaptain?.projectedFantasyPoints !== undefined
      ? round(
          predictedFantasyXi.reduce((sum, player) => sum + (player.projectedFantasyPoints ?? 0), 0) +
          captain.projectedFantasyPoints +
          viceCaptain.projectedFantasyPoints * 0.5,
        )
      : null;

  const selectedConfidence = predictedFantasyXi
    .map((player) => player.confidencePercent)
    .filter((value): value is number => value !== null);
  const confidencePercent = selectedConfidence.length > 0 ? Math.round(average(selectedConfidence) ?? 0) : null;
  const risk: PredictionRisk =
    predictedFantasyXi.some((player) => player.risk === "High")
      ? "High"
      : predictedFantasyXi.some((player) => player.risk === "Medium")
        ? "Medium"
        : "Low";

  const outPlayers = allIntel.filter((player) => player.status === "Out").map((player) => player.name);
  const concernPlayers = allIntel
    .filter((player) => player.status === "Questionable" || player.status === "Game Time Decision")
    .map((player) => player.name);
  const knownAvgFptsLost = average(
    allIntel
      .filter((player) => player.status === "Out" && player.avgFptsLast10 !== null)
      .map((player) => player.avgFptsLast10 as number),
  );

  const valuePicks = players.filter((player) => player.tags.includes("value")).slice(0, 3);
  const lockPicks = players.filter((player) => player.tags.includes("lock")).slice(0, 3);

  return {
    gameId: game.id,
    league: game.league,
    generatedAt,
    available: true,
    unavailableReason: null,
    players,
    predictedFantasyXi,
    captain,
    viceCaptain,
    projectedFantasyScore,
    confidencePercent,
    risk,
    valuePicks,
    // ESPN does not provide contest ownership. Never label a player as a
    // differential without that required input.
    differentialPicks: [],
    lockPicks,
    injuryImpact: { outPlayers, concernPlayers, knownAvgFptsLost },
    modelInputs: {
      last5: players.some((player) => player.avgFptsLast5 !== null),
      last10: players.some((player) => player.avgFptsLast10 !== null),
      last20: players.some((player) => player.avgFptsLast20 !== null),
      seasonAverage: players.some((player) => player.seasonAvgFpts !== null),
      homeAway: "available",
      opponentDefense: "unavailable",
      pace: "unavailable",
      usage: "unavailable",
      minutes: "available",
      injuries: "available",
      backToBack: "available",
      restDays: "unavailable",
      starterBench: "available",
      matchupHistory: "unavailable",
    },
  };
}

const SNAPSHOT_PREFIX = "fantasyiq:basketball-prediction:";

export function saveBasketballPrediction(prediction: BasketballPrediction): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${SNAPSHOT_PREFIX}${prediction.gameId}`, JSON.stringify(prediction));
  } catch {
    // Prediction rendering must not fail if browser storage is unavailable.
  }
}

export function getSavedBasketballPrediction(gameId: string): BasketballPrediction | null {
  if (typeof window === "undefined" || !gameId) return null;
  try {
    const raw = window.localStorage.getItem(`${SNAPSHOT_PREFIX}${gameId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BasketballPrediction;
    return parsed?.gameId === gameId ? parsed : null;
  } catch {
    return null;
  }
}