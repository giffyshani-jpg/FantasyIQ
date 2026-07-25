// Home page — HoopIQ multi-sport hub.
//
// Layout:
//   ① LIVE NOW banner  — shown when any sport has live games
//   ② NBA card         — premium basketball card
//   ③ WNBA card        — premium basketball card
//   ④ Cricket section  — auto-discovered competitions (TheSportsDB)
//
// Note: "Other Basketball" (NBL, NZ NBL, FIBA, Summer) has been removed.
// NBA and WNBA are the only basketball leagues shown on the home page.

import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { GameCard } from "../components/game-card";
import {
  LEAGUE_CONFIGS,
  fetchLeagueOverview,
  fetchCricketOverview,
} from "../api";
import { Game, LeagueKey, LeagueOverview } from "../lib/types";
import type { CricketGame, CricketLeagueOverview } from "../lib/cricket-types";

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronRight({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function fmtTime(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(isoString));
  } catch { return ""; }
}

/**
 * True if the game is actually happening "soon" (within 48 h) or is live/recent.
 * Used to filter NBA/WNBA to prevent showing pre-season games months away on
 * the home page — ESPN's scoreboard returns the next scheduled event even when
 * it's far in the future when no games are currently active.
 */
function isGameSoon(game: Game): boolean {
  if (game.status === "in_progress" || game.status === "final") return true;
  if (!game.startTimeIso) return false;
  const diff = new Date(game.startTimeIso).getTime() - Date.now();
  return diff < 48 * 3600 * 1000 && diff > -6 * 3600 * 1000;
}

// ─── LIVE NOW banner ─────────────────────────────────────────────────────────

function LiveNowBanner({ liveGames }: { liveGames: Game[] }) {
  if (liveGames.length === 0) return null;
  return (
    <div className="rounded-2xl overflow-hidden border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
        </span>
        <h2 className="text-sm font-black uppercase tracking-widest text-primary">Live Now</h2>
        <span className="ml-auto text-xs font-semibold text-muted-foreground/60 bg-muted/40 rounded-full px-2 py-0.5">
          {liveGames.length} {liveGames.length === 1 ? "game" : "games"}
        </span>
      </div>
      <div className="flex flex-col gap-2 px-3 pb-3">
        {liveGames.slice(0, 3).map((g) => <GameCard key={g.id} game={g} showLeague />)}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PremiumCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-full skeleton-shimmer" />
          <div className="h-7 w-24 rounded-lg skeleton-shimmer" />
        </div>
        <div className="h-3 w-36 rounded-full skeleton-shimmer mb-2" />
        <div className="h-4 w-20 rounded-full skeleton-shimmer" />
      </div>
    </div>
  );
}

// ─── Premium league card (NBA / WNBA) ────────────────────────────────────────

