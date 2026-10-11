const OVERVIEW_URL = "/api/cricket/overview";
const CLIENT_CACHE_TTL_MS = 2 * 60 * 1000;

let cache = { fetchedAt: 0, overview: null };
let inFlight = null;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value) {
  return (value || "cricket")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function normalizeStartTime(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const withZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function displayTime(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function formatFor(matchType, series) {
  const value = `${matchType} ${series}`.toLowerCase();
  if (/hundred/.test(value)) return "The Hundred";
  if (/test|first.?class|county championship|sheffield shield|ranji trophy/.test(value)) return "Test";
  if (/t10|abu.?dhabi.?t10/.test(value)) return "T10";
  if (/odi|one.?day|world.?cup(?!.*t20)|champions.?trophy/.test(value)) return "ODI";
  if (/t20|twenty.?20/.test(value)) return "T20";
  return "Other";
}

function normalizeStatus(matchStatus, statusText) {
  const providerStatus = text(matchStatus).toLowerCase();
  if (/^(live|in.?progress|started)$/.test(providerStatus)) return "in_progress";
  if (/^(result|final|completed|finished)$/.test(providerStatus)) return "final";
  if (/^(fixture|upcoming|scheduled)$/.test(providerStatus)) return "scheduled";

  const detail = text(statusText).toLowerCase();
  if (/won by|lost by|match tied|drawn|no result|abandoned|match finished/.test(detail)) {
    return "final";
  }
  if (/live|innings|day\s+\d|session|stumps|in progress/.test(detail)) {
    return "in_progress";
  }
  return "scheduled";
}

function normalizeTeam(rawName, rawScore, id) {
  const providerName = text(rawName);
  const abbreviationMatch = providerName.match(/\[([^\]]+)\]\s*$/);
  const name = providerName.replace(/\s*\[[^\]]+\]\s*$/, "").trim() || "Team";
  const scoreText = text(rawScore);
  const scoreMatch = scoreText.match(/(\d+\s*\/\s*\d+)/);
  const oversMatch = scoreText.match(/\(([^)]+)\)/);
  const overs = oversMatch?.[1]
    ?.replace(/\s*(?:overs?|ov)\s*$/i, "")
    .trim() || null;

  return {
    id,
    name,
    abbreviation: abbreviationMatch?.[1]?.trim().toUpperCase()
      || name.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase()
      || "UNK",
    score: scoreMatch?.[1]?.replace(/\s+/g, "") || scoreText || null,
    overs,
    players: [],
  };
}

function normalizeMatch(row) {
  if (!row || typeof row !== "object" || !text(row.id)) return null;

  const id = `cricapi:${text(row.id)}`;
  const competitionName = text(row.series) || "Cricket";
  const statusText = text(row.status);
  const status = normalizeStatus(row.matchStatus, statusText);
  const startTimeIso = normalizeStartTime(row.dateTimeGMT);

  return {
    id,
    competitionSlug: slugify(competitionName),
    competitionName,
    format: formatFor(text(row.matchType), competitionName),
    homeTeam: normalizeTeam(row.homeTeam, row.homeScore, `${id}:home`),
    awayTeam: normalizeTeam(row.awayTeam, row.awayScore, `${id}:away`),
    startTime: displayTime(startTimeIso),
    startTimeIso,
    status,
    period: status === "in_progress" ? statusText || "In Progress" : undefined,
    statusDetail: statusText || null,
    innings: [],
    result: status === "final" ? statusText || null : null,
    venue: null,
  };
}

function buildOverview(matches) {
  const now = Date.now();
  const unique = new Map();
  for (const match of matches) {
    if (match && !unique.has(match.id)) unique.set(match.id, match);
  }
  const games = [...unique.values()];

  const live = games.filter((game) => game.status === "in_progress");
  const upcoming = games
    .filter((game) => {
      if (game.status !== "scheduled") return false;
      if (!game.startTimeIso) return true;
      return new Date(game.startTimeIso).getTime() > now - 8 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime());

  const recentCutoff = now - 8 * 24 * 60 * 60 * 1000;
  const recentCompleted = games
    .filter((game) => game.status === "final"
      && game.startTimeIso
      && new Date(game.startTimeIso).getTime() >= recentCutoff)
    .sort((a, b) => new Date(b.startTimeIso).getTime() - new Date(a.startTimeIso).getTime());

  const activeCompetitions = [...new Set([
    ...live,
    ...upcoming,
    ...recentCompleted,
  ].map((game) => game.competitionName))];

  return {
    live,
    upcoming,
    lastPlayed: recentCompleted[0] ?? null,
    recentCompleted,
    activeCompetitions,
  };
}

async function fetchOverview() {
  const response = await fetch(OVERVIEW_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Cricket overview proxy returned ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload?.matches)) {
    throw new Error("Cricket overview proxy returned an invalid response");
  }
  return buildOverview(payload.matches.map(normalizeMatch));
}

export async function getLeagueOverview({ noCache = false } = {}) {
  if (!noCache && cache.overview && Date.now() - cache.fetchedAt < CLIENT_CACHE_TTL_MS) {
    return cache.overview;
  }
  if (inFlight) return inFlight;

  const request = fetchOverview()
    .then((overview) => {
      cache = { fetchedAt: Date.now(), overview };
      return overview;
    })
    .finally(() => {
      inFlight = null;
    });
  inFlight = request;
  return request;
}

export async function getGame(gameId, options) {
  const overview = await getLeagueOverview(options);
  return [
    ...overview.live,
    ...overview.upcoming,
    ...overview.recentCompleted,
  ].find((game) => game.id === gameId) ?? null;
}
