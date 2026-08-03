import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { StarButton } from "../components/star-button";
import { PlayerStatusBadges } from "../components/player-status-badges";
import { PlayerDetailSheet } from "../components/player-detail-sheet";
import { fetchGameById } from "../api";
import { calculateFantasyPoints } from "../lib/stats";
import { useComparisonSelection } from "../hooks/use-comparison-selection";
import { useFavorites } from "../hooks/use-favorites";
import { useRecentForm } from "../hooks/use-recent-form";
import {
  usePlayerComparisonIntel,
  PlayerComparisonIntel,
  ComparisonRisk,
} from "../hooks/use-player-comparison-intel";
import { Game, InjuryReportEntry, Player } from "../lib/types";

// ─── Local types ──────────────────────────────────────────────────────────

type ComparePlayer = Player & {
  teamAbbreviation: string;
  isHome: boolean;
  fpts: number;
};

// ─── Box-score stat rows (existing grid) ─────────────────────────────────

type StatRow = {
  key: string;
  label: string;
  getValue: (p: ComparePlayer) => number | null;
  getDisplay: (p: ComparePlayer) => string;
  optional?: boolean;
};

function parseMadeCount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const made = parseInt(raw.split("-")[0], 10);
  return Number.isFinite(made) ? made : null;
}

const STAT_ROWS: StatRow[] = [
  {
    key: "minutes",
    label: "Minutes",
    getValue: (p) => (p.stats.minutes ? parseFloat(p.stats.minutes) : null),
    getDisplay: (p) => p.stats.minutes ?? "-",
  },
  {
    key: "fpts",
    label: "Fantasy Points",
    getValue: (p) => p.fpts,
    getDisplay: (p) => p.fpts.toFixed(1),
  },
  {
    key: "points",
    label: "Points",
    getValue: (p) => p.stats.points,
    getDisplay: (p) => String(p.stats.points),
  },
  {
    key: "rebounds",
    label: "Rebounds",
    getValue: (p) => p.stats.rebounds,
    getDisplay: (p) => String(p.stats.rebounds),
  },
  {
    key: "assists",
    label: "Assists",
    getValue: (p) => p.stats.assists,
    getDisplay: (p) => String(p.stats.assists),
  },
  {
    key: "steals",
    label: "Steals",
    getValue: (p) => p.stats.steals,
    getDisplay: (p) => String(p.stats.steals),
  },
  {
    key: "blocks",
    label: "Blocks",
    getValue: (p) => p.stats.blocks,
    getDisplay: (p) => String(p.stats.blocks),
  },
  {
    key: "turnovers",
    label: "Turnovers",
    getValue: (p) => p.stats.turnovers,
    getDisplay: (p) => String(p.stats.turnovers),
  },
  {
    key: "fg",
    label: "FG (M/A)",
    getValue: (p) => parseMadeCount(p.stats.fieldGoals),
    getDisplay: (p) => p.stats.fieldGoals ?? "-",
  },
  {
    key: "3pt",
    label: "3PT (M/A)",
    getValue: (p) => parseMadeCount(p.stats.threePointers),
    getDisplay: (p) => p.stats.threePointers ?? "-",
  },
  {
    key: "ft",
    label: "FT (M/A)",
    getValue: (p) => parseMadeCount(p.stats.freeThrows),
    getDisplay: (p) => p.stats.freeThrows ?? "-",
  },
  {
    key: "plusMinus",
    label: "Plus/Minus",
    getValue: (p) => (typeof p.stats.plusMinus === "number" ? p.stats.plusMinus : null),
    getDisplay: (p) =>
      typeof p.stats.plusMinus === "number"
        ? p.stats.plusMinus > 0
          ? `+${p.stats.plusMinus}`
          : String(p.stats.plusMinus)
        : "-",
    optional: true,
  },
];

const PLAYER_COL_WIDTH = 140;
const LABEL_COL_WIDTH = 116;

// ─── AI comparison helpers ────────────────────────────────────────────────

