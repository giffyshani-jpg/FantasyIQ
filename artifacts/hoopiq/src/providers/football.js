// Football data provider — ESPN's public soccer scoreboard with a TheSportsDB fallback.
//
// Architecture:
//   Primary: ESPN site scoreboard/summary endpoints (free, no key, CORS-open)
//   Fallback: TheSportsDB (free, CORS-open, no auth required)
//
// Provider contract (same as all other providers):
//   getLeagueOverview(options) → { live, upcoming, lastPlayed }
//   getGame(gameId)            → Game | null
//   getGamesByDate(dateStr)    → Game[]
//   getPlayerGameLog(playerId) → []
//   getTeamSchedule(teamId)    → []
//
// Competition discovery uses active ESPN fixtures, then TheSportsDB's partial
// competition directory when the primary feed has no current match data.
//
import { recordSuccess, recordFailure } from "../lib/provider-health";

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const PROVIDER_NAME = "thesportsdb-football";
const ESPN_PROVIDER_NAME = "espn-football";
const COMPETITION_CACHE_TTL = 5 * 60 * 1000;
let competitionCache = null;

const GENERIC_SEASON_SLUGS = new Set([
  "season",
  "regular-season",
  "fall-season",
  "spring-season",
  "qualifying-round",
  "group-stage",
  "final-stage",
  "knockout-stage",
  "tournament",
  "apertura",
  "clausura",
  "torneo-apertura",
  "torneo-clausura",
]);
const ESPN_LEAGUE_NAMES = new Map();
const ESPN_LEAGUE_IN_FLIGHT = new Map();
const ESPN_LEAGUE_CACHE_TTL = 12 * 60 * 60 * 1000;

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

function optionalBoolean(...values) {
  const value = values.find((candidate) => candidate !== null && candidate !== undefined && candidate !== "");
  if (value === undefined) return null;
  if (value === true || value === 1 || String(value).toLowerCase() === "true" || String(value).toLowerCase() === "yes") return true;
  if (value === false || value === 0 || String(value).toLowerCase() === "false" || String(value).toLowerCase() === "no") return false;
  return null;
}

