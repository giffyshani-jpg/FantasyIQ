// Cricket Box Score page.
//
// Route: /cricket/:competition/game/:id
//
// Shows batting and bowling scorecards for each innings, live status,
// AI Rating badges + coloured Player Badge chips on each player row,
// and a link to the cricket fantasy optimizer.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { fetchCricketGame } from "../api";
import type { CricketGame, CricketInnings, CricketPlayer } from "../lib/cricket-types";
import { calculateCricketFantasyPoints, getScoringProfile } from "../lib/cricket-scoring";
import { MatchIntelligenceCard } from "../components/cricket-match-intelligence";
import {
  computeAllPlayerRatings,
  computePlayerBadge,
  type PlayerAIRating,
  type PlayerBadge,
} from "../lib/ai-player-rating";

// ─── Icons ─────────────────────────────────────────────────────────────────

function ArrowLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
    </svg>
  );
}

function ZapIcon({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

// ─── AI Rating Badge ───────────────────────────────────────────────────────

function AIRatingBadge({ rating }: { rating: PlayerAIRating }) {
  const colorCls =
    rating.overall >= 85 ? "text-yellow-300 bg-yellow-900/30 border-yellow-700/40" :
    rating.overall >= 72 ? "text-green-300 bg-green-900/30 border-green-700/40" :
    rating.overall >= 58 ? "text-blue-300 bg-blue-900/30 border-blue-700/40" :
    rating.overall >= 44 ? "text-slate-400 bg-slate-800/40 border-slate-600/30" :
    "text-red-400/70 bg-red-900/20 border-red-700/30";

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-black rounded px-1.5 py-0.5 border ${colorCls} shrink-0`}
      title={`AI Rating: ${rating.overall}/100 — ${rating.label}`}
    >
      AI {rating.overall}
    </span>
  );
}

// ─── Player Badge Chip ─────────────────────────────────────────────────────
// Reusable colour-coded chip for HOT / SAFE / DIFFERENTIAL / RISKY / VALUE PICK

const BADGE_CONFIG: Record<PlayerBadge, { label: string; cls: string }> = {
  HOT:          { label: "🔥 HOT",        cls: "bg-orange-900/50 text-orange-200 border-orange-600/50" },
  SAFE:         { label: "🛡 SAFE",       cls: "bg-green-900/50 text-green-200 border-green-600/50" },
  DIFFERENTIAL: { label: "⚡ DIFF",       cls: "bg-purple-900/50 text-purple-200 border-purple-600/50" },
  RISKY:        { label: "⚠ RISKY",      cls: "bg-red-900/50 text-red-200 border-red-600/50" },
  "VALUE PICK": { label: "💎 VALUE",      cls: "bg-cyan-900/50 text-cyan-200 border-cyan-600/50" },
};

export function PlayerBadgeChip({ badge }: { badge: PlayerBadge }) {
  const { label, cls } = BADGE_CONFIG[badge];
  return (
    <span className={`inline-flex items-center text-[8px] font-black uppercase tracking-wide rounded px-1.5 py-0.5 border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 rounded-xl skeleton-shimmer" />
      ))}
    </div>
  );
}

// ─── Score header ─────────────────────────────────────────────────────────