type WinSide = "left" | "right" | "tie" | "none";

function compareNums(
  a: number | null,
  b: number | null,
  higherIsBetter = true,
): WinSide {
  if (a === null && b === null) return "none";
  if (a === null) return "right";
  if (b === null) return "left";
  if (Math.abs(a - b) < 0.01) return "tie";
  return (higherIsBetter ? a > b : a < b) ? "left" : "right";
}

function riskScore(r: ComparisonRisk | null): number | null {
  if (r === null) return null;
  return r === "Low" ? 3 : r === "Medium" ? 2 : 1;
}

function minutesTrendScore(t: "up" | "down" | "flat" | null): number | null {
  if (t === null) return null;
  return t === "up" ? 3 : t === "flat" ? 2 : 1;
}

function formScore(f: "Hot" | "Average" | "Cold"): number {
  return f === "Hot" ? 3 : f === "Average" ? 2 : 1;
}

function injuryScore(s: InjuryReportEntry["status"] | null): number {
  if (!s) return 4; // active/no report
  if (s === "Probable") return 3;
  if (s === "Questionable") return 2;
  if (s === "GTD") return 1;
  return 0; // OUT
}

function fmtFpts(v: number | null): string {
  return v === null ? "Unavailable" : v.toFixed(1);
}

function fmtPct(v: number | null): string {
  return v === null ? "Unavailable" : `${v}%`;
}

function fmtRisk(v: ComparisonRisk | null): string {
  return v === null ? "Unavailable" : v;
}

function fmtTrend(v: "up" | "down" | "flat" | null): string {
  if (v === null) return "Unavailable";
  return v === "up" ? "↑ Trending Up" : v === "down" ? "↓ Trending Down" : "→ Flat";
}

function fmtForm(v: "Hot" | "Average" | "Cold"): string {
  return v === "Hot" ? "Hot 🔥" : v === "Cold" ? "Cold ❄️" : "Average";
}

function fmtInjury(s: InjuryReportEntry["status"] | null): string {
  return s ?? "—";
}

function fmtSplit(home: number | null, away: number | null, isHome: boolean): string {
  if (home === null && away === null) return "Unavailable";
  const homeStr = home !== null ? home.toFixed(1) : "N/A";
  const awayStr = away !== null ? away.toFixed(1) : "N/A";
  const indicator = isHome ? " ◀" : "";
  return `H: ${homeStr}${isHome ? indicator : ""}  A: ${awayStr}${!isHome ? indicator : ""}`;
}

// The applicable split (home game → home avg, away game → away avg).
function applicableSplit(intel: PlayerComparisonIntel): number | null {
  return intel.isHome ? intel.homeAvgFpts : intel.awayAvgFpts;
}

// ─── Intelligence row type ────────────────────────────────────────────────

type IntelRow = {
  key: string;
  label: string;
  leftDisplay: string;
  rightDisplay: string;
  winner: WinSide;
  /** Extra emphasis on cells when winner is clear. */
  important?: boolean;
};

