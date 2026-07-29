// Football hub page — live scores wired (Task 1 fix).
//
// Route: /football
//
// Provider: TheSportsDB (free, CORS-open) via providers/football.js
// Data: eventsday.php?s=Soccer — live, upcoming, recently played
//
// Fantasy logic is NOT yet implemented — Task 2.
// Competition sub-pages are NOT yet implemented — gap analysis in docs.

import React, { useEffect, useState, useCallback } from "react";
import { MobileLayout } from "../components/layout";
import { fetchFootballOverview } from "../api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FootballTeam {
  id: string;
  name: string;
  abbreviation: string;
  score: string | null;
}

interface FootballGame {
  id: string;
  leagueId: number | string;
  leagueName: string;
  homeTeam: FootballTeam;
  awayTeam: FootballTeam;
  startTimeIso: string | null;
  status: "scheduled" | "in_progress" | "final";
  venue: string | null;
  result: string | null;
  league: string;
}

interface FootballOverview {
  live: FootballGame[];
  upcoming: FootballGame[];
  lastPlayed: FootballGame | null;
}

interface FootballPageState {
  overview: FootballOverview | null;
  loading: boolean;
  error: string | null;
  lastRefreshed: number | null;
}

// ─── Known competitions (auto-discovery ready) ────────────────────────────────

interface FootballCompetition {
  id: number;
  name: string;
  country: string;
  type: "league" | "cup" | "international";
}

const SEEDED_COMPETITIONS: FootballCompetition[] = [
  { id: 4328, name: "Premier League",             country: "England",       type: "league"        },
  { id: 4335, name: "La Liga",                    country: "Spain",         type: "league"        },
  { id: 4331, name: "Bundesliga",                 country: "Germany",       type: "league"        },
  { id: 4332, name: "Serie A",                    country: "Italy",         type: "league"        },
  { id: 4334, name: "Ligue 1",                    country: "France",        type: "league"        },
  { id: 4530, name: "Eredivisie",                 country: "Netherlands",   type: "league"        },
  { id: 4346, name: "Champions League",           country: "Europe",        type: "cup"           },
  { id: 4337, name: "FA Cup",                     country: "England",       type: "cup"           },
  { id: 4344, name: "FIFA World Cup",             country: "International", type: "international" },
  { id: 4399, name: "UEFA European Championship", country: "International", type: "international" },
];

