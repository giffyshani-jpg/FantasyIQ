import { FavoriteMatchCard } from "./favorite-match-card";
import { useMatchFavorites } from "../hooks/use-match-favorites";
import type { FavoriteMatchSport } from "../lib/match-favorites";

export function FavoritesSection({ sport }: { sport: FavoriteMatchSport }) {
  const { favorites } = useMatchFavorites();
  const matches = favorites.filter((favorite) => favorite.sport === sport);

  if (matches.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-amber-400">Favorites</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground/60">Matches you’re following</p>
        </div>
        <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
          {matches.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((match) => <FavoriteMatchCard key={match.key} match={match} />)}
      </div>
    </section>
  );
}