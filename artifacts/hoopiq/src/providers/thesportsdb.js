// TheSportsDB provider — free public API (no API key required for v1/json/3/).
//
// Documentation: https://www.thesportsdb.com/api.php
// Free tier endpoints used here:
//   Next 15 events  : /api/v1/json/3/eventsnextleague.php?id={leagueId}
//   Past 15 events  : /api/v1/json/3/eventspastleague.php?id={leagueId}
//   Season events   : /api/v1/json/3/eventsseason.php?id={leagueId}&s={season}
//
// Known league IDs used by this project:
//   NZ NBL          : 5066   (New Zealand National Basketball League)
//
// Note: TSDB event data doesn't include live scores or play-by-play.
// Use it only for schedule (upcoming/past) when no better source is available.

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";

async function fetchTsdb(path) {
  const url = `${TSDB_BASE}/${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TheSportsDB ${res.status}: ${url}`);
  return res.json();
}

// ─── NZ NBL team abbreviation lookup ─────────────────────────────────────────
//
// TheSportsDB does not include short abbreviations. Slicing the first 3 chars
// of the full team name works for most cases but breaks for multi-word names
// where the city name alone isn't distinctive enough (e.g. "Hawke's Bay Hawks"
// → "HAW" vs "Haw"). This table maps known full names to their standard 3-char
// codes; the fallback uses word initials (e.g. "Nelson Giants" → "NGT").

const TEAM_ABBREVIATIONS = {
  // NZ NBL (TheSportsDB league 5066)
  "Canterbury Rams":      "CAN",
  "Franklin Bulls":       "FRA",
  "Hawke's Bay Hawks":    "HBH",
  "Manawatu Jets":        "MAN",
  "Nelson Giants":        "NEL",
  "Otago Nuggets":        "OTA",
  "Southland Sharks":     "STH",
  "Supercity Rangers":    "SCR",
  "Taranaki Mountainairs":"TAR",
  "Waikato Pistons":      "WAI",
  "Wellington Saints":    "WEL",
};

/**
 * Derive a 3-character team abbreviation.
 * Prefers the lookup table; falls back to the word-initials strategy
 * (e.g. "Hobart Chargers" → "HCH") so new teams look reasonable without
 * requiring a code change.
 *
 * @param {string|null|undefined} name  full team name from TSDB
 * @param {string} fallback             fallback string (e.g. "HOM")
 */
function teamAbbr(name, fallback) {
  if (!name) return fallback;
  if (TEAM_ABBREVIATIONS[name]) return TEAM_ABBREVIATIONS[name];
  // Word-initials: take first letter of each word, up to 3.
  const initials = name.split(/\s+/).map((w) => w[0] ?? "").join("").toUpperCase();
  if (initials.length >= 2) return initials.slice(0, 3).padEnd(3, initials[0]);
  return name.slice(0, 3).toUpperCase() || fallback;
}

/**
 * Map a TheSportsDB event to our normalized Game shape.
 * TSDB events have no live score, so status is always "scheduled" or "final"
 * based on whether strStatus contains "Match Finished" or similar.
 *
 * @param {object} ev   raw TSDB event
 * @param {string} leagueKey
 */
function normalizeEvent(ev, leagueKey) {
  const isFinished = (ev.strStatus ?? "").toLowerCase().includes("match finished") ||
    (ev.strStatus ?? "").toLowerCase() === "ft";

  let startTimeIso = null;
  let startTime = "";
  if (ev.strTimestamp) {
    try {
      startTimeIso = new Date(ev.strTimestamp).toISOString();
      startTime = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(ev.strTimestamp));
    } catch { /* ignore */ }
  }

  const homeScore = ev.intHomeScore != null ? Number(ev.intHomeScore) : null;
  const awayScore = ev.intAwayScore != null ? Number(ev.intAwayScore) : null;

  return {
    id: ev.idEvent,
    league: leagueKey,
    homeTeam: {
      id: ev.idHomeTeam ?? "",
      name: ev.strHomeTeam ?? "Home",
      abbreviation: teamAbbr(ev.strHomeTeam, "HOM"),
      score: homeScore,
      players: [],
    },
    awayTeam: {
      id: ev.idAwayTeam ?? "",
      name: ev.strAwayTeam ?? "Away",
      abbreviation: teamAbbr(ev.strAwayTeam, "AWY"),
      score: awayScore,
      players: [],
    },
    startTime,
    startTimeIso,
    status: isFinished ? "final" : "scheduled",
    period: "",
    clock: "",
  };
}

