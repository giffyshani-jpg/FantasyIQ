// AI Match Intelligence card for cricket matches.
//
// Renders 9 intelligence sections for a CricketGame:
//   Match Difficulty · Pitch Profile · Weather (placeholder) · Toss Importance
//   Batting/Bowling Surface · Captain Picks · VC Picks · Differential Picks · Risk Level
//
// Collapsed by default — tap header to expand.
// MOCK badge is always shown until isMock is removed from the intelligence engine.
//
// Usage:
//   import { MatchIntelligenceCard } from "../components/cricket-match-intelligence";
//   <MatchIntelligenceCard game={game} />

import React, { useMemo, useState } from "react";
import type { CricketGame } from "../lib/cricket-types";
import {
  computeMatchIntelligence,
} from "../lib/cricket-ai-intelligence";
import type {
  AIPlayerPick,
  DifficultyLevel,
  MatchIntelligence,
  RiskLevel,
} from "../lib/cricket-ai-intelligence";

// ── Micro icons (all inline SVG — zero extra deps) ────────────────────────────

const Icons = {
  Brain: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={13} height={13} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
    </svg>
  ),
  Clock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  Warning: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  ),
  Database: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
    </svg>
  ),
  Cloud: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
    </svg>
  ),
  Coin: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>
    </svg>
  ),
  Star: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  TrendUp: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  Chevron: ({ open }: { open: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
};

// ── Shared primitives ─────────────────────────────────────────────────────────

function ScoreBar({
  score,
  color = "bg-primary",
}: {
  score: number;
  color?: string;
}) {
  return (
    <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden flex-1">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(4, score)}%` }}
      />
    </div>
  );
}

function SectionHeader({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-muted-foreground/40">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
        {label}
      </span>
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    LOW: "bg-green-900/50 text-green-300 border-green-700/40",
    MEDIUM: "bg-yellow-900/50 text-yellow-300 border-yellow-700/40",
    HIGH: "bg-orange-900/50 text-orange-300 border-orange-700/40",
    EXTREME: "bg-red-900/50 text-red-300 border-red-700/40",
  };
  return (
    <span
      className={`inline-flex text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 border ${styles[level]}`}
    >
      {level}
    </span>
  );
}

function DifficultyBadge({
  level,
  score,
}: {
  level: DifficultyLevel;
  score: number;
}) {
  const cls =
    score >= 68
      ? "bg-red-900/40 text-red-300 border-red-700/30"
      : score >= 42
        ? "bg-yellow-900/40 text-yellow-300 border-yellow-700/30"
        : "bg-green-900/40 text-green-300 border-green-700/30";
  return (
    <span
      className={`inline-flex text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 border ${cls}`}
    >
      {level}
    </span>
  );
}

function RolePill({ role }: { role: string }) {
  const label =
    role === "wk" ? "WK" : role === "all" ? "AR" : role.toUpperCase();
  return (
    <span className="text-[9px] text-muted-foreground/40 bg-muted/20 rounded px-1.5 py-0.5 uppercase">
      {label}
    </span>
  );
}

// ── Player pick row ───────────────────────────────────────────────────────────

const RANK_STYLES = {
  C: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  VC: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  D: "bg-purple-500/20 text-purple-300 border-purple-500/40",
} as const;

function PlayerPickRow({
  pick,
  rank,
}: {
  pick: AIPlayerPick;
  rank: "C" | "VC" | "D";
}) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/10 last:border-0">
      <span
        className={`shrink-0 text-[9px] font-black rounded px-1.5 py-0.5 border mt-0.5 ${RANK_STYLES[rank]}`}
      >
        {rank}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-foreground leading-tight">
            {pick.player.name}
          </span>
          <span className="text-[9px] text-muted-foreground/50 bg-muted/30 rounded px-1.5 py-0.5">
            {pick.teamAbbreviation}
          </span>
          <RolePill role={pick.player.role} />
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-relaxed">
          {pick.rationale}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <span className="text-[10px] font-bold text-primary/60">
          {pick.confidence}%
        </span>
        <p className="text-[9px] text-muted-foreground/35">conf.</p>
      </div>
    </div>
  );
}

// ── Placeholder pill ──────────────────────────────────────────────────────────

