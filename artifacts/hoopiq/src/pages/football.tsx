import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { fetchFootballOverview } from "../api";
import type { FootballGame, FootballOverview, FootballTeam } from "../lib/football-types";

interface FootballPageState {
  overview: FootballOverview | null;
  loading: boolean;
  error: string | null;
  lastRefreshed: number | null;
}

function fmtKickoff(isoStr: string | null): string {
  if (!isoStr) return "Time unavailable";
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(isoStr: string | null): string {
  if (!isoStr) return "";
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function TeamLogo({ team, align = "left" }: { team: FootballTeam; align?: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {team.badgeUrl ? (
        <img
          src={team.badgeUrl}
          alt=""
          className="h-9 w-9 rounded-full object-contain bg-white/90 p-1 shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="h-9 w-9 rounded-full bg-muted/60 border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground shrink-0">
          {team.abbreviation.slice(0, 3)}
        </div>
      )}
      <span className="text-sm font-bold text-foreground truncate">{team.name}</span>
    </div>
  );
}

function StatusPill({ game }: { game: FootballGame }) {
  if (game.status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-green-300 bg-green-900/40 border border-green-700/30 rounded-full px-2 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
        {game.minute ?? game.statusDetail ?? "LIVE"}
      </span>
    );
  }
  if (game.status === "final") {
    return (
      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/65 bg-muted/30 rounded-full px-2 py-1">
        {game.statusDetail === "AET" || game.statusDetail === "PEN" ? game.statusDetail : "FT"}
      </span>
    );
  }
  return (
    <span className="text-[9px] font-black uppercase tracking-widest text-blue-300/70 bg-blue-900/30 rounded-full px-2 py-1">
      {fmtKickoff(game.startTimeIso)}
    </span>
  );
}

function MatchMeta({ game }: { game: FootballGame }) {
  const details = [
    game.venue,
    game.city,
    game.country,
    game.status === "scheduled" ? fmtDate(game.startTimeIso) : null,
  ].filter(Boolean);
  if (details.length === 0) return null;
  return <p className="text-[10px] text-muted-foreground/45 mt-3 truncate">{details.join(" · ")}</p>;
}

function MatchExtras({ game }: { game: FootballGame }) {
  const home = game.homeTeam;
  const away = game.awayTeam;
  const hasCards = home.yellowCards !== null || away.yellowCards !== null || home.redCards !== null || away.redCards !== null;
  const hasShootout = home.penaltyScore !== null || away.penaltyScore !== null;
  const hasExtraTime = home.extraTimeScore !== null || away.extraTimeScore !== null;
  if (!hasCards && !hasShootout && !hasExtraTime) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border/30 mt-3 pt-2 text-[10px] text-muted-foreground/60">
      {hasCards && (
        <span>
          Cards: Y {home.yellowCards ?? "—"}–{away.yellowCards ?? "—"} · R {home.redCards ?? "—"}–{away.redCards ?? "—"}
        </span>
      )}
      {hasShootout && <span>Penalties {home.penaltyScore ?? "—"}–{away.penaltyScore ?? "—"}</span>}
      {hasExtraTime && <span>Extra time {home.extraTimeScore ?? "—"}–{away.extraTimeScore ?? "—"}</span>}
    </div>
  );
}

