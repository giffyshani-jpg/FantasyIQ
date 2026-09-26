// Pro Kabaddi League fantasy scoring.
//
// The scoring values below follow the Dream11 kabaddi fantasy point table
// (accessed 2026-09-25): https://www.dream11.com/games/point-system
// and the raid/tackle terminology used by the official PKL rules:
// https://www.prokabaddi.com/kabaddi-rules-videos
//
// FantasyIQ has no PKL feed yet. This module therefore accepts only
// provider/imported projected stats; it never creates players or estimates
// missing values. Dream11's public kabaddi table does not establish a salary
// budget or a per-team cap, so neither rule is applied here.

export const PKL_LINEUP_SIZE = 7;
export const PKL_CAPTAIN_MULTIPLIER = 2;
export const PKL_VICE_CAPTAIN_MULTIPLIER = 1.5;
export const PKL_MAX_PLAYERS_PER_TEAM = 5;
export const PKL_ROLE_LIMITS = {
  raider: { min: 2, max: 4 },
  defender: { min: 2, max: 4 },
  "all-rounder": { min: 1, max: 2 },
} as const;

export type PklRole = "raider" | "defender" | "all-rounder" | "unknown";

export type PklPlayerStats = {
  raidPoints?: number;
  tacklePoints?: number;
  bonusPoints?: number;
  superRaids?: number;
  superTackles?: number;
  allOuts?: number;
  highFives?: number;
  super10s?: number;
  doOrDieRaidPoints?: number;
  successfulRaids?: number;
  totalRaids?: number;
  raidTouches?: number;
  tackles?: number;
  failedTackles?: number;
  greenCards?: number;
  yellowCards?: number;
  redCards?: number;
};

export type PklPlayer = {
  id: string;
  name: string;
  team: string;
  role: PklRole;
  stats: PklPlayerStats;
};

export type PklFantasyBreakdown = {
  raidPoints: number;
  tacklePoints: number;
  bonusPoints: number;
  superRaids: number;
  superTackles: number;
  allOuts: number;
  highFives: number;
  super10s: number;
  doOrDieRaidPoints: number;
  discipline: number;
  total: number;
};

// Dream11's base scoring table does not publish a separate multiplier for
// projected "successful raids" or "tackles"; those fields remain descriptive.
export const PKL_SCORING = {
  raidPoint: 8,
  tacklePoint: 20,
  bonusPoint: 2,
  superRaid: 4,
  superTackle: 8,
  allOut: 4,
  highFive: 8,
  super10: 4,
  doOrDieRaidPoint: 2,
  greenCard: 0,
  yellowCard: -2,
  redCard: -4,
} as const;

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function calculatePklFantasyPoints(stats: PklPlayerStats): PklFantasyBreakdown {
  const discipline =
    numeric(stats.greenCards) * PKL_SCORING.greenCard +
    numeric(stats.yellowCards) * PKL_SCORING.yellowCard +
    numeric(stats.redCards) * PKL_SCORING.redCard;
  const breakdown = {
    raidPoints: numeric(stats.raidPoints) * PKL_SCORING.raidPoint,
    tacklePoints: numeric(stats.tacklePoints) * PKL_SCORING.tacklePoint,
    bonusPoints: numeric(stats.bonusPoints) * PKL_SCORING.bonusPoint,
    superRaids: numeric(stats.superRaids) * PKL_SCORING.superRaid,
    superTackles: numeric(stats.superTackles) * PKL_SCORING.superTackle,
    allOuts: numeric(stats.allOuts) * PKL_SCORING.allOut,
    highFives: numeric(stats.highFives) * PKL_SCORING.highFive,
    super10s: numeric(stats.super10s) * PKL_SCORING.super10,
    doOrDieRaidPoints: numeric(stats.doOrDieRaidPoints) * PKL_SCORING.doOrDieRaidPoint,
    discipline,
  };
  return { ...breakdown, total: Object.values(breakdown).reduce((sum, value) => sum + value, 0) };
}

export function getPklPlayerFantasyPoints(player: PklPlayer): number {
  return calculatePklFantasyPoints(player.stats).total;
}

export type PklLineupValidationError =
  | { kind: "size"; expected: number; actual: number }
  | { kind: "duplicate_player"; playerId: string }
  | { kind: "unknown_player"; playerId: string }
  | { kind: "captain_missing" }
  | { kind: "vice_captain_missing" }
  | { kind: "captain_not_selected"; playerId: string }
  | { kind: "vice_captain_not_selected"; playerId: string }
  | { kind: "captain_equals_vice_captain" }
  | { kind: "team_limit"; team: string; actual: number; maximum: number }
  | { kind: "role_minimum"; role: Exclude<PklRole, "unknown">; actual: number; minimum: number }
  | { kind: "role_maximum"; role: Exclude<PklRole, "unknown">; actual: number; maximum: number }
  | { kind: "unknown_role"; playerId: string };