function mapFootballPosition(...values) {
  const positions = values
    .flatMap((value) => value && typeof value === "object"
      ? [value.abbreviation, value.displayName, value.name]
      : [value])
    .map((value) => optionalText(value)?.toLowerCase())
    .filter(Boolean);
  for (const position of positions) {
    if (["gk", "g", "goalkeeper"].includes(position) || position.includes("goal") || position.includes("keeper")) return "GK";
    if (
      ["d", "df", "cd", "cb", "lb", "rb", "lwb", "rwb", "sw", "cd-l", "cd-r"].includes(position) ||
      position.includes("def") ||
      position.includes("back")
    ) return "DEF";
    if (
      ["m", "mf", "cm", "dm", "am", "lm", "rm"].includes(position) ||
      position.includes("mid") ||
      position.includes("wing")
    ) return "MID";
    if (
      ["f", "fw", "st", "cf", "ss", "lw", "rw"].includes(position) ||
      position.includes("forward") ||
      position.includes("striker")
    ) return "FWD";
  }
  return null;
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function positionLabel(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  return optionalText(value.abbreviation, value.displayName, value.name);
}

function normalizeFootballPlayer(raw, team, source = "thesportsdb") {
  if (!raw || typeof raw !== "object") return null;
  const id = optionalText(raw.idPlayer, raw.id, raw.playerId);
  const name = optionalText(raw.strPlayer, raw.playerName, raw.name, raw.displayName, raw.fullName);
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
  const isStarter = source === "espn"
    ? optionalBoolean(raw.starter, raw.isStarter)
    : raw.isStarter === true || raw.isStarter === "true" || substitute === "no"
      ? true
      : raw.isStarter === false || raw.isStarter === "false" || substitute === "yes"
        ? false
        : null;
  const credits = source === "espn" ? null : number("credits", "credit", "strCredits", "salary", "price", "value");
  return {
    id: `${source}-football-player:${id}`,
    name,
    shortName: optionalText(raw.strPlayerShort, raw.shortName),
    position: mapFootballPosition(
      raw.strPosition,
      positionLabel(raw.position),
      raw.position?.displayName,
      raw.position?.name,
      raw.strRole,
    ),
    teamId: team.id,
    teamName: team.name,
    teamAbbreviation: team.abbreviation,
    isStarter,
    lineupStatus: isStarter === true ? "starter" : isStarter === false ? "bench" : "unknown",
    photoUrl: optionalText(raw.strCutout, raw.strThumb, raw.headshot?.href),
    credits,
    creditSource: credits === null ? null : "thesportsdb",
    isSetPieceTaker: optionalBoolean(
      raw.isSetPieceTaker,
      raw.setPieceTaker,
      raw.isSetPiece,
      raw.freeKickTaker,
    ),
    isPenaltyTaker: optionalBoolean(
      raw.isPenaltyTaker,
      raw.penaltyTaker,
      raw.isPenaltyKickTaker,
    ),
    stats,
    statsAvailable: Object.values(stats).some((value) => value !== null),
    source,
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
  if (s === "post" || s === "final" || s === "status_final" || s === "ft" || s === "aet" || s === "pen" || s.includes("finished")) return "final";
  if (s === "in" || s === "in_progress" || s === "status_in_progress" || s === "1h" || s === "2h" || s === "ht" || s === "et" || s === "live") return "in_progress";
  if (s === "pre" || s === "scheduled" || s === "status_scheduled" || s === "ns" || s === "" || s === "not started") return "scheduled";
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

// ── Cache and ESPN normalization ──────────────────────────────────────────────

const DAY_CACHE = new Map();
const DAY_IN_FLIGHT = new Map();
const GAME_CACHE = new Map();
const OVERVIEW_CACHE = new Map();
const OVERVIEW_IN_FLIGHT = new Map();
const DAY_CACHE_TTL = 3 * 60 * 1000;
const OVERVIEW_CACHE_TTL = 2 * 60 * 1000;

function getCachedDay(dateStr) {
  const entry = DAY_CACHE.get(dateStr);
  if (entry && Date.now() - entry.fetchedAt < DAY_CACHE_TTL) return entry.events;
  return null;
}

function espnLeagueId(event) {
  const uidId = event?.uid?.match(/~l:(\d+)/)?.[1];
  return optionalText(event?.league?.id, event?.competitions?.[0]?.league?.id, uidId);
}

function espnSeasonSlug(event) {
  return optionalText(event?.league?.slug, event?.season?.slug)?.toLowerCase();
}

function isGenericSeasonSlug(slug) {
  return !slug ||
    GENERIC_SEASON_SLUGS.has(slug) ||
    /^round-of-\d+$/.test(slug) ||
    /^tournament-stage/.test(slug);
}

function seasonSlugToName(slug) {
  if (!slug || isGenericSeasonSlug(slug)) return null;
  const name = slug
    .replace(/^\d{4}(?:-\d{2})?-/, "")
    .replace(/-/g, " ")
    .replace(/\bwomens\b/gi, "women's")
    .replace(/\b\w/g, (character) => character.toUpperCase());
  const knownNames = {
    "English Premier League": "English Premier League",
    "Laliga": "LaLiga",
    "Italian Serie A": "Italian Serie A",
    "German Bundesliga": "German Bundesliga",
    "French Ligue 1": "French Ligue 1",
    "Japanese J.League": "Japanese J.League",
    "Mls": "MLS",
    "Ncaa Division I Men": "NCAA Men's Soccer",
    "Ncaa Division I Women": "NCAA Women's Soccer",
    "Fifa World Cup": "FIFA World Cup",
    "Uefa Champions League": "UEFA Champions League",
    "Uefa Europa League": "UEFA Europa League",
  };
  return knownNames[name] ?? name;
}

async function resolveEspnLeague(event) {
  const league = event?.league ?? event?.competitions?.[0]?.league ?? null;
  const id = espnLeagueId(event);
  const slug = espnSeasonSlug(event);
  const slugName = seasonSlugToName(slug);
  const explicitName = optionalText(league?.name);

  if (id && explicitName) {
    const metadata = { id: `espn:${id}`, name: explicitName, badgeUrl: league?.logos?.[0]?.href ?? null };
    ESPN_LEAGUE_NAMES.set(id, { metadata, fetchedAt: Date.now() });
    return metadata;
  }
  if (id) {
    const cached = ESPN_LEAGUE_NAMES.get(id);
    if (cached && Date.now() - cached.fetchedAt < ESPN_LEAGUE_CACHE_TTL) return cached.metadata;
    const inFlight = ESPN_LEAGUE_IN_FLIGHT.get(id);
    if (inFlight) return inFlight;
  }
  if (id && slugName) {
    const metadata = { id: `espn:${id}`, name: slugName, badgeUrl: league?.logos?.[0]?.href ?? null };
    ESPN_LEAGUE_NAMES.set(id, { metadata, fetchedAt: Date.now() });
    return metadata;
  }

  const fallback = {
    id: id ? `espn:${id}` : `espn:${slug ?? "soccer"}`,
    name: slugName ?? (id ? `Football competition ${id}` : "Football"),
    badgeUrl: league?.logos?.[0]?.href ?? null,
  };
  const eventId = optionalText(event?.id);
  if (!id || !eventId) return fallback;

  const request = (async () => {
    try {
      const response = await fetch(
        `${ESPN_BASE}/all/summary?event=${encodeURIComponent(eventId)}`,
        { signal: AbortSignal.timeout(12_000) },
      );
      if (!response.ok) throw new Error(`ESPN league summary returned ${response.status}`);
      const summary = await response.json();
      const details = summary?.header?.league;
      const name = optionalText(details?.name);
      if (!name) return fallback;
      const metadata = {
        id: `espn:${optionalText(details?.id, id)}`,
        name,
        badgeUrl: details?.logos?.[0]?.href ?? null,
      };
      ESPN_LEAGUE_NAMES.set(id, { metadata, fetchedAt: Date.now() });
      return metadata;
    } catch {
      return fallback;
    }
  })();
  ESPN_LEAGUE_IN_FLIGHT.set(id, request);
  try {
    return await request;
  } finally {
    ESPN_LEAGUE_IN_FLIGHT.delete(id);
  }
}

function espnScore(value, status) {
  if (status === "scheduled") return null;
  return optionalText(value);
}

async function normalizeEspnEvent(event) {
  if (!event?.id || !Array.isArray(event.competitions)) return null;
  try {
    const competition = event.competitions[0];
    const competitors = competition?.competitors ?? [];
    const home = competitors.find((team) => team.homeAway === "home");
    const away = competitors.find((team) => team.homeAway === "away");
    if (!home?.team?.displayName || !away?.team?.displayName) return null;

    const statusInfo = competition?.status ?? event.status ?? {};
    const statusType = statusInfo.type ?? {};
    const state = String(statusType.state ?? "").toLowerCase();
    const status = state === "in"
      ? "in_progress"
      : state === "post"
        ? "final"
        : mapFootballStatus(statusType.name ?? statusType.detail ?? statusType.description);
    const [league, startTimeIso] = await Promise.all([
      resolveEspnLeague(event),
      (async () => {
        const dateValue = optionalText(event.date, competition?.date);
        if (!dateValue) return null;
        try { return new Date(dateValue).toISOString(); } catch { return null; }
      })(),
    ]);
    const scoreFor = (team) => espnScore(team.score, status);
    const homeTeam = {
      id: String(home.team.id ?? home.team.displayName),
      name: home.team.displayName,
      abbreviation: optionalText(home.team.abbreviation) ?? makeAbbreviation(home.team.displayName),
      score: scoreFor(home),
      badgeUrl: optionalText(home.team.logo, home.team.logos?.[0]?.href),
      yellowCards: null,
      redCards: null,
      penaltyScore: null,
      extraTimeScore: null,
    };
    const awayTeam = {
      id: String(away.team.id ?? away.team.displayName),
      name: away.team.displayName,
      abbreviation: optionalText(away.team.abbreviation) ?? makeAbbreviation(away.team.displayName),
      score: scoreFor(away),
      badgeUrl: optionalText(away.team.logo, away.team.logos?.[0]?.href),
      yellowCards: null,
      redCards: null,
      penaltyScore: null,
      extraTimeScore: null,
    };
    const venue = competition?.venue ?? {};
    const result = status === "final" && homeTeam.score !== null && awayTeam.score !== null
      ? `${homeTeam.name} ${homeTeam.score} - ${awayTeam.score} ${awayTeam.name}`
      : null;
    return {
      id: `espn-football:${event.id}`,
      leagueId: league.id,
      leagueName: league.name,
      leagueBadgeUrl: league.badgeUrl,
      homeTeam,
      awayTeam,
      startTimeIso,
      status,
      statusDetail: optionalText(statusType.shortDetail, statusType.detail, statusType.description),
      minute: status === "in_progress"
        ? optionalText(statusInfo.displayClock, statusType.shortDetail, statusType.detail)
        : null,
      venue: optionalText(venue.fullName, venue.name),
      country: optionalText(venue.address?.country, venue.country),
      city: optionalText(venue.address?.city, venue.city),
      result,
      league: "football",
      players: [],
      lineupAvailable: false,
      lineupStatus: "unavailable",
      lineupSource: null,
      playerStatsAvailable: false,
    };
  } catch {
    return null;
  }
}

function normalizeCompetitionList(data) {
  const discovered = (data?.leagues ?? [])
    .filter((league) => String(league.strSport ?? "").toLowerCase() === "soccer")
    .map((league) => ({
      id: String(league.idLeague),
      name: league.strLeague,
      sport: "Soccer",
    }))
    .filter((league) => league.id && league.name);
  const merged = new Map(
    KNOWN_LEAGUES.map((league) => [
      String(league.id),
      { id: String(league.id), name: league.name, sport: "Soccer" },
    ]),
  );
  for (const competition of discovered) merged.set(competition.id, competition);
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Public provider API ───────────────────────────────────────────────────────

export async function getCompetitions() {
  if (competitionCache && Date.now() - competitionCache.fetchedAt < COMPETITION_CACHE_TTL) {
    return competitionCache.competitions;
  }
  const overview = await getLeagueOverview();
  const activeGames = [...overview.live, ...overview.upcoming, ...overview.finished];
  const discovered = new Map();
  for (const game of activeGames) {
    discovered.set(String(game.leagueId), {
      id: String(game.leagueId),
      name: game.leagueName,
      sport: "Soccer",
    });
  }

  const result = discovered.size
    ? [...discovered.values()].sort((a, b) => a.name.localeCompare(b.name))
    : normalizeCompetitionList(await fetchTsdb("all_leagues.php"));
  competitionCache = { competitions: result, fetchedAt: Date.now() };
  return result;
}

/**
 * Fetches fixtures, live scores and results for a YYYY-MM-DD or YYYYMMDD date.
 * ESPN's open all-leagues scoreboard is primary; TheSportsDB remains fallback.
 */
export async function getGamesByDate(dateStr) {
  const normalized = dateStr.length === 8
    ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    : dateStr;
  const cached = getCachedDay(normalized);
  if (cached !== null) return cached;
  const pending = DAY_IN_FLIGHT.get(normalized);
  if (pending) return pending;

  const request = (async () => {
    const dateParam = normalized.replaceAll("-", "");
    let events = null;
    const startedAt = Date.now();
    try {
      const response = await fetch(
        `${ESPN_BASE}/all/scoreboard?dates=${encodeURIComponent(dateParam)}&limit=1000`,
        { signal: AbortSignal.timeout(12_000) },
      );
      if (!response.ok) throw new Error(`ESPN scoreboard returned ${response.status}`);
      const feed = await response.json();
      if (!Array.isArray(feed?.events)) throw new Error("ESPN scoreboard response did not include events");
      events = (await Promise.all(feed.events.map(normalizeEspnEvent))).filter(Boolean);
      recordSuccess(ESPN_PROVIDER_NAME, Date.now() - startedAt);
    } catch (error) {
      recordFailure(ESPN_PROVIDER_NAME, error instanceof Error ? error.message : "ESPN scoreboard failed");
    }

    // An empty ESPN matchday is not an outage. Still consult the fallback so
    // TheSportsDB events remain visible when it has data ESPN did not return.
    if (!events?.length) {
      const fallback = await fetchTsdb(`eventsday.php?d=${normalized}&s=Soccer`);
      events = (fallback?.events ?? []).map(normalizeFootballEvent).filter(Boolean);
    }
    const result = events ?? [];
    for (const game of result) GAME_CACHE.set(game.id, game);
    DAY_CACHE.set(normalized, { events: result, fetchedAt: Date.now() });
    return result;
  })();
  DAY_IN_FLIGHT.set(normalized, request);
  try {
    return await request;
  } finally {
    DAY_IN_FLIGHT.delete(normalized);
  }
}

/**
 * Football overview — yesterday, today and tomorrow.
 * Returns { live, upcoming, finished, lastPlayed }.
 */
export async function getLeagueOverview(options = {}) {
  const cacheKey = options.competitionId ? String(options.competitionId) : "all";
  const cached = OVERVIEW_CACHE.get(cacheKey);
  if (!options.noCache && cached && Date.now() - cached.fetchedAt < OVERVIEW_CACHE_TTL) {
    return cached.overview;
  }
  const pending = OVERVIEW_IN_FLIGHT.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    const now = new Date();
    const dates = [-1, 0, 1].map((offset) => {
      const date = new Date(now.getTime() + offset * 86_400_000);
      return date.toISOString().slice(0, 10);
    });
    const results = await Promise.all(dates.map(getGamesByDate));
    const all = results
      .flat()
      .filter((game) => !options.competitionId || String(game.leagueId) === String(options.competitionId));
    const live = all.filter((game) => game.status === "in_progress");
    const upcoming = all
      .filter((game) => game.status === "scheduled")
      .sort((a, b) => new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime());
    const finished = all
      .filter((game) => game.status === "final")
      .sort((a, b) => new Date(b.startTimeIso ?? 0).getTime() - new Date(a.startTimeIso ?? 0).getTime());
    return { live, upcoming, finished, lastPlayed: finished[0] ?? null };
  })();
  OVERVIEW_IN_FLIGHT.set(cacheKey, request);
  try {
    const overview = await request;
    if (!options.noCache) OVERVIEW_CACHE.set(cacheKey, { overview, fetchedAt: Date.now() });
    return overview;
  } finally {
    OVERVIEW_IN_FLIGHT.delete(cacheKey);
  }
}

function normalizeEspnRoster(game, rosterData) {
  const players = (rosterData ?? []).flatMap((roster) => {
    const rosterTeam = roster?.team ?? {};
    const team = [game.homeTeam, game.awayTeam].find((candidate) =>
      String(candidate.id) === String(rosterTeam.id) ||
      candidate.name === optionalText(rosterTeam.displayName, rosterTeam.name)
    );
    if (!team) return [];
    const rows = roster.roster ?? roster.athletes ?? [];
    return rows
      .map((row) => {
        const athlete = row?.athlete ?? row ?? {};
        return normalizeFootballPlayer({
          ...athlete,
          ...row,
          id: athlete.id ?? row?.id,
          position: row?.position ?? athlete.position,
          starter: row?.starter ?? row?.isStarter ?? athlete.starter,
          isStarter: row?.starter ?? row?.isStarter ?? athlete.isStarter,
          headshot: row?.headshot ?? athlete.headshot,
        }, team, "espn");
      })
      .filter(Boolean);
  });
  const uniquePlayers = players.filter((player, index) =>
    players.findIndex((candidate) => candidate.id === player.id) === index
  );
  const lineupConfirmed = uniquePlayers.some((player) => player.lineupStatus !== "unknown");
  return {
    ...game,
    players: uniquePlayers,
    homeTeam: { ...game.homeTeam, players: uniquePlayers.filter((player) => player.teamId === game.homeTeam.id) },
    awayTeam: { ...game.awayTeam, players: uniquePlayers.filter((player) => player.teamId === game.awayTeam.id) },
    lineupAvailable: lineupConfirmed,
    lineupStatus: lineupConfirmed ? "confirmed" : "unavailable",
    lineupSource: lineupConfirmed ? "espn" : null,
    playerStatsAvailable: uniquePlayers.some((player) => player.statsAvailable),
  };
}

/**
 * Football game detail by ID.
 * IDs are provider-prefixed to preserve old TheSportsDB deep links.
 */
export async function getGame(gameId) {
  if (gameId.startsWith("espn-football:")) {
    const cached = GAME_CACHE.get(gameId) ?? null;
    const eventId = gameId.slice("espn-football:".length);
    try {
      const response = await fetch(
        `${ESPN_BASE}/all/summary?event=${encodeURIComponent(eventId)}`,
        { signal: AbortSignal.timeout(12_000) },
      );
      if (!response.ok) throw new Error(`ESPN summary returned ${response.status}`);
      const summary = await response.json();
      const game = await normalizeEspnEvent(summary?.header);
      if (!game) return cached;
      const enriched = normalizeEspnRoster(game, summary?.rosters);
      GAME_CACHE.set(gameId, enriched);
      return enriched;
    } catch {
      return cached;
    }
  }

  const eventId = gameId.startsWith("tsdb-football:") ? gameId.slice(14) : gameId;
  const data = await fetchTsdb(`lookupevent.php?id=${eventId}`);
  const ev = data?.events?.[0];
  if (!ev) return null;
  const game = normalizeFootballEvent(ev);
  if (!game || game.players.length > 0) return game;

  // Use real team rosters only when the event feed omits players; squad members
  // stay unconfirmed rather than being presented as a match lineup.
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
