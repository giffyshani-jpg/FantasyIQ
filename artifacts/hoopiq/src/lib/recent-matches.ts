// FantasyIQ — Recent Matches store
//
// Tracks the last MAX_RECENT match detail pages the user opened.
// Stored in localStorage, deduped by key, newest first, capped at MAX_RECENT.
// No backend, no API dependencies.

export type RecentMatchSport = "basketball" | "cricket" | "football";

export type RecentMatch = {
  /** Unique dedup key — "sport:league:id" */
  key: string;
  sport: RecentMatchSport;
  href: string;
  /** Display name shown in the card — e.g. "BOS vs LAL" */
  matchName: string;
  /** League or competition name — e.g. "NBA", "IPL 2026" */
  league: string;
  /** Emoji sport icon displayed alongside the match */
  sportIcon: string;
  /** ISO start time, or null when not available */
  startTime: string | null;
  /** Unix milliseconds when this match was last opened */
  viewedAt: number;
};

const STORAGE_KEY = "fantasyiq:recent-matches";
const MAX_RECENT = 10;

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getStoredRecentMatches(): RecentMatch[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RecentMatch => {
      if (!item || typeof item !== "object") return false;
      const m = item as Partial<RecentMatch>;
      return (
        typeof m.key === "string" &&
        (m.sport === "basketball" || m.sport === "cricket" || m.sport === "football") &&
        typeof m.href === "string" &&
        typeof m.matchName === "string" &&
        typeof m.league === "string" &&
        typeof m.sportIcon === "string" &&
        (m.startTime === null || typeof m.startTime === "string") &&
        typeof m.viewedAt === "number"
      );
    });
  } catch {
    return [];
  }
}

/**
 * Add or refresh a match at the front of the recent list.
 * Deduplicates by key, always keeps newest first, trims to MAX_RECENT.
 */
export function addRecentMatch(match: RecentMatch): void {
  if (!hasStorage()) return;
  const current = getStoredRecentMatches();
  // Remove any existing entry with the same key first (dedup)
  const filtered = current.filter((m) => m.key !== match.key);
  // Prepend and cap
  const updated = [match, ...filtered].slice(0, MAX_RECENT);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearRecentMatches(): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

// ── Builder helpers (mirror the shape of match-favorites.ts builders) ────────

export function recentBasketballMatch(game: {
  id: string;
  league: string;
  startTimeIso?: string | null;
  homeTeam: { name: string; abbreviation: string };
  awayTeam: { name: string; abbreviation: string };
}): RecentMatch {
  return {
    key: `basketball:${game.league}:${game.id}`,
    sport: "basketball",
    href: `/${game.league}/game/${game.id}`,
    matchName: `${game.homeTeam.abbreviation} vs ${game.awayTeam.abbreviation}`,
    league: game.league.toUpperCase(),
    sportIcon: "🏀",
    startTime: game.startTimeIso ?? null,
    viewedAt: Date.now(),
  };
}

export function recentCricketMatch(game: {
  id: string;
  competitionSlug: string;
  competitionName: string;
  startTimeIso?: string | null;
  homeTeam: { name: string; abbreviation: string };
  awayTeam: { name: string; abbreviation: string };
}): RecentMatch {
  return {
    key: `cricket:${game.competitionSlug}:${game.id}`,
    sport: "cricket",
    href: `/cricket/${game.competitionSlug}/game/${encodeURIComponent(game.id)}`,
    matchName: `${game.homeTeam.abbreviation} vs ${game.awayTeam.abbreviation}`,
    league: game.competitionName,
    sportIcon: "🏏",
    startTime: game.startTimeIso ?? null,
    viewedAt: Date.now(),
  };
}

export function recentFootballMatch(game: {
  id: string;
  leagueId: string | number;
  leagueName: string;
  startTimeIso?: string | null;
  homeTeam: { name: string; abbreviation: string };
  awayTeam: { name: string; abbreviation: string };
}): RecentMatch {
  return {
    key: `football:${String(game.leagueId)}:${game.id}`,
    sport: "football",
    href: `/football/${String(game.leagueId)}/game/${encodeURIComponent(game.id)}`,
    matchName: `${game.homeTeam.abbreviation} vs ${game.awayTeam.abbreviation}`,
    league: game.leagueName,
    sportIcon: "⚽",
    startTime: game.startTimeIso ?? null,
    viewedAt: Date.now(),
  };
}
