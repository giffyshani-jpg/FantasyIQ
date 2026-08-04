// FantasyIQ — Recently Viewed Section
//
// Shown on the Home page when the user has opened at least one match.
// Displays up to 10 match cards (newest first) with: sport icon, match name,
// league, and start time. Clicking any card navigates to that match.

import { Link } from "wouter";
import { useRecentMatches } from "../hooks/use-recent-matches";

function formatStartTime(startTime: string | null, viewedAt: number): string {
  if (startTime) {
    const d = new Date(startTime);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  // Fall back to when the match was last viewed
  const d = new Date(viewedAt);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RecentlyViewedSection() {
  const { recentMatches, clearAll } = useRecentMatches();

  if (recentMatches.length === 0) return null;

  return (
    <section>
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/65">
            Recently Viewed
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground/40">
            Last {recentMatches.length === 1 ? "match" : `${recentMatches.length} matches`} you opened
          </p>
        </div>
        <button
          type="button"
          onClick={clearAll}
          aria-label="Clear recently viewed matches"
          className="text-[10px] font-semibold text-muted-foreground/35 hover:text-muted-foreground/65 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Match cards grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {recentMatches.map((match) => (
          <Link key={match.key} href={match.href}>
            <article className="group flex items-center gap-3 rounded-xl border border-border/35 bg-card/50 p-3 transition-all hover:border-border/60 hover:bg-card/80 active:scale-[0.99]">
              {/* Sport icon tile */}
              <div className="h-10 w-10 shrink-0 rounded-xl bg-muted/35 flex items-center justify-center text-xl select-none">
                {match.sportIcon}
              </div>

              {/* Match info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground leading-tight">
                  {match.matchName}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/55">
                  {match.league}
                </p>
              </div>

              {/* Start time (right-aligned) */}
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-muted-foreground/40 whitespace-nowrap leading-tight">
                  {formatStartTime(match.startTime, match.viewedAt)}
                </p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