/**
 * Fetches a league overview (upcoming + last played) from TheSportsDB.
 * TSDB doesn't provide live scores, so `live` is always [].
 *
 * @param {string | number} leagueId  TSDB numeric league ID
 * @param {string} leagueKey          our internal key, e.g. "nznbl"
 */
export async function getLeagueOverviewFromTsdb(leagueId, leagueKey) {
  const [nextData, pastData] = await Promise.all([
    fetchTsdb(`eventsnextleague.php?id=${leagueId}`).catch(() => ({ events: null })),
    fetchTsdb(`eventspastleague.php?id=${leagueId}`).catch(() => ({ events: null })),
  ]);

  const upcoming = (nextData.events ?? [])
    .filter((e) => e.strSport?.toLowerCase().includes("basketball") || !e.strSport)
    .map((e) => normalizeEvent(e, leagueKey))
    .filter((g) => g.status === "scheduled")
    .sort(
      (a, b) =>
        new Date(a.startTimeIso ?? 0).getTime() -
        new Date(b.startTimeIso ?? 0).getTime()
    );

  const past = (pastData.events ?? [])
    .filter((e) => e.strSport?.toLowerCase().includes("basketball") || !e.strSport)
    .map((e) => normalizeEvent(e, leagueKey))
    .filter((g) => g.status === "final")
    .sort(
      (a, b) =>
        new Date(b.startTimeIso ?? 0).getTime() -
        new Date(a.startTimeIso ?? 0).getTime()
    );

  return {
    live: [],                   // TSDB has no live scores
    upcoming,
    lastPlayed: past[0] ?? null,
  };
}

/**
 * Fetch a single game by its TheSportsDB event ID.
 * Uses the `lookupevent.php` endpoint which returns a single event with scores
 * and status. Confirmed response shape (July 2026 NZ NBL test):
 *   { idEvent, strEvent, strStatus:"FT", intHomeScore:"92", intAwayScore:"79",
 *     strTimestamp:"2026-07-16T07:00:00", strSport:"Basketball" }
 *
 * Returns null if the event is not found or the request fails.
 *
 * @param {string | number} eventId  TSDB numeric event ID (e.g. "2467092")
 * @param {string} leagueKey         our internal key, e.g. "nznbl"
 * @returns {Promise<object|null>}   normalized Game or null
 */
export async function getGameFromTsdb(eventId, leagueKey) {
  try {
    const data = await fetchTsdb(`lookupevent.php?id=${eventId}`);
    const events = data.events ?? [];
    if (events.length === 0) return null;
    const ev = events[0];
    // Reject if the sport doesn't look like basketball (guard against TSDB ID
    // collisions with other sports databases).
    const sport = (ev.strSport ?? "").toLowerCase();
    if (sport && !sport.includes("basketball")) return null;
    return normalizeEvent(ev, leagueKey);
  } catch (err) {
    console.warn(`[thesportsdb] getGameFromTsdb(${eventId}) failed:`, err.message);
    return null;
  }
}

/**
 * Fetches today's events for a league from TSDB.
 * Since TSDB has no live scores, returns scheduled events for today only.
 * @param {string | number} leagueId
 * @param {string} leagueKey
 */
export async function getTodayGamesFromTsdb(leagueId, leagueKey) {
  try {
    const data = await fetchTsdb(`eventsnextleague.php?id=${leagueId}`);
    const today = new Date().toISOString().slice(0, 10);
    return (data.events ?? [])
      .filter((e) => (e.dateEvent ?? "") === today)
      .map((e) => normalizeEvent(e, leagueKey));
  } catch {
    return [];
  }
}
