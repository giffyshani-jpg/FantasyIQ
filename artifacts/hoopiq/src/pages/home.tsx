// FantasyIQ — Home Page
//
// Three premium sport cards: Cricket, Basketball, Football.
// Each card shows live count, upcoming summary, and navigates to its sport section.
// No dropdown expansion — premium, clean, mobile-first design.

import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { fetchLeagueOverview, fetchCricketOverview } from "../api";
import { LeagueOverview } from "../lib/types";
import type { CricketLeagueOverview } from "../lib/cricket-types";
import { relativeDate } from "../lib/date-utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isGameSoon(startTimeIso: string | null | undefined): boolean {
  if (!startTimeIso) return false;
  const diff = new Date(startTimeIso).getTime() - Date.now();
  return diff < 48 * 3600 * 1000 && diff > -8 * 3600 * 1000; // -8h covers T20/ODI durations
}

// ─── Live pulse dot ───────────────────────────────────────────────────────────

function LiveDot({ color = "bg-primary" }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}

// ─── Sport card skeleton ──────────────────────────────────────────────────────

function SportCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl skeleton-shimmer" />
        <div className="flex-1">
          <div className="h-6 w-28 rounded-lg skeleton-shimmer mb-2" />
          <div className="h-3 w-36 rounded-full skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

// ─── Sport Card ───────────────────────────────────────────────────────────────

interface SportCardProps {
  href: string;
  emoji: string;
  name: string;
  description: string;
  loading?: boolean;
  liveCount: number;
  upcomingCount: number;
  nextGameDate?: string | null;
  gradient: string;
  accentColor: string;
  badgeColor: string;
  comingSoon?: boolean;
}

