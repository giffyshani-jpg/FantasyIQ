// Basketball hub page — NBA + WNBA in one screen.
//
// Route: /basketball
//
// Redesigned to match Cricket UI:
//   - Shared day tabs (Today / Tomorrow / Day After) at page level
//   - Flat competition-group section headers (collapsible, count badge, live dot)
//   - Same card style, spacing, and animations as cricket-schedule.tsx
//
// Data and provider logic unchanged from prior implementation.

import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { GameCard } from "../components/game-card";
import { fetchLeagueOverview, fetchGamesByLeagueAndLocalDate, LEAGUE_CONFIGS } from "../api";
import { Game, LeagueKey, LeagueOverview } from "../lib/types";
import {
  localDateKey,
  localDateString,
  localDayOffset,
  relativeDate,
} from "../lib/date-utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isGameSoon(game: Game): boolean {
  if (game.status === "in_progress" || game.status === "final") return true;
  if (!game.startTimeIso) return false;
  const diff = new Date(game.startTimeIso).getTime() - Date.now();
  return diff < 48 * 3600 * 1000 && diff > -6 * 3600 * 1000;
}

// ─── Day tabs — identical design to cricket DayTabs ───────────────────────────

const DAY_LABELS = ["Today", "Tomorrow", "Day After"];

interface DayTabsProps {
  selected: number; // 0 = Today, 1 = Tomorrow, 2 = Day After
  onChange: (i: number) => void;
  counts: number[];
  hasLive: boolean[];
}

