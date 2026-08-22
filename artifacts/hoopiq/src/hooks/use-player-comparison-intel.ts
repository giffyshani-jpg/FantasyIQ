// Player Comparison Intelligence hook.
//
// Fetches real ESPN game-log metrics for up to 2 selected players and,
// for scheduled games, derives projected fantasy points, confidence, and
// risk from the same pre-game intelligence pipeline used by
// BasketballPredictionPanel (without calling the expensive full-lineup
// optimisation path).
//
// Transparent heuristics are documented inline.  Nothing is fabricated:
// any field whose source data is absent returns null, which the UI
// renders as "Unavailable".

import { useEffect, useMemo, useState } from "react";
import { fetchPlayerGameLog } from "../api";
import { computeGameLogMetrics, GameLogMetrics } from "../lib/game-log-metrics";
import { usePregameIntel } from "./use-pregame-intel";
import { Game, InjuryReportEntry, LeagueKey, PlayerGameLogEntry } from "../lib/types";
import { PregamePlayerIntel } from "../lib/pregame-intel";

export type ComparisonRisk = "Low" | "Medium" | "High";

export type PlayerComparisonIntel = {
  playerId: string;
  name: string;
  teamAbbreviation: string;
  isHome: boolean;

  /** Weighted projection (L5 35 % · L10 30 % · L20 20 % · season 15 %).
   *  Null when game has already started or player has no historical data. */
  projectedFpts: number | null;

  /** 0–95 % heuristic confidence in the projection.
   *  Null when game has already started. */
  confidence: number | null;

  /** Heuristic risk level.  Null when game has already started. */
  risk: ComparisonRisk | null;

  avgFptsLast5: number | null;
  avgFptsLast10: number | null;

  /** Ceiling: highest single-game FPTS in the full game log. */
  highFpts: number | null;

  minutesTrend: "up" | "down" | "flat" | null;
  recentForm: "Hot" | "Average" | "Cold";

  injuryStatus: InjuryReportEntry["status"] | null;

  /** Player's historical average when playing at home. */
  homeAvgFpts: number | null;
  /** Player's historical average when playing away. */
  awayAvgFpts: number | null;
};

// ─── Internal heuristics (same logic as basketball-prediction.ts) ──────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function projectFpts(intel: PregamePlayerIntel): number | null {
  if (intel.status === "Out") return null;
  const windows = [
    { value: intel.avgFptsLast5,  weight: 0.35 },
    { value: intel.avgFptsLast10, weight: 0.30 },
    { value: intel.avgFptsLast20, weight: 0.20 },
    { value: intel.seasonAvgFpts, weight: 0.15 },
  ].filter((w): w is { value: number; weight: number } => w.value !== null);

  if (windows.length === 0) return null;

  const totalWeight = windows.reduce((s, w) => s + w.weight, 0);
  let base = windows.reduce((s, w) => s + w.value * w.weight, 0) / totalWeight;

  const split = intel.isHome ? intel.homeAvgFpts : intel.awayAvgFpts;
  if (split !== null) base = base * 0.8 + split * 0.2;

  const minutesBaseline = intel.avgMinutesLast10 ?? intel.avgMinutesLast5;
  const minutes = intel.projectedMinutes ?? minutesBaseline;
  if (minutes == null || minutes <= 0 || minutesBaseline == null || minutesBaseline <= 0) {
    return round1(base);
  }
  return round1(base * clamp(minutes / minutesBaseline, 0.7, 1.25));
}

function computeConfidence(intel: PregamePlayerIntel): number {
  if (intel.status === "Out") return 0;
  let c = 55;
  if (intel.status === "Confirmed Starter")  c += 18;
  else if (intel.status === "Expected Starter") c += 10;
  else if (intel.status === "Questionable" || intel.status === "Game Time Decision") c -= 22;
  else if (intel.status === "Bench" || intel.status === "Confirmed Bench") c -= 8;

  if (intel.consistency === "Consistent")          c += 12;
  else if (intel.consistency === "Somewhat Consistent") c += 5;
  else if (intel.consistency === "Volatile")        c -= 10;

  if (intel.formTrend === "Hot")  c += 5;
  if (intel.formTrend === "Cold") c -= 6;
  if (intel.backToBack)           c -= 5;
  return Math.round(clamp(c, 10, 95));
}