const TYPE_LABELS: Record<string, string> = {
  league: "Domestic Leagues",
  cup: "Cups & Knockouts",
  international: "International",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtKickoff(isoStr: string | null): string {
  if (!isoStr) return "TBD";
  try {
    return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "TBD";
  }
}

function fmtDate(isoStr: string | null): string {
  if (!isoStr) return "";
  try {
    return new Date(isoStr).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: FootballGame["status"] }) {
  if (status === "in_progress") {
    return (
      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-green-300 bg-green-900/40 border border-green-700/30 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === "final") {
    return (
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/50 bg-muted/20 rounded-full px-2 py-0.5">
        FT
      </span>
    );
  }
  return null;
}

// ─── Type badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    league: "bg-blue-900/30 text-blue-300/70",
    cup: "bg-amber-900/30 text-amber-300/70",
    international: "bg-purple-900/30 text-purple-300/70",
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${colors[type] ?? "bg-muted/30 text-muted-foreground/50"}`}>
      {type}
    </span>
  );
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ game }: { game: FootballGame }) {
  const isLive = game.status === "in_progress";
  const isFinal = game.status === "final";
  const hasScore = game.homeTeam.score != null && game.awayTeam.score != null;

  return (
    <div className={`rounded-xl border px-4 py-3 ${
      isLive
        ? "bg-green-950/30 border-green-700/25"
        : "bg-muted/15 border-border/20"
    }`}>
      {/* League + status row */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] text-muted-foreground/50 truncate max-w-[70%]">
          {game.leagueName}
        </span>
        <StatusPill status={game.status} />
      </div>

      {/* Teams + score */}
      <div className="flex items-center gap-3">
        {/* Home */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold truncate ${isLive ? "text-white" : "text-foreground"}`}>
            {game.homeTeam.name}
          </p>
        </div>

        {/* Score / kickoff */}
        <div className="shrink-0 text-center min-w-[56px]">
          {hasScore ? (
            <span className={`text-lg font-black tabular-nums tracking-tighter ${
              isLive ? "text-green-300" : isFinal ? "text-foreground/80" : "text-muted-foreground/50"
            }`}>
              {game.homeTeam.score} – {game.awayTeam.score}
            </span>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground/50">
              {fmtKickoff(game.startTimeIso)}
            </span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 min-w-0 text-right">
          <p className={`text-sm font-bold truncate ${isLive ? "text-white" : "text-foreground"}`}>
            {game.awayTeam.name}
          </p>
        </div>
      </div>

      {/* Venue / date */}
      {(game.venue || game.startTimeIso) && (
        <p className="text-[10px] text-muted-foreground/35 mt-1.5 truncate">
          {[game.venue, fmtDate(game.startTimeIso)].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  label,
  accentClass,
  children,
}: {
  label: string;
  accentClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <p className={`text-[10px] font-black uppercase tracking-widest px-1 mb-2 ${accentClass}`}>
        {label}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return <div className="h-20 rounded-xl skeleton-shimmer" />;
}

// ─── Competition card ─────────────────────────────────────────────────────────

function CompetitionCard({ comp }: { comp: FootballCompetition }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-muted/20 border border-border/25">
      <div className="w-9 h-9 rounded-xl bg-blue-900/30 flex items-center justify-center text-lg select-none shrink-0">
        ⚽
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{comp.name}</p>
        <p className="text-[10px] text-muted-foreground/50 truncate">{comp.country}</p>
      </div>
      <TypeBadge type={comp.type} />
    </div>
  );
}

function CompetitionList({ competitions }: { competitions: FootballCompetition[] }) {
  const byType = new Map<string, FootballCompetition[]>();
  for (const comp of competitions) {
    if (!byType.has(comp.type)) byType.set(comp.type, []);
    byType.get(comp.type)!.push(comp);
  }
  return (
    <div className="flex flex-col gap-6">
      {(["league", "cup", "international"] as const).map(type => {
        const comps = byType.get(type);
        if (!comps || comps.length === 0) return null;
        return (
          <div key={type}>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400/50 px-1 mb-2">
              {TYPE_LABELS[type]}
            </p>
            <div className="flex flex-col gap-2">
              {comps.map(c => <CompetitionCard key={c.id} comp={c} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FootballPage() {
  const [state, setState] = useState<FootballPageState>({
    overview: null,
    loading: true,
    error: null,
    lastRefreshed: null,
  });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const overview = await fetchFootballOverview() as FootballOverview;
      setState({ overview, loading: false, error: null, lastRefreshed: Date.now() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setState(s => ({ ...s, loading: false, error: msg }));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const { overview, loading, error } = state;
  const live     = overview?.live ?? [];
  const upcoming = overview?.upcoming ?? [];
  const recent   = overview?.lastPlayed ? [overview.lastPlayed] : [];

  const hasMatches = live.length > 0 || upcoming.length > 0 || recent.length > 0;

  return (
    <MobileLayout title="Football" showBack backHref="/">
      <div className="p-4 sm:p-5 pb-12">

        {/* Header */}
        <div className="mb-5 pt-1">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-black tracking-tighter">⚽ Football</h1>
            {!loading && (
              <button
                onClick={load}
                className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors px-2 py-1 rounded-lg bg-muted/20"
              >
                Refresh
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading matches…"
              : error
              ? "Could not load matches"
              : hasMatches
              ? `${live.length} live · ${upcoming.length} upcoming`
              : "No matches in window · Competition list below"}
          </p>
        </div>

        {/* Fantasy notice */}
        <div className="rounded-2xl bg-amber-950/30 border border-amber-700/20 px-4 py-3 mb-5 flex items-start gap-3">
          <span className="text-base select-none shrink-0 mt-0.5">🏗️</span>
          <div>
            <p className="text-xs font-bold text-amber-200/80">Fantasy optimizer coming next</p>
            <p className="text-[10px] text-amber-200/50 leading-relaxed mt-0.5">
              Live scores are wired. Auto Pick, Captain/VC, and formation validation are in progress.
            </p>
          </div>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="flex flex-col gap-2 mb-6">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl bg-red-950/30 border border-red-700/25 px-4 py-3 mb-5">
            <p className="text-xs text-red-300/80 font-semibold">Provider error</p>
            <p className="text-[10px] text-red-300/50 mt-0.5">{error}</p>
          </div>
        )}

        {/* Live now */}
        {!loading && live.length > 0 && (
          <Section label="⚡ Live Now" accentClass="text-green-400/60">
            {live.map(g => <MatchCard key={g.id} game={g} />)}
          </Section>
        )}

        {/* Upcoming */}
        {!loading && upcoming.length > 0 && (
          <Section label="Upcoming" accentClass="text-blue-400/50">
            {upcoming.slice(0, 10).map(g => <MatchCard key={g.id} game={g} />)}
          </Section>
        )}

        {/* Recent result */}
        {!loading && recent.length > 0 && (
          <Section label="Recent Result" accentClass="text-muted-foreground/40">
            {recent.map(g => <MatchCard key={g.id} game={g} />)}
          </Section>
        )}

        {/* No matches in window */}
        {!loading && !error && !hasMatches && (
          <div className="rounded-xl bg-muted/10 border border-border/15 px-4 py-6 text-center mb-5">
            <p className="text-sm font-semibold text-muted-foreground/60">No matches in current window</p>
            <p className="text-[10px] text-muted-foreground/35 mt-1">TheSportsDB returns yesterday / today / tomorrow</p>
          </div>
        )}

        {/* Competition list */}
        <div className="mt-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 px-1 mb-3">
            Supported Competitions
          </p>
          <CompetitionList competitions={SEEDED_COMPETITIONS} />
        </div>

        <div className="mt-8 pt-4 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground/30 text-center">
            Provider: TheSportsDB · eventsday.php?s=Soccer · Fantasy optimizer: Task 2
          </p>
        </div>

      </div>
    </MobileLayout>
  );
}
