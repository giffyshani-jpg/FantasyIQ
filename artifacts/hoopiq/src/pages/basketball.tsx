// Basketball hub page — NBA + WNBA in one screen.
//
// Route: /basketball
//
// Shows NBA and WNBA as separate sub-sections, each with their own
// date navigator and game list. When no games today, shows the actual
// next scheduled game date — never fake upcoming games.

import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { GameCard } from "../components/game-card";
import { fetchLeagueOverview, fetchGamesByLeagueAndLocalDate, LEAGUE_CONFIGS } from "../api";
import { Game, LeagueKey, LeagueOverview } from "../lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateKey(date: Date): string {
  // Use LOCAL date so the date navigator matches the user's calendar day,
  // not UTC. Without this, IST users (UTC+5:30) see the wrong day's games.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function relativeDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const tom = new Date(now.getTime() + 86_400_000);
    if (d.toDateString() === tom.toDateString()) return "Tomorrow";
    const yest = new Date(now.getTime() - 86_400_000);
    if (d.toDateString() === yest.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch { return ""; }
}

function fmtDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function isGameSoon(game: Game): boolean {
  if (game.status === "in_progress" || game.status === "final") return true;
  if (!game.startTimeIso) return false;
  const diff = new Date(game.startTimeIso).getTime() - Date.now();
  return diff < 48 * 3600 * 1000 && diff > -6 * 3600 * 1000;
}