function computeRisk(intel: PregamePlayerIntel): ComparisonRisk {
  if (
    intel.status === "Out" ||
    intel.status === "Questionable" ||
    intel.status === "Game Time Decision" ||
    intel.formTrend === "Cold"
  ) return "High";

  if (
    intel.status === "Bench" ||
    intel.status === "Confirmed Bench" ||
    intel.minutesTrend === "down" ||
    intel.consistency === "Volatile" ||
    intel.backToBack
  ) return "Medium";

  return "Low";
}

// ─── Hook ─────────────────────────────────────────────────────────────────

type PlayerEntry = {
  id: string;
  name: string;
  teamAbbreviation: string;
  isHome: boolean;
  /** Injury status already on the box-score player object, if any. */
  injuryStatus?: InjuryReportEntry["status"];
};

export type ComparisonIntelResult = {
  /** Keyed by playerId. Populated once game-log fetches complete. */
  intel: Map<string, PlayerComparisonIntel>;
  loading: boolean;
};

export function usePlayerComparisonIntel(
  game: Game | null | undefined,
  league: LeagueKey,
  players: PlayerEntry[],
): ComparisonIntelResult {
  const pregameIntel = usePregameIntel(game ?? null, league);

  const [logMetrics, setLogMetrics] = useState<Map<string, GameLogMetrics>>(new Map());
  const [loading, setLoading] = useState(false);

  const idsKey = players.map((p) => p.id).join(",");
  const leagueKey = league;
  const gameId = game?.id ?? "";

  useEffect(() => {
    if (players.length === 0 || !game) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.all(
      players.map(async (p) => {
        const entries = (await fetchPlayerGameLog(p.id, leagueKey)) as PlayerGameLogEntry[];
        return [p.id, computeGameLogMetrics(entries)] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) {
          setLogMetrics(new Map(entries));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, leagueKey, gameId]);

  // Build the per-player pregame intel lookup (scheduled games only).
  const pregameByPlayerId = useMemo(() => {
    const map = new Map<string, PregamePlayerIntel>();
    if (!pregameIntel.away || !pregameIntel.home) return map;
    for (const p of [...pregameIntel.away, ...pregameIntel.home]) {
      map.set(p.playerId, p);
    }
    return map;
  }, [pregameIntel.away, pregameIntel.home]);

  const intel = useMemo<Map<string, PlayerComparisonIntel>>(() => {
    const result = new Map<string, PlayerComparisonIntel>();
    const isScheduled = game?.status === "scheduled";

    for (const entry of players) {
      const metrics = logMetrics.get(entry.id);
      const intelPlayer = isScheduled ? pregameByPlayerId.get(entry.id) : undefined;

      // Injury status: prefer injury-report entry (available pregame), fall
      // back to the box-score flag already on the player object.
      const injuryFromReport =
        game?.injuryReport?.find((r) => r.playerId === entry.id)?.status ?? null;
      const injuryStatus = injuryFromReport ?? entry.injuryStatus ?? null;

      // Pregame projections are only meaningful before the game starts.
      const projectedFpts = intelPlayer ? projectFpts(intelPlayer) : null;
      const confidence    = intelPlayer ? computeConfidence(intelPlayer) : null;
      const risk          = intelPlayer ? computeRisk(intelPlayer) : null;

      const highFpts =
        metrics && metrics.fptsByGame.length > 0 ? Math.max(...metrics.fptsByGame) : null;

      result.set(entry.id, {
        playerId:          entry.id,
        name:              entry.name,
        teamAbbreviation:  entry.teamAbbreviation,
        isHome:            entry.isHome,
        projectedFpts,
        confidence,
        risk,
        avgFptsLast5:  metrics?.avgFptsLast5  ?? null,
        avgFptsLast10: metrics?.avgFptsLast10 ?? null,
        highFpts,
        minutesTrend:  metrics?.minutesTrend  ?? null,
        recentForm:    metrics?.trend ?? "Average",
        injuryStatus,
        homeAvgFpts:   metrics?.homeAvgFpts ?? null,
        awayAvgFpts:   metrics?.awayAvgFpts ?? null,
      });
    }
    return result;
  }, [players, logMetrics, pregameByPlayerId, game]);

  return { intel, loading };
}
