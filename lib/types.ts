export type Match = {
  id: number;
  external_id: string;
  competition: string;
  season: string | null;
  stage: string | null;
  group_name: string | null;
  matchday: number | null;
  home_team: string;
  home_code: string | null;
  home_flag: string | null;
  away_team: string;
  away_code: string | null;
  away_flag: string | null;
  home_score: number | null;
  away_score: number | null;
  status: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED";
  minute: string | null;
  utc_kickoff: string | null;
  venue: string | null;
};

export type Prediction = {
  id: number;
  user_id: string;
  match_id: number;
  pred_home: number;
  pred_away: number;
  points_awarded: number;
  scored: boolean;
};

export type League = {
  id: number;
  name: string;
  code: string;
  owner_id: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  max_matches: number | null;
  punishment: string | null;
};

export type CompetitionMatchInput = {
  homeTeam: string;
  homeCode?: string | null;
  homeFlag?: string | null;
  awayTeam: string;
  awayCode?: string | null;
  awayFlag?: string | null;
  kickoffIso: string;
};

export type CompetitionMatch = {
  ordinal: number;
  match: Match;
};

export const isLive = (s: Match["status"]) => s === "IN_PLAY" || s === "PAUSED";
export const isFinished = (s: Match["status"]) => s === "FINISHED";
export const isUpcoming = (s: Match["status"]) =>
  s === "SCHEDULED" || s === "TIMED" || s === "POSTPONED";
