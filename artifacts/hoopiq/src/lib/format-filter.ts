// Format-Aware Statistics Filter — Task 8.
//
// Cricket statistics MUST NOT be mixed across formats.
// This module defines format groups and provides filtering helpers.
//
// Format groups:
//   T20_GROUP  → T20, The Hundred, T20I, domestic T20 leagues, international T20
//   ODI_GROUP  → ODI, One-Day Internationals, domestic 50-over
//   TEST_GROUP → Test, First-Class, Sheffield Shield, County Championship
//   T10_GROUP  → T10 only
//
// Rule: stats from different groups MUST NEVER be combined for any
// analysis purpose — averages, strike rates, economy, fantasy projections.
// Only combine within the same group (e.g. IPL T20 + England T20I = both T20_GROUP).

import type { MatchFormat } from "./cricket-types";

// ─── Format groups ────────────────────────────────────────────────────────────

export type FormatGroup = "T20" | "ODI" | "Test" | "T10" | "Other";

/**
 * Map from MatchFormat to its group.
 * The Hundred counts as T20 (same structure: 100 balls ≈ T20 intensity,
 * fantasy scoring and player skills transfer directly).
 */
export const FORMAT_GROUPS: Record<MatchFormat, FormatGroup> = {
  T20:          "T20",
  "The Hundred": "T20",  // 100-ball is T20-equivalent
  ODI:          "ODI",
  Test:         "Test",
  T10:          "T10",
  Other:        "Other",
};

export function getFormatGroup(format: MatchFormat | string): FormatGroup {
  return FORMAT_GROUPS[format as MatchFormat] ?? "Other";
}

// ─── Competition-name heuristics ─────────────────────────────────────────────
//
// When format is not explicitly stored, derive it from competition/league name.

export function detectFormatFromName(leagueName: string): FormatGroup {
  const n = (leagueName || "").toLowerCase();

  if (/hundred/.test(n)) return "T20";           // The Hundred → T20 group
  if (/t10/.test(n)) return "T10";
  if (/t20|twenty20|ipl|bbl|cpl|psl|sa20|ilt20|mlc|lpl|bpl|ncl|rcb|slt20|npl/.test(n)) return "T20";
  if (/odi|one.?day|list.?a/.test(n)) return "ODI";
  if (/test|shield|championship|plunket|ranji|sheffield|county/.test(n)) return "Test";
  if (/blast|vitality/.test(n)) return "T20";   // Vitality T20 Blast

  return "Other";
}

// ─── Match-level predicates ───────────────────────────────────────────────────

/** Returns true when two formats belong to the same analysis group. */
export function isSameFormatGroup(a: MatchFormat | string, b: MatchFormat | string): boolean {
  return getFormatGroup(a) === getFormatGroup(b);
}

export function isT20Format(format: MatchFormat | string): boolean {
  return getFormatGroup(format) === "T20";
}

export function isODIFormat(format: MatchFormat | string): boolean {
  return getFormatGroup(format) === "ODI";
}

export function isTestFormat(format: MatchFormat | string): boolean {
  return getFormatGroup(format) === "Test";
}

// ─── Stat-row filter ──────────────────────────────────────────────────────────

export interface FormattedStatRow {
  /** ISO date string of the match */
  matchDate?: string;
  /** MatchFormat or league name (will be resolved) */
  format?: MatchFormat | string;
  /** Competition/league name (used as fallback format source) */
  competitionName?: string;
  [key: string]: unknown;
}

/**
 * Filters an array of stat rows to only include those that belong to the
 * same format group as the target format.
 *
 * @param rows       Array of stat rows (game log entries, historical stats, etc.)
 * @param targetFormat  The format of today's match
 * @returns Only rows where format === same group as targetFormat
 */
export function filterStatsByFormat<T extends FormattedStatRow>(
  rows: T[],
  targetFormat: MatchFormat | string
): T[] {
  const targetGroup = getFormatGroup(targetFormat);
  if (targetGroup === "Other") return rows; // no filter for unknown

  return rows.filter(row => {
    // Prefer explicit format field; fall back to competition name detection
    const rowFormat = row.format ?? row.competitionName ?? "";
    const rowGroup = (rowFormat as string).length > 0
      ? getFormatGroup(rowFormat as string)
      : detectFormatFromName(rowFormat as string);

    // If rowGroup is "Other" (couldn't determine), include it to be safe
    if (rowGroup === "Other") return true;

    return rowGroup === targetGroup;
  });
}

// ─── Rolling window helpers ───────────────────────────────────────────────────

export interface PlayerStatEntry extends FormattedStatRow {
  runs?: number;
  balls?: number;
  wickets?: number;
  runsConceded?: number;
  overs?: number;
  fantasyPoints?: number;
  strikeRate?: number | null;
  economy?: number | null;
}

export interface RollingStats {
  last5: PlayerStatEntry[];
  last10: PlayerStatEntry[];
  average: number | null;
  strikeRateAvg: number | null;
  economyAvg: number | null;
  fantasyAvg: number | null;
  /** Total innings/matches included */
  sampleSize: number;
}

/**
 * Compute rolling stats for a player, filtering by format group.
 * Rows should be sorted most-recent-first.
 */
export function computeRollingStats(
  rows: PlayerStatEntry[],
  targetFormat: MatchFormat | string,
  role: "bat" | "bowl" | "all" = "all"
): RollingStats {
  const filtered = filterStatsByFormat(rows, targetFormat);
  const last10 = filtered.slice(0, 10);
  const last5 = last10.slice(0, 5);

  function avg(arr: PlayerStatEntry[], fn: (r: PlayerStatEntry) => number | null | undefined): number | null {
    const vals = arr.map(fn).filter((v): v is number => v != null && !isNaN(v));
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const runsAvg = (role === "bat" || role === "all") ? avg(last10, r => r.runs) : null;
  const srAvg = (role === "bat" || role === "all") ? avg(last10, r => r.strikeRate) : null;
  const econAvg = (role === "bowl" || role === "all") ? avg(last10, r => r.economy) : null;
  const fPtsAvg = avg(last10, r => r.fantasyPoints);

  return {
    last5,
    last10,
    average: runsAvg,
    strikeRateAvg: srAvg,
    economyAvg: econAvg,
    fantasyAvg: fPtsAvg,
    sampleSize: last10.length,
  };
}