function PremiumLeagueCard({
  leagueKey,
  overview,
  loading,
  emoji,
}: {
  leagueKey: LeagueKey;
  overview: LeagueOverview | null;
  loading: boolean;
  emoji: string;
}) {
  const cfg = LEAGUE_CONFIGS[leagueKey];
  if (!cfg) return null;

  if (loading) return <PremiumCardSkeleton />;

  const live = overview?.live ?? [];
  const allUpcoming = overview?.upcoming ?? [];

  // Only show game cards for games actually happening within 48 h
  const soonUpcoming = allUpcoming.filter(isGameSoon);
  const inlineGames: Game[] = [...live, ...soonUpcoming];

  // Determine status text shown under the league name
  let statusText: string;
  let nextGameDate: string | null = null;
  if (live.length > 0) {
    statusText = `${live.length} live${soonUpcoming.length > 0 ? ` · ${soonUpcoming.length} upcoming` : ""}`;
  } else if (soonUpcoming.length > 0) {
    statusText = `${soonUpcoming.length} upcoming today`;
  } else if (allUpcoming.length > 0) {
    // There are future games but not soon
    nextGameDate = allUpcoming[0].startTimeIso ?? null;
    const dateLabel = relativeDate(nextGameDate);
    statusText = `Next game: ${dateLabel || fmtTime(nextGameDate)}`;
  } else if (overview?.lastPlayed) {
    statusText = `Last played: ${relativeDate(overview.lastPlayed.startTimeIso)}`;
  } else {
    statusText = "No games scheduled";
  }

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${cfg.gradient} border border-white/8 shadow-lg overflow-hidden`}>
      <Link href={`/${leagueKey}`}>
        <div className="flex items-start justify-between p-5 sm:p-6 cursor-pointer group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-2xl leading-none select-none">{emoji}</span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-white">{cfg.name}</h2>
              {live.length > 0 && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              )}
            </div>
            <p className={`text-xs ${cfg.textLight} opacity-60 mb-1.5`}>{cfg.description}</p>
            <p className="text-xs font-medium text-foreground/60">{statusText}</p>
          </div>
          <span className="text-white/25 group-hover:text-white/50 transition-colors shrink-0 ml-3 mt-1">
            <ChevronRight />
          </span>
        </div>
      </Link>

      {/* Game cards — only when games are within 48 h */}
      {inlineGames.length > 0 && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="flex flex-col gap-2">
            {inlineGames.slice(0, 3).map((g) => <GameCard key={g.id} game={g} />)}
          </div>
          {allUpcoming.length > 3 && (
            <Link href={`/${leagueKey}`}>
              <div className="text-center text-xs font-semibold text-white/40 hover:text-white/70 transition-colors py-2 mt-2 rounded-xl border border-white/10 border-dashed hover:border-white/20">
                +{allUpcoming.length - 3} more
              </div>
            </Link>
          )}
        </div>
      )}

      {/* No games today — show next game date if available */}
      {inlineGames.length === 0 && nextGameDate && (
        <div className="px-5 pb-4">
          <p className="text-xs text-white/30 text-center">
            Season starts {relativeDate(nextGameDate) || fmtTime(nextGameDate)}
            {nextGameDate ? ` · ${new Date(nextGameDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}
          </p>
        </div>
      )}

      {/* No games, no future games — show last played */}
      {inlineGames.length === 0 && !nextGameDate && overview?.lastPlayed && (
        <div className="px-5 pb-4">
          <Link href={`/${leagueKey}`}>
            <p className={`text-xs font-bold ${cfg.accent} hover:opacity-80 transition-opacity text-center`}>
              View last played →
            </p>
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Cricket status badge ─────────────────────────────────────────────────────

function CricketStatusBadge({ game }: { game: CricketGame }) {
  if (game.status === "in_progress") {
    return (
      <div className="flex items-center gap-1">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
        </span>
        <span className="text-[10px] font-black text-primary">LIVE</span>
      </div>
    );
  }
  if (game.status === "final") {
    return <span className="text-[10px] font-bold text-muted-foreground/50">FT</span>;
  }

  // Scheduled — show date/time
  if (game.startTimeIso) {
    const now = Date.now();
    const start = new Date(game.startTimeIso).getTime();
    const diff = start - now;
    if (diff < 0) {
      return <span className="text-[10px] font-bold text-amber-400">NOW</span>;
    }
    const dateLabel = relativeDate(game.startTimeIso);
    if (dateLabel === "Today") {
      return <span className="text-[10px] font-bold text-green-400/80">{fmtTime(game.startTimeIso)}</span>;
    }
    return <span className="text-[10px] font-semibold text-muted-foreground/50">{dateLabel}</span>;
  }
  return <span className="text-[10px] text-muted-foreground/40">Upcoming</span>;
}

// ─── Cricket game card ────────────────────────────────────────────────────────

function CricketGameCard({ game }: { game: CricketGame }) {
  const link = `/cricket/${game.competitionSlug}/game/${encodeURIComponent(game.id)}`;

  return (
    <Link href={link}>
      <div className={`rounded-xl border ${game.status === "in_progress" ? "border-primary/30 bg-primary/5" : "border-green-800/25 bg-green-900/8"} hover:bg-green-900/20 transition-colors p-3 cursor-pointer`}>
        {/* Competition name + badge */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-green-400/60 truncate flex-1">
            {game.competitionName}
          </span>
          <div className="flex-shrink-0">
            <CricketStatusBadge game={game} />
          </div>
        </div>

        {/* Teams + scores */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{game.homeTeam.abbreviation}</p>
            <p className="text-[10px] text-muted-foreground/50 truncate">{game.homeTeam.name}</p>
            {game.homeTeam.score && (
              <p className="text-xs font-bold text-green-300 mt-0.5">{game.homeTeam.score}</p>
            )}
          </div>

          <div className="text-xs text-muted-foreground/30 flex-shrink-0 font-medium">vs</div>

          <div className="flex-1 min-w-0 text-right">
            <p className="text-sm font-bold text-foreground truncate">{game.awayTeam.abbreviation}</p>
            <p className="text-[10px] text-muted-foreground/50 truncate">{game.awayTeam.name}</p>
            {game.awayTeam.score && (
              <p className="text-xs font-bold text-green-300 mt-0.5">{game.awayTeam.score}</p>
            )}
          </div>
        </div>

        {/* Result */}
        {game.result && (
          <p className="text-[10px] text-green-300/50 mt-1.5 truncate">{game.result}</p>
        )}
        {game.venue && !game.result && game.status === "scheduled" && (
          <p className="text-[10px] text-muted-foreground/35 mt-1 truncate">📍 {game.venue}</p>
        )}
      </div>
    </Link>
  );
}

// ─── Cricket competition group ────────────────────────────────────────────────

function CricketCompetitionGroup({
  name,
  games,
  maxShown = 3,
}: {
  name: string;
  games: CricketGame[];
  maxShown?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? games : games.slice(0, maxShown);
  const more = games.length - maxShown;

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-green-400/50 px-1 mb-1.5">{name}</p>
      <div className="flex flex-col gap-2">
        {shown.map((g) => <CricketGameCard key={g.id} game={g} />)}
      </div>
      {!showAll && more > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full text-center text-xs text-green-400/40 hover:text-green-400/70 transition-colors py-2 mt-1"
        >
          +{more} more in this competition
        </button>
      )}
    </div>
  );
}

// ─── Cricket section ──────────────────────────────────────────────────────────

function CricketSection({
  overview,
  loading,
}: {
  overview: CricketLeagueOverview | null;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const liveCount = overview?.live.length ?? 0;
  const upcomingCount = overview?.upcoming.length ?? 0;
  const totalGames = liveCount + upcomingCount;
  const competitionCount = overview?.activeCompetitions.length ?? 0;

  let summaryText: string;
  if (loading) {
    summaryText = "Loading…";
  } else if (liveCount > 0) {
    summaryText = `${liveCount} live · ${upcomingCount} upcoming`;
  } else if (upcomingCount > 0) {
    summaryText = `${upcomingCount} upcoming`;
    if (competitionCount > 0) summaryText += ` · ${competitionCount} competition${competitionCount !== 1 ? "s" : ""}`;
  } else if (overview?.lastPlayed) {
    summaryText = `Last: ${relativeDate(overview.lastPlayed.startTimeIso)}`;
  } else {
    summaryText = "Checking providers…";
  }

  // Group games by competition for cleaner display
  const allDisplayGames: CricketGame[] = [
    ...(overview?.live ?? []),
    ...(overview?.upcoming ?? []).slice(0, 12),
  ];

  const byCompetition = new Map<string, CricketGame[]>();
  for (const g of allDisplayGames) {
    const key = g.competitionName;
    if (!byCompetition.has(key)) byCompetition.set(key, []);
    byCompetition.get(key)!.push(g);
  }

  // Sort: competitions with live games first, then by number of games
  const sortedCompetitions = [...byCompetition.entries()].sort((a, b) => {
    const aHasLive = a[1].some(g => g.status === "in_progress") ? 1 : 0;
    const bHasLive = b[1].some(g => g.status === "in_progress") ? 1 : 0;
    if (bHasLive !== aHasLive) return bHasLive - aHasLive;
    return b[1].length - a[1].length;
  });

  return (
    <div className="rounded-2xl bg-gradient-to-br from-green-950/90 to-slate-900 border border-green-800/30 shadow-lg overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between p-4 sm:p-5 group"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none select-none">🏏</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-white leading-tight">Cricket</h2>
              {liveCount > 0 && (
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                </span>
              )}
            </div>
            <p className="text-xs text-green-400/60 mt-0.5">{summaryText}</p>
          </div>
        </div>
        <span className="text-white/25 group-hover:text-white/50 transition-colors shrink-0">
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-green-800/20">
          {loading ? (
            <div className="flex flex-col gap-2 p-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}
            </div>
          ) : sortedCompetitions.length > 0 ? (
            <div className="flex flex-col gap-4 p-3">
              {sortedCompetitions.map(([name, games]) => (
                <CricketCompetitionGroup key={name} name={name} games={games} />
              ))}
            </div>
          ) : overview?.lastPlayed ? (
            <div className="p-3">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2 px-1">Last Played</p>
              <CricketGameCard game={overview.lastPlayed} />
            </div>
          ) : (
            <div className="py-6 px-4 text-center">
              <p className="text-sm text-muted-foreground/60">Checking cricket providers…</p>
              <p className="text-xs text-muted-foreground/40 mt-1">
                TheSportsDB · Querying {17} competition leagues
              </p>
            </div>
          )}

          {/* Provider info */}
          {!loading && (
            <div className="border-t border-green-800/15 px-4 py-2 flex items-center justify-between">
              <span className="text-[9px] text-green-400/30 uppercase tracking-wider">
                Data: TheSportsDB · Free tier · No live scores
              </span>
              {competitionCount > 0 && (
                <span className="text-[10px] text-green-400/40">
                  {competitionCount} active
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

function PageHeader({
  totalLive,
  totalUpcoming,
  anyLoading,
}: {
  totalLive: number;
  totalUpcoming: number;
  anyLoading: boolean;
}) {
  const now = new Date();
  const dayLabel = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  let subtext: string;
  if (anyLoading) {
    subtext = "Loading…";
  } else if (totalLive > 0) {
    subtext = `${totalLive} game${totalLive !== 1 ? "s" : ""} in progress`;
    if (totalUpcoming > 0) subtext += ` · ${totalUpcoming} upcoming`;
  } else if (totalUpcoming > 0) {
    subtext = `${totalUpcoming} game${totalUpcoming !== 1 ? "s" : ""} upcoming today`;
  } else {
    subtext = "No games in progress right now";
  }

  return (
    <div className="pt-2 sm:pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tighter">Today's Games</h1>
        <span className="text-xs text-muted-foreground/50 shrink-0">{dayLabel}</span>
      </div>
      <p className="text-muted-foreground text-sm mt-1">{subtext}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [nbaOverview, setNbaOverview] = useState<LeagueOverview | null>(null);
  const [wnbaOverview, setWnbaOverview] = useState<LeagueOverview | null>(null);
  const [nbaLoading, setNbaLoading] = useState(true);
  const [wnbaLoading, setWnbaLoading] = useState(true);

  const [cricketOverview, setCricketOverview] = useState<CricketLeagueOverview | null>(null);
  const [cricketLoading, setCricketLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Basketball — scan:false means we only look at yesterday/today/tomorrow
    // (no 180-day forward scan that would return pre-season games months away)
    fetchLeagueOverview("nba", { scan: false }).then(d => {
      if (!cancelled) { setNbaOverview(d as LeagueOverview); setNbaLoading(false); }
    }).catch(() => { if (!cancelled) setNbaLoading(false); });

    fetchLeagueOverview("wnba", { scan: false }).then(d => {
      if (!cancelled) { setWnbaOverview(d as LeagueOverview); setWnbaLoading(false); }
    }).catch(() => { if (!cancelled) setWnbaLoading(false); });

    // Cricket — multi-source (TheSportsDB day-based + per-league)
    fetchCricketOverview().then(d => {
      if (!cancelled) { setCricketOverview(d as CricketLeagueOverview); setCricketLoading(false); }
    }).catch(() => { if (!cancelled) setCricketLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // Live NOW banner — both basketball and cricket
  const liveBasketball = [
    ...(nbaOverview?.live ?? []),
    ...(wnbaOverview?.live ?? []),
  ];

  // Count "soon" upcoming games for the header summary
  const allSoonUpcoming = [
    ...(nbaOverview?.upcoming ?? []).filter(isGameSoon),
    ...(wnbaOverview?.upcoming ?? []).filter(isGameSoon),
    ...(cricketOverview?.upcoming ?? []),
  ];

  const totalLive = liveBasketball.length + (cricketOverview?.live.length ?? 0);
  const totalUpcoming = allSoonUpcoming.length;
  const anyLoading = nbaLoading || wnbaLoading || cricketLoading;

  return (
    <MobileLayout>
      <div className="p-4 sm:p-5 flex flex-col gap-3.5 pb-12">
        <PageHeader totalLive={totalLive} totalUpcoming={totalUpcoming} anyLoading={anyLoading} />

        {/* Live NOW banner (basketball only — cricket section shows its own live status) */}
        {!anyLoading && liveBasketball.length > 0 && (
          <LiveNowBanner liveGames={liveBasketball} />
        )}

        {/* NBA */}
        <PremiumLeagueCard
          leagueKey="nba"
          overview={nbaOverview}
          loading={nbaLoading}
          emoji="🏀"
        />

        {/* WNBA */}
        <PremiumLeagueCard
          leagueKey="wnba"
          overview={wnbaOverview}
          loading={wnbaLoading}
          emoji="🏀"
        />

        {/* Cricket — TheSportsDB auto-discovery */}
        <CricketSection overview={cricketOverview} loading={cricketLoading} />

        {/* Footer */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <p className="text-[10px] text-muted-foreground/35 text-center">
            ESPN (NBA/WNBA) · TheSportsDB (Cricket)
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}
