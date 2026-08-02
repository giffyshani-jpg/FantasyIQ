export type FootballMatchStatus = "scheduled" | "in_progress" | "final";

export type FootballPosition = "GK" | "DEF" | "MID" | "FWD";

export type FootballMatchResult = "win" | "draw" | "loss" | null;

/**
 * Provider-supplied football match statistics.
 *
 * Every field is optional because TheSportsDB's free event feed commonly
 * returns no player statistics at all. Consumers must not replace null with
 * an estimate.
 */
export interface FootballPlayerStats {
  minutes?: number | null;
  goals?: number | null;
  assists?: number | null;
  cleanSheet?: boolean | null;
  goalsConceded?: number | null;
  saves?: number | null;
  penaltySaves?: number | null;
  tackles?: number | null;
  chancesCreated?: number | null;
  shotsOnTarget?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
  ownGoals?: number | null;
  penaltiesWon?: number | null;
  penaltiesConceded?: number | null;
  directFreeKickGoals?: number | null;
  matchResult?: FootballMatchResult;
}

export interface FootballPlayer {
  id: string;
  name: string;
  shortName?: string | null;
  position: FootballPosition | null;
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  isStarter: boolean | null;
  photoUrl?: string | null;
  credits: number | null;
  stats: FootballPlayerStats;
  /** True only when the provider supplied at least one player stat. */
  statsAvailable: boolean;
  source: "thesportsdb";
}

export interface FootballTeam {
  id: string;
  name: string;
  abbreviation: string;
  score: string | null;
  badgeUrl: string | null;
  yellowCards: number | null;
  redCards: number | null;
  penaltyScore: number | null;
  extraTimeScore: number | null;
  players?: FootballPlayer[];
}

export interface FootballGame {
  id: string;
  leagueId: number | string;
  leagueName: string;
  leagueBadgeUrl: string | null;
  homeTeam: FootballTeam;
  awayTeam: FootballTeam;
  startTimeIso: string | null;
  status: FootballMatchStatus;
  statusDetail: string | null;
  minute: string | null;
  venue: string | null;
  country: string | null;
  city: string | null;
  result: string | null;
  league: "football";
  players: FootballPlayer[];
  lineupAvailable: boolean;
  playerStatsAvailable: boolean;
}

export interface FootballOverview {
  live: FootballGame[];
  upcoming: FootballGame[];
  finished: FootballGame[];
  lastPlayed: FootballGame | null;
}