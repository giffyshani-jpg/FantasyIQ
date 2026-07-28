// AI Match Intelligence card for cricket matches.
//
// Renders intelligence sections for a CricketGame:
//   AI Insights Panel (new) — polished summary of all 10 key signals
//   Match Difficulty · Risk Level
//   Match Conditions (Task 3): Pitch Report · Weather · Dew Factor · Toss Bias
//                              Pace vs Spin · Batting % · Bowling %
//   Captain/VC Engine (Task 2): Best Captain · Best VC · Safe Pick · GL Diff · Risk Pick
//   Legacy: Differential Picks
//
// Collapsed by default — tap header to expand.
// MOCK badge is always shown until isMock is removed from the engine.
//
// Usage:
//   import { MatchIntelligenceCard } from "../components/cricket-match-intelligence";
//   <MatchIntelligenceCard game={game} />

import React, { useMemo, useState } from "react";
import type { CricketGame } from "../lib/cricket-types";
import { computeMatchIntelligence } from "../lib/cricket-ai-intelligence";
import type {
  AIPlayerPick,
  CaptainLabel,
  CaptainVCPick,
  DifficultyLevel,
  MatchIntelligence,
  PaceSpinBias,
  DewImpact,
  RiskLevel,
} from "../lib/cricket-ai-intelligence";

// ── Micro icons ───────────────────────────────────────────────────────────────

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
  Droplets: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/>
      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>
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
  Zap: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Wind: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
    </svg>
  ),
  Chevron: ({ open }: { open: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
  Sparkles: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  ),
};

// ── Shared primitives ─────────────────────────────────────────────────────────

function ScoreBar({ score, color = "bg-primary" }: { score: number; color?: string }) {
  return (
    <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden flex-1">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(4, score)}%` }} />
    </div>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-muted-foreground/40">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border/15" />;
}

// ── Badges ────────────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    LOW:     "bg-green-900/50 text-green-300 border-green-700/40",
    MEDIUM:  "bg-yellow-900/50 text-yellow-300 border-yellow-700/40",
    HIGH:    "bg-orange-900/50 text-orange-300 border-orange-700/40",
    EXTREME: "bg-red-900/50 text-red-300 border-red-700/40",
  };
  return (
    <span className={`inline-flex text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 border ${styles[level]}`}>
      {level}
    </span>
  );
}

function DifficultyBadge({ level, score }: { level: DifficultyLevel; score: number }) {
  const cls = score >= 68
    ? "bg-red-900/40 text-red-300 border-red-700/30"
    : score >= 42
      ? "bg-yellow-900/40 text-yellow-300 border-yellow-700/30"
      : "bg-green-900/40 text-green-300 border-green-700/30";
  return (
    <span className={`inline-flex text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 border ${cls}`}>
      {level}
    </span>
  );
}

function RolePill({ role }: { role: string }) {
  const label = role === "wk" ? "WK" : role === "all" ? "AR" : role.toUpperCase();
  return (
    <span className="text-[9px] text-muted-foreground/40 bg-muted/20 rounded px-1.5 py-0.5 uppercase">
      {label}
    </span>
  );
}

function PaceSpinBadge({ bias }: { bias: PaceSpinBias }) {
  const cfg: Record<PaceSpinBias, { label: string; cls: string }> = {
    PACE_DOMINANT: { label: "Pace Dominant", cls: "bg-blue-900/40 text-blue-300 border-blue-700/30" },
    SLIGHT_PACE:   { label: "Slight Pace",   cls: "bg-blue-900/30 text-blue-300/80 border-blue-700/20" },
    BALANCED:      { label: "Balanced",      cls: "bg-muted/30 text-muted-foreground/60 border-border/30" },
    SLIGHT_SPIN:   { label: "Slight Spin",   cls: "bg-purple-900/30 text-purple-300/80 border-purple-700/20" },
    SPIN_DOMINANT: { label: "Spin Dominant", cls: "bg-purple-900/40 text-purple-300 border-purple-700/30" },
  };
  const { label, cls } = cfg[bias];
  return (
    <span className={`inline-flex text-[9px] font-bold rounded px-1.5 py-0.5 border ${cls}`}>
      {label}
    </span>
  );
}

