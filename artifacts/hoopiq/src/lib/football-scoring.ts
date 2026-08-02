// Football fantasy scoring and lineup validation.
//
// The scoring table is based on the publicly accessible FantasyGo football
// rules reference:
// https://fantasygo.gitbook.io/knowledge-base/rules-and-how-to-play/fantasy-football-soccer/scoring-rules
//
// It is intentionally independent from the basketball and cricket engines.
// Missing provider values remain missing; this module never estimates stats,
// ratings, credits, or player availability.

import type {
  FootballPlayer,
  FootballPlayerStats,
  FootballPosition,
} from "./football-types";

export const FOOTBALL_LINEUP_SIZE = 11;
export const FOOTBALL_MAX_PLAYERS_PER_TEAM = 7;
export const FOOTBALL_CAPTAIN_MULTIPLIER = 2;
export const FOOTBALL_VICE_CAPTAIN_MULTIPLIER = 1.5;

export const FOOTBALL_FORMATIONS = {
  "4-4-2": { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  "4-3-3": { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  "3-4-3": { GK: 1, DEF: 3, MID: 4, FWD: 3 },
  "3-5-2": { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  "4-5-1": { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  "5-3-2": { GK: 1, DEF: 5, MID: 3, FWD: 2 },
  "5-4-1": { GK: 1, DEF: 5, MID: 4, FWD: 1 },
} as const;

export type FootballFormation = keyof typeof FOOTBALL_FORMATIONS;

export type FootballFantasyBreakdown = {
  appearance: number;
  played60Minutes: number;
  matchWin: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  goalsConceded: number;
  saves: number;
  penaltySaves: number;
  tackles: number;
  chancesCreated: number;
  shotsOnTarget: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  penaltiesWon: number;
  penaltiesConceded: number;
  directFreeKickGoals: number;
  total: number;
  hasProviderStats: boolean;
};

export type FootballLineupValidationError =
  | { kind: "size"; expected: number; actual: number }
  | { kind: "duplicate_player"; playerId: string }
  | { kind: "unknown_player"; playerId: string }
  | { kind: "missing_position"; playerId: string }
  | { kind: "formation"; formation: FootballFormation; position: FootballPosition; expected: number; actual: number }
  | { kind: "team_limit"; teamId: string; count: number; maximum: number }
  | { kind: "captain_missing" }
  | { kind: "vice_captain_missing" }
  | { kind: "captain_not_selected"; playerId: string }
  | { kind: "vice_captain_not_selected"; playerId: string }
  | { kind: "captain_equals_vice_captain" }
  | { kind: "budget"; used: number; budget: number };

export type FootballLineupValidationOptions = {
  formation: FootballFormation;
  captainId?: string | null;
  viceCaptainId?: string | null;
  budget?: number | null;
};

export type FootballAutoPickResult =
  | {
      ok: true;
      players: FootballPlayer[];
      captainId: string;
      viceCaptainId: string;
      formation: FootballFormation;
      creditsUsed: number | null;
    }
  | {
      ok: false;
      reason:
        | "lineup_unavailable"
        | "player_stats_unavailable"
        | "not_enough_players"
        | "no_valid_lineup";
      message: string;
    };

function numeric(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function pointsForGoals(position: FootballPosition, goals: number): number {
  const points = { GK: 10, DEF: 6, MID: 5, FWD: 4 }[position];
  return goals * points;
}

export function calculateFootballFantasyPoints(
  stats: FootballPlayerStats,
  position: FootballPosition | null,
): FootballFantasyBreakdown {
  const empty: FootballFantasyBreakdown = {
    appearance: 0,
    played60Minutes: 0,
    matchWin: 0,
    goals: 0,
    assists: 0,
    cleanSheet: 0,
    goalsConceded: 0,
    saves: 0,
    penaltySaves: 0,
    tackles: 0,
    chancesCreated: 0,
    shotsOnTarget: 0,
    yellowCards: 0,
    redCards: 0,
    ownGoals: 0,
    penaltiesWon: 0,
    penaltiesConceded: 0,
    directFreeKickGoals: 0,
    total: 0,
    hasProviderStats: Object.values(stats).some(hasValue),
  };
  if (!position) return empty;

  const minutes = numeric(stats.minutes);
  const goals = numeric(stats.goals);
  const saves = numeric(stats.saves);
  const goalsConceded = numeric(stats.goalsConceded);
  const breakdown = {
    ...empty,
    appearance: hasValue(stats.minutes) ? 1 : 0,
    played60Minutes: hasValue(stats.minutes) && minutes >= 60 ? 1 : 0,
    matchWin: stats.matchResult === "win" ? 1 : 0,
    goals: pointsForGoals(position, goals),
    assists: numeric(stats.assists) * 3,
    cleanSheet:
      stats.cleanSheet === true && minutes >= 60
        ? position === "GK" || position === "DEF"
          ? 5
          : position === "MID"
            ? 1
            : 0
        : 0,
    goalsConceded:
      (position === "GK" || position === "DEF") && hasValue(stats.goalsConceded)
        ? -Math.max(0, goalsConceded - 1)
        : 0,
    saves: position === "GK" ? Math.floor(saves / 3) : 0,
    penaltySaves: position === "GK" ? numeric(stats.penaltySaves) * 3 : 0,
    tackles: position === "MID" ? Math.floor(numeric(stats.tackles) / 3) : 0,
    chancesCreated: position === "MID" ? Math.floor(numeric(stats.chancesCreated) / 2) : 0,
    shotsOnTarget: position === "FWD" ? Math.floor(numeric(stats.shotsOnTarget) / 2) : 0,
    yellowCards: -numeric(stats.yellowCards),
    redCards: -numeric(stats.redCards) * 2,
    ownGoals: -numeric(stats.ownGoals) * 2,
    penaltiesWon: numeric(stats.penaltiesWon) * 2,
    penaltiesConceded: -numeric(stats.penaltiesConceded),
    directFreeKickGoals: numeric(stats.directFreeKickGoals),
  };
  return {
    ...breakdown,
    total: Object.entries(breakdown).reduce(
      (sum, [key, value]) => (key === "total" || key === "hasProviderStats" ? sum : sum + (value as number)),
      0,
    ),
  };
}

export function getFootballPlayerFantasyPoints(player: FootballPlayer): number {
  return calculateFootballFantasyPoints(player.stats, player.position).total;
}

function countPositions(players: FootballPlayer[]): Record<FootballPosition, number> {
  return players.reduce(
    (counts, player) => {
      if (player.position) counts[player.position] += 1;
      return counts;
    },
    { GK: 0, DEF: 0, MID: 0, FWD: 0 },
  );
}

function creditsFor(players: FootballPlayer[]): number | null {
  if (!players.length || players.some((player) => typeof player.credits !== "number")) return null;
  return players.reduce((sum, player) => sum + (player.credits as number), 0);
}

export function validateFootballLineup(
  selectedPlayers: FootballPlayer[],
  allPlayers: FootballPlayer[],
  options: FootballLineupValidationOptions,
): FootballLineupValidationError[] {
  const errors: FootballLineupValidationError[] = [];
  const byId = new Map(allPlayers.map((player) => [player.id, player]));
  const ids = new Set<string>();
  for (const player of selectedPlayers) {
    if (ids.has(player.id)) errors.push({ kind: "duplicate_player", playerId: player.id });
    ids.add(player.id);
    if (!byId.has(player.id)) errors.push({ kind: "unknown_player", playerId: player.id });
    if (!player.position) errors.push({ kind: "missing_position", playerId: player.id });
  }
  if (selectedPlayers.length !== FOOTBALL_LINEUP_SIZE) {
    errors.push({ kind: "size", expected: FOOTBALL_LINEUP_SIZE, actual: selectedPlayers.length });
  }

  const counts = countPositions(selectedPlayers);
  const formation = FOOTBALL_FORMATIONS[options.formation];
  for (const position of ["GK", "DEF", "MID", "FWD"] as const) {
    if (counts[position] !== formation[position]) {
      errors.push({ kind: "formation", formation: options.formation, position, expected: formation[position], actual: counts[position] });
    }
  }

  const teamCounts = new Map<string, number>();
  for (const player of selectedPlayers) {
    teamCounts.set(player.teamId, (teamCounts.get(player.teamId) ?? 0) + 1);
  }
  for (const [teamId, count] of teamCounts) {
    if (count > FOOTBALL_MAX_PLAYERS_PER_TEAM) {
      errors.push({ kind: "team_limit", teamId, count, maximum: FOOTBALL_MAX_PLAYERS_PER_TEAM });
    }
  }

  if (!options.captainId) errors.push({ kind: "captain_missing" });
  else if (!ids.has(options.captainId)) errors.push({ kind: "captain_not_selected", playerId: options.captainId });
  if (!options.viceCaptainId) errors.push({ kind: "vice_captain_missing" });
  else if (!ids.has(options.viceCaptainId)) errors.push({ kind: "vice_captain_not_selected", playerId: options.viceCaptainId });
  if (options.captainId && options.captainId === options.viceCaptainId) {
    errors.push({ kind: "captain_equals_vice_captain" });
  }

  const creditsUsed = creditsFor(selectedPlayers);
  if (options.budget !== null && options.budget !== undefined && creditsUsed !== null && creditsUsed > options.budget) {
    errors.push({ kind: "budget", used: creditsUsed, budget: options.budget });
  }
  return errors;
}

type PickState = { players: FootballPlayer[]; score: number; credits: number | null; teamCounts: Map<string, number> };

function expandStates(states: PickState[], candidates: FootballPlayer[], needed: number, budget: number | null): PickState[] {
  const next: PickState[] = [];
  const limit = 2400;
  for (const state of states) {
    const start = state.players.length ? candidates.findIndex((player) => player.id === state.players[state.players.length - 1].id) + 1 : 0;
    for (let index = start; index < candidates.length; index += 1) {
      const player = candidates[index];
      const teamCount = state.teamCounts.get(player.teamId) ?? 0;
      if (teamCount >= FOOTBALL_MAX_PLAYERS_PER_TEAM) continue;
      const credits = state.credits === null || typeof player.credits !== "number" ? null : state.credits + player.credits;
      if (budget !== null && credits !== null && credits > budget) continue;
      const teamCounts = new Map(state.teamCounts);
      teamCounts.set(player.teamId, teamCount + 1);
      next.push({
        players: [...state.players, player],
        score: state.score + getFootballPlayerFantasyPoints(player),
        credits,
        teamCounts,
      });
    }
  }
  return next
    .sort((a, b) => b.score - a.score || a.players.map((p) => p.name).join().localeCompare(b.players.map((p) => p.name).join()))
    .slice(0, limit)
    .filter((state) => state.players.length <= needed);
}

export function autoPickFootballLineup(
  players: FootballPlayer[],
  formation: FootballFormation,
  budget: number | null = null,
): FootballAutoPickResult {
  if (!players.length) {
    return { ok: false, reason: "lineup_unavailable", message: "Optimization unavailable because the provider did not return a football lineup." };
  }
  const scorable = players.filter((player) => player.statsAvailable && player.position);
  if (scorable.length < FOOTBALL_LINEUP_SIZE) {
    return { ok: false, reason: "player_stats_unavailable", message: "Optimization unavailable because real player statistics are not available from the football provider." };
  }

  const formationCounts = FOOTBALL_FORMATIONS[formation];
  let states: PickState[] = [{ players: [], score: 0, credits: budget === null ? null : 0, teamCounts: new Map() }];
  for (const position of ["GK", "DEF", "MID", "FWD"] as const) {
    const candidates = scorable
      .filter((player) => player.position === position)
      .sort((a, b) => getFootballPlayerFantasyPoints(b) - getFootballPlayerFantasyPoints(a) || a.name.localeCompare(b.name))
      .slice(0, 12);
    if (candidates.length < formationCounts[position]) {
      return { ok: false, reason: "not_enough_players", message: `Optimization unavailable because the provider returned fewer than ${formationCounts[position]} real ${position} players.` };
    }
    for (let i = 0; i < formationCounts[position]; i += 1) {
      states = expandStates(states, candidates, FOOTBALL_LINEUP_SIZE, budget);
    }
  }

  const best = states
    .filter((state) => state.players.length === FOOTBALL_LINEUP_SIZE)
    .sort((a, b) => b.score - a.score)[0];
  if (!best) return { ok: false, reason: "no_valid_lineup", message: "No valid football XI satisfies the selected formation, team, and budget rules." };

  const picked = [...best.players].sort((a, b) => getFootballPlayerFantasyPoints(b) - getFootballPlayerFantasyPoints(a) || a.name.localeCompare(b.name));
  const captainId = picked[0].id;
  const viceCaptainId = picked[1].id;
  const errors = validateFootballLineup(picked, players, { formation, captainId, viceCaptainId, budget });
  if (errors.length) return { ok: false, reason: "no_valid_lineup", message: "The provider data could not form a valid XI under the selected football rules." };
  return { ok: true, players: picked, captainId, viceCaptainId, formation, creditsUsed: creditsFor(picked) };
}