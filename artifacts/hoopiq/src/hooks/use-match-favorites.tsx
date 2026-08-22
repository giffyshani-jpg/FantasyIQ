import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getStoredMatchFavorites,
  setStoredMatchFavorites,
  type FavoriteMatch,
} from "../lib/match-favorites";

type MatchFavoritesContextValue = {
  favorites: FavoriteMatch[];
  isFavorite: (key: string) => boolean;
  toggleFavorite: (match: FavoriteMatch) => void;
};

const MatchFavoritesContext = createContext<MatchFavoritesContextValue | null>(null);

export function MatchFavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteMatch[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFavorites(getStoredMatchFavorites());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) setStoredMatchFavorites(favorites);
  }, [favorites, hydrated]);

  const isFavorite = useCallback(
    (key: string) => favorites.some((favorite) => favorite.key === key),
    [favorites],
  );

  const toggleFavorite = useCallback((match: FavoriteMatch) => {
    setFavorites((current) =>
      current.some((favorite) => favorite.key === match.key)
        ? current.filter((favorite) => favorite.key !== match.key)
        : [...current, match],
    );
  }, []);

  const value = useMemo(
    () => ({ favorites, isFavorite, toggleFavorite }),
    [favorites, isFavorite, toggleFavorite],
  );

  return <MatchFavoritesContext.Provider value={value}>{children}</MatchFavoritesContext.Provider>;
}

export function useMatchFavorites(): MatchFavoritesContextValue {
  const context = useContext(MatchFavoritesContext);
  if (!context) throw new Error("useMatchFavorites must be used inside MatchFavoritesProvider");
  return context;
}