function buildIntelRows(
  left: PlayerComparisonIntel,
  right: PlayerComparisonIntel,
): IntelRow[] {
  return [
    {
      key: "projFpts",
      label: "Projected FPTS",
      leftDisplay: fmtFpts(left.projectedFpts),
      rightDisplay: fmtFpts(right.projectedFpts),
      winner: compareNums(left.projectedFpts, right.projectedFpts),
      important: true,
    },
    {
      key: "confidence",
      label: "Confidence",
      leftDisplay: fmtPct(left.confidence),
      rightDisplay: fmtPct(right.confidence),
      winner: compareNums(left.confidence, right.confidence),
    },
    {
      key: "risk",
      label: "Risk",
      leftDisplay: fmtRisk(left.risk),
      rightDisplay: fmtRisk(right.risk),
      winner: compareNums(riskScore(left.risk), riskScore(right.risk)),
    },
    {
      key: "l5",
      label: "Last 5 Avg",
      leftDisplay: fmtFpts(left.avgFptsLast5),
      rightDisplay: fmtFpts(right.avgFptsLast5),
      winner: compareNums(left.avgFptsLast5, right.avgFptsLast5),
      important: true,
    },
    {
      key: "l10",
      label: "Last 10 Avg",
      leftDisplay: fmtFpts(left.avgFptsLast10),
      rightDisplay: fmtFpts(right.avgFptsLast10),
      winner: compareNums(left.avgFptsLast10, right.avgFptsLast10),
    },
    {
      key: "minTrend",
      label: "Minutes Trend",
      leftDisplay: fmtTrend(left.minutesTrend),
      rightDisplay: fmtTrend(right.minutesTrend),
      winner: compareNums(
        minutesTrendScore(left.minutesTrend),
        minutesTrendScore(right.minutesTrend),
      ),
    },
    {
      key: "form",
      label: "Recent Form",
      leftDisplay: fmtForm(left.recentForm),
      rightDisplay: fmtForm(right.recentForm),
      winner: compareNums(formScore(left.recentForm), formScore(right.recentForm)),
    },
    {
      key: "injury",
      label: "Injury Status",
      leftDisplay: fmtInjury(left.injuryStatus),
      rightDisplay: fmtInjury(right.injuryStatus),
      winner: compareNums(injuryScore(left.injuryStatus), injuryScore(right.injuryStatus)),
    },
    {
      key: "split",
      label: "Home / Away Split",
      leftDisplay: fmtSplit(left.homeAvgFpts, left.awayAvgFpts, left.isHome),
      rightDisplay: fmtSplit(right.homeAvgFpts, right.awayAvgFpts, right.isHome),
      winner: compareNums(applicableSplit(left), applicableSplit(right)),
    },
    {
      key: "h2h",
      label: "Head-to-Head History",
      leftDisplay: "Unavailable",
      rightDisplay: "Unavailable",
      winner: "none",
    },
  ];
}

// ─── Summary computation ──────────────────────────────────────────────────

type SummaryResult = {
  betterFantasyPick: { name: string; reason: string } | null;
  saferPick: { name: string; reason: string } | null;
  higherUpside: { name: string; reason: string } | null;
  aiExplanation: string;
};

