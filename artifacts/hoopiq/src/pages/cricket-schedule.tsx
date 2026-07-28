// Cricket Schedule page — dedicated cricket hub.
//
// Route: /cricket
//
// Displays RECENT / TODAY / TOMORROW tabs.
// Groups matches by competition. Auto-discovers all competitions via TheSportsDB.
// No hardcoded league list required — competitions appear automatically.

import React, { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { fetchCricketOverview } from "../api";
import type { CricketGame, CricketLeagueOverview } from "../lib/cricket-types";
import { localDateString, localDateStringFromIso, fmtTime } from "../lib/date-utils";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ game }: { game: CricketGame }) {
  if (game.status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black text-primary bg-primary/10 rounded-full px-2 py-0.5">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
        </span>
        LIVE
      </span>
    );
  }
  if (game.status === "final") {
    return <span className="text-[10px] font-semibold text-muted-foreground/50 bg-muted/30 rounded-full px-2 py-0.5">FT</span>;
  }
  if (game.startTimeIso) {
    const now = Date.now();
    const start = new Date(game.startTimeIso).getTime();
    // Only show "LIVE" if provider confirms in_progress. Never infer from time alone.
    if (start - now < 0 && start - now > -8 * 3600 * 1000) {
      // Match start time has passed but not marked live yet — show as "Starting".
      // -8h matches the provider's upcoming cutoff so no match ever shows a raw
      // past timestamp in the badge. Covers T20 (~3.5h) and ODI (~8h) durations.
      return <span className="text-[10px] font-bold text-amber-400/80">Starting</span>;
    }
    return (
      <span className="text-[10px] font-semibold text-green-400/70">{fmtTime(game.startTimeIso)}</span>
    );
  }
  return <span className="text-[10px] text-muted-foreground/40">TBC</span>;
}

// ─── Format badge ─────────────────────────────────────────────────────────────