function MatchHeader({ game }: { game: CricketGame }) {
  const isLive  = game.status === "in_progress";
  const isFinal = game.status === "final";

  return (
    <div className="bg-gradient-to-br from-green-900/80 to-slate-900 border border-green-800/30 rounded-2xl overflow-hidden shadow-lg">
      {/* Competition + format */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-green-400/80">
          {game.competitionName}
        </span>
        <span className="text-[10px] font-semibold bg-green-900/50 text-green-300 rounded-full px-2 py-0.5 border border-green-700/40">
          {game.format}
        </span>
      </div>

      {/* Teams and scores */}
      <div className="px-4 pb-3 pt-1">
        <div className="flex items-center justify-between gap-2">
          {/* Home team */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-white leading-tight truncate">
              {game.homeTeam.abbreviation}
            </p>
            <p className="text-xs text-slate-400 truncate">{game.homeTeam.name}</p>
            {game.homeTeam.score && (
              <p className="text-xl font-black text-green-300 mt-0.5">
                {game.homeTeam.score}
                {game.homeTeam.overs && (
                  <span className="text-xs font-normal text-slate-400 ml-1">({game.homeTeam.overs} ov)</span>
                )}
              </p>
            )}
          </div>

          {/* Status */}
          <div className="flex flex-col items-center gap-1 px-2">
            {isLive ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
            ) : null}
            <span className={`text-[11px] font-bold ${isLive ? "text-primary" : isFinal ? "text-slate-400" : "text-slate-500"}`}>
              {isLive ? "LIVE" : isFinal ? "FT" : "vs"}
            </span>
          </div>

          {/* Away team */}
          <div className="flex-1 min-w-0 text-right">
            <p className="text-base font-black text-white leading-tight truncate">
              {game.awayTeam.abbreviation}
            </p>
            <p className="text-xs text-slate-400 truncate">{game.awayTeam.name}</p>
            {game.awayTeam.score && (
              <p className="text-xl font-black text-green-300 mt-0.5">
                {game.awayTeam.score}
                {game.awayTeam.overs && (
                  <span className="text-xs font-normal text-slate-400 ml-1">({game.awayTeam.overs} ov)</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Result / status detail */}
        {(game.result || game.statusDetail) && (
          <div className="mt-2 text-center">
            <p className="text-xs font-semibold text-green-300/80">
              {game.result ?? game.statusDetail}
            </p>
          </div>
        )}

        {/* Venue */}
        {game.venue && (
          <p className="text-[10px] text-slate-500 text-center mt-1">{game.venue}</p>
        )}
      </div>

      {/* Optimizer CTA */}
      <Link href={`/cricket/${game.competitionSlug}/game/${encodeURIComponent(game.id)}/optimizer`}>
        <div className="flex items-center justify-center gap-2 py-2.5 bg-green-800/30 hover:bg-green-800/50 transition-colors border-t border-green-800/30 cursor-pointer group">
          <ZapIcon size={13} />
          <span className="text-xs font-bold text-green-300 group-hover:text-green-200 transition-colors">
            Fantasy Optimizer
          </span>
        </div>
      </Link>
    </div>
  );
}

// ─── Batting scorecard ────────────────────────────────────────────────────

function BattingCard({
  innings,
  profile,
  ratings,
}: {
  innings: CricketInnings;
  profile: ReturnType<typeof getScoringProfile>;
  ratings: Map<string, PlayerAIRating>;
}) {
  const players = innings.battingTeam.players.filter((p) => p.stats?.batting);

  if (players.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/30">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {innings.battingTeam.abbreviation} Batting
        </span>
        <span className="text-xs text-muted-foreground/60">
          {innings.totalRuns}/{innings.totalWickets} ({innings.totalOvers} ov)
        </span>
      </div>

      {/* Header row — R | B | 4s | 6s | SR | FPTS */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-1 px-4 py-1.5 border-b border-border/20">
        <span className="text-[10px] font-semibold text-muted-foreground/60">Batter</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">R</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">B</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">4s</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">6s</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-9">SR</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-12">FPTS</span>
      </div>

      {players.map((p, i) => {
        const bat = p.stats.batting!;
        const pts = calculateCricketFantasyPoints(p.stats, profile);
        const notOut = !bat.dismissed;
        const aiRating = ratings.get(p.id);
        const badge = aiRating ? computePlayerBadge(aiRating, p) : null;
        const sr = bat.strikeRate !== null ? bat.strikeRate.toFixed(1) : "—";
        return (
          <div key={p.id}
            className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-1 px-4 py-2.5 items-start ${i < players.length - 1 ? "border-b border-border/15" : ""}`}>
            {/* Name + AI Rating + Badge */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-foreground truncate">
                  {p.name}
                  {notOut && <span className="ml-1 text-[10px] text-green-400 font-bold">*</span>}
                </p>
                {aiRating && <AIRatingBadge rating={aiRating} />}
              </div>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {bat.dismissal && !notOut && (
                  <p className="text-[10px] text-muted-foreground/50 truncate">{bat.dismissal}</p>
                )}
                {badge && <PlayerBadgeChip badge={badge} />}
              </div>
            </div>
            <span className={`text-sm font-bold text-right w-7 ${bat.runs >= 50 ? "text-yellow-400" : bat.runs >= 25 ? "text-orange-400" : "text-foreground"}`}>
              {bat.runs}
            </span>
            <span className="text-xs text-muted-foreground text-right w-7">{bat.balls}</span>
            <span className="text-xs text-muted-foreground text-right w-7">{bat.fours}</span>
            <span className="text-xs text-muted-foreground text-right w-7">{bat.sixes}</span>
            <span className={`text-xs text-right w-9 ${bat.strikeRate !== null && bat.strikeRate >= 150 ? "text-green-400" : bat.strikeRate !== null && bat.strikeRate < 70 ? "text-red-400/70" : "text-muted-foreground"}`}>
              {sr}
            </span>
            <span className={`text-xs font-bold text-right w-12 ${pts.total > 0 ? "text-green-400" : pts.total < 0 ? "text-red-400" : "text-muted-foreground/50"}`}>
              {pts.total > 0 ? "+" : ""}{pts.total.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Bowling scorecard ────────────────────────────────────────────────────

function BowlingCard({
  innings,
  profile,
  ratings,
}: {
  innings: CricketInnings;
  profile: ReturnType<typeof getScoringProfile>;
  ratings: Map<string, PlayerAIRating>;
}) {
  const players = innings.bowlingTeam.players.filter((p) => p.stats?.bowling);
  if (players.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/30">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {innings.bowlingTeam.abbreviation} Bowling
        </span>
      </div>

      {/* Header row — O | M | R | W | Econ | FPTS */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-1 px-4 py-1.5 border-b border-border/20">
        <span className="text-[10px] font-semibold text-muted-foreground/60">Bowler</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">O</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">M</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">R</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">W</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-9">Econ</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-12">FPTS</span>
      </div>

      {players.map((p, i) => {
        const bowl = p.stats.bowling!;
        const oversStr = bowl.extraBalls > 0 ? `${bowl.overs}.${bowl.extraBalls}` : `${bowl.overs}`;
        const pts = calculateCricketFantasyPoints(p.stats, profile);
        const aiRating = ratings.get(p.id);
        const badge = aiRating ? computePlayerBadge(aiRating, p) : null;
        const econ = bowl.economy !== null ? bowl.economy.toFixed(2) : "—";
        return (
          <div key={p.id}
            className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-1 px-4 py-2.5 items-start ${i < players.length - 1 ? "border-b border-border/15" : ""}`}>
            {/* Name + AI Rating + Badge */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                {aiRating && <AIRatingBadge rating={aiRating} />}
              </div>
              {badge && (
                <div className="mt-0.5">
                  <PlayerBadgeChip badge={badge} />
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground text-right w-7">{oversStr}</span>
            <span className="text-xs text-muted-foreground text-right w-7">{bowl.maidens}</span>
            <span className="text-xs text-muted-foreground text-right w-7">{bowl.runsConceded}</span>
            <span className={`text-sm font-bold text-right w-7 ${bowl.wickets >= 3 ? "text-yellow-400" : bowl.wickets > 0 ? "text-orange-400" : "text-foreground"}`}>
              {bowl.wickets}
            </span>
            <span className={`text-xs text-right w-9 ${bowl.economy !== null && bowl.economy < 6 ? "text-green-400" : bowl.economy !== null && bowl.economy > 10 ? "text-red-400/70" : "text-muted-foreground"}`}>
              {econ}
            </span>
            <span className={`text-xs font-bold text-right w-12 ${pts.total > 0 ? "text-green-400" : pts.total < 0 ? "text-red-400" : "text-muted-foreground/50"}`}>
              {pts.total > 0 ? "+" : ""}{pts.total.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Fielding scorecard ────────────────────────────────────────────────────
//
// Shows players with any fielding contribution (catches / stumpings / run-outs).
// Displays fantasy points from the fielding portion only.

function FieldingCard({
  innings,
  profile,
}: {
  innings: CricketInnings;
  profile: ReturnType<typeof getScoringProfile>;
}) {
  // Gather all players from both teams in this innings who have fielding stats.
  const allPlayers = [
    ...innings.battingTeam.players,
    ...innings.bowlingTeam.players,
  ];
  // Deduplicate by id.
  const seen = new Set<string>();
  const players = allPlayers.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    const f = p.stats?.fielding;
    return f && (f.catches > 0 || f.stumpings > 0 || f.runOutsDirect > 0 || f.runOutsIndirect > 0);
  });

  if (players.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border/30">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Fielding
        </span>
      </div>

      {/* Header row — C | St | RO | FPTS */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1 px-4 py-1.5 border-b border-border/20">
        <span className="text-[10px] font-semibold text-muted-foreground/60">Fielder</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">C</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">St</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">RO</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-12">FPTS</span>
      </div>

      {players.map((p, i) => {
        const f = p.stats.fielding!;
        const pts = calculateCricketFantasyPoints(p.stats, profile);
        const runOuts = f.runOutsDirect + f.runOutsIndirect;
        return (
          <div key={p.id}
            className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-1 px-4 py-2.5 items-center ${i < players.length - 1 ? "border-b border-border/15" : ""}`}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground/50">{p.teamAbbreviation}</p>
            </div>
            <span className={`text-sm font-bold text-right w-7 ${f.catches > 0 ? "text-blue-300" : "text-muted-foreground/40"}`}>
              {f.catches}
            </span>
            <span className={`text-sm font-bold text-right w-7 ${f.stumpings > 0 ? "text-purple-300" : "text-muted-foreground/40"}`}>
              {f.stumpings}
            </span>
            <span className={`text-sm font-bold text-right w-7 ${runOuts > 0 ? "text-orange-300" : "text-muted-foreground/40"}`}>
              {runOuts}
            </span>
            <span className={`text-xs font-bold text-right w-12 ${pts.fielding > 0 ? "text-green-400" : "text-muted-foreground/50"}`}>
              +{pts.fielding.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Innings section ──────────────────────────────────────────────────────

function InningsSection({
  innings,
  game,
  ratings,
}: {
  innings: CricketInnings;
  game: CricketGame;
  ratings: Map<string, PlayerAIRating>;
}) {
  const profile = getScoringProfile(game.format, game.competitionName);
  const label = innings.inningsNumber === 1 ? "1st Innings" : "2nd Innings";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">{label}</span>
        {innings.status === "in_progress" && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">
            In Progress
          </span>
        )}
      </div>
      <BattingCard innings={innings} profile={profile} ratings={ratings} />
      <BowlingCard innings={innings} profile={profile} ratings={ratings} />
      <FieldingCard innings={innings} profile={profile} />
    </div>
  );
}

// ─── Task 4: Match Summary card for completed matches ─────────────────────
//
// Shown ABOVE the AI intelligence card for final-status matches.
// Displays all available structured data: result, venue, competition, format.
// Player of Match and Toss are not provided by TSDB free tier.

function MatchSummaryCard({ game }: { game: CricketGame }) {
  if (game.status !== "final") return null;

  const rows: { icon: string; label: string; value: string }[] = [
    ...(game.result ? [{ icon: "🏆", label: "Result",      value: game.result }]           : []),
    ...(game.venue  ? [{ icon: "📍", label: "Venue",       value: game.venue }]             : []),
    {                  icon: "🏆",  label: "Competition",  value: game.competitionName      },
    {                  icon: "📋",  label: "Format",       value: game.format               },
  ];

  return (
    <div className="rounded-2xl border border-border/30 overflow-hidden bg-card">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-b border-border/20">
        <span className="text-base">🏁</span>
        <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
          Match Summary
        </span>
      </div>
      <div className="px-4 py-2">
        {rows.map(({ icon, label, value }) => (
          value ? (
            <div key={label} className="flex items-start gap-2.5 py-2 border-b border-border/10 last:border-0">
              <span className="text-base shrink-0 mt-0.5">{icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
              </div>
            </div>
          ) : null
        ))}
        <div className="py-2">
          <p className="text-[10px] text-muted-foreground/30 leading-relaxed">
            Player of Match and Toss details not available from TheSportsDB free tier.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Pre-match / No-scorecard panel ──────────────────────────────────────
//
// Task 3: Never leave a blank page. Show all available data regardless of
// whether a scorecard exists. Scheduled → pre-match panel. Completed without
// scorecard → result + venue + match summary.

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-border/15 last:border-0">
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function NoScorecard({ game }: { game: CricketGame }) {
  const isScheduled  = game.status === "scheduled";
  const isInProgress = game.status === "in_progress";
  const isFinal      = game.status === "final";

  const { fmtTime: formatTime } = (() => {
    // local import-like pattern — use the same util but keep this component self-contained
    return { fmtTime: (iso: string | null | undefined) => {
      if (!iso) return "";
      try { return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", weekday: "short", month: "short", day: "numeric" }).format(new Date(iso)); }
      catch { return ""; }
    }};
  })();

  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-b border-border/30">
        <span className="text-base">
          {isScheduled ? "📅" : isInProgress ? "🔴" : isFinal ? "🏁" : "🏏"}
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {isScheduled  ? "Match Preview"
           : isInProgress ? "In Progress — Scorecard Unavailable"
           : isFinal      ? "Match Completed — Scorecard Unavailable"
           : "Match Info"}
        </span>
      </div>

      <div className="px-4 py-2">
        {/* Result (completed) */}
        {isFinal && game.result && (
          <div className="py-2 mb-1">
            <p className="text-sm font-bold text-green-300">{game.result}</p>
          </div>
        )}

        {/* Scheduled: countdown message */}
        {isScheduled && game.startTimeIso && (
          <div className="py-2 mb-1">
            <p className="text-sm font-semibold text-amber-300/80">
              Starts {formatTime(game.startTimeIso)}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              Live scoring data will appear once the match begins
            </p>
          </div>
        )}

        {/* Venue */}
        <InfoRow icon="📍" label="Venue" value={game.venue ?? ""} />

        {/* Competition */}
        <InfoRow icon="🏆" label="Competition" value={game.competitionName ?? ""} />

        {/* Format */}
        <InfoRow icon="📋" label="Format" value={game.format ?? ""} />

        {/* Status detail */}
        {game.statusDetail && game.statusDetail !== game.result && (
          <InfoRow icon="ℹ️" label="Status" value={game.statusDetail} />
        )}

        {/* Optimizer CTA for upcoming matches */}
        {(isScheduled || isInProgress) && (
          <div className="mt-3 pt-2 border-t border-border/20">
            <p className="text-[10px] text-muted-foreground/40">
              {isScheduled
                ? "Use the Fantasy Optimizer above to build your lineup before the match"
                : "Detailed ball-by-ball data not available from TheSportsDB free tier"}
            </p>
          </div>
        )}

        {isFinal && (
          <div className="mt-2 pt-2 border-t border-border/20">
            <p className="text-sm font-semibold text-amber-300/80">
              Player statistics unavailable from current provider.
            </p>
            <p className="text-[10px] text-muted-foreground/40 mt-1">
              TheSportsDB free tier returns match results only — no detailed scorecard data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CricketBoxScore() {
  const params = useParams<{ competition: string; id: string }>();
  const competition = params.competition ?? "";
  const rawId       = params.id ?? "";
  const gameId      = decodeURIComponent(rawId).includes(":")
    ? decodeURIComponent(rawId)
    : `${competition}:${rawId}`;

  const [game, setGame]       = useState<CricketGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const pollRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(noCache = false) {
      try {
        const data = await fetchCricketGame(gameId, { noCache });
        if (!cancelled && data) {
          setGame(data as CricketGame);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Failed to load match data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [gameId]);

  // Live polling
  useEffect(() => {
    if (!game || game.status !== "in_progress") return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchCricketGame(gameId, { noCache: true })
        .then((d) => { if (d) setGame(d as CricketGame); })
        .catch(() => {});
    }, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [game?.status, gameId]);

  // ── Compute AI ratings for all players once per game load ──────────────
  const playerRatings = useMemo<Map<string, PlayerAIRating>>(() => {
    if (!game) return new Map();
    const allPlayers: CricketPlayer[] = [];
    const seen = new Set<string>();
    const push = (p: CricketPlayer) => { if (!seen.has(p.id)) { seen.add(p.id); allPlayers.push(p); } };

    for (const inn of game.innings) {
      for (const p of inn.battingTeam.players)  push(p);
      for (const p of inn.bowlingTeam.players)  push(p);
    }
    if (allPlayers.length === 0) {
      for (const p of game.homeTeam.players) push(p);
      for (const p of game.awayTeam.players) push(p);
    }

    return computeAllPlayerRatings(allPlayers, {
      format: game.format,
      competitionName: game.competitionName,
      isBattingFriendly: true,
    });
  }, [game?.id, game?.innings.length]);

  return (
    <MobileLayout>
      <div className="p-4 sm:p-5 flex flex-col gap-4 pb-12">
        {/* Back navigation */}
        <div className="flex items-center gap-2">
          <Link href="/cricket">
            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              <ArrowLeft />
              <span>Cricket</span>
            </button>
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <>
            <div className="h-40 rounded-2xl skeleton-shimmer" />
            <Skeleton />
          </>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && game && (
          <>
            <MatchHeader game={game} />

            {/* Task 4: Match summary for completed; pre-match AI preview for upcoming */}
            {game.status === "final" && (
              <MatchSummaryCard game={game} />
            )}

            <MatchIntelligenceCard game={game} />

            {game.innings.length === 0 ? (
              <NoScorecard game={game} />
            ) : (
              game.innings.map((inn) => (
                <InningsSection key={inn.inningsNumber} innings={inn} game={game} ratings={playerRatings} />
              ))
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
}