function PlaceholderPill({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-border/25 px-3 py-2.5 bg-muted/8">
      <span className="text-[9px] font-bold text-muted-foreground/25 uppercase tracking-widest shrink-0 mt-0.5">
        —
      </span>
      <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
        {text}
      </p>
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return <div className="border-t border-border/15" />;
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function MatchIntelligenceCard({ game }: { game: CricketGame }) {
  const [open, setOpen] = useState(false);

  // Recompute only when game ID or innings count changes (new scorecard data)
  const intel: MatchIntelligence = useMemo(
    () => computeMatchIntelligence(game),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game.id, game.innings.length, game.status],
  );

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent overflow-hidden">
      {/* ── Collapsed header — always visible ────────────────────────────── */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-primary/60">
            <Icons.Brain />
          </span>
          <span className="text-sm font-black text-foreground">
            AI Match Intelligence
          </span>
          <span className="text-[9px] font-bold text-amber-400/60 bg-amber-900/20 border border-amber-700/20 rounded px-1.5 py-0.5 uppercase tracking-wide">
            MOCK
          </span>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge level={intel.riskLevel} />
          <span className="text-muted-foreground/40">
            <Icons.Chevron open={open} />
          </span>
        </div>
      </button>

      {/* ── Expanded body ─────────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-primary/10 flex flex-col divide-y divide-border/15">

          {/* Row 1 — Difficulty + Risk ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-0 divide-x divide-border/15">
            {/* Match Difficulty */}
            <div className="px-4 py-3">
              <SectionHeader icon={<Icons.Clock />} label="Match Difficulty" />
              <div className="flex items-center gap-2 mb-1.5">
                <DifficultyBadge
                  level={intel.matchDifficulty.level}
                  score={intel.matchDifficulty.score}
                />
                <span className="text-[10px] text-muted-foreground/35">
                  {intel.matchDifficulty.score}/100
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/45 leading-relaxed">
                {intel.matchDifficulty.rationale}
              </p>
            </div>

            {/* Risk Level */}
            <div className="px-4 py-3">
              <SectionHeader icon={<Icons.Warning />} label="Risk Level" />
              <div className="mb-1.5">
                <RiskBadge level={intel.riskLevel} />
              </div>
              <p className="text-[10px] text-muted-foreground/45 leading-relaxed">
                {intel.riskRationale}
              </p>
            </div>
          </div>

          {/* Pitch Profile ──────────────────────────────────────────────────── */}
          <div className="px-4 py-3">
            <SectionHeader icon={<Icons.Database />} label="Pitch Profile" />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-foreground/80">
                {intel.surface.label}
              </span>
              <span className="text-[9px] font-bold text-muted-foreground/30 bg-muted/20 border border-border/20 rounded px-1.5 py-0.5">
                PLACEHOLDER
              </span>
            </div>
            <div className="flex flex-col gap-1.5 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/50 w-14 shrink-0">
                  Batting
                </span>
                <ScoreBar
                  score={intel.surface.battingScore}
                  color={
                    intel.isBattingFriendly
                      ? "bg-orange-400/80"
                      : "bg-muted/50"
                  }
                />
                <span className="text-[10px] font-bold text-muted-foreground/50 w-6 text-right">
                  {intel.surface.battingScore}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/50 w-14 shrink-0">
                  Bowling
                </span>
                <ScoreBar
                  score={intel.surface.bowlingScore}
                  color={
                    !intel.isBattingFriendly
                      ? "bg-blue-400/80"
                      : "bg-muted/50"
                  }
                />
                <span className="text-[10px] font-bold text-muted-foreground/50 w-6 text-right">
                  {intel.surface.bowlingScore}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
              {intel.surface.rationale}
            </p>
          </div>

          {/* Toss Importance ───────────────────────────────────────────────── */}
          <div className="px-4 py-3">
            <SectionHeader icon={<Icons.Coin />} label="Toss Importance" />
            <div className="flex items-center gap-2 mb-1.5">
              <ScoreBar
                score={intel.toss.importanceScore}
                color="bg-yellow-400/70"
              />
              <span className="text-[10px] font-bold text-yellow-300/70 shrink-0">
                {intel.toss.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-muted-foreground/40">
                Preferred:
              </span>
              <span className="text-[10px] font-bold text-foreground/60">
                {intel.toss.preferredDecision} FIRST
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
              {intel.toss.rationale}
            </p>
          </div>

          {/* Weather ───────────────────────────────────────────────────────── */}
          <div className="px-4 py-3">
            <SectionHeader icon={<Icons.Cloud />} label="Weather" />
            <PlaceholderPill text={intel.weather.impact} />
          </div>

          {/* Captain Picks ─────────────────────────────────────────────────── */}
          {intel.captainPicks.length > 0 && (
            <div className="px-4 py-3">
              <SectionHeader icon={<Icons.Star />} label="Captain Picks" />
              <div className="flex flex-col">
                {intel.captainPicks.map((pick) => (
                  <PlayerPickRow key={pick.player.id} pick={pick} rank="C" />
                ))}
              </div>
            </div>
          )}

          {/* Vice Captain Picks ────────────────────────────────────────────── */}
          {intel.viceCaptainPicks.length > 0 && (
            <div className="px-4 py-3">
              <SectionHeader icon={<Icons.Star />} label="Vice Captain Picks" />
              <div className="flex flex-col">
                {intel.viceCaptainPicks.map((pick) => (
                  <PlayerPickRow key={pick.player.id} pick={pick} rank="VC" />
                ))}
              </div>
            </div>
          )}

          {/* Differential Picks ────────────────────────────────────────────── */}
          {intel.differentialPicks.length > 0 && (
            <div className="px-4 py-3">
              <SectionHeader
                icon={<Icons.TrendUp />}
                label="Differential Picks"
              />
              <div className="flex flex-col">
                {intel.differentialPicks.map((pick) => (
                  <PlayerPickRow key={pick.player.id} pick={pick} rank="D" />
                ))}
              </div>
            </div>
          )}

          {/* Footer disclaimer ─────────────────────────────────────────────── */}
          <div className="px-4 py-2.5">
            <p className="text-[9px] text-muted-foreground/25 text-center leading-relaxed">
              AI Mock Engine v0.1 · Format heuristics · No live pitch or weather
              data · Captain/VC derived from scorecard when available
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
