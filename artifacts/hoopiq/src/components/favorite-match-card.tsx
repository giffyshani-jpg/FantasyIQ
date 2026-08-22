import { Link } from "wouter";
import { StarButton } from "./star-button";
import { useMatchFavorites } from "../hooks/use-match-favorites";
import type { FavoriteMatch } from "../lib/match-favorites";

function statusLabel(match: FavoriteMatch): string {
  if (match.status === "in_progress") return "LIVE";
  if (match.status === "final") return "FINAL";
  return match.startTime ?? "SCHEDULED";
}

export function FavoriteMatchCard({ match }: { match: FavoriteMatch }) {
  const { isFavorite, toggleFavorite } = useMatchFavorites();

  return (
    <Link href={match.href}>
      <article className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 transition-colors hover:border-primary/40">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            {match.competition}
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${match.status === "in_progress" ? "text-primary" : "text-muted-foreground/55"}`}>
              {statusLabel(match)}
            </span>
            <StarButton
              active={isFavorite(match.key)}
              onToggle={() => toggleFavorite(match)}
              label={`Unfavorite ${match.homeTeam.name} vs ${match.awayTeam.name}`}
              size={17}
            />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{match.homeTeam.abbreviation}</p>
            <p className="truncate text-[10px] text-muted-foreground/55">{match.homeTeam.name}</p>
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground/35">vs</span>
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-bold text-foreground">{match.awayTeam.abbreviation}</p>
            <p className="truncate text-[10px] text-muted-foreground/55">{match.awayTeam.name}</p>
          </div>
        </div>
      </article>
    </Link>
  );
}