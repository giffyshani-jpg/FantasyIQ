// Official EuroLeague results provider.
// The official XML feed does not expose browser CORS, so requests go through
// the same-origin API server proxy at /api/euroleague/results.

const BASE = "/api/euroleague/results";
const LEAGUE = "euroleague";
let cache = { key: "", fetchedAt: 0, games: [] };

function parseDate(date, time) {
  const parsed = Date.parse(`${date} ${time} UTC`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function team(id, name, abbreviation, score) {
  return { id, name, abbreviation, score, players: [] };
}

function mapGame(raw) {
  const startTimeIso = parseDate(raw.date, raw.time);
  return {
    id: raw.id,
    league: LEAGUE,
    homeTeam: team(`${raw.gameCode}:home`, raw.homeTeam.name, raw.homeTeam.code, raw.homeTeam.score),
    awayTeam: team(`${raw.gameCode}:away`, raw.awayTeam.name, raw.awayTeam.code, raw.awayTeam.score),
    startTime: startTimeIso ?? `${raw.date} ${raw.time}`,
    startTimeIso,
    status: raw.played ? "final" : "scheduled",
    period: raw.played ? "Final" : undefined,
    clock: undefined,
    playByPlay: [],
  };
}

async function fetchResults(seasonCode = "E2026") {
  const key = seasonCode.toUpperCase();
  if (cache.key === key && Date.now() - cache.fetchedAt < 5 * 60 * 1000) return cache.games;
  const response = await fetch(`${BASE}?seasoncode=${encodeURIComponent(key)}`);
  if (!response.ok) throw new Error(`EuroLeague proxy returned ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("EuroLeague proxy returned an invalid response");
  const games = payload.map(mapGame);
  cache = { key, fetchedAt: Date.now(), games };
  return games;
}

export async function getLeagueOverview() {
  const games = await fetchResults();
  const now = Date.now();
  const live = games.filter((game) => game.status === "in_progress");
  const upcoming = games
    .filter((game) => game.status === "scheduled")
    .sort((a, b) => new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime());
  const finished = games
    .filter((game) => game.status === "final")
    .sort((a, b) => new Date(b.startTimeIso ?? 0).getTime() - new Date(a.startTimeIso ?? 0).getTime());
  return { live, upcoming: upcoming.filter((game) => new Date(game.startTimeIso ?? 0).getTime() >= now - 24 * 60 * 60 * 1000), finished, lastPlayed: finished[0] ?? null };
}

export async function getTodayGames() {
  const overview = await getLeagueOverview();
  return [...overview.live, ...overview.upcoming, ...overview.finished];
}

export async function getGamesByDate(dateStr) {
  const games = await fetchResults();
  const normalized = dateStr.length === 8 ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}` : dateStr;
  return games.filter((game) => game.startTimeIso?.slice(0, 10) === normalized);
}

export async function getGame(gameId) {
  const games = await fetchResults();
  return games.find((game) => game.id === gameId || game.id === `euroleague:${gameId}`) ?? null;
}

export async function getPlayerGameLog() { return []; }
export async function getTeamSchedule() { return []; }