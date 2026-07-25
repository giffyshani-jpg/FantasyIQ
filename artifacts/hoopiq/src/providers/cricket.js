// Cricket data provider — TheSportsDB (primary) with multi-day coverage.
//
// TheSportsDB (thesportsdb.com) is a free, CORS-open sports database.
// No API key required. Uses v1/json/3 endpoints.
//
// TWO complementary strategies are used together:
//
//   1. DAY-BASED  — `eventsday.php?d={YYYY-MM-DD}&s=Cricket` fetches ALL cricket
//      events for a given calendar day, regardless of competition. Today, yesterday,
//      and the next 4 days are queried in parallel. This is the primary feed.
//
//   2. LEAGUE-BASED — for each of the 17 known cricket league IDs, we fetch their
//      "next 15 events" and "past 15 events" to catch leagues that don't appear in
//      the day-based endpoint (e.g. Lanka Premier League) or to populate upcoming
//      events beyond the 4-day window.
//
// Auto-discovery: the day-based endpoint requires no league list at all. New
// competitions created by TSDB appear automatically without any code change.
// The league-based supplement uses a maintained league ID list.
//
// Provider health: every successful/failed request is reported to provider-health.ts.
// The UI can display health status and we surface it for debugging.
//
// Limitations of TheSportsDB free tier:
//   - No real-time live scores (status is "NS" = not started, "FT" = finished, etc.)
//   - No ball-by-ball or innings-level scoring in the free tier
//   - Score data available only for completed matches
//
// ESPNcricinfo is NOT used — their API requires auth tokens (x-hsci-auth-token)
// and is Akamai-blocked from non-browser clients. Their CORS policy restricts
// browser calls to espncricinfo.com origin only. Both server-side and cross-origin
// browser calls fail. TheSportsDB is used exclusively.

import { recordSuccess, recordFailure } from "../lib/provider-health";

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const PROVIDER_NAME = "thesportsdb-cricket";

// ─── Known cricket league IDs (TheSportsDB) ───────────────────────────────
// Used for league-based supplemental queries.
// Supplement the day-based endpoint to catch leagues it misses.
const KNOWN_LEAGUES = [
  { id: 4460, name: "Indian Premier League",          format: "T20",  country: "India"      },
  { id: 4461, name: "Big Bash League",                format: "T20",  country: "Australia"  },
  { id: 4463, name: "Vitality T20 Blast",             format: "T20",  country: "England"    },
  { id: 4458, name: "County Championship Div 1",      format: "Test", country: "England"    },
  { id: 4459, name: "County Championship Div 2",      format: "Test", country: "England"    },
  { id: 4462, name: "SA T20 Challenge",               format: "T20",  country: "South Africa" },
  { id: 5067, name: "Pakistan Super League",          format: "T20",  country: "Pakistan"   },
  { id: 5174, name: "Super Smash",                    format: "T20",  country: "New Zealand"},
  { id: 5175, name: "Lanka Premier League",           format: "T20",  country: "Sri Lanka"  },
  { id: 5176, name: "Caribbean Premier League",       format: "T20",  country: "West Indies"},
  { id: 5529, name: "Bangladesh Premier League",      format: "T20",  country: "Bangladesh" },
  { id: 5530, name: "Sheffield Shield",               format: "Test", country: "Australia"  },
  { id: 5532, name: "SA20",                           format: "T20",  country: "South Africa" },
  { id: 5533, name: "Nepal Premier League",           format: "T10",  country: "Nepal"      },
  { id: 5534, name: "Shpageeza Cricket League",       format: "T20",  country: "Afghanistan"},
  { id: 5535, name: "Zimbabwe T20",                   format: "T20",  country: "Zimbabwe"   },
  { id: 5606, name: "Ireland T20 Trophy",             format: "T20",  country: "Ireland"    },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(date) {
  return date.toISOString().slice(0, 10);
}

function fmtTime(isoDate) {
  if (!isoDate) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(isoDate));
  } catch { return ""; }
}

function makeAbbreviation(name) {
  if (!name) return "UNK";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  // Multi-word: initials of first 3 words
  if (words.length >= 3) return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
  return words[0].slice(0, 3).toUpperCase();
}

function detectFormat(leagueName) {
  const n = (leagueName || "").toLowerCase();
  if (/hundred/.test(n)) return "The Hundred";
  if (/test|shield|championship/.test(n)) return "Test";
  if (/t10/.test(n)) return "T10";
  if (/odi|one.?day/.test(n)) return "ODI";
  return "T20";
}