function buildSummary(
  left: PlayerComparisonIntel,
  right: PlayerComparisonIntel,
): SummaryResult {
  // Better fantasy pick: projected fpts (scheduled) else last-5 avg.
  const fantasyBasis =
    left.projectedFpts !== null || right.projectedFpts !== null
      ? { left: left.projectedFpts, right: right.projectedFpts, label: "projected FPTS" }
      : { left: left.avgFptsLast5, right: right.avgFptsLast5, label: "last-5 avg" };

  const fantasyWinner = compareNums(fantasyBasis.left, fantasyBasis.right);
  let betterFantasyPick: SummaryResult["betterFantasyPick"] = null;
  if (fantasyWinner === "left" || fantasyWinner === "right") {
    const winner = fantasyWinner === "left" ? left : right;
    const loser  = fantasyWinner === "left" ? right : left;
    const winVal = fantasyWinner === "left" ? fantasyBasis.left : fantasyBasis.right;
    const loseVal = fantasyWinner === "left" ? fantasyBasis.right : fantasyBasis.left;
    betterFantasyPick = {
      name: winner.name,
      reason: `Higher ${fantasyBasis.label} (${fmtFpts(winVal)} vs ${fmtFpts(loseVal)})`,
    };
    void loser; // suppress unused-variable lint
  } else if (fantasyWinner === "tie") {
    betterFantasyPick = { name: left.name, reason: `Equal ${fantasyBasis.label} — coin flip` };
  }

  // Safer pick: risk (primary), then injury.
  const riskWinner = compareNums(riskScore(left.risk), riskScore(right.risk));
  let saferPick: SummaryResult["saferPick"] = null;
  if (riskWinner !== "none") {
    if (riskWinner === "left" || riskWinner === "right") {
      const winner = riskWinner === "left" ? left : right;
      const loser  = riskWinner === "left" ? right : left;
      saferPick = {
        name: winner.name,
        reason: `${winner.risk ?? "lower"} risk (vs ${loser.risk ?? "higher"} risk)`,
      };
    } else {
      // Tied risk — break by injury.
      const injWinner = compareNums(injuryScore(left.injuryStatus), injuryScore(right.injuryStatus));
      if (injWinner === "left") {
        saferPick = { name: left.name, reason: `No injury concern (vs ${right.injuryStatus ?? "unknown"})` };
      } else if (injWinner === "right") {
        saferPick = { name: right.name, reason: `No injury concern (vs ${left.injuryStatus ?? "unknown"})` };
      } else {
        saferPick = { name: left.name, reason: "Similar risk profile — slight edge to first selected" };
      }
    }
  } else {
    // No risk data — fall back to injury only.
    const injWinner = compareNums(injuryScore(left.injuryStatus), injuryScore(right.injuryStatus));
    if (injWinner === "left") saferPick = { name: left.name, reason: "Fewer injury concerns" };
    else if (injWinner === "right") saferPick = { name: right.name, reason: "Fewer injury concerns" };
  }

  // Higher upside: ceiling from full game log.
  const upsideWinner = compareNums(left.highFpts, right.highFpts);
  let higherUpside: SummaryResult["higherUpside"] = null;
  if (upsideWinner === "left" || upsideWinner === "right") {
    const winner = upsideWinner === "left" ? left : right;
    const winVal = upsideWinner === "left" ? left.highFpts : right.highFpts;
    const loseVal = upsideWinner === "left" ? right.highFpts : left.highFpts;
    higherUpside = {
      name: winner.name,
      reason: `Best single-game FPTS (${fmtFpts(winVal)} vs ${fmtFpts(loseVal)})`,
    };
  } else if (upsideWinner === "tie" && left.highFpts !== null) {
    higherUpside = { name: left.name, reason: `Equal ceiling (${fmtFpts(left.highFpts)}) — coin flip` };
  }

  // AI explanation: concise narrative based on available data.
  const parts: string[] = [];

  if (fantasyBasis.left !== null || fantasyBasis.right !== null) {
    if (fantasyWinner === "left") {
      parts.push(
        `${left.name} leads on ${fantasyBasis.label} (${fmtFpts(fantasyBasis.left)} vs ${fmtFpts(fantasyBasis.right)}).`,
      );
    } else if (fantasyWinner === "right") {
      parts.push(
        `${right.name} leads on ${fantasyBasis.label} (${fmtFpts(fantasyBasis.right)} vs ${fmtFpts(fantasyBasis.left)}).`,
      );
    }
  }

  if (riskWinner === "left") {
    parts.push(`${left.name} carries lower risk (${left.risk}).`);
  } else if (riskWinner === "right") {
    parts.push(`${right.name} carries lower risk (${right.risk}).`);
  }

  if (left.recentForm !== right.recentForm) {
    const formWinner = formScore(left.recentForm) > formScore(right.recentForm) ? left : right;
    parts.push(`${formWinner.name} is in better recent form (${formWinner.recentForm}).`);
  }

  if (left.minutesTrend !== null && right.minutesTrend !== null && left.minutesTrend !== right.minutesTrend) {
    const mt = minutesTrendScore(left.minutesTrend)! > minutesTrendScore(right.minutesTrend)!
      ? left
      : right;
    parts.push(`${mt.name}'s minutes are trending ${mt.minutesTrend}.`);
  }

  if (left.injuryStatus && !right.injuryStatus) {
    parts.push(`${right.name} has no injury concern; ${left.name} is listed as ${left.injuryStatus}.`);
  } else if (!left.injuryStatus && right.injuryStatus) {
    parts.push(`${left.name} has no injury concern; ${right.name} is listed as ${right.injuryStatus}.`);
  }

  const aiExplanation =
    parts.length > 0
      ? parts.join(" ")
      : "Insufficient historical data to generate a detailed AI explanation for this matchup.";

  return { betterFantasyPick, saferPick, higherUpside, aiExplanation };
}

