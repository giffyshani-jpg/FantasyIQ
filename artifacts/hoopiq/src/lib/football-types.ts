export type FootballMatchStatus = "scheduled" | "in_progress" | "final";

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
}

export interface FootballOverview {
  live: FootballGame[];
  upcoming: FootballGame[];
  finished: FootballGame[];
  lastPlayed: FootballGame | null;
}