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
// Timezone handling (Task 6 fix):
//   - ALL time comparisons use UTC internally.
//   - Timezone conversion happens ONLY at display time (in the UI layer).
//   - A match is NEVER marked "in_progress" from time arithmetic alone.
//     Only TSDB's strStatus field drives live status detection.
//   - "scheduled" + start time passed → shows "Starting" in UI, not "LIVE"/"NOW".
//
// Provider health: every successful/failed request is reported to provider-health.ts.
// The UI can display health status and we surface it for debugging.

import { recordSuccess, recordFailure } from "../lib/provider-health";

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const PROVIDER_NAME = "thesportsdb-cricket";

// ─── Known cricket league IDs (TheSportsDB) ───────────────────────────────
// Used for league-based supplemental queries.
// Supplement the day-based endpoint to catch leagues it misses.
const KNOWN_LEAGUES = [
  // ── Men's T20 franchise leagues ───────────────────────────────────────────
  { id: 4460, name: "Indian Premier League",          format: "T20",  country: "India"       },
  { id: 4461, name: "Big Bash League",                format: "T20",  country: "Australia"   },
  { id: 4463, name: "Vitality T20 Blast",             format: "T20",  country: "England"     },
  { id: 4462, name: "SA T20 Challenge",               format: "T20",  country: "South Africa"},
  { id: 5067, name: "Pakistan Super League",          format: "T20",  country: "Pakistan"    },
  { id: 5174, name: "Super Smash",                    format: "T20",  country: "New Zealand" },
  { id: 5175, name: "Lanka Premier League",           format: "T20",  country: "Sri Lanka"   },
  { id: 5176, name: "Caribbean Premier League",       format: "T20",  country: "West Indies" },
  { id: 5529, name: "Bangladesh Premier League",      format: "T20",  country: "Bangladesh"  },
  { id: 5532, name: "SA20",                           format: "T20",  country: "South Africa"},
  { id: 5533, name: "Nepal Premier League",           format: "T10",  country: "Nepal"       },
  { id: 5534, name: "Shpageeza Cricket League",       format: "T20",  country: "Afghanistan" },
  { id: 5535, name: "Zimbabwe T20",                   format: "T20",  country: "Zimbabwe"    },
  { id: 5606, name: "Ireland T20 Trophy",             format: "T20",  country: "Ireland"     },
  // ── The Hundred ───────────────────────────────────────────────────────────
  { id: 5561, name: "The Hundred Men's Competition",  format: "The Hundred", country: "England" },
  { id: 5562, name: "The Hundred Women's Competition",format: "The Hundred", country: "England" },
  // ── Test / First-class ────────────────────────────────────────────────────
  { id: 4458, name: "County Championship Div 1",      format: "Test", country: "England"     },
  { id: 4459, name: "County Championship Div 2",      format: "Test", country: "England"     },
  { id: 5530, name: "Sheffield Shield",               format: "Test", country: "Australia"   },
  // ── International (ICC) ───────────────────────────────────────────────────
  { id: 4455, name: "ICC T20 World Cup",              format: "T20",  country: "International"},
  { id: 4456, name: "ICC Cricket World Cup",          format: "ODI",  country: "International"},
  { id: 4457, name: "ICC Champions Trophy",           format: "ODI",  country: "International"},
  { id: 4464, name: "International Twenty20",         format: "T20",  country: "International"},
  { id: 4465, name: "International Test Cricket",     format: "Test", country: "International"},
  { id: 4466, name: "International ODI Cricket",      format: "ODI",  country: "International"},
  // ── Women's international ─────────────────────────────────────────────────
  { id: 4902, name: "ICC Women's T20 World Cup",      format: "T20",  country: "International"},
  { id: 4903, name: "ICC Women's Cricket World Cup",  format: "ODI",  country: "International"},
  { id: 4904, name: "Women's International T20",      format: "T20",  country: "International"},
  { id: 4905, name: "Women's International ODI",      format: "ODI",  country: "International"},
  // ── Women's domestic ─────────────────────────────────────────────────────
  { id: 5560, name: "Women's Premier League",         format: "T20",  country: "India"       },
  { id: 5607, name: "Women's Big Bash League",        format: "T20",  country: "Australia"   },
  { id: 5608, name: "Rachael Heyhoe Flint Trophy",    format: "ODI",  country: "England"     },
  // ── T10 ──────────────────────────────────────────────────────────────────
  { id: 5563, name: "Abu Dhabi T10",                  format: "T10",  country: "UAE"         },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns YYYY-MM-DD in the user's LOCAL timezone.
 *
 * TSDB `eventsday.php` keys events by the HOST COUNTRY local date, so a match
 * in India on "2026-07-29" is stored under that key regardless of what UTC
 * says. Using UTC here would silently drop matches for viewers in timezones
 * that are ahead of UTC (IST, AEST, etc.) when their local date differs from
 * the UTC date.
 */
function fmtDate(date) {
  return date.toLocaleDateString("en-CA"); // always YYYY-MM-DD in LOCAL zone
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
  if (/test|shield|championship|first.?class/.test(n)) return "Test";
  if (/t10|abu.?dhabi.?t10|mzansi/.test(n)) return "T10";
  if (/odi|one.?day|world.?cup(?!.*t20)|champions.?trophy/.test(n)) return "ODI";
  // T20 catch-all (covers IPL, T20 Blast, PSL, BBL, LPL, CPL, T20I, etc.)
  return "T20";
}

function makeCompetitionSlug(leagueName) {
  return (leagueName || "cricket")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * Map TSDB strStatus values to our status enum.
 *
 * TIMEZONE FIX (Task 6):
 *   - NEVER infer "in_progress" from time arithmetic.
 *   - ONLY use explicit TSDB status strings to mark a match live.
 *   - "NS" (Not Started) always maps to "scheduled" regardless of time.
 *   - Past dates with "NS" status → keep as "scheduled" (TSDB hasn't updated yet).
 *   - "final" is only set when TSDB explicitly reports completion.
 *
 * This prevents matches appearing as "NOW" / "LIVE" before they actually start.
 */
function mapTsdbStatus(strStatus) {
  const s = (strStatus || "").toLowerCase().trim();

  // Completed
  if (
    s === "ft" ||
    s === "match finished" ||
    s.includes("match finished") ||
    s === "abandoned" ||
    s.includes("abandoned") ||
    s === "aet" ||
    s === "d/l" ||
    s === "n/r" ||
    s.includes("no result")
  ) {
    return "final";
  }

  // In-progress — ONLY from explicit TSDB live status strings
  // Never infer from time
  if (
    s.includes("1st innings") ||
    s.includes("2nd innings") ||
    s.includes("3rd innings") ||
    s.includes("4th innings") ||
    s === "in progress" ||
    s === "live" ||
    s === "in-play" ||
    s.includes("day ") ||  // Test match "Day 2, Session 1"
    (s.length > 0 && s.includes("innings") && !s.includes("break"))
  ) {
    return "in_progress";
  }

  // Not started / unknown → always scheduled
  // This explicitly includes "ns", "", and unknown strings.
  // Do NOT map to "final" based on past date — TSDB is slow to update.
  return "scheduled";
}

// ─── TSDB event normalizer ─────────────────────────────────────────────────

function normalizeTsdbEvent(ev) {
  if (!ev) return null;
  try {
    const leagueName = ev.strLeague || ev.strLeagueAlternate || "Cricket";
    const format = detectFormat(leagueName);
    const slug = makeCompetitionSlug(leagueName);

    // Build startTimeIso in UTC.
    // strTimestamp is the canonical UTC time from TSDB when available.
    // Fallback: dateEvent (YYYY-MM-DD, local date) + strTime (HH:MM) → treat as UTC noon
    // to avoid showing match in wrong local day.
    let startTimeIso = null;
    if (ev.strTimestamp) {
      try {
        const d = new Date(ev.strTimestamp);
        if (!isNaN(d.getTime())) startTimeIso = d.toISOString();
      } catch {}
    }
    if (!startTimeIso && ev.dateEvent) {
      // strTime from TSDB is the LOCAL time at the venue, NOT UTC.
      // We cannot reliably convert it to UTC without knowing the venue timezone,
      // so we use UTC noon on the event date as a safe proxy. UTC noon ensures
      // the match appears on the correct local calendar day for viewers in
      // timezones between UTC-11 and UTC+11 (covers almost all cricket nations).
      // The actual time is displayed separately from TSDB's strTime field.
      try {
        const d = new Date(`${ev.dateEvent}T12:00:00Z`);
        if (!isNaN(d.getTime())) startTimeIso = d.toISOString();
        else startTimeIso = ev.dateEvent + "T12:00:00Z";
      } catch {
        startTimeIso = ev.dateEvent + "T12:00:00Z";
      }
    }

    // Status: ONLY from TSDB strStatus — never inferred from time
    const status = mapTsdbStatus(ev.strStatus);

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
const DAY_CACHE_TTL = 5 * 60 * 1000; // 5 min
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
 *   2. League-based: fetch all known leagues in parallel for broader upcoming coverage.
 *   3. Merge and deduplicate by game ID, classify as live/upcoming/lastPlayed.
 *
 * Timezone rules (Task 6):
 *   - "live" games: ONLY those with status === "in_progress" from TSDB strStatus.
 *   - "upcoming" games: status === "scheduled" with startTimeIso in the future
 *     OR within past 3h (TSDB may not have updated yet — do NOT mark as live).
 *   - Never use time arithmetic to promote "scheduled" → "in_progress".
 */
export async function getLeagueOverview() {
  const now = new Date();

  // Day-based: query LOCAL calendar dates from -2 to +3 relative to today.
  //
  // Why -2? Users in UTC+14 (Pacific islands) or UTC+12 (NZ) have a local
  // "today" that is 1-2 days ahead of UTC, so their "yesterday" in local time
  // is still today or tomorrow UTC. Querying -2 local ensures completed games
  // from the past 48 hours are always captured for every timezone.
  //
  // Why +3? Covers upcoming matches up to 3 local days ahead, including The
  // Hundred / LPL fixtures that TSDB may publish days in advance.
  //
  // We deduplicate by game ID after merging so there is no double-counting.
  const dayDates = [-2, -1, 0, 1, 2, 3].map(offset =>
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

  // Live: only explicitly marked by TSDB
  const live = all.filter(g => g.status === "in_progress");

  // Upcoming: scheduled games — sorted by startTimeIso
  // Include games that started up to 3h ago (TSDB may not have updated status yet)
  // BUT keep them as "scheduled" — do NOT promote to "in_progress"
  const upcoming = all
    .filter(g => {
      if (g.status !== "scheduled") return false;
      if (!g.startTimeIso) return true; // no time — include
      const diffMs = new Date(g.startTimeIso).getTime() - now.getTime();
      // Include: future games AND games that started within last 3h (awaiting TSDB update)
      return diffMs > -8 * 3600 * 1000; // cover full T20 (~3.5h) and ODI (~8h) durations
    })
    .sort((a, b) =>
      new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime()
    );

  // Recent completed — all finals within the last 48 hours.
  //
  // The league-based supplement fetches "past 15 events" per league, which can
  // include games weeks or months old. Capping at 48 h ensures the "Recent" tab
  // only shows genuinely recent results and doesn't pollute today/tomorrow filters
  // with stale data.
  //
  // Why 48 h (not 24 h)? The Hundred, LPL, and International matches often finish
  // late local time; a viewer in UTC+5:30 checking next morning needs to still see
  // yesterday's completed games, which can be up to ~36 h ago in UTC.
  const cutoff48h = now.getTime() - 48 * 3600 * 1000;
  const recentCompleted = all
    .filter(g => {
      if (g.status !== "final") return false;
      if (!g.startTimeIso) return false;
      return new Date(g.startTimeIso).getTime() >= cutoff48h;
    })
    .sort((a, b) =>
      new Date(b.startTimeIso ?? 0).getTime() - new Date(a.startTimeIso ?? 0).getTime()
    );

  const lastPlayed = recentCompleted[0] ?? null;

  // Active competitions: leagues with upcoming or recently completed games (within 7 days)
  const activeCompetitionNames = new Set();
  const cutoffPast = new Date(now.getTime() - 7 * 86_400_000);
  for (const g of all) {
    if (g.status === "scheduled") {
      activeCompetitionNames.add(g.competitionName);
    } else if (g.status === "final" && g.startTimeIso) {
      if (new Date(g.startTimeIso) > cutoffPast) {
        activeCompetitionNames.add(g.competitionName);
      }
    } else if (g.status === "in_progress") {
      activeCompetitionNames.add(g.competitionName);
    }
  }
  const activeCompetitions = [...activeCompetitionNames];

  return { live, upcoming, lastPlayed, recentCompleted, activeCompetitions };
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