// ─── Sub-components ───────────────────────────────────────────────────────

function WinnerBadge({ side, target }: { side: WinSide; target: "left" | "right" }) {
  if (side === "none" || side === "tie") return null;
  if (side !== target) return null;
  return (
    <span className="ml-1 inline-flex items-center rounded bg-primary/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">
      ✓
    </span>
  );
}

function IntelCell({
  display,
  winner,
  side,
  isUnavailable,
}: {
  display: string;
  winner: WinSide;
  side: "left" | "right";
  isUnavailable: boolean;
}) {
  const isWinner = winner === side;
  const isTie = winner === "tie";
  return (
    <div
      className={`border-b border-border py-3 px-2 text-center text-sm flex items-center justify-center gap-1 ${
        isWinner
          ? "bg-primary/10 font-bold text-primary"
          : isTie
          ? "bg-muted/30 font-semibold text-foreground"
          : isUnavailable
          ? "text-muted-foreground italic"
          : "text-foreground"
      }`}
    >
      <span>{display}</span>
      {isWinner && (
        <span className="text-primary text-xs">✓</span>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  name,
  reason,
}: {
  icon: string;
  title: string;
  name: string | null;
  reason: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span>{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      {name ? (
        <>
          <p className="text-sm font-bold text-foreground">{name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{reason}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">Unavailable</p>
      )}
    </div>
  );
}

// ─── Main head-to-head intelligence panel ────────────────────────────────

function HeadToHeadPanel({
  left,
  right,
  loading,
}: {
  left: PlayerComparisonIntel;
  right: PlayerComparisonIntel;
  loading: boolean;
}) {
  const rows = useMemo(() => buildIntelRows(left, right), [left, right]);
  const summary = useMemo(() => buildSummary(left, right), [left, right]);

  const leftWins  = rows.filter((r) => r.winner === "left").length;
  const rightWins = rows.filter((r) => r.winner === "right").length;

  return (
    <section className="border-b border-border bg-background">
      {/* Panel header */}
      <div className="px-4 py-4 border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
          FantasyIQ AI
        </p>
        <h2 className="text-base font-bold">Head-to-Head Intelligence</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Provider-backed metrics. Projected data is pregame only.{" "}
          <span className="text-primary font-semibold">
            {left.name} {leftWins}–{rightWins} {right.name}
          </span>
        </p>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground animate-pulse">
          Loading player intelligence…
        </div>
      ) : (
        <>
          {/* Player name header row */}
          <div className="grid grid-cols-[1fr_1px_1fr] border-b border-border">
            <div className="px-3 py-2 text-center">
              <p className="text-xs font-bold truncate text-foreground">{left.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{left.teamAbbreviation}</p>
            </div>
            <div className="bg-border" />
            <div className="px-3 py-2 text-center">
              <p className="text-xs font-bold truncate text-foreground">{right.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{right.teamAbbreviation}</p>
            </div>
          </div>

          {/* Comparison rows */}
          {rows.map((row) => {
            const leftUnavailable  = row.leftDisplay  === "Unavailable";
            const rightUnavailable = row.rightDisplay === "Unavailable";
            return (
              <React.Fragment key={row.key}>
                {/* Row label spanning full width */}
                <div className="bg-muted/40 px-3 py-1 border-b border-border">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    {row.label}
                  </span>
                </div>
                {/* Left | Right values */}
                <div className="grid grid-cols-[1fr_1px_1fr]">
                  <IntelCell
                    display={row.leftDisplay}
                    winner={row.winner}
                    side="left"
                    isUnavailable={leftUnavailable}
                  />
                  <div className="bg-border" />
                  <IntelCell
                    display={row.rightDisplay}
                    winner={row.winner}
                    side="right"
                    isUnavailable={rightUnavailable}
                  />
                </div>
              </React.Fragment>
            );
          })}

          {/* Summary cards */}
          <div className="px-3 py-4 space-y-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-0.5">
              AI Summary
            </p>
            <div className="grid grid-cols-1 gap-2">
              <SummaryCard
                icon="🏆"
                title="Better Fantasy Pick"
                name={summary.betterFantasyPick?.name ?? null}
                reason={summary.betterFantasyPick?.reason ?? "Insufficient data"}
              />
              <SummaryCard
                icon="🛡️"
                title="Safer Pick"
                name={summary.saferPick?.name ?? null}
                reason={summary.saferPick?.reason ?? "Insufficient data"}
              />
              <SummaryCard
                icon="🚀"
                title="Higher Upside"
                name={summary.higherUpside?.name ?? null}
                reason={summary.higherUpside?.reason ?? "Insufficient data"}
              />
            </div>

            {/* AI explanation */}
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                🤖 AI Explanation
              </p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {summary.aiExplanation}
              </p>
              <p className="mt-2 text-[9px] text-muted-foreground/60">
                Based on real provider data. No fabricated stats.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function PlayerComparison() {
  const params = useParams();
  const gameId = params.id;
  const league = params.league as import("../lib/types").LeagueKey;

  const [game, setGame] = useState<Game | null | undefined>(null);
  const comparison  = useComparisonSelection(gameId);
  const favorites   = useFavorites();
  const recentForm  = useRecentForm();
  const [detailPlayer, setDetailPlayer] = useState<ComparePlayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGame(null);
    fetchGameById(gameId || "", league).then((data) => {
      if (!cancelled) setGame((data as Game | undefined) ?? undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, league]);

  const allPlayers: ComparePlayer[] = useMemo(() => {
    if (!game) return [];
    const away = game.awayTeam.players.map((p) => ({
      ...p,
      teamAbbreviation: game.awayTeam.abbreviation,
      isHome: false,
      fpts: calculateFantasyPoints(p.stats),
    }));
    const home = game.homeTeam.players.map((p) => ({
      ...p,
      teamAbbreviation: game.homeTeam.abbreviation,
      isHome: true,
      fpts: calculateFantasyPoints(p.stats),
    }));
    return [...away, ...home];
  }, [game]);

  const comparedPlayers = useMemo(
    () =>
      comparison.selectedIds
        .map((id) => allPlayers.find((p) => p.id === id))
        .filter((p): p is ComparePlayer => Boolean(p)),
    [comparison.selectedIds, allPlayers],
  );

  // Intelligence entries for up to 2 selected players.
  const intelEntries = useMemo(
    () =>
      comparedPlayers.slice(0, 2).map((p) => ({
        id: p.id,
        name: p.name,
        teamAbbreviation: p.teamAbbreviation,
        isHome: p.isHome,
        injuryStatus: p.injuryStatus,
      })),
    [comparedPlayers],
  );

  const { intel, loading: intelLoading } = usePlayerComparisonIntel(
    game ?? null,
    league,
    intelEntries,
  );

  const showIntelPanel =
    comparedPlayers.length === 2 &&
    intel.has(comparedPlayers[0].id) &&
    intel.has(comparedPlayers[1].id);

  const visibleRows = useMemo(
    () =>
      STAT_ROWS.filter((row) => {
        if (!row.optional) return true;
        return comparedPlayers.some((p) => row.getValue(p) !== null);
      }),
    [comparedPlayers],
  );

  if (game === null) {
    return (
      <MobileLayout showBack title="Compare Players">
        <div className="p-8 text-center text-muted-foreground">Loading game…</div>
      </MobileLayout>
    );
  }

  if (!game) {
    return (
      <MobileLayout showBack title="Compare Players">
        <div className="p-8 text-center text-muted-foreground">Game not found</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showBack title="Compare Players">
      <div className="flex flex-col h-full">
        {/* Match header */}
        <div className="p-4 border-b border-border bg-card flex items-center justify-between shrink-0">
          <div className="text-sm font-semibold text-foreground">
            {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
          </div>
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {comparedPlayers.length}/{comparison.selectedIds.length > 0 ? comparison.selectedIds.length : "—"}{" "}
            selected
          </div>
        </div>

        {comparedPlayers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-muted-foreground text-sm">
              No players selected yet. Go back and tap "Compare" on players from either team.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {/* ── AI Head-to-Head Intelligence (2 players only) ─────────── */}
            {showIntelPanel && (
              <HeadToHeadPanel
                left={intel.get(comparedPlayers[0].id)!}
                right={intel.get(comparedPlayers[1].id)!}
                loading={intelLoading}
              />
            )}

            {comparedPlayers.length === 1 && (
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <p className="text-xs text-muted-foreground text-center">
                  Select a second player to unlock AI Head-to-Head Intelligence.
                </p>
              </div>
            )}

            {/* ── Box-score stats grid ───────────────────────────────────── */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `${LABEL_COL_WIDTH}px repeat(${comparedPlayers.length}, ${PLAYER_COL_WIDTH}px)`,
              }}
            >
              {/* Header row */}
              <div className="sticky top-0 left-0 z-30 bg-muted/95 border-b border-r border-border" />
              {comparedPlayers.map((player) => {
                const isFavorite = favorites.isFavorite(player.id);
                return (
                  <div
                    key={player.id}
                    className="sticky top-0 z-20 bg-muted/95 border-b border-border px-2 py-2 flex flex-col items-center gap-1"
                  >
                    <div className="self-stretch flex items-center justify-between -mt-1 -mr-1">
                      <StarButton
                        active={isFavorite}
                        onToggle={() => favorites.toggleFavorite(player.id)}
                        label={isFavorite ? `Unfavorite ${player.name}` : `Favorite ${player.name}`}
                        size={14}
                      />
                      <button
                        type="button"
                        onClick={() => comparison.remove(player.id)}
                        aria-label={`Remove ${player.name} from comparison`}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailPlayer(player)}
                      className="text-xs font-bold text-foreground text-center leading-tight truncate w-full hover:text-primary hover:underline underline-offset-2 transition-colors"
                    >
                      {player.name}
                    </button>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {player.teamAbbreviation} • #{player.number}
                    </span>
                    {game && <PlayerStatusBadges player={player} gameStatus={game.status} />}
                  </div>
                );
              })}

              {/* Section label */}
              <div
                className="col-span-full bg-muted/40 px-3 py-1.5 border-b border-border"
                style={{ gridColumn: `1 / span ${1 + comparedPlayers.length}` }}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  This Game
                </span>
              </div>

              {/* Stat rows */}
              {visibleRows.map((row) => {
                const values = comparedPlayers.map((p) => row.getValue(p));
                const numericValues = values.filter((v): v is number => v !== null);
                const maxValue =
                  comparedPlayers.length > 1 && numericValues.length > 0
                    ? Math.max(...numericValues)
                    : null;

                return (
                  <React.Fragment key={row.key}>
                    <div className="sticky left-0 z-10 bg-card border-b border-r border-border px-3 py-3 text-xs font-semibold text-muted-foreground uppercase flex items-center">
                      {row.label}
                    </div>
                    {comparedPlayers.map((player, idx) => {
                      const value = values[idx];
                      const isHighest = maxValue !== null && value !== null && value === maxValue;
                      return (
                        <div
                          key={player.id}
                          className={`border-b border-border px-2 py-3 text-sm text-center tabular-nums flex items-center justify-center ${
                            isHighest
                              ? "bg-primary/10 text-primary font-bold"
                              : "text-foreground"
                          }`}
                        >
                          {row.getDisplay(player)}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {detailPlayer && game && (
        <PlayerDetailSheet
          player={detailPlayer}
          teamAbbreviation={detailPlayer.teamAbbreviation}
          gameStatus={game.status}
          recentForm={recentForm.getForm(detailPlayer.id)}
          onClose={() => setDetailPlayer(null)}
          league={game.league}
        />
      )}
    </MobileLayout>
  );
}