function SportCard({
  href,
  emoji,
  name,
  description,
  loading,
  liveCount,
  upcomingCount,
  nextGameDate,
  gradient,
  accentColor,
  badgeColor,
  comingSoon,
}: SportCardProps) {
  let statusLine: React.ReactNode;

  if (loading) {
    statusLine = <span className="text-xs text-muted-foreground/50">Loading…</span>;
  } else if (comingSoon) {
    statusLine = (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground/50 bg-muted/40 rounded-full px-2.5 py-0.5">
        Coming soon
      </span>
    );
  } else if (liveCount > 0) {
    statusLine = (
      <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${accentColor}`}>
        <LiveDot color={badgeColor} />
        {liveCount} live · {upcomingCount} upcoming
      </span>
    );
  } else if (upcomingCount > 0) {
    statusLine = (
      <span className="text-xs font-semibold text-muted-foreground/70">
        {upcomingCount} upcoming today
      </span>
    );
  } else if (nextGameDate) {
    const label = relativeDate(nextGameDate);
    statusLine = (
      <span className="text-xs text-muted-foreground/60">
        Next: {label || new Date(nextGameDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </span>
    );
  } else {
    statusLine = (
      <span className="text-xs text-muted-foreground/40">No games today</span>
    );
  }

  const inner = (
    <div
      className={`group rounded-2xl bg-gradient-to-br ${gradient} border border-white/8 shadow-lg overflow-hidden active:scale-[0.99] transition-transform`}
    >
      <div className="flex items-center justify-between p-5 sm:p-6">
        <div className="flex items-center gap-4">
          {/* Sport emoji in rounded tile */}
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl select-none shrink-0 shadow-inner">
            {emoji}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-black tracking-tight text-white">{name}</h2>
              {liveCount > 0 && !comingSoon && <LiveDot color={badgeColor} />}
            </div>
            <p className="text-xs text-white/50 mb-1">{description}</p>
            <div>{statusLine}</div>
          </div>
        </div>

        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white/25 group-hover:text-white/55 transition-colors shrink-0 ml-3"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </div>
  );

  if (comingSoon) return inner;
  return <Link href={href}>{inner}</Link>;
}

// ─── LIVE NOW global banner ────────────────────────────────────────────────────

function LiveNowBanner({ totalLive, sports }: { totalLive: number; sports: string[] }) {
  if (totalLive === 0) return null;
  return (
    <div className="rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
      <div className="flex items-center gap-3 px-4 py-3">
        <LiveDot color="bg-primary" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-black uppercase tracking-wider text-primary">Live Now</span>
          <span className="text-xs text-muted-foreground/60 ml-2">
            {totalLive} {totalLive === 1 ? "match" : "matches"} · {sports.join(" · ")}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

function PageHeader({ anyLoading, totalLive }: { anyLoading: boolean; totalLive: number }) {
  const now = new Date();
  const dayLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="pt-2 sm:pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tighter">Today's Sports</h1>
        <span className="text-xs text-muted-foreground/50 shrink-0">{dayLabel}</span>
      </div>
      <p className="text-muted-foreground text-sm mt-1">
        {anyLoading
          ? "Loading schedules…"
          : totalLive > 0
          ? `${totalLive} match${totalLive !== 1 ? "es" : ""} in progress across all sports`
          : "Your multi-sport fantasy hub"}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  // Basketball (NBA + WNBA combined)
  const [nbaOverview, setNbaOverview] = useState<LeagueOverview | null>(null);
  const [wnbaOverview, setWnbaOverview] = useState<LeagueOverview | null>(null);
  const [nbaLoading, setNbaLoading] = useState(true);
  const [wnbaLoading, setWnbaLoading] = useState(true);

  // Cricket
  const [cricketOverview, setCricketOverview] = useState<CricketLeagueOverview | null>(null);
  const [cricketLoading, setCricketLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchLeagueOverview("nba", { scan: false }).then(d => {
      if (!cancelled) { setNbaOverview(d as LeagueOverview); setNbaLoading(false); }
    }).catch(() => { if (!cancelled) setNbaLoading(false); });

    fetchLeagueOverview("wnba", { scan: false }).then(d => {
      if (!cancelled) { setWnbaOverview(d as LeagueOverview); setWnbaLoading(false); }
    }).catch(() => { if (!cancelled) setWnbaLoading(false); });

    fetchCricketOverview().then(d => {
      if (!cancelled) { setCricketOverview(d as CricketLeagueOverview); setCricketLoading(false); }
    }).catch(() => { if (!cancelled) setCricketLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // ── Basketball aggregates ────────────────────────────────────────────────
  const basketballLive = [
    ...(nbaOverview?.live ?? []),
    ...(wnbaOverview?.live ?? []),
  ];
  const basketballUpcomingSoon = [
    ...(nbaOverview?.upcoming ?? []).filter(g => isGameSoon(g.startTimeIso)),
    ...(wnbaOverview?.upcoming ?? []).filter(g => isGameSoon(g.startTimeIso)),
  ];
  const allBasketballUpcoming = [
    ...(nbaOverview?.upcoming ?? []),
    ...(wnbaOverview?.upcoming ?? []),
  ];
  const basketballLoading = nbaLoading || wnbaLoading;

  // Next basketball game (for off-season display)
  const nextBasketballDate = basketballLive.length === 0 && basketballUpcomingSoon.length === 0
    ? (allBasketballUpcoming.sort((a, b) =>
        new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime()
      )[0]?.startTimeIso ?? null)
    : null;

  // ── Cricket aggregates ───────────────────────────────────────────────────
  const cricketLive = cricketOverview?.live.length ?? 0;
  const cricketUpcomingSoon = (cricketOverview?.upcoming ?? []).filter(g => isGameSoon(g.startTimeIso)).length;

  // Next cricket game
  const nextCricketDate = cricketLive === 0 && cricketUpcomingSoon === 0
    ? (cricketOverview?.upcoming?.[0]?.startTimeIso ?? null)
    : null;

  // ── Global live totals ───────────────────────────────────────────────────
  const totalLive = basketballLive.length + cricketLive;
  const anyLoading = basketballLoading || cricketLoading;

  const liveSports: string[] = [];
  if (basketballLive.length > 0) liveSports.push("Basketball");
  if (cricketLive > 0) liveSports.push("Cricket");

  return (
    <MobileLayout>
      <div className="p-4 sm:p-5 flex flex-col gap-4 pb-12">
        <PageHeader anyLoading={anyLoading} totalLive={totalLive} />

        {/* Global live banner */}
        {!anyLoading && totalLive > 0 && (
          <LiveNowBanner totalLive={totalLive} sports={liveSports} />
        )}

        {/* ── Cricket ── */}
        {cricketLoading ? (
          <SportCardSkeleton />
        ) : (
          <SportCard
            href="/cricket"
            emoji="🏏"
            name="Cricket"
            description="T20 · ODI · Test · All Competitions"
            loading={false}
            liveCount={cricketLive}
            upcomingCount={cricketUpcomingSoon}
            nextGameDate={nextCricketDate}
            gradient="from-green-950 to-slate-900"
            accentColor="text-green-400"
            badgeColor="bg-green-400"
          />
        )}

        {/* ── Basketball ── */}
        {basketballLoading ? (
          <SportCardSkeleton />
        ) : (
          <SportCard
            href="/basketball"
            emoji="🏀"
            name="Basketball"
            description="NBA · WNBA · International"
            loading={false}
            liveCount={basketballLive.length}
            upcomingCount={basketballUpcomingSoon.length}
            nextGameDate={nextBasketballDate}
            gradient="from-orange-950 to-slate-900"
            accentColor="text-orange-400"
            badgeColor="bg-orange-400"
          />
        )}

        {/* ── Football ── */}
        <SportCard
          href="/football"
          emoji="⚽"
          name="Football"
          description="Top leagues · International · Cups"
          loading={false}
          liveCount={0}
          upcomingCount={0}
          nextGameDate={null}
          gradient="from-blue-950 to-slate-900"
          accentColor="text-blue-400"
          badgeColor="bg-blue-400"
          comingSoon={true}
        />

        {/* Footer */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <p className="text-[10px] text-muted-foreground/30 text-center">
            ESPN · TheSportsDB · FantasyIQ Intelligence
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}