function DewBadge({ factor }: { factor: DewImpact }) {
  const cfg: Record<DewImpact, { label: string; cls: string }> = {
    NONE:     { label: "No Dew",      cls: "bg-muted/20 text-muted-foreground/40 border-border/20" },
    LOW:      { label: "Low Dew",     cls: "bg-cyan-900/20 text-cyan-400/60 border-cyan-700/20" },
    MODERATE: { label: "Moderate Dew",cls: "bg-cyan-900/40 text-cyan-300 border-cyan-700/30" },
    HIGH:     { label: "Heavy Dew",   cls: "bg-cyan-900/60 text-cyan-200 border-cyan-600/40" },
  };
  const { label, cls } = cfg[factor];
  return (
    <span className={`inline-flex text-[9px] font-bold rounded px-1.5 py-0.5 border ${cls}`}>
      {label}
    </span>
  );
}

// ── Captain label badge ───────────────────────────────────────────────────────

const CAPTAIN_LABEL_CONFIG: Record<CaptainLabel, { icon: string; short: string; cls: string }> = {
  BEST_CAPTAIN:  { icon: "⭐", short: "C",    cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
  BEST_VC:       { icon: "⭐", short: "VC",   cls: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  SAFE_PICK:     { icon: "🛡", short: "SAFE", cls: "bg-green-500/20 text-green-300 border-green-500/40" },
  GRAND_LEAGUE:  { icon: "🔥", short: "GL",   cls: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  RISK_PICK:     { icon: "⚠", short: "RISK", cls: "bg-red-500/20 text-red-300 border-red-500/40" },
};

// ── AI Insights Panel ─────────────────────────────────────────────────────────

/** Compact captain insight card used inside the 2-column top row */
function CaptainInsightCard({ pick }: { pick: CaptainVCPick }) {
  const cfg = CAPTAIN_LABEL_CONFIG[pick.label];
  const aiColor =
    pick.aiRating >= 80 ? "text-yellow-300" :
    pick.aiRating >= 65 ? "text-green-300" :
    pick.aiRating >= 50 ? "text-blue-300" :
    "text-muted-foreground/50";

  return (
    <div className="rounded-xl border border-border/20 bg-muted/10 p-2.5 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`text-[9px] font-black rounded px-1.5 py-0.5 border ${cfg.cls}`}>
          {cfg.icon} {cfg.short}
        </span>
      </div>
      <p className="text-[11px] font-bold text-foreground truncate leading-tight">
        {pick.player.name || "TBD"}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <RolePill role={pick.player.role} />
        <span className={`text-[10px] font-black ${aiColor}`}>AI {pick.aiRating}</span>
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className="text-[9px] text-muted-foreground/35">Score</span>
        <span className="text-[10px] font-bold text-primary/70">{pick.captainScore}</span>
        <span className="text-[9px] text-muted-foreground/25">·</span>
        <span className="text-[9px] text-muted-foreground/35">Conf</span>
        <span className="text-[10px] font-bold text-muted-foreground/55">{pick.confidencePct}%</span>
      </div>
    </div>
  );
}

/** Small pick chip for Differential / Safe / Risk picks */
function PickChip({ pick, variant }: { pick: CaptainVCPick; variant: "differential" | "safe" | "risk" }) {
  const cfg = {
    differential: {
      icon: "🔥",
      label: "DIFF",
      cls: "border-purple-600/30 bg-purple-900/15",
      nameColor: "text-purple-200",
      labelCls: "text-purple-400/70",
    },
    safe: {
      icon: "🛡",
      label: "SAFE",
      cls: "border-green-600/30 bg-green-900/15",
      nameColor: "text-green-200",
      labelCls: "text-green-400/70",
    },
    risk: {
      icon: "⚠",
      label: "RISK",
      cls: "border-red-600/30 bg-red-900/15",
      nameColor: "text-red-200",
      labelCls: "text-red-400/70",
    },
  }[variant];

  return (
    <div className={`rounded-xl border ${cfg.cls} px-2.5 py-2 flex flex-col gap-0.5 min-w-0`}>
      <div className="flex items-center gap-1">
        <span className="text-[10px]">{cfg.icon}</span>
        <span className={`text-[8px] font-black uppercase tracking-wider ${cfg.labelCls}`}>{cfg.label}</span>
      </div>
      <p className={`text-[10px] font-bold truncate leading-tight ${cfg.nameColor}`}>
        {pick.player.name
          ? pick.player.name.split(" ").slice(-1)[0]
          : "TBD"}
      </p>
      <span className="text-[8px] text-muted-foreground/35">AI {pick.aiRating}</span>
    </div>
  );
}

/** Single metric row with optional progress bar */
function MetricRow({
  icon,
  label,
  value,
  bar,
  barColor,
}: {
  icon: string;
  label: string;
  value: string;
  bar?: number;
  barColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[11px] shrink-0 w-4 text-center">{icon}</span>
      <span className="text-[10px] text-muted-foreground/50 shrink-0 w-24">{label}</span>
      {bar !== undefined ? (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <ScoreBar score={bar} color={barColor ?? "bg-primary/60"} />
          <span className="text-[10px] font-bold text-foreground/60 shrink-0">{value}</span>
        </div>
      ) : (
        <span className="text-[10px] font-semibold text-foreground/60 truncate flex-1">{value}</span>
      )}
    </div>
  );
}

/** Polished AI Insights summary panel — top of expanded card */
function AIInsightsPanel({ intel }: { intel: MatchIntelligence }) {
  const { captainEngine, matchConditions, matchDifficulty } = intel;
  const { pitchReport, weather, tossBias } = matchConditions;

  const confidenceColor =
    captainEngine.teamConfidencePct >= 75 ? "bg-green-400/70" :
    captainEngine.teamConfidencePct >= 55 ? "bg-amber-400/70" :
    "bg-red-400/60";

  const diffColor =
    matchDifficulty.score >= 68 ? "bg-red-400/70" :
    matchDifficulty.score >= 42 ? "bg-amber-400/70" :
    "bg-green-400/70";

  return (
    <div className="px-4 pt-3 pb-4 space-y-3">
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <span className="text-primary/50"><Icons.Sparkles /></span>
        <span className="text-[10px] font-black uppercase tracking-widest text-primary/50">AI Insights</span>
        <div className="flex-1 h-px bg-primary/10" />
        <span className="text-[9px] text-muted-foreground/25 font-semibold uppercase tracking-wide">MOCK</span>
      </div>

      {/* ── Captain + VC row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <CaptainInsightCard pick={captainEngine.bestCaptain} />
        <CaptainInsightCard pick={captainEngine.bestVC} />
      </div>

      {/* ── Pick chips: Differential / Safe / Risk ─────────────────────────── */}
      <div className="grid grid-cols-3 gap-1.5">
        <PickChip pick={captainEngine.grandLeagueDiff} variant="differential" />
        <PickChip pick={captainEngine.safePick} variant="safe" />
        <PickChip pick={captainEngine.riskPick} variant="risk" />
      </div>

      {/* ── Metrics ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/15 bg-muted/8 px-3 py-2.5 space-y-2">
        <MetricRow
          icon="📈"
          label="Team Confidence"
          value={`${captainEngine.teamConfidencePct}%`}
          bar={captainEngine.teamConfidencePct}
          barColor={confidenceColor}
        />
        <MetricRow
          icon="🎯"
          label="Match Difficulty"
          value={`${matchDifficulty.level} · ${matchDifficulty.score}/100`}
          bar={matchDifficulty.score}
          barColor={diffColor}
        />
        <MetricRow
          icon="🪙"
          label="Toss Importance"
          value={`${tossBias.label} · ${tossBias.importanceScore}%`}
          bar={tossBias.importanceScore}
          barColor="bg-yellow-400/70"
        />
        <MetricRow
          icon="🌤"
          label="Weather"
          value={weather.isPlaceholder ? "Awaiting data" : weather.label}
        />
        <MetricRow
          icon="🏟"
          label="Pitch"
          value={`${pitchReport.label} · Bat ${pitchReport.battingFriendlyPct}%`}
          bar={pitchReport.battingFriendlyPct}
          barColor="bg-orange-400/60"
        />
      </div>
    </div>
  );
}

// ── Captain/VC full pick row (detailed section) ───────────────────────────────

function CaptainVCPickRow({ pick }: { pick: CaptainVCPick }) {
  const cfg = CAPTAIN_LABEL_CONFIG[pick.label];
  const riskColor = pick.riskPct >= 60
    ? "text-red-400/70"
    : pick.riskPct >= 35
      ? "text-yellow-400/70"
      : "text-green-400/70";

  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-border/10 last:border-0">
      {/* Label badge */}
      <span className={`shrink-0 text-[9px] font-black rounded px-1.5 py-0.5 border mt-0.5 ${cfg.cls}`}>
        {cfg.icon} {cfg.short}
      </span>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-foreground leading-tight">{pick.player.name}</span>
          <span className="text-[9px] text-muted-foreground/50 bg-muted/30 rounded px-1.5 py-0.5">
            {pick.teamAbbreviation}
          </span>
          <RolePill role={pick.player.role} />
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-relaxed">{pick.rationale}</p>

        {/* Score row */}
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/30">Score</span>
            <span className="text-[10px] font-bold text-primary/70">{pick.captainScore}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/30">Risk</span>
            <span className={`text-[10px] font-bold ${riskColor}`}>{pick.riskPct}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/30">Conf</span>
            <span className="text-[10px] font-bold text-muted-foreground/60">{pick.confidencePct}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/30">AI</span>
            <span className="text-[10px] font-bold text-amber-400/70">{pick.aiRating}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Legacy differential pick row ──────────────────────────────────────────────

function DifferentialPickRow({ pick }: { pick: AIPlayerPick }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/10 last:border-0">
      <span className="shrink-0 text-[9px] font-black rounded px-1.5 py-0.5 border mt-0.5 bg-purple-500/20 text-purple-300 border-purple-500/40">
        D
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-foreground leading-tight">{pick.player.name}</span>
          <span className="text-[9px] text-muted-foreground/50 bg-muted/30 rounded px-1.5 py-0.5">
            {pick.teamAbbreviation}
          </span>
          <RolePill role={pick.player.role} />
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-relaxed">{pick.rationale}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className="text-[10px] font-bold text-primary/60">{pick.confidence}%</span>
        <p className="text-[9px] text-muted-foreground/35">conf.</p>
      </div>
    </div>
  );
}

// ── Placeholder pill ──────────────────────────────────────────────────────────

function PlaceholderPill({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-border/25 px-3 py-2.5 bg-muted/8">
      <span className="text-[9px] font-bold text-muted-foreground/25 uppercase tracking-widest shrink-0 mt-0.5">—</span>
      <p className="text-[10px] text-muted-foreground/40 leading-relaxed">{text}</p>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function MatchIntelligenceCard({ game }: { game: CricketGame }) {
  const [open, setOpen] = useState(false);

  const intel: MatchIntelligence = useMemo(
    () => computeMatchIntelligence(game),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game.id, game.innings.length, game.status],
  );

  const { matchConditions, captainEngine } = intel;
  const { pitchReport, weather, tossBias } = matchConditions;

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent overflow-hidden">
      {/* ── Collapsed header ─────────────────────────────────────────────── */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-primary/60"><Icons.Brain /></span>
          <span className="text-sm font-black text-foreground">AI Match Intelligence</span>
          <span className="text-[9px] font-bold text-amber-400/60 bg-amber-900/20 border border-amber-700/20 rounded px-1.5 py-0.5 uppercase tracking-wide">
            MOCK
          </span>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge level={intel.riskLevel} />
          <span className="text-muted-foreground/40"><Icons.Chevron open={open} /></span>
        </div>
      </button>

      {/* ── Expanded body ─────────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-primary/10 flex flex-col divide-y divide-border/15">

          {/* ── AI Insights Panel (new polished summary) ──────────────────── */}
          <AIInsightsPanel intel={intel} />

          {/* Row 1 — Difficulty + Risk ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-0 divide-x divide-border/15">
            <div className="px-4 py-3">
              <SectionHeader icon={<Icons.Clock />} label="Match Difficulty" />
              <div className="flex items-center gap-2 mb-1.5">
                <DifficultyBadge level={intel.matchDifficulty.level} score={intel.matchDifficulty.score} />
                <span className="text-[10px] text-muted-foreground/35">{intel.matchDifficulty.score}/100</span>
              </div>
              <p className="text-[10px] text-muted-foreground/45 leading-relaxed">
                {intel.matchDifficulty.rationale}
              </p>
            </div>
            <div className="px-4 py-3">
              <SectionHeader icon={<Icons.Warning />} label="Risk Level" />
              <div className="mb-1.5"><RiskBadge level={intel.riskLevel} /></div>
              <p className="text-[10px] text-muted-foreground/45 leading-relaxed">{intel.riskRationale}</p>
            </div>
          </div>

          {/* ── Pitch Report ──────────────────────────────────────────────── */}
          <div className="px-4 py-3">
            <SectionHeader icon={<Icons.Database />} label="Pitch Report" />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-foreground/80">{pitchReport.label}</span>
              <PaceSpinBadge bias={pitchReport.paceSpinBias} />
              <span className="text-[9px] font-bold text-muted-foreground/30 bg-muted/20 border border-border/20 rounded px-1.5 py-0.5">
                PLACEHOLDER
              </span>
            </div>
            {/* Batting/Bowling bars */}
            <div className="flex flex-col gap-1.5 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/50 w-14 shrink-0">Batting</span>
                <ScoreBar score={pitchReport.battingFriendlyPct}
                  color={intel.isBattingFriendly ? "bg-orange-400/80" : "bg-muted/50"} />
                <span className="text-[10px] font-bold text-muted-foreground/50 w-7 text-right">
                  {pitchReport.battingFriendlyPct}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/50 w-14 shrink-0">Bowling</span>
                <ScoreBar score={pitchReport.bowlingFriendlyPct}
                  color={!intel.isBattingFriendly ? "bg-blue-400/80" : "bg-muted/50"} />
                <span className="text-[10px] font-bold text-muted-foreground/50 w-7 text-right">
                  {pitchReport.bowlingFriendlyPct}%
                </span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/40 leading-relaxed">{pitchReport.rationale}</p>
            <p className="text-[10px] text-muted-foreground/35 mt-1.5 leading-relaxed">
              {pitchReport.paceSpinRationale}
            </p>
          </div>

          {/* ── Weather + Dew Factor ─────────────────────────────────────── */}
          <div className="px-4 py-3">
            <SectionHeader icon={<Icons.Cloud />} label="Weather" />
            {weather.isPlaceholder ? (
              <PlaceholderPill text={weather.impact} />
            ) : (
              <p className="text-[10px] text-muted-foreground/45 leading-relaxed">{weather.impact}</p>
            )}
            {/* Dew Factor */}
            <div className="mt-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-muted-foreground/40"><Icons.Droplets /></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                  Dew Factor
                </span>
                <DewBadge factor={weather.dewFactor} />
              </div>
              <p className="text-[10px] text-muted-foreground/40 leading-relaxed">{weather.dewRationale}</p>
            </div>
          </div>

          {/* ── Toss Bias ─────────────────────────────────────────────────── */}
          <div className="px-4 py-3">
            <SectionHeader icon={<Icons.Coin />} label="Toss Bias" />
            <div className="flex items-center gap-2 mb-1.5">
              <ScoreBar score={tossBias.importanceScore} color="bg-yellow-400/70" />
              <span className="text-[10px] font-bold text-yellow-300/70 shrink-0">{tossBias.label}</span>
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-muted-foreground/40">Preferred:</span>
              <span className="text-[10px] font-bold text-foreground/60">{tossBias.preferredDecision} FIRST</span>
            </div>
            <p className="text-[10px] text-muted-foreground/40 leading-relaxed">{tossBias.rationale}</p>
          </div>

          {/* ── Match Conditions Summary ─────────────────────────────────── */}
          <div className="px-4 py-3">
            <SectionHeader icon={<Icons.Wind />} label="Match Conditions" />
            <div className="grid grid-cols-2 gap-3">
              {/* Batting Friendly % */}
              <div>
                <p className="text-[9px] text-muted-foreground/35 mb-1 uppercase tracking-wider">
                  Batting Friendly
                </p>
                <div className="flex items-center gap-1.5">
                  <ScoreBar score={matchConditions.battingFriendlyPct} color="bg-orange-400/70" />
                  <span className="text-[10px] font-bold text-orange-400/70 shrink-0">
                    {matchConditions.battingFriendlyPct}%
                  </span>
                </div>
              </div>
              {/* Bowling Friendly % */}
              <div>
                <p className="text-[9px] text-muted-foreground/35 mb-1 uppercase tracking-wider">
                  Bowling Friendly
                </p>
                <div className="flex items-center gap-1.5">
                  <ScoreBar score={matchConditions.bowlingFriendlyPct} color="bg-blue-400/70" />
                  <span className="text-[10px] font-bold text-blue-400/70 shrink-0">
                    {matchConditions.bowlingFriendlyPct}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Captain/VC Engine (full detail) ──────────────────────────── */}
          <div className="px-4 py-3">
            <SectionHeader icon={<Icons.Star />} label="Captain / VC Engine" />
            <div className="flex flex-col">
              <CaptainVCPickRow pick={captainEngine.bestCaptain} />
              <CaptainVCPickRow pick={captainEngine.bestVC} />
              <CaptainVCPickRow pick={captainEngine.safePick} />
              <CaptainVCPickRow pick={captainEngine.grandLeagueDiff} />
              <CaptainVCPickRow pick={captainEngine.riskPick} />
            </div>
          </div>

          {/* ── Differential Picks ────────────────────────────────────────── */}
          {intel.differentialPicks.length > 0 && (
            <div className="px-4 py-3">
              <SectionHeader icon={<Icons.TrendUp />} label="Differential Picks" />
              <div className="flex flex-col">
                {intel.differentialPicks.map((pick) => (
                  <DifferentialPickRow key={pick.player.id} pick={pick} />
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5">
            <p className="text-[9px] text-muted-foreground/25 text-center leading-relaxed">
              AI Mock Engine v0.3 · Format heuristics · No live pitch, weather, or dew data · 5 picks + confidence
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