function FormatBadge({ format }: { format: string }) {
  const colors: Record<string, string> = {
    T20: "bg-orange-900/40 text-orange-300/80 border-orange-700/30",
    ODI: "bg-blue-900/40 text-blue-300/80 border-blue-700/30",
    Test: "bg-amber-900/40 text-amber-300/80 border-amber-700/30",
    "The Hundred": "bg-purple-900/40 text-purple-300/80 border-purple-700/30",
    T10: "bg-pink-900/40 text-pink-300/80 border-pink-700/30",
  };
  const cls = colors[format] ?? "bg-muted/40 text-muted-foreground/60 border-border/30";
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 border ${cls}`}>
      {format}
    </span>
  );
}

// ─── Cricket match card ───────────────────────────────────────────────────────

function CricketMatchCard({ game }: { game: CricketGame }) {
  const link = `/cricket/${game.competitionSlug}/game/${encodeURIComponent(game.id)}`;
  const isLive = game.status === "in_progress";

  return (
    <Link href={link}>
      <div className={`rounded-xl border transition-all cursor-pointer active:scale-[0.99] ${
        isLive
          ? "border-primary/25 bg-primary/5 hover:bg-primary/8"
          : "border-green-800/20 bg-green-900/6 hover:bg-green-900/12"
      } p-3`}>
        {/* Status + format */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <FormatBadge format={game.format} />
          <StatusBadge game={game} />
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{game.homeTeam.abbreviation}</p>
            <p className="text-[10px] text-muted-foreground/50 truncate">{game.homeTeam.name}</p>
            {game.homeTeam.score && (
              <p className="text-xs font-bold text-green-300 mt-0.5">
                {game.homeTeam.score}
                {game.homeTeam.overs && <span className="text-[10px] text-muted-foreground/50 ml-1">({game.homeTeam.overs})</span>}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <span className="text-[10px] font-semibold text-muted-foreground/30">vs</span>
          </div>

          <div className="flex-1 min-w-0 text-right">
            <p className="text-sm font-bold text-foreground truncate">{game.awayTeam.abbreviation}</p>
            <p className="text-[10px] text-muted-foreground/50 truncate">{game.awayTeam.name}</p>
            {game.awayTeam.score && (
              <p className="text-xs font-bold text-green-300 mt-0.5">
                {game.awayTeam.score}
                {game.awayTeam.overs && <span className="text-[10px] text-muted-foreground/50 ml-1">({game.awayTeam.overs})</span>}
              </p>
            )}
          </div>
        </div>

        {/* Result / venue */}
        {game.result && (
          <p className="text-[10px] text-green-300/60 mt-1.5 truncate">{game.result}</p>
        )}
        {!game.result && game.venue && game.status === "scheduled" && (
          <p className="text-[10px] text-muted-foreground/30 mt-1 truncate">📍 {game.venue}</p>
        )}
        {game.status === "in_progress" && game.statusDetail && (
          <p className="text-[10px] text-primary/60 mt-1 truncate">{game.statusDetail}</p>
        )}
      </div>
    </Link>
  );
}

// ─── Competition group ────────────────────────────────────────────────────────

function CompetitionGroup({ name, games }: { name: string; games: CricketGame[] }) {
  const [expanded, setExpanded] = useState(true);
  const hasLive = games.some(g => g.status === "in_progress");

  return (
    <div className="mb-4">
      <button
        className="flex items-center gap-2 w-full text-left px-1 mb-2 group"
        onClick={() => setExpanded(v => !v)}
      >
        <span className={`text-[10px] font-black uppercase tracking-widest flex-1 ${hasLive ? "text-primary/70" : "text-green-400/50"}`}>
          {name}
        </span>
        {hasLive && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
        )}
        <span className="text-[10px] text-muted-foreground/40 bg-muted/30 rounded-full px-1.5 py-0.5">{games.length}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground/30 transition-transform ${expanded ? "" : "-rotate-90"}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2">
          {games.map(g => <CricketMatchCard key={g.id} game={g} />)}
        </div>
      )}
    </div>
  );
}

// ─── Day tab ──────────────────────────────────────────────────────────────────

// Tab indices: 0 = Recent, 1 = Today, 2 = Tomorrow
// dayOffset mapping: tabIndex - 1  →  -1 = recent, 0 = today, 1 = tomorrow
const DAY_LABELS = ["Recent", "Today", "Tomorrow"];

interface DayTabsProps {
  selectedDay: number; // 0 = recent, 1 = today, 2 = tomorrow, 3 = day after
  onChange: (day: number) => void;
  counts: number[];
  hasLive: boolean[];
}

function DayTabs({ selectedDay, onChange, counts, hasLive }: DayTabsProps) {
  return (
    <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
      {DAY_LABELS.map((label, i) => (
        <button
          key={label}
          onClick={() => onChange(i)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
            selectedDay === i
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground/60 hover:text-foreground/60"
          }`}
        >
          {hasLive[i] && (
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
          )}
          {label}
          {counts[i] > 0 && (
            <span className={`text-[10px] rounded-full px-1.5 ${selectedDay === i ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground/50"}`}>
              {counts[i]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Games for a specific day ─────────────────────────────────────────────────

function DayGames({ overview, dayOffset, loading }: { overview: CricketLeagueOverview | null; dayOffset: number; loading: boolean }) {
  // dayOffset = -1 means "Recent": walk backwards from today to find the most
  // recent date with completed matches, then show ALL matches from that date.
  // dayOffset >= 0 means a calendar day offset from today.

  let dayGames: CricketGame[];

  if (dayOffset === -1) {
    // Recent: find the single most-recent date that has any completed game,
    // then show all games from that date. Identical algorithm to basketball.tsx.
    const completed = overview?.recentCompleted ?? [];
    const latestDate = completed.reduce<string | null>((best, g) => {
      const d = localDateStringFromIso(g.startTimeIso);
      if (!d) return best;
      return best === null || d > best ? d : best;
    }, null);
    dayGames = latestDate
      ? completed.filter(g => localDateStringFromIso(g.startTimeIso) === latestDate)
      : [];
    // recentCompleted is already sorted newest-first from the provider
  } else {
    const targetDate = localDateString(new Date(Date.now() + dayOffset * 86_400_000));

    const allGames: CricketGame[] = [
      ...(overview?.live ?? []),
      ...(overview?.upcoming ?? []),
      ...(dayOffset === 0 ? (overview?.lastPlayed ? [overview.lastPlayed] : []) : []),
    ];

    // Filter to target day (using local date from startTimeIso)
    dayGames = allGames.filter(g => {
      if (!g.startTimeIso) return dayOffset === 0; // no time? show on today only
      return localDateStringFromIso(g.startTimeIso) === targetDate;
    });
  }

  // Sort: for Recent, newest first (already sorted by provider); for other tabs, live first then chronological.
  if (dayOffset !== -1) {
    dayGames.sort((a, b) => {
      if (a.status === "in_progress" && b.status !== "in_progress") return -1;
      if (b.status === "in_progress" && a.status !== "in_progress") return 1;
      return new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime();
    });
  }

  // Group by competition
  const byCompetition = new Map<string, CricketGame[]>();
  for (const g of dayGames) {
    const key = g.competitionName;
    if (!byCompetition.has(key)) byCompetition.set(key, []);
    byCompetition.get(key)!.push(g);
  }

  // Sort competitions: live first, then by count
  const sortedComps = [...byCompetition.entries()].sort((a, b) => {
    const aLive = a[1].some(g => g.status === "in_progress") ? 1 : 0;
    const bLive = b[1].some(g => g.status === "in_progress") ? 1 : 0;
    if (bLive !== aLive) return bLive - aLive;
    return b[1].length - a[1].length;
  });

  if (loading) {
    return (
      <div className="flex flex-col gap-2 mt-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl skeleton-shimmer" />)}
      </div>
    );
  }

  if (sortedComps.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-2xl mb-3">🏏</p>
        <p className="text-sm font-semibold text-muted-foreground/60">No cricket scheduled</p>
        <p className="text-xs text-muted-foreground/40 mt-1">
          {dayOffset === -1 ? "No completed matches found" :
           dayOffset === 0 ? "Check back throughout the day" : "Nothing found for this date"}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {sortedComps.map(([name, games]) => (
        <CompetitionGroup key={name} name={name} games={games} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CricketSchedule() {
  const [overview, setOverview] = useState<CricketLeagueOverview | null>(null);
  const [loading, setLoading] = useState(true);
  // Default to Today (tab index 1), not Recent
  const [selectedDay, setSelectedDay] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetchCricketOverview().then(d => {
      if (!cancelled) {
        setOverview(d as CricketLeagueOverview);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Compute per-tab counts for badges.
  // Tab 0 = Recent, Tab 1 = Today (offset 0), Tab 2 = Tomorrow (offset 1)
  const recentCount = (() => {
    const completed = overview?.recentCompleted ?? [];
    const latestDate = completed.reduce<string | null>((best, g) => {
      const d = localDateStringFromIso(g.startTimeIso);
      if (!d) return best;
      return best === null || d > best ? d : best;
    }, null);
    return latestDate ? completed.filter(g => localDateStringFromIso(g.startTimeIso) === latestDate).length : 0;
  })();

  const counts = [
    recentCount,
    ...[0, 1].map(offset => {
      const targetDate = localDateString(new Date(Date.now() + offset * 86_400_000));
      const all = [
        ...(overview?.live ?? []),
        ...(overview?.upcoming ?? []),
      ];
      return all.filter(g => g.startTimeIso && localDateStringFromIso(g.startTimeIso) === targetDate).length;
    }),
  ];

  // hasLive: only Today (tab 1) can have live matches
  const hasLive = [false, (overview?.live.length ?? 0) > 0, false];

  const liveCount = overview?.live.length ?? 0;
  const activeCompCount = overview?.activeCompetitions.length ?? 0;

  return (
    <MobileLayout title="Cricket" showBack backHref="/">
      <div className="p-4 sm:p-5 pb-12">
        {/* Header */}
        <div className="mb-4 pt-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black tracking-tighter">🏏 Cricket</h1>
            {liveCount > 0 && (
              <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                {liveCount} LIVE
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Discovering competitions…"
              : activeCompCount > 0
              ? `${activeCompCount} active competition${activeCompCount !== 1 ? "s" : ""} · Auto-discovered`
              : "All T20, ODI, Test competitions"}
          </p>
        </div>

        {/* Day tabs */}
        <DayTabs
          selectedDay={selectedDay}
          onChange={setSelectedDay}
          counts={counts}
          hasLive={hasLive}
        />

        {/* Games for selected day */}
        <DayGames
          overview={overview}
          dayOffset={selectedDay - 1}
          loading={loading}
        />

        {/* Provider note */}
        {!loading && (
          <div className="mt-6 pt-4 border-t border-border/20">
            <p className="text-[10px] text-muted-foreground/30 text-center">
              Data: TheSportsDB · Free tier · Competitions auto-discovered
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