function makeCompetitionSlug(leagueName) {
  return (leagueName || "cricket")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** Map TSDB strStatus values to our status enum. */
function mapTsdbStatus(strStatus, dateEvent) {
  const s = (strStatus || "").toLowerCase().trim();
  if (s === "ft" || s.includes("match finished") || s.includes("abandoned") || s === "aet") {
    return "final";
  }
  // In-progress statuses
  if (s.includes("1st innings") || s.includes("2nd innings") || s === "in progress" || s === "live") {
    return "in_progress";
  }
  // Not started / scheduled
  if (s === "ns" || s === "" || s === "not started") {
    // Determine by date: if in the past, treat as final-pending; if future, scheduled
    if (dateEvent) {
      const matchDate = new Date(dateEvent + "T23:59:59Z");
      if (matchDate < new Date()) return "final"; // past date with no status = completed
    }
    return "scheduled";
  }
  return "scheduled";
}

// ─── TSDB event normalizer ─────────────────────────────────────────────────

function normalizeTsdbEvent(ev) {
  if (!ev) return null;
  try {
    const leagueName = ev.strLeague || ev.strLeagueAlternate || "Cricket";
    const format = detectFormat(leagueName);
    const slug = makeCompetitionSlug(leagueName);

    let startTimeIso = null;
    if (ev.strTimestamp) {
      try { startTimeIso = new Date(ev.strTimestamp).toISOString(); } catch {}
    } else if (ev.dateEvent) {
      startTimeIso = ev.dateEvent + "T12:00:00Z"; // approximate
    }

    const status = mapTsdbStatus(ev.strStatus, ev.dateEvent);

    // Scores — only available for completed matches
    const homeScore = ev.intHomeScore != null && ev.intHomeScore !== "" ? String(ev.intHomeScore) : null;
    const awayScore = ev.intAwayScore != null && ev.intAwayScore !== "" ? String(ev.intAwayScore) : null;

    const gameId = `tsdb:${ev.idEvent}`;

    return {
      id: gameId,
      competitionSlug: slug,
      competitionName: leagueName,
      format,
      homeTeam: {
        id: String(ev.idHomeTeam || "h"),
        name: ev.strHomeTeam || "Home",
        abbreviation: makeAbbreviation(ev.strHomeTeam),
        score: homeScore,
        overs: null,
        players: [],
      },
      awayTeam: {
        id: String(ev.idAwayTeam || "a"),
        name: ev.strAwayTeam || "Away",
        abbreviation: makeAbbreviation(ev.strAwayTeam),
        score: awayScore,
        overs: null,
        players: [],
      },
      startTime: startTimeIso ? fmtTime(startTimeIso) : (ev.strTime || ""),
      startTimeIso,
      status,
      period: status === "in_progress" ? (ev.strStatus || "In Progress") : undefined,
      statusDetail: ev.strStatus || null,
      innings: [],
      result: status === "final" ? (ev.strResult || null) : null,
      venue: ev.strVenue || null,
    };
  } catch {
    return null;
  }
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────

async function fetchTsdb(path) {
  const url = `${TSDB_BASE}/${path}`;
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible)",
        Accept: "application/json",
      },
    });
    if (!r.ok) throw new Error(`TSDB ${r.status}: ${path}`);
    const data = await r.json();
    recordSuccess(PROVIDER_NAME, Date.now() - t0);
    return data;
  } catch (err) {
    recordFailure(PROVIDER_NAME, err?.message ?? "fetch error");
    return null;
  }
}

// ─── Cache ─────────────────────────────────────────────────────────────────

const DAY_CACHE = new Map(); // dateStr → { games, fetchedAt }
const DAY_CACHE_TTL = 5 * 60 * 1000; // 5 min (TSDB has no live scores, refresh less often)
const LEAGUE_CACHE = new Map(); // leagueId → { events, fetchedAt }
const LEAGUE_CACHE_TTL = 10 * 60 * 1000; // 10 min

function getCachedDay(dateStr) {
  const e = DAY_CACHE.get(dateStr);
  if (e && Date.now() - e.fetchedAt < DAY_CACHE_TTL) return e.games;
  return null;
}

function getCachedLeague(id) {
  const e = LEAGUE_CACHE.get(id);
  if (e && Date.now() - e.fetchedAt < LEAGUE_CACHE_TTL) return e.events;
  return null;
}

// ─── Day-based fetch ──────────────────────────────────────────────────────

async function fetchDayEvents(dateStr) {
  const cached = getCachedDay(dateStr);
  if (cached !== null) return cached;

  const data = await fetchTsdb(`eventsday.php?d=${dateStr}&s=Cricket`);
  const raw = data?.events ?? [];
  const games = raw.map(normalizeTsdbEvent).filter(Boolean);
  DAY_CACHE.set(dateStr, { games, fetchedAt: Date.now() });
  return games;
}

// ─── League-based fetch (supplement) ─────────────────────────────────────

