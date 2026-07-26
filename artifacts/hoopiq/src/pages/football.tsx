// Football hub page — infrastructure only (Task 10).
//
// Route: /football
//
// Architecture is future-ready: provider slot, auto-discovery framework,
// and competition grouping are all in place. Fantasy logic TBD.
// TheSportsDB is used for competition discovery (soccer category).

import React, { useEffect, useState } from "react";
import { MobileLayout } from "../components/layout";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FootballCompetition {
  id: number;
  name: string;
  country: string;
  type: "league" | "cup" | "international";
}

interface FootballProviderStatus {
  loaded: boolean;
  error: string | null;
  competitions: FootballCompetition[];
}

// ─── Known competitions (auto-discovery ready) ────────────────────────────────
// These are seeded for the first render. The provider will auto-discover
// additional competitions when it becomes available.

const SEEDED_COMPETITIONS: FootballCompetition[] = [
  { id: 4328, name: "Premier League",        country: "England",       type: "league"        },
  { id: 4335, name: "La Liga",               country: "Spain",         type: "league"        },
  { id: 4331, name: "Bundesliga",            country: "Germany",       type: "league"        },
  { id: 4332, name: "Serie A",               country: "Italy",         type: "league"        },
  { id: 4334, name: "Ligue 1",               country: "France",        type: "league"        },
  { id: 4530, name: "Eredivisie",            country: "Netherlands",   type: "league"        },
  { id: 4346, name: "Champions League",      country: "Europe",        type: "cup"           },
  { id: 4337, name: "FA Cup",                country: "England",       type: "cup"           },
  { id: 4344, name: "FIFA World Cup",        country: "International", type: "international" },
  { id: 4399, name: "UEFA European Championship", country: "International", type: "international" },
];

const TYPE_LABELS: Record<string, string> = {
  league: "Domestic Leagues",
  cup: "Cups & Knockouts",
  international: "International",
};

// ─── Competition badge ────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    league: "bg-blue-900/30 text-blue-300/70",
    cup: "bg-amber-900/30 text-amber-300/70",
    international: "bg-purple-900/30 text-purple-300/70",
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${colors[type] ?? "bg-muted/30 text-muted-foreground/50"}`}>
      {type}
    </span>
  );
}

// ─── Competition card ─────────────────────────────────────────────────────────

function CompetitionCard({ comp }: { comp: FootballCompetition }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-muted/20 border border-border/25 hover:bg-muted/30 transition-colors">
      <div className="w-9 h-9 rounded-xl bg-blue-900/30 flex items-center justify-center text-lg select-none shrink-0">
        ⚽
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{comp.name}</p>
        <p className="text-[10px] text-muted-foreground/50 truncate">{comp.country}</p>
      </div>
      <TypeBadge type={comp.type} />
    </div>
  );
}

// ─── Grouped competition list ─────────────────────────────────────────────────

function CompetitionList({ competitions }: { competitions: FootballCompetition[] }) {
  const byType = new Map<string, FootballCompetition[]>();
  for (const comp of competitions) {
    if (!byType.has(comp.type)) byType.set(comp.type, []);
    byType.get(comp.type)!.push(comp);
  }

  return (
    <div className="flex flex-col gap-6">
      {["league", "cup", "international"].map(type => {
        const comps = byType.get(type as any);
        if (!comps || comps.length === 0) return null;
        return (
          <div key={type}>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400/50 px-1 mb-2">
              {TYPE_LABELS[type]}
            </p>
            <div className="flex flex-col gap-2">
              {comps.map(c => <CompetitionCard key={c.id} comp={c} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Coming soon banner ───────────────────────────────────────────────────────

function ComingSoonBanner() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-950 to-slate-900 border border-blue-700/25 p-5 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/15 flex items-center justify-center text-2xl select-none shrink-0">
          🚧
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-black text-white mb-1">Football — Coming Soon</h2>
          <p className="text-xs text-blue-200/60 leading-relaxed">
            Live scores, schedules, and fantasy picks for top leagues and international competitions.
            Infrastructure is in place — fantasy logic coming next.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {["Live Scores", "Schedules", "Fantasy Picks", "AI Recommendations"].map(tag => (
              <span key={tag} className="text-[10px] font-semibold text-blue-300/50 bg-blue-900/30 rounded-full px-2.5 py-1 border border-blue-700/20">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FootballPage() {
  const [status, setStatus] = useState<FootballProviderStatus>({
    loaded: false,
    error: null,
    competitions: SEEDED_COMPETITIONS,
  });

  useEffect(() => {
    // Infrastructure only — no live fetch yet.
    // When the football provider is wired in, replace this with:
    //   fetchFootballOverview().then(d => setStatus({ loaded: true, ... }))
    const t = setTimeout(() => {
      setStatus({ loaded: true, error: null, competitions: SEEDED_COMPETITIONS });
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const totalComps = status.competitions.length;

  return (
    <MobileLayout title="Football" showBack backHref="/">
      <div className="p-4 sm:p-5 pb-12">
        {/* Header */}
        <div className="mb-5 pt-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black tracking-tighter">⚽ Football</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {status.loaded
              ? `${totalComps} competitions ready · Scores coming soon`
              : "Loading competition list…"}
          </p>
        </div>

        <ComingSoonBanner />

        {/* Competition list */}
        {status.loaded ? (
          <CompetitionList competitions={status.competitions} />
        ) : (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 rounded-xl skeleton-shimmer" />
            ))}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground/30 text-center">
            Architecture: TheSportsDB · Auto-discovery ready · Fantasy logic TBD
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}
