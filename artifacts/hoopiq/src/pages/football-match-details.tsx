import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { fetchFootballGame } from "../api";
import type { FootballGame, FootballTeam } from "../lib/football-types";
import { useRecentMatches } from "../hooks/use-recent-matches";
import { recentFootballMatch } from "../lib/recent-matches";

function TeamLogo({ team }: { team: FootballTeam }) {
  return team.badgeUrl ? (
    <img src={team.badgeUrl} alt="" className="h-16 w-16 object-contain rounded-full bg-white/90 p-2" />
  ) : (
    <div className="h-16 w-16 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-black">{team.abbreviation}</div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === "") return null;
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/25 last:border-0">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/45">{label}</span>
      <span className="text-xs font-semibold text-foreground/80 text-right">{value}</span>
    </div>
  );
}

function MatchSummary({ game }: { game: FootballGame }) {
  const isLive = game.status === "in_progress";
  const isFinal = game.status === "final";
  const score = game.homeTeam.score !== null || game.awayTeam.score !== null
    ? `${game.homeTeam.score ?? "—"} – ${game.awayTeam.score ?? "—"}`
    : "vs";
  return (
    <div className={`rounded-2xl border p-5 ${isLive ? "border-green-700/35 bg-green-950/20" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 min-w-0">
          {game.leagueBadgeUrl && <img src={game.leagueBadgeUrl} alt="" className="h-6 w-6 object-contain rounded-full bg-white/90 p-0.5" />}
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/65 truncate">{game.leagueName}</span>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest ${isLive ? "text-green-300" : isFinal ? "text-muted-foreground/60" : "text-blue-300/75"}`}>
          {isLive ? game.minute ?? game.statusDetail ?? "LIVE" : isFinal ? game.statusDetail === "AET" || game.statusDetail === "PEN" ? game.statusDetail : "FT" : "Scheduled"}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex flex-col items-center gap-2 text-center min-w-0">
          <TeamLogo team={game.homeTeam} />
          <p className="text-sm font-bold truncate max-w-full">{game.homeTeam.name}</p>
          <p className="text-[10px] text-muted-foreground/45">{game.homeTeam.abbreviation}</p>
        </div>
        <p className={`text-3xl font-black tabular-nums ${isLive ? "text-green-300" : "text-foreground"}`}>{score}</p>
        <div className="flex flex-col items-center gap-2 text-center min-w-0">
          <TeamLogo team={game.awayTeam} />
          <p className="text-sm font-bold truncate max-w-full">{game.awayTeam.name}</p>
          <p className="text-[10px] text-muted-foreground/45">{game.awayTeam.abbreviation}</p>
        </div>
      </div>
      {game.result && <p className="text-xs text-center font-semibold text-green-300/80 mt-5">{game.result}</p>}
    </div>
  );
}

function MatchDetails({ game }: { game: FootballGame }) {
  const home = game.homeTeam;
  const away = game.awayTeam;
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground/65 mb-2">Match details</h2>
      <DetailRow label="Kickoff" value={game.startTimeIso ? new Date(game.startTimeIso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : null} />
      <DetailRow label="Venue" value={game.venue} />
      <DetailRow label="Location" value={[game.city, game.country].filter(Boolean).join(", ") || null} />
      <DetailRow label="Yellow cards" value={home.yellowCards !== null || away.yellowCards !== null ? `${home.yellowCards ?? "—"} – ${away.yellowCards ?? "—"}` : null} />
      <DetailRow label="Red cards" value={home.redCards !== null || away.redCards !== null ? `${home.redCards ?? "—"} – ${away.redCards ?? "—"}` : null} />
      <DetailRow label="Penalty shootout" value={home.penaltyScore !== null || away.penaltyScore !== null ? `${home.penaltyScore ?? "—"} – ${away.penaltyScore ?? "—"}` : null} />
      <DetailRow label="Extra time" value={home.extraTimeScore !== null || away.extraTimeScore !== null ? `${home.extraTimeScore ?? "—"} – ${away.extraTimeScore ?? "—"}` : null} />
    </div>
  );
}

export default function FootballMatchDetails() {
  const { id } = useParams<{ leagueId: string; id: string }>();
  const [game, setGame] = useState<FootballGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { recordMatch } = useRecentMatches();

  // Record this match as recently viewed on first successful load
  useEffect(() => {
    if (!game) return;
    recordMatch(recentFootballMatch({
      id: game.id,
      leagueId: game.leagueId,
      leagueName: game.leagueName,
      startTimeIso: game.startTimeIso,
      homeTeam: { name: game.homeTeam.name, abbreviation: game.homeTeam.abbreviation },
      awayTeam: { name: game.awayTeam.name, abbreviation: game.awayTeam.abbreviation },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  const load = useCallback(async () => {
    if (!id) {
      setError("Match ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFootballGame(decodeURIComponent(id)) as FootballGame | null;
      if (!result) throw new Error("This match is not available from TheSportsDB.");
      setGame(result);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not load this match.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <MobileLayout title="Match Details" showBack backHref="/football">
      <div className="p-4 sm:p-5 pb-12">
        {loading && <div className="h-64 rounded-2xl skeleton-shimmer" />}
        {!loading && error && (
          <div className="rounded-2xl border border-red-700/25 bg-red-950/25 px-4 py-6 text-center">
            <p className="text-sm font-bold text-red-300">Match unavailable</p>
            <p className="text-[10px] text-red-300/60 mt-1">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-3 text-[10px] font-bold text-red-200 underline underline-offset-2">Try again</button>
          </div>
        )}
        {!loading && game && (
          <>
            <MatchSummary game={game} />
            <div className="mt-4"><MatchDetails game={game} /></div>
            <Link href={`/football/${game.leagueId}/game/${encodeURIComponent(game.id)}/optimizer`}>
              <div className="mt-5 rounded-xl border border-green-700/40 bg-green-950/20 px-4 py-3 text-center text-xs font-black text-green-300">
                Open Football Optimizer
              </div>
            </Link>
            <Link href="/football">
              <div className="mt-5 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hover:text-foreground transition-colors">Back to live football</div>
            </Link>
          </>
        )}
      </div>
    </MobileLayout>
  );
}