function MatchCard({ game }: { game: FootballGame }) {
  const hasScore = game.homeTeam.score !== null || game.awayTeam.score !== null;
  const score = hasScore ? `${game.homeTeam.score ?? "—"} – ${game.awayTeam.score ?? "—"}` : "vs";
  return (
    <Link href={`/football/${game.leagueId}/game/${encodeURIComponent(game.id)}`}>
      <article
        className={`relative rounded-2xl border p-4 cursor-pointer transition-all active:scale-[0.99] hover:border-primary/45 hover:bg-primary/[0.03] ${
          game.status === "in_progress" ? "border-green-700/35 bg-green-950/20" : "border-border bg-card"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            {game.leagueBadgeUrl && (
              <img src={game.leagueBadgeUrl} alt="" className="h-5 w-5 object-contain rounded-full bg-white/90 p-0.5 shrink-0" loading="lazy" />
            )}
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/65 truncate">{game.leagueName}</span>
          </div>
          <StatusPill game={game} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamLogo team={game.homeTeam} />
          <div className="text-center min-w-[58px]">
            <p className={`text-xl font-black tabular-nums tracking-tight ${game.status === "in_progress" ? "text-green-300" : "text-foreground"}`}>
              {score}
            </p>
            {game.status === "scheduled" && <p className="text-[9px] text-muted-foreground/45 mt-1">Kickoff</p>}
          </div>
          <TeamLogo team={game.awayTeam} align="right" />
        </div>

        <MatchMeta game={game} />
        <MatchExtras game={game} />
      </article>
    </Link>
  );
}

function groupByLeague(games: FootballGame[]) {
  const groups = new Map<string, FootballGame[]>();
  for (const game of games) {
    const key = String(game.leagueId || game.leagueName);
    const current = groups.get(key) ?? [];
    current.push(game);
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => a[0].leagueName.localeCompare(b[0].leagueName));
}

function MatchSection({
  title,
  subtitle,
  games,
  accent,
}: {
  title: string;
  subtitle: string;
  games: FootballGame[];
  accent: string;
}) {
  const groups = groupByLeague(games);
  if (groups.length === 0) return null;
  return (
    <section className="mb-7">
      <div className="flex items-end justify-between gap-3 px-1 mb-3">
        <div>
          <h2 className={`text-xs font-black uppercase tracking-[0.18em] ${accent}`}>{title}</h2>
          <p className="text-[10px] text-muted-foreground/40 mt-1">{subtitle}</p>
        </div>
        <span className="text-[10px] text-muted-foreground/45 tabular-nums">{games.length}</span>
      </div>
      <div className="flex flex-col gap-4">
        {groups.map((leagueGames) => (
          <div key={`${title}-${leagueGames[0].leagueId}`} className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-muted-foreground/50 px-1">{leagueGames[0].leagueName}</p>
            {leagueGames.map((game) => <MatchCard game={game} key={game.id} />)}
          </div>
        ))}
      </div>
    </section>
  );
}

function SkeletonCard() {
  return <div className="h-36 rounded-2xl skeleton-shimmer" />;
}

export default function FootballPage() {
  const [state, setState] = useState<FootballPageState>({
    overview: null,
    loading: true,
    error: null,
    lastRefreshed: null,
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const overview = await fetchFootballOverview() as FootballOverview;
      setState({ overview, loading: false, error: null, lastRefreshed: Date.now() });
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "The football provider could not be reached.",
      }));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const live = state.overview?.live ?? [];
  const upcoming = state.overview?.upcoming ?? [];
  const finished = state.overview?.finished ?? (state.overview?.lastPlayed ? [state.overview.lastPlayed] : []);
  const total = live.length + upcoming.length + finished.length;
  const refreshedLabel = useMemo(
    () => state.lastRefreshed ? new Date(state.lastRefreshed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
    [state.lastRefreshed],
  );

  return (
    <MobileLayout title="Football" showBack backHref="/">
      <div className="p-4 sm:p-5 pb-12">
        <header className="flex items-start justify-between gap-4 mb-6 pt-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-green-400/70 mb-2">Match centre</p>
            <h1 className="text-2xl font-black tracking-tighter">Live Football</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {state.loading ? "Checking the latest fixtures…" : state.error ? "Live data is unavailable" : `${live.length} live · ${upcoming.length} upcoming · ${finished.length} finished`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={state.loading}
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65 hover:text-foreground bg-muted/30 rounded-xl px-3 py-2 transition-colors disabled:opacity-40"
          >
            {state.loading ? "Loading" : "Refresh"}
          </button>
        </header>

        {state.loading && <div className="flex flex-col gap-3 mb-6">{[1, 2, 3].map((item) => <SkeletonCard key={item} />)}</div>}

        {!state.loading && state.error && (
          <div className="rounded-2xl border border-red-700/25 bg-red-950/25 px-4 py-4 mb-6">
            <p className="text-xs font-bold text-red-300">Football data unavailable</p>
            <p className="text-[10px] text-red-300/60 mt-1">{state.error}</p>
            <button type="button" onClick={() => void load()} className="mt-3 text-[10px] font-bold text-red-200 underline underline-offset-2">Try again</button>
          </div>
        )}

        {!state.loading && !state.error && total === 0 && (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center mb-6">
            <p className="text-sm font-bold text-foreground/75">No matches in the current window</p>
            <p className="text-[10px] text-muted-foreground/45 mt-1">TheSportsDB provides yesterday, today, and tomorrow.</p>
          </div>
        )}

        {!state.loading && !state.error && (
          <>
            <MatchSection title="Live now" subtitle="Confirmed in-progress matches" games={live} accent="text-green-400" />
            <MatchSection title="Upcoming" subtitle="Next scheduled kickoffs" games={upcoming} accent="text-blue-300" />
            <MatchSection title="Finished" subtitle="Most recent completed matches" games={finished} accent="text-muted-foreground/65" />
          </>
        )}

        <footer className="border-t border-border/30 pt-4 mt-2 text-center">
          <p className="text-[10px] text-muted-foreground/35">TheSportsDB · optional match events appear only when provided by the source</p>
          {refreshedLabel && <p className="text-[9px] text-muted-foreground/25 mt-1">Updated {refreshedLabel}</p>}
        </footer>
      </div>
    </MobileLayout>
  );
}