export function validatePklLineup(
  selectedPlayers: PklPlayer[],
  allPlayers: PklPlayer[],
  captainId?: string | null,
  viceCaptainId?: string | null,
): PklLineupValidationError[] {
  const errors: PklLineupValidationError[] = [];
  const known = new Set(allPlayers.map((player) => player.id));
  const ids = new Set<string>();
  for (const player of selectedPlayers) {
    if (ids.has(player.id)) errors.push({ kind: "duplicate_player", playerId: player.id });
    ids.add(player.id);
    if (!known.has(player.id)) errors.push({ kind: "unknown_player", playerId: player.id });
  }
  if (selectedPlayers.length !== PKL_LINEUP_SIZE) {
    errors.push({ kind: "size", expected: PKL_LINEUP_SIZE, actual: selectedPlayers.length });
  }
  if (!captainId) errors.push({ kind: "captain_missing" });
  else if (!ids.has(captainId)) errors.push({ kind: "captain_not_selected", playerId: captainId });
  if (!viceCaptainId) errors.push({ kind: "vice_captain_missing" });
  else if (!ids.has(viceCaptainId)) errors.push({ kind: "vice_captain_not_selected", playerId: viceCaptainId });
  if (captainId && captainId === viceCaptainId) errors.push({ kind: "captain_equals_vice_captain" });

  const teamCounts = new Map<string, number>();
  for (const player of selectedPlayers) teamCounts.set(player.team, (teamCounts.get(player.team) ?? 0) + 1);
  for (const [team, actual] of teamCounts) {
    if (actual > PKL_MAX_PLAYERS_PER_TEAM) errors.push({ kind: "team_limit", team, actual, maximum: PKL_MAX_PLAYERS_PER_TEAM });
  }
  for (const role of ["raider", "defender", "all-rounder"] as const) {
    const actual = selectedPlayers.filter((player) => player.role === role).length;
    const limits = PKL_ROLE_LIMITS[role];
    if (actual < limits.min) errors.push({ kind: "role_minimum", role, actual, minimum: limits.min });
    if (actual > limits.max) errors.push({ kind: "role_maximum", role, actual, maximum: limits.max });
  }
  for (const player of selectedPlayers) {
    if (player.role === "unknown") errors.push({ kind: "unknown_role", playerId: player.id });
  }
  return errors;
}

export function autoPickPklLineup(players: PklPlayer[]): {
  players: PklPlayer[];
  captainId: string | null;
  viceCaptainId: string | null;
} {
  const sorted = [...players].sort(
    (a, b) => getPklPlayerFantasyPoints(b) - getPklPlayerFantasyPoints(a) || a.name.localeCompare(b.name),
  );
  let best: PklPlayer[] | undefined;
  let nodes = 0;
  const search = (
    index: number,
    picked: PklPlayer[],
    teamCounts: Map<string, number>,
    roleCounts: Record<Exclude<PklRole, "unknown">, number>,
  ) => {
    if (++nodes > 50_000) return;
    if (picked.length === PKL_LINEUP_SIZE) {
      const complete = (Object.keys(PKL_ROLE_LIMITS) as Array<Exclude<PklRole, "unknown">>)
        .every((role) => roleCounts[role] >= PKL_ROLE_LIMITS[role].min);
      if (complete && (!best || picked.reduce((sum, p) => sum + getPklPlayerFantasyPoints(p), 0)
        > best.reduce((sum, p) => sum + getPklPlayerFantasyPoints(p), 0))) best = [...picked];
      return;
    }
    if (sorted.length - index < PKL_LINEUP_SIZE - picked.length) return;
    for (let i = index; i < sorted.length; i += 1) {
      const player = sorted[i];
      if (player.role === "unknown") continue;
      const limits = PKL_ROLE_LIMITS[player.role];
      if (roleCounts[player.role] >= limits.max) continue;
      if ((teamCounts.get(player.team) ?? 0) >= PKL_MAX_PLAYERS_PER_TEAM) continue;
      const nextTeams = new Map(teamCounts);
      nextTeams.set(player.team, (nextTeams.get(player.team) ?? 0) + 1);
      const nextRoles = { ...roleCounts, [player.role]: roleCounts[player.role] + 1 };
      search(i + 1, [...picked, player], nextTeams, nextRoles);
    }
  };
  search(0, [], new Map(), { raider: 0, defender: 0, "all-rounder": 0 });
  const picked: PklPlayer[] = best ?? [];
  return {
    players: picked,
    captainId: picked[0]?.id ?? null,
    viceCaptainId: picked[1]?.id ?? null,
  };
}
