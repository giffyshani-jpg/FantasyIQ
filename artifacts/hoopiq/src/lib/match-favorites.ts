export type FavoriteMatchSport = "basketball" | "cricket" | "football";

export type FavoriteMatch = {
  key: string;
  sport: FavoriteMatchSport;
  href: string;
  competition: string;
  status: "scheduled" | "in_progress" | "final";
  startTime: string | null;
  homeTeam: { name: string; abbreviation: string; score: string | number | null };
  awayTeam: { name: string; abbreviation: string; score: string | number | null };
};

const STORAGE_KEY = "fantasyiq:match-favorites";

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getStoredMatchFavorites(): FavoriteMatch[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((favorite): favorite is FavoriteMatch => {
      if (!favorite || typeof favorite !== "object") return false;
      const item = favorite as Partial<FavoriteMatch>;
      return (
        typeof item.key === "string" &&
        (item.sport === "basketball" || item.sport === "cricket" || item.sport === "football") &&
        typeof item.href === "string" &&
        typeof item.competition === "string" &&
        (item.status === "scheduled" || item.status === "in_progress" || item.status === "final") &&
        (item.startTime === null || typeof item.startTime === "string") &&
        !!item.homeTeam &&
        !!item.awayTeam
      );
    });
  } catch {
    return [];
  }
}

export function setStoredMatchFavorites(favorites: FavoriteMatch[]): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
}

export function basketballFavorite(game: {
  id: string;
  league: string;
  startTime: string;
  status: FavoriteMatch["status"];
  homeTeam: { name: string; abbreviation: string; score: number | null };
  awayTeam: { name: string; abbreviation: string; score: number | null };
}): FavoriteMatch {
  return {
    key: `basketball:${game.league}:${game.id}`,
    sport: "basketball",
    href: `/${game.league}/game/${game.id}`,
    competition: game.league.toUpperCase(),
    status: game.status,
    startTime: game.startTime,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
  };
}

export function cricketFavorite(game: {
  id: string;
  competitionSlug: string;
  competitionName: string;
  startTime: string;
  startTimeIso?: string | null;
  status: FavoriteMatch["status"];
  homeTeam: { name: string; abbreviation: string; score: string | null };
  awayTeam: { name: string; abbreviation: string; score: string | null };
}): FavoriteMatch {
  return {
    key: `cricket:${game.competitionSlug}:${game.id}`,
    sport: "cricket",
    href: `/cricket/${game.competitionSlug}/game/${encodeURIComponent(game.id)}`,
    competition: game.competitionName,
    status: game.status,
    startTime: game.startTimeIso ?? game.startTime,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
  };
}

export function footballFavorite(game: {
  id: string;
  leagueId: string | number;
  leagueName: string;
  startTimeIso: string | null;
  status: FavoriteMatch["status"];
  homeTeam: { name: string; abbreviation: string; score: string | number | null };
  awayTeam: { name: string; abbreviation: string; score: string | number | null };
}): FavoriteMatch {
  return {
    key: `football:${String(game.leagueId)}:${game.id}`,
    sport: "football",
    href: `/football/${String(game.leagueId)}/game/${encodeURIComponent(game.id)}`,
    competition: game.leagueName,
    status: game.status,
    startTime: game.startTimeIso,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
  };
}