async function fetchLeagueEvents(leagueId) {
  const cached = getCachedLeague(leagueId);
  if (cached !== null) return cached;

  const [next, past] = await Promise.all([
    fetchTsdb(`eventsnextleague.php?id=${leagueId}`),
    fetchTsdb(`eventspastleague.php?id=${leagueId}`),
  ]);

  const events = [
    ...(next?.events ?? []),
    ...(past?.events ?? []),
  ].map(normalizeTsdbEvent).filter(Boolean);

  LEAGUE_CACHE.set(leagueId, { events, fetchedAt: Date.now() });
  return events;
}

// ─── Public provider API ───────────────────────────────────────────────────

/**
 * Returns the cricket league overview:
 *   { live, upcoming, lastPlayed, activeCompetitions }
 *
 * Strategy:
 *   1. Day-based: fetch today, yesterday, and the next 3 days for the immediate window.
 *   2. League-based: fetch all 17 known leagues in parallel for broader upcoming coverage.
 *   3. Merge and deduplicate by game ID, classify as live/upcoming/lastPlayed.
 *
 * "live" games: status === "in_progress" (TSDB's strStatus contains innings/live markers)
 * "upcoming" games: status === "scheduled", sorted by startTimeIso
 * "lastPlayed": most recent completed game
 *
 * Note: TSDB free tier does not provide live scores. Most "live" games will show
 * as "scheduled" (NS) until they complete (FT). Live status is determined from
 * TSDB's strStatus field when populated.
 */
export async function getLeagueOverview() {
  const now = new Date();

  // Day-based: yesterday, today, +1, +2, +3 days
  const dayDates = [-1, 0, 1, 2, 3].map(offset =>
    fmtDate(new Date(now.getTime() + offset * 86_400_000))
  );

  // Run day-based AND league-based queries in parallel
  const [dayResults, leagueResults] = await Promise.all([
    Promise.all(dayDates.map(d => fetchDayEvents(d))),
    Promise.all(KNOWN_LEAGUES.map(l => fetchLeagueEvents(l.id))),
  ]);

  // Merge all events, deduplicate by id
  const seen = new Set();
  const all = [];

  for (const group of [...dayResults, ...leagueResults]) {
    for (const game of group) {
      if (!seen.has(game.id)) {
        seen.add(game.id);
        all.push(game);
      }
    }
  }

  // Classify
  const live = all.filter(g => g.status === "in_progress");

  // Upcoming: scheduled games with startTimeIso in the future, or within past 3h (might have started)
  const upcoming = all
    .filter(g => {
      if (g.status !== "scheduled") return false;
      if (!g.startTimeIso) return true;
      const diff = new Date(g.startTimeIso).getTime() - now.getTime();
      return diff > -3 * 3600 * 1000; // include games that started within last 3h (might not be in progress yet per TSDB)
    })
    .sort((a, b) =>
      new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime()
    );

  // Recent completed
  const recentCompleted = all
    .filter(g => g.status === "final")
    .sort((a, b) =>
      new Date(b.startTimeIso ?? 0).getTime() - new Date(a.startTimeIso ?? 0).getTime()
    );

  const lastPlayed = recentCompleted[0] ?? null;

  // Active competitions: leagues that have at least one upcoming or recently completed game
  const activeCompetitionNames = new Set();
  const cutoffPast = new Date(now.getTime() - 7 * 86_400_000); // 7 days ago
  for (const g of all) {
    if (g.status === "scheduled") {
      activeCompetitionNames.add(g.competitionName);
    } else if (g.status === "final" && g.startTimeIso) {
      if (new Date(g.startTimeIso) > cutoffPast) {
        activeCompetitionNames.add(g.competitionName);
      }
    }
  }
  const activeCompetitions = [...activeCompetitionNames];

  return { live, upcoming, lastPlayed, activeCompetitions };
}

/**
 * Fetches a cricket game by ID.
 * TSDB game IDs use format "tsdb:{idEvent}".
 *
 * Returns the base game from cache with empty innings (TSDB free tier
 * doesn't provide detailed scorecard data).
 */
export async function fetchGameById(gameId, { noCache = false } = {}) {
  const eventId = gameId.startsWith("tsdb:") ? gameId.slice(5) : gameId;

  const t0 = Date.now();
  try {
    const data = await fetchTsdb(`lookupevent.php?id=${eventId}`);
    const ev = data?.events?.[0];
    if (!ev) return null;
    recordSuccess(PROVIDER_NAME, Date.now() - t0);
    const game = normalizeTsdbEvent(ev);
    if (game) game.allPlayers = [];
    return game;
  } catch (err) {
    recordFailure(PROVIDER_NAME, err?.message ?? "lookup failed");
    return null;
  }
}

/**
 * Returns the roster for a cricket game.
 * TSDB free tier doesn't provide player rosters.
 */
export async function fetchGameRoster(gameId) {
  return { homeTeam: null, awayTeam: null, allPlayers: [] };
}

/** Returns the match format for a given game ID. */
export function getMatchFormat(gameId) {
  // Best effort from cache
  return "T20";
}
