// Football data provider — TheSportsDB-backed live match data.
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
import { recordSuccess, recordFailure } from "../lib/provider-health";

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const PROVIDER_NAME = "thesportsdb-football";
const COMPETITION_CACHE_TTL = 30 * 60 * 1000;
let competitionCache = null;

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

function optionalNumber(...values) {
  const value = values.find((candidate) => candidate !== null && candidate !== undefined && candidate !== "");
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(...values) {
  const value = values.find((candidate) => typeof candidate === "string" && candidate.trim());
  return value ? value.trim() : null;
}

function mapFootballPosition(...values) {
  const position = optionalText(...values)?.toLowerCase() ?? "";
  if (position === "gk" || position.includes("goal") || position.includes("keeper")) return "GK";
  if (
    ["cb", "lb", "rb", "lwb", "rwb", "sw"].includes(position) ||
    position.includes("def") ||
    position.includes("back")
  ) return "DEF";
  if (
    ["cm", "dm", "am", "lm", "rm"].includes(position) ||
    position.includes("mid") ||
    position.includes("wing")
  ) return "MID";
  if (
    ["fw", "st", "cf", "ss", "lw", "rw"].includes(position) ||
    position.includes("forward") ||
    position.includes("striker")
  ) return "FWD";
  return null;
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function normalizeFootballPlayer(raw, team) {
  if (!raw || typeof raw !== "object") return null;
  const id = optionalText(raw.idPlayer, raw.id, raw.playerId);
  const name = optionalText(raw.strPlayer, raw.playerName, raw.name);
  if (!id || !name) return null;
  const number = (...keys) => optionalNumber(...keys.map((key) => raw[key]));
  const cleanSheet = number("intCleanSheet", "cleanSheet", "isCleanSheet");
  const stats = {
    minutes: number("intMinutes", "minutes"),
    goals: number("intGoals", "goals"),
    assists: number("intAssists", "assists"),
    cleanSheet: cleanSheet === null ? null : cleanSheet > 0,
    goalsConceded: number("intGoalsConceded", "goalsConceded"),
    saves: number("intSaves", "saves"),
    penaltySaves: number("intPenaltySaves", "penaltySaves"),
    tackles: number("intTackles", "tackles"),
    chancesCreated: number("intChancesCreated", "chancesCreated"),
    shotsOnTarget: number("intShotsOnTarget", "shotsOnTarget"),
    yellowCards: number("intYellowCards", "yellowCards"),
    redCards: number("intRedCards", "redCards"),
    ownGoals: number("intOwnGoals", "ownGoals"),
    penaltiesWon: number("intPenaltiesWon", "penaltiesWon"),
    penaltiesConceded: number("intPenaltiesConceded", "penaltiesConceded"),
    directFreeKickGoals: number("intDirectFreeKickGoals", "directFreeKickGoals"),
  };
  const substitute = optionalText(raw.strSubstitute, raw.substitute)?.toLowerCase();
  const isStarter =
    raw.isStarter === true || raw.isStarter === "true" || substitute === "no"
      ? true
      : raw.isStarter === false || raw.isStarter === "false" || substitute === "yes"
        ? false
        : null;
  const credits = number("credits", "credit", "strCredits", "salary", "price", "value");
  return {
    id: `tsdb-football-player:${id}`,
    name,
    shortName: optionalText(raw.strPlayerShort, raw.shortName),
    position: mapFootballPosition(raw.strPosition, raw.position, raw.strRole),
    teamId: team.id,
    teamName: team.name,
    teamAbbreviation: team.abbreviation,
    isStarter,
    lineupStatus: isStarter === true ? "starter" : isStarter === false ? "bench" : "unknown",
    photoUrl: optionalText(raw.strCutout, raw.strThumb),
    credits,
    creditSource: credits === null ? null : "thesportsdb",
    stats,
    statsAvailable: Object.values(stats).some((value) => value !== null),
    source: "thesportsdb",
  };
}

function extractFootballPlayers(ev, homeTeam, awayTeam) {
  const raw = parseMaybeJson(ev.lineup ?? ev.lineups ?? ev.players ?? ev.strLineup);
  if (!raw) return [];
  const players = [];
  const add = (items, team) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const player = normalizeFootballPlayer(item, team);
      if (player) players.push(player);
    }
  };
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const homeFlag = String(item?.strHome ?? item?.home ?? "").toLowerCase();
      add([item], homeFlag === "yes" || homeFlag === "true" ? homeTeam : awayTeam);
    }
  } else if (typeof raw === "object") {
    add(raw.home ?? raw.homeTeam ?? raw.strHomeTeam, homeTeam);
    add(raw.away ?? raw.awayTeam ?? raw.strAwayTeam, awayTeam);
    add(raw.players, homeTeam);
  }
  return players.filter((player, index, all) =>
    all.findIndex((candidate) => candidate.id === player.id) === index
  );
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
    const homeTeam = {
      id: String(ev.idHomeTeam || "h"),
      name: ev.strHomeTeam || "Home",
      abbreviation: makeAbbreviation(ev.strHomeTeam),
      score: ev.intHomeScore != null ? String(ev.intHomeScore) : null,
      badgeUrl: ev.strHomeTeamBadge || null,
      yellowCards: optionalNumber(ev.intHomeYellowCards, ev.strHomeYellowCards),
      redCards: optionalNumber(ev.intHomeRedCards, ev.strHomeRedCards),
      penaltyScore: optionalNumber(ev.intHomeScorePenalties, ev.intHomePenalties, ev.strHomeScorePenalties),
      extraTimeScore: optionalNumber(ev.intHomeScoreExtra, ev.intHomeScoreExtraTime, ev.strHomeScoreExtraTime),
    };
    const awayTeam = {
      id: String(ev.idAwayTeam || "a"),
      name: ev.strAwayTeam || "Away",
      abbreviation: makeAbbreviation(ev.strAwayTeam),
      score: ev.intAwayScore != null ? String(ev.intAwayScore) : null,
      badgeUrl: ev.strAwayTeamBadge || null,
      yellowCards: optionalNumber(ev.intAwayYellowCards, ev.strAwayYellowCards),
      redCards: optionalNumber(ev.intAwayRedCards, ev.strAwayRedCards),
      penaltyScore: optionalNumber(ev.intAwayScorePenalties, ev.intAwayPenalties, ev.strAwayScorePenalties),
      extraTimeScore: optionalNumber(ev.intAwayScoreExtra, ev.intAwayScoreExtraTime, ev.strAwayScoreExtraTime),
    };
    const players = extractFootballPlayers(ev, homeTeam, awayTeam);

    const lineupConfirmed = players.some((player) => player.lineupStatus !== "unknown");
    return {
      id: `tsdb-football:${ev.idEvent}`,
      leagueId: ev.idLeague,
      leagueName: ev.strLeague || "Football",
      leagueBadgeUrl: ev.strLeagueBadge || null,
      homeTeam: { ...homeTeam, players: players.filter((player) => player.teamId === homeTeam.id) },
      awayTeam: { ...awayTeam, players: players.filter((player) => player.teamId === awayTeam.id) },
      startTimeIso,
      status,
      statusDetail: optionalText(ev.strStatus),
      minute: optionalText(ev.strProgress, ev.strMinute, ev.intMinute),
      venue: ev.strVenue || null,
      country: ev.strCountry || null,
      city: ev.strCity || null,
      result: status === "final"
        ? `${ev.strHomeTeam} ${ev.intHomeScore ?? "?"} - ${ev.intAwayScore ?? "?"} ${ev.strAwayTeam}`
        : null,
      league: "football",
      players,
      lineupAvailable: lineupConfirmed,
      lineupStatus: lineupConfirmed ? "confirmed" : "unavailable",
      lineupSource: lineupConfirmed ? "thesportsdb" : null,
      playerStatsAvailable: players.some((player) => player.statsAvailable),
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

/**
 * TheSportsDB's league directory is the source of truth for football
 * competitions. The static list above is retained only as a degraded-mode
 * fallback when the directory request is unavailable.
 */
export async function getCompetitions() {
  if (competitionCache && Date.now() - competitionCache.fetchedAt < COMPETITION_CACHE_TTL) {
    return competitionCache.competitions;
  }

  const data = await fetchTsdb("all_leagues.php");
  const competitions = (data?.leagues ?? [])
    .filter((league) => String(league.strSport ?? "").toLowerCase() === "soccer")
    .map((league) => ({
      id: String(league.idLeague),
      name: league.strLeague,
      sport: "Soccer",
    }))
    .filter((league) => league.id && league.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  // The free directory can return a partial catalogue, so merge its live
  // results with the provider's bootstrap IDs without replacing discovery.
  const merged = new Map(
    KNOWN_LEAGUES.map((league) => [
      String(league.id),
      { id: String(league.id), name: league.name, sport: "Soccer" },
    ])
  );
  for (const competition of competitions) merged.set(competition.id, competition);
  const result = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  competitionCache = { competitions: result, fetchedAt: Date.now() };
  return result;
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
 * Returns { live, upcoming, finished, lastPlayed }.
 */
export async function getLeagueOverview(options = {}) {
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
      .filter(Boolean)
      .filter((game) => !options.competitionId || String(game.leagueId) === String(options.competitionId));

    const live = all.filter(g => g.status === "in_progress");
    const upcoming = all
      .filter(g => g.status === "scheduled")
      .sort((a, b) =>
        new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime()
      );
    const finished = all
      .filter(g => g.status === "final")
      .sort((a, b) =>
        new Date(b.startTimeIso ?? 0).getTime() - new Date(a.startTimeIso ?? 0).getTime()
      );

    return { live, upcoming, finished, lastPlayed: finished[0] ?? null };
  } catch {
    return { live: [], upcoming: [], finished: [], lastPlayed: null };
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
  if (!ev) return null;
  const game = normalizeFootballEvent(ev);
  if (!game || game.players.length > 0) return game;

  // Some competitions expose no event lineup, but do expose their current
  // team rosters. Use those real provider records as a pool, while keeping
  // starter status unknown rather than guessing it from a squad list.
  const teamIds = [game.homeTeam.id, game.awayTeam.id].filter(Boolean);
  const rosterResults = await Promise.all(
    teamIds.map(async (teamId) => {
      const roster = await fetchTsdb(`lookup_all_players.php?id=${teamId}`);
      const team = teamId === game.homeTeam.id ? game.homeTeam : game.awayTeam;
      return (roster?.player ?? [])
        .map((player) => normalizeFootballPlayer(player, team))
        .filter(Boolean);
    }),
  );
  const players = rosterResults.flat();
  if (!players.length) return game;
  return {
    ...game,
    players,
    homeTeam: { ...game.homeTeam, players: players.filter((player) => player.teamId === game.homeTeam.id) },
    awayTeam: { ...game.awayTeam, players: players.filter((player) => player.teamId === game.awayTeam.id) },
    lineupAvailable: false,
    lineupStatus: "unavailable",
    lineupSource: null,
    playerStatsAvailable: players.some((player) => player.statsAvailable),
  };
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
