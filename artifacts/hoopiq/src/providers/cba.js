// Chinese Basketball Association schedule provider.
//
// TheSportsDB's free public feed has schedule and completed-game records for
// Chinese CBA (league ID 4442), but does not provide live scores or player
// box-score statistics. Keep this adapter limited to data the feed supplies.

import { getGameFromTsdb, getLeagueOverviewFromTsdb } from "./thesportsdb";

const LEAGUE_ID = 4442;
const LEAGUE_KEY = "cba";

export async function getLeagueOverview() {
  return getLeagueOverviewFromTsdb(LEAGUE_ID, LEAGUE_KEY);
}

/**
 * TheSportsDB exposes only next/past league event lists, not a date query.
 * Return those real records; the shared API layer filters them by local date.
 */
export async function getGamesByDate() {
  const overview = await getLeagueOverview();
  return [
    ...(overview.live ?? []),
    ...(overview.upcoming ?? []),
    ...(overview.lastPlayed ? [overview.lastPlayed] : []),
  ];
}

export async function getGame(gameId) {
  return getGameFromTsdb(gameId, LEAGUE_KEY);
}

export async function getPlayerGameLog() {
  return [];
}

export async function getTeamSchedule() {
  return [];
}