function DayTabs({ selected, onChange, counts, hasLive }: DayTabsProps) {
  return (
    <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
      {DAY_LABELS.map((label, i) => (
        <button
          key={label}
          onClick={() => onChange(i)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
            selected === i
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
            <span
              className={`text-[10px] rounded-full px-1.5 ${
                selected === i
                  ? "bg-primary/15 text-primary"
                  : "bg-muted/50 text-muted-foreground/50"
              }`}
            >
              {counts[i]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── League section — matches cricket CompetitionGroup design ─────────────────

interface LeagueSectionProps {
  leagueKey: LeagueKey;
  label: string;
  overview: LeagueOverview | null;
  overviewLoading: boolean;
  games: Game[] | null;
  gamesLoading: boolean;
  dayOffset: number; // 0 = today, 1 = tomorrow, 2 = day after
}

function LeagueSection({
  leagueKey,
  label,
  overview,
  overviewLoading,
  games,
  gamesLoading,
  dayOffset,
}: LeagueSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const live = overview?.live ?? [];
  const hasLive = live.length > 0;
  const allUpcoming = overview?.upcoming ?? [];
  const soonUpcoming = allUpcoming.filter(isGameSoon);
  const gameCount = games?.length ?? 0;

  // suppress unused-variable warning — leagueKey used via LEAGUE_CONFIGS
  void LEAGUE_CONFIGS[leagueKey];

  if (overviewLoading) {
    return (
      <div className="mb-4">
        <div className="h-6 w-16 rounded-lg skeleton-shimmer mb-2" />
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  // Next game label shown in empty state
  const nextGameLabel = (() => {
    if (allUpcoming.length === 0) return null;
    const first = allUpcoming[0];
    const rel = relativeDate(first.startTimeIso);
    const full = first.startTimeIso
      ? new Date(first.startTimeIso).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "";
    return rel && rel !== "Today" && rel !== "Tomorrow" ? `${rel} · ${full}` : full;
  })();

  return (
    <div className="mb-4">
      {/* Section header — same pattern as cricket's CompetitionGroup */}
      <button
        className="flex items-center gap-2 w-full text-left px-1 mb-2 group"
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          className={`text-[10px] font-black uppercase tracking-widest flex-1 ${
            hasLive ? "text-primary/70" : "text-orange-400/50"
          }`}
        >
          {label}
        </span>

        {/* Live pulse indicator */}
        {hasLive && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
        )}

        {/* Live / upcoming badge */}
        {hasLive && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
            {live.length} LIVE
          </span>
        )}
        {!hasLive && soonUpcoming.length > 0 && (
          <span className="text-[10px] text-muted-foreground/50 bg-muted/30 rounded-full px-1.5 py-0.5">
            {soonUpcoming.length} upcoming
          </span>
        )}

        {/* Game count pill */}
        <span className="text-[10px] text-muted-foreground/40 bg-muted/30 rounded-full px-1.5 py-0.5">
          {gameCount}
        </span>

        {/* Expand / collapse chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-muted-foreground/30 transition-transform ${expanded ? "" : "-rotate-90"}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2">
          {gamesLoading ? (
            [1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl skeleton-shimmer" />
            ))
          ) : games && games.length > 0 ? (
            games.map((g) => <GameCard key={g.id} game={g} />)
          ) : (
            <div className="py-8 text-center">
              <p className="text-2xl mb-2">🏀</p>
              <p className="text-sm font-semibold text-muted-foreground/60">
                No {label} games{dayOffset === 0 ? " today" : dayOffset === 1 ? " tomorrow" : " this day"}
              </p>
              {nextGameLabel && (
                <p className="text-xs text-muted-foreground/40 mt-1">
                  Next scheduled: {nextGameLabel}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BasketballPage() {
  // Shared day-tab state: 0 = Today, 1 = Tomorrow, 2 = Day After
  const [selected, setSelected] = useState(0);

  // Overview state (fetched once)
  const [nbaOverview, setNbaOverview] = useState<LeagueOverview | null>(null);
  const [wnbaOverview, setWnbaOverview] = useState<LeagueOverview | null>(null);
  const [nbaLoading, setNbaLoading] = useState(true);
  const [wnbaLoading, setWnbaLoading] = useState(true);

  // Games for selected day
  const [nbaGames, setNbaGames] = useState<Game[] | null>(null);
  const [wnbaGames, setWnbaGames] = useState<Game[] | null>(null);
  const [nbaGamesLoading, setNbaGamesLoading] = useState(false);
  const [wnbaGamesLoading, setWnbaGamesLoading] = useState(false);

  // Fetch overviews once on mount
  useEffect(() => {
    let cancelled = false;

    fetchLeagueOverview("nba", { scan: false })
      .then((d) => {
        if (!cancelled) {
          setNbaOverview(d as LeagueOverview);
          setNbaLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setNbaLoading(false);
      });

    fetchLeagueOverview("wnba", { scan: false })
      .then((d) => {
        if (!cancelled) {
          setWnbaOverview(d as LeagueOverview);
          setWnbaLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setWnbaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Re-fetch games whenever selected tab changes.
  // localDayOffset(selected) returns the LOCAL calendar Date for offset 0/1/2.
  // localDateKey formats it to YYYYMMDD for the ESPN scoreboard endpoint.
  useEffect(() => {
    const date = localDayOffset(selected); // 0 = today, 1 = tomorrow, 2 = day after
    const dateKey = localDateKey(date);

    setNbaGamesLoading(true);
    setWnbaGamesLoading(true);
    setNbaGames(null);
    setWnbaGames(null);

    fetchGamesByLeagueAndLocalDate("nba", dateKey)
      .then((g: Game[]) => setNbaGames(g))
      .catch(() => setNbaGames([]))
      .finally(() => setNbaGamesLoading(false));

    fetchGamesByLeagueAndLocalDate("wnba", dateKey)
      .then((g: Game[]) => setWnbaGames(g))
      .catch(() => setWnbaGames([]))
      .finally(() => setWnbaGamesLoading(false));
  }, [selected]);

  const totalLive =
    (nbaOverview?.live.length ?? 0) + (wnbaOverview?.live.length ?? 0);

  // Tab counts — use local calendar dates (date-utils) so they're correct for any timezone.
  // Live games are always counted on Today regardless of startTimeIso.
  const counts = ([0, 1, 2] as const).map((offset) => {
    const targetDate = localDateString(localDayOffset(offset));

    const nbaAll = [
      ...(nbaOverview?.live ?? []),
      ...(nbaOverview?.upcoming ?? []),
    ];
    const wnbaAll = [
      ...(wnbaOverview?.live ?? []),
      ...(wnbaOverview?.upcoming ?? []),
    ];

    return [...nbaAll, ...wnbaAll].filter((g) => {
      if (offset === 0 && g.status === "in_progress") return true; // live → always today
      if (!g.startTimeIso) return offset === 0; // no time → today only
      return localDateString(new Date(g.startTimeIso)) === targetDate;
    }).length;
  });

  // hasLive[i]: live games can only appear on Today
  const hasLive: [boolean, boolean, boolean] = [totalLive > 0, false, false];

  return (
    <MobileLayout title="Basketball" showBack backHref="/">
      <div className="p-4 sm:p-5 pb-12">
        {/* Page headline */}
        <div className="mb-4 pt-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black tracking-tighter">🏀 Basketball</h1>
            {totalLive > 0 && (
              <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                {totalLive} LIVE
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            NBA & WNBA — live scores and schedules
          </p>
        </div>

        {/* Day tabs — same pill-tab style as cricket */}
        <DayTabs
          selected={selected}
          onChange={setSelected}
          counts={counts}
          hasLive={hasLive}
        />

        {/* League sections */}
        <div className="mt-4">
          <LeagueSection
            leagueKey="nba"
            label="NBA"
            overview={nbaOverview}
            overviewLoading={nbaLoading}
            games={nbaGames}
            gamesLoading={nbaGamesLoading}
            dayOffset={selected}
          />
          <LeagueSection
            leagueKey="wnba"
            label="WNBA"
            overview={wnbaOverview}
            overviewLoading={wnbaLoading}
            games={wnbaGames}
            gamesLoading={wnbaGamesLoading}
            dayOffset={selected}
          />
        </div>

        {/* Other basketball leagues */}
        <div className="rounded-2xl border border-border/30 border-dashed p-4 mb-4">
          <p className="text-xs font-semibold text-muted-foreground/50 mb-2">
            More Basketball
          </p>
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

        {!nbaLoading && !wnbaLoading && (
          <p className="text-[10px] text-muted-foreground/30 text-center">
            Data: ESPN Site API
          </p>
        )}
      </div>
    </MobileLayout>
  );
}
