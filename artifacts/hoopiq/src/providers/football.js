// Football data provider — infrastructure skeleton (Task 10).
//
// Architecture:
//   Primary: TheSportsDB (free, CORS-open, no auth required)
//   Future: API-Football (free tier, requires API key) or LiveScore (paid)
//
// Provider contract (same as all other providers):
//   getLeagueOverview(options) → { live, upcoming, lastPlayed }
//   getGame(gameId)            → Game | null
//   getGamesByDate(dateStr)    → Game[]
//   getPlayerGameLog(playerId) → []
//   getTeamSchedule(teamId)    → []
//
// Auto-discovery: TheSportsDB's "soccerleagues.php" endpoint returns all
// football leagues. No hardcoded list required for competition discovery.
//
// Status (July 2026): INFRASTRUCTURE ONLY — returns empty datasets.
// Wire up live data by implementing fetchTodayMatches() and fetchLeagueEvents().

import { recordSuccess, recordFailure } from "../lib/provider-health";

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const PROVIDER_NAME = "thesportsdb-football";

// ── Known league IDs for bootstrap (supplement auto-discovery) ───────────────
const KNOWN_LEAGUES = [
  { id: 4328, name: "Premier League",             country: "England",       type: "league"        },
  { id: 4335, name: "La Liga",                    country: "Spain",         type: "league"        },
  { id: 4331, name: "Bundesliga",                 country: "Germany",       type: "league"        },
  { id: 4332, name: "Serie A",                    country: "Italy",         type: "league"        },
  { id: 4334, name: "Ligue 1",                    country: "France",        type: "league"        },
  { id: 4530, name: "Eredivisie",                 country: "Netherlands",   type: "league"        },
  { id: 4346, name: "UEFA Champions League",      country: "Europe",        type: "cup"           },
  { id: 4344, name: "FIFA World Cup",             country: "International", type: "international" },
];

// ── HTTP helper ───────────────────────────────────────────────────────────────

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

// ── Normalizer ────────────────────────────────────────────────────────────────

function makeAbbreviation(name) {
  if (!name) return "UNK";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  if (words.length >= 3) return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
  return words[0].slice(0, 3).toUpperCase();
}

function mapFootballStatus(strStatus) {
  const s = (strStatus || "").toLowerCase().trim();
  if (s === "ft" || s === "aet" || s === "pen" || s.includes("finished")) return "final";
  if (s === "1h" || s === "2h" || s === "ht" || s === "et" || s === "live") return "in_progress";
  if (s === "ns" || s === "" || s === "not started") return "scheduled";
  return "scheduled";
}

function normalizeFootballEvent(ev) {
  if (!ev) return null;
  try {
    let startTimeIso = null;
    if (ev.strTimestamp) {
      try { startTimeIso = new Date(ev.strTimestamp).toISOString(); } catch {}
    } else if (ev.dateEvent && ev.strTime) {
      try { startTimeIso = new Date(`${ev.dateEvent}T${ev.strTime}Z`).toISOString(); } catch {}
    } else if (ev.dateEvent) {
      startTimeIso = ev.dateEvent + "T15:00:00Z";
    }

    const status = mapFootballStatus(ev.strStatus);

    return {
      id: `tsdb-football:${ev.idEvent}`,
      leagueId: ev.idLeague,
      leagueName: ev.strLeague || "Football",
      homeTeam: {
        id: String(ev.idHomeTeam || "h"),
        name: ev.strHomeTeam || "Home",
        abbreviation: makeAbbreviation(ev.strHomeTeam),
        score: ev.intHomeScore != null ? String(ev.intHomeScore) : null,
        players: [],
      },
      awayTeam: {
        id: String(ev.idAwayTeam || "a"),
        name: ev.strAwayTeam || "Away",
        abbreviation: makeAbbreviation(ev.strAwayTeam),
        score: ev.intAwayScore != null ? String(ev.intAwayScore) : null,
        players: [],
      },
      startTimeIso,
      status,
      venue: ev.strVenue || null,
      result: status === "final"
        ? `${ev.strHomeTeam} ${ev.intHomeScore ?? "?"} - ${ev.intAwayScore ?? "?"} ${ev.strAwayTeam}`
        : null,
      league: "football",
    };
  } catch {
    return null;
  }
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const DAY_CACHE = new Map();
const DAY_CACHE_TTL = 3 * 60 * 1000;

function getCachedDay(dateStr) {
  const e = DAY_CACHE.get(dateStr);
  if (e && Date.now() - e.fetchedAt < DAY_CACHE_TTL) return e.events;
  return null;
}

// ── Public provider API ───────────────────────────────────────────────────────

/**
 * Fetches football events for a specific YYYY-MM-DD date string.
 * Uses TheSportsDB eventsday endpoint (sport=Soccer).
 */
export async function getGamesByDate(dateStr) {
  // dateStr from UI is YYYYMMDD — normalize to YYYY-MM-DD for TSDB
  const normalized = dateStr.length === 8
    ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    : dateStr;

  const cached = getCachedDay(normalized);
  if (cached !== null) return cached;

  const data = await fetchTsdb(`eventsday.php?d=${normalized}&s=Soccer`);
  const raw = data?.events ?? [];
  const events = raw.map(normalizeFootballEvent).filter(Boolean);
  DAY_CACHE.set(normalized, { events, fetchedAt: Date.now() });
  return events;
}

/**
 * Football league overview — today, yesterday, tomorrow.
 * Returns { live, upcoming, lastPlayed }.
 *
 * Infrastructure only — returns empty arrays until scoring logic is wired.
 */
export async function getLeagueOverview(_options) {
  const now = new Date();
  const dates = [-1, 0, 1].map(offset => {
    const d = new Date(now.getTime() + offset * 86_400_000);
    return d.toISOString().slice(0, 10);
  });

  try {
    const results = await Promise.all(dates.map(d => fetchTsdb(`eventsday.php?d=${d}&s=Soccer`)));
    const all = results
      .flatMap(r => r?.events ?? [])
      .map(normalizeFootballEvent)
      .filter(Boolean);

    const live = all.filter(g => g.status === "in_progress");
    const upcoming = all
      .filter(g => g.status === "scheduled")
      .sort((a, b) =>
        new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime()
      );
    const lastPlayed = all
      .filter(g => g.status === "final")
      .sort((a, b) =>
        new Date(b.startTimeIso ?? 0).getTime() - new Date(a.startTimeIso ?? 0).getTime()
      )[0] ?? null;

    return { live, upcoming, lastPlayed };
  } catch {
    return { live: [], upcoming: [], lastPlayed: null };
  }
}

/**
 * Football game detail by ID.
 * ID format: "tsdb-football:{idEvent}"
 */
export async function getGame(gameId) {
  const eventId = gameId.startsWith("tsdb-football:") ? gameId.slice(14) : gameId;
  const data = await fetchTsdb(`lookupevent.php?id=${eventId}`);
  const ev = data?.events?.[0];
  return ev ? normalizeFootballEvent(ev) : null;
}

/** Placeholder — football player game logs not yet implemented. */
export async function getPlayerGameLog(_playerId) {
  return [];
}

/** Placeholder — football team schedules not yet implemented. */
export async function getTeamSchedule(_teamId) {
  return [];
}

/** Returns list of known football competitions (for UI display). */
export function getKnownLeagues() {
  return KNOWN_LEAGUES;
}