// ─── Live dot ─────────────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LeagueSectionSkeleton() {
  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl skeleton-shimmer" />
        <div className="flex-1">
          <div className="h-5 w-20 rounded-lg skeleton-shimmer mb-1.5" />
          <div className="h-3 w-32 rounded-full skeleton-shimmer" />
        </div>
      </div>
      <div className="px-3 pb-3 flex flex-col gap-2">
        {[1, 2].map(i => (
          <div key={i} className="h-16 rounded-xl skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}

// ─── Date navigator ───────────────────────────────────────────────────────────

interface DateNavProps {
  offset: number;
  onChange: (offset: number) => void;
}

function DateNav({ offset, onChange }: DateNavProps) {
  const now = new Date();
  const date = new Date(now.getTime() + offset * 86_400_000);

  const displayLabel =
    offset === -1 ? "Yesterday" :
    offset === 0  ? "Today"     :
    offset === 1  ? "Tomorrow"  :
    fmtDisplayDate(date);

  return (
    <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
      <button
        onClick={() => onChange(offset - 1)}
        disabled={offset <= -3}
        className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors disabled:opacity-30 active:scale-95"
        aria-label="Previous day"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <span className="text-xs font-semibold text-foreground/80 min-w-[72px] text-center">{displayLabel}</span>
      <button
        onClick={() => onChange(offset + 1)}
        disabled={offset >= 3}
        className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors disabled:opacity-30 active:scale-95"
        aria-label="Next day"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}

// ─── League section ───────────────────────────────────────────────────────────

interface LeagueSectionProps {
  leagueKey: LeagueKey;
  emoji: string;
  overview: LeagueOverview | null;
  overviewLoading: boolean;
}

function LeagueSection({ leagueKey, emoji, overview, overviewLoading }: LeagueSectionProps) {
  const cfg = LEAGUE_CONFIGS[leagueKey];
  const [offset, setOffset] = useState(0);
  const [games, setGames] = useState<Game[] | null>(null);
  const [gamesLoading, setGamesLoading] = useState(false);

  // When offset changes, fetch games for that day
  useEffect(() => {
    const date = new Date(Date.now() + offset * 86_400_000);
    const dateKey = formatDateKey(date);
    setGamesLoading(true);
    setGames(null);

    fetchGamesByLeagueAndLocalDate(leagueKey, dateKey)
      .then((g: Game[]) => setGames(g))
      .catch(() => setGames([]))
      .finally(() => setGamesLoading(false));
  }, [leagueKey, offset]);

  if (overviewLoading) return <LeagueSectionSkeleton />;

  const live = overview?.live ?? [];
  const allUpcoming = overview?.upcoming ?? [];
  const soonUpcoming = allUpcoming.filter(isGameSoon);

  // For the header status summary (based on overview, not selected day)
  let headerStatus: React.ReactNode;
  if (live.length > 0) {
    headerStatus = (
      <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
        <LiveDot />
        {live.length} live
        {soonUpcoming.length > 0 && ` · ${soonUpcoming.length} upcoming`}
      </span>
    );
  } else if (soonUpcoming.length > 0) {
    headerStatus = (
      <span className="text-xs font-semibold text-muted-foreground/70">
        {soonUpcoming.length} upcoming today
      </span>
    );
  } else if (allUpcoming.length > 0) {
    // Off-season / future game
    const nextDate = allUpcoming[0].startTimeIso;
    const label = relativeDate(nextDate);
    const fullDate = nextDate ? new Date(nextDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "";
    headerStatus = (
      <span className="text-xs text-muted-foreground/60">
        Next scheduled: {label || fullDate}
        {label && fullDate ? ` · ${fullDate}` : ""}
      </span>
    );
  } else if (overview?.lastPlayed) {
    headerStatus = (
      <span className="text-xs text-muted-foreground/50">
        Last played: {relativeDate(overview.lastPlayed.startTimeIso)}
      </span>
    );
  } else if (!cfg?.active) {
    headerStatus = <span className="text-xs text-muted-foreground/40">Off-season</span>;
  } else {
    headerStatus = <span className="text-xs text-muted-foreground/40">No scheduled games</span>;
  }

  // Games to show for the selected date
  const selectedDateGames: Game[] = games ?? [];
  const isOffSeason = !cfg?.active && live.length === 0 && soonUpcoming.length === 0;

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${cfg?.gradient ?? "from-slate-900 to-slate-900"} border border-white/8 overflow-hidden shadow`}>
      {/* Header */}
      <Link href={`/${leagueKey}`}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 cursor-pointer group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-xl select-none shrink-0">
              {emoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">{cfg?.name ?? leagueKey.toUpperCase()}</h2>
                {live.length > 0 && <LiveDot />}
              </div>
              <div className="mt-0.5">{headerStatus}</div>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/25 group-hover:text-white/50 transition-colors shrink-0">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </Link>

      {/* Date navigator + games (only when not confirmed off-season) */}
      {!isOffSeason && (
        <div className="border-t border-white/8 px-3 py-3">
          <div className="flex items-center justify-between mb-3">
            <DateNav offset={offset} onChange={setOffset} />
          </div>

          {gamesLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2].map(i => <div key={i} className="h-14 rounded-xl skeleton-shimmer" />)}
            </div>
          ) : selectedDateGames.length > 0 ? (
            <div className="flex flex-col gap-2">
              {selectedDateGames.map(g => <GameCard key={g.id} game={g} />)}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-xs text-white/30">No games scheduled</p>
            </div>
          )}
        </div>
      )}

      {/* Off-season message */}
      {isOffSeason && allUpcoming.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs text-white/25 text-center">
            Season starts {relativeDate(allUpcoming[0].startTimeIso) || new Date(allUpcoming[0].startTimeIso ?? "").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BasketballPage() {
  const [nbaOverview, setNbaOverview] = useState<LeagueOverview | null>(null);
  const [wnbaOverview, setWnbaOverview] = useState<LeagueOverview | null>(null);
  const [nbaLoading, setNbaLoading] = useState(true);
  const [wnbaLoading, setWnbaLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchLeagueOverview("nba", { scan: false }).then(d => {
      if (!cancelled) { setNbaOverview(d as LeagueOverview); setNbaLoading(false); }
    }).catch(() => { if (!cancelled) setNbaLoading(false); });

    fetchLeagueOverview("wnba", { scan: false }).then(d => {
      if (!cancelled) { setWnbaOverview(d as LeagueOverview); setWnbaLoading(false); }
    }).catch(() => { if (!cancelled) setWnbaLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const totalLive = (nbaOverview?.live.length ?? 0) + (wnbaOverview?.live.length ?? 0);

  return (
    <MobileLayout title="Basketball" showBack backHref="/">
      <div className="p-4 sm:p-5 flex flex-col gap-4 pb-12">
        {/* Page headline */}
        <div className="pt-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tighter">🏀 Basketball</h1>
            {totalLive > 0 && (
              <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                {totalLive} LIVE
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">NBA & WNBA — live scores and schedules</p>
        </div>

        {/* NBA section */}
        <LeagueSection
          leagueKey="nba"
          emoji="🏀"
          overview={nbaOverview}
          overviewLoading={nbaLoading}
        />

        {/* WNBA section */}
        <LeagueSection
          leagueKey="wnba"
          emoji="🏀"
          overview={wnbaOverview}
          overviewLoading={wnbaLoading}
        />

        {/* Other basketball leagues link */}
        <div className="rounded-2xl border border-border/30 border-dashed p-4">
          <p className="text-xs font-semibold text-muted-foreground/50 mb-2">More Basketball</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "nbl", label: "Australian NBL" },
              { key: "nznbl", label: "NZ NBL" },
              { key: "fiba", label: "FIBA" },
              { key: "nba-summer", label: "NBA Summer" },
            ].map(({ key, label }) => (
              <Link key={key} href={`/${key}`}>
                <span className="inline-flex text-xs font-semibold text-muted-foreground/60 hover:text-foreground/80 bg-muted/40 hover:bg-muted/60 rounded-full px-3 py-1.5 transition-colors cursor-pointer">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/30 text-center">Data: ESPN Site API</p>
      </div>
    </MobileLayout>
  